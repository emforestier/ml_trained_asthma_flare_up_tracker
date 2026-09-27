import os
from datetime import datetime, timezone

from pymongo import timeout
from pymongo.errors import PyMongoError

from backend.db import get_db, DatabaseUnavailable
from backend.local_storage import read_local_logs, save_local_log


def local_only():
    # A switch for testing without changing database credentials.
    return os.getenv("LOCAL_ONLY", "").lower() == "true"


def timestamp(record):
    value = record.get("updated_at")

    if not value:
        return datetime.min.replace(tzinfo=timezone.utc)

    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


def read_logs(user):
    local_entries = read_local_logs(user)
    remote_entries = []
    mongo_available = False

    if not local_only():
        try:
            with timeout(2):
                remote_entries = list(
                    get_db().daily_logs.find(
                        {"user": user},
                        {"_id": 0},
                    )
                )
            mongo_available = True
        except (DatabaseUnavailable, PyMongoError):
            pass

    # One result per date. Keep the most recently updated version.
    combined = {}

    for entry in remote_entries + local_entries:
        existing = combined.get(entry["date"])

        if existing is None or timestamp(entry) >= timestamp(existing):
            combined[entry["date"]] = entry

    entries = sorted(
        combined.values(),
        key=lambda entry: entry["date"],
        reverse=True,
    )

    return entries, mongo_available


def save_log(record):
    existing_entries, _ = read_logs(record["user"])

    previous = next(
        (
            entry
            for entry in existing_entries
            if entry["date"] == record["date"]
        ),
        None,
    )

    record = dict(record)

    if previous:
        record["created_at"] = previous.get(
            "created_at", record["updated_at"]
        )

        if (
            record.get("environment") is None
            and previous.get("environment") is not None
        ):
            record["environment"] = previous["environment"]
            record["environment_status"] = previous.get(
                "environment_status",
                "snapshot_at_check_in",
            )

    # Save locally before attempting the cloud write.
    local_result = save_local_log(record)
    saved_record = local_result["record"]
    mongo_confirmed = False

    if not local_only():
        try:
            with timeout(2):
                result = get_db().daily_logs.update_one(
                    {
                        "user": saved_record["user"],
                        "date": saved_record["date"],
                    },
                    {"$set": saved_record},
                    upsert=True,
                )
                mongo_confirmed = result.acknowledged
        except (DatabaseUnavailable, PyMongoError):
            pass

    return {
        "status": "saved",
        "saved": True,
        "storage": (
            "mongodb_and_local"
            if mongo_confirmed
            else "local"
        ),
        "cloud_save_confirmed": mongo_confirmed,
        "operation": "updated" if previous else "created",
        "message": (
            "Check-in saved to MongoDB and this computer."
            if mongo_confirmed
            else "Check-in saved on this computer. Cloud save not confirmed."
        ),
        "log": saved_record,
    }