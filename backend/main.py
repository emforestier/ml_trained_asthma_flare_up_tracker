from datetime import timedelta
from zoneinfo import ZoneInfo
from datetime import datetime, timezone
from pymongo.errors import PyMongoError
from backend.db import get_db, DatabaseUnavailable
import requests
from backend.environment import fetch_environment
import json
from pathlib import Path
from datetime import date as Date
from pydantic import BaseModel, Field, model_validator
from fastapi import FastAPI, HTTPException

app = FastAPI()
CONTRACTS_DIR = (
    Path(__file__).resolve().parent.parent / "contracts"
)


def load_sample(name):
    file_path = CONTRACTS_DIR / f"{name}.json"

    with file_path.open(encoding="utf-8-sig") as file:
        return json.load(file)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/environment")
def get_environment(user: str = "demo-user-1"):
    try:
        return fetch_environment()

    except (
        requests.RequestException,
        ValueError,
        KeyError,
        TypeError,
    ):
        raise HTTPException(
            status_code=503,
            detail=(
                "Environmental data is temporarily unavailable. "
                "Please try again shortly."
            ),
        )


@app.get("/risk")
def get_risk(user: str = "demo-user-1"):
    return load_sample("risk")


@app.get("/triggers")
def get_triggers(user: str = "demo-user-1"):
    return load_sample("triggers")


@app.get("/summary")
def get_summary(user: str = "demo-user-1"):
    return load_sample("summary")


@app.get("/log")
def get_log(user: str = "demo-user-1"):
    try:
        db = get_db()

        entries = list(
            db.daily_logs.find(
                {"user": user},
                {"_id": 0},
            ).sort("date", -1)
        )

    except (DatabaseUnavailable, PyMongoError):
        raise HTTPException(
            status_code=503,
            detail="Could not load saved check-ins. Please try again.",
        )

    # Count distinct dates, not the number of Save button clicks.
    logged_dates = {entry["date"] for entry in entries}

    today = datetime.now(
        ZoneInfo("America/New_York")
    ).date()

    # Keep yesterday's streak active until today has passed.
    cursor = today
    if cursor.isoformat() not in logged_dates:
        cursor -= timedelta(days=1)

    streak = 0
    while cursor.isoformat() in logged_dates:
        streak += 1
        cursor -= timedelta(days=1)

    return {
        "user": user,
        "data_mode": "saved_logs",
        "storage": "mongodb",
        "days_logged": len(logged_dates),
        "streak": streak,
        "entries": entries,
        "xp": 0,
        "xp_status": "managed_by_frontend",
        "accuracy": {
            "correct": 0,
            "total": 0,
        },
        "accuracy_status": "not_calculated",
        "last_prediction": None,
    }




class Symptoms(BaseModel):
    breath: int = Field(ge=0, le=3, strict=True)
    wheeze: int = Field(ge=0, le=3, strict=True)
    cough: int = Field(ge=0, le=3, strict=True)


class DailyLog(BaseModel):
    user: str = Field(min_length=1)
    date: Date

    puffs: int = Field(ge=0, strict=True)
    pre_exercise_puffs: int = Field(ge=0, strict=True)

    symptoms: Symptoms
    night_waking: bool = Field(strict=True)
    emergency_signs: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def check_puff_counts(self):
        if self.pre_exercise_puffs > self.puffs:
            raise ValueError(
                "Pre-exercise puffs cannot exceed total rescue puffs."
            )
        return self


@app.post("/log")
def receive_log(log: DailyLog):
    # Convert the validated check-in into a database record.
    # mode="json" converts its date to a YYYY-MM-DD string.
    record = log.model_dump(mode="json")
            # Only attach current conditions to a check-in for today.
    today = datetime.now(
        ZoneInfo("America/New_York")
    ).date()

    if log.date == today:
        try:
            environment = get_environment(user=log.user)

            if environment.get("valid_for") == log.date.isoformat():
                record["environment"] = environment
                record["environment_status"] = (
                    "snapshot_at_check_in"
                )
            else:
                record["environment"] = None
                record["environment_status"] = (
                    "unavailable_for_requested_date"
                )

        except HTTPException:
            # A weather-service failure should not prevent
            # the person from saving their symptoms.
            record["environment"] = None
            record["environment_status"] = (
                "temporarily_unavailable"
            )
    else:
        record["environment"] = None
        record["environment_status"] = (
            "historical_conditions_not_connected"
        )

    record["eligible_rescue_puffs"] = (
        log.puffs - log.pre_exercise_puffs
    )

    record["symptom_total"] = (
        log.symptoms.breath
        + log.symptoms.wheeze
        + log.symptoms.cough
    )

    now = datetime.now(timezone.utc).isoformat()
    record["updated_at"] = now

    # This combination identifies one person's one-day check-in.
    lookup = {
        "user": record["user"],
        "date": record["date"],
    }

    try:
        db = get_db()
                # Keep the previous snapshot if this request
        # could not obtain environmental information.
        if record.get("environment") is None:
            existing = db.daily_logs.find_one(
                lookup,
                {
                    "_id": 0,
                    "environment": 1,
                    "environment_status": 1,
                },
            )

            if existing and existing.get("environment") is not None:
                record["environment"] = existing["environment"]
                record["environment_status"] = existing.get(
                    "environment_status",
                    "snapshot_at_check_in",
                )



        result = db.daily_logs.update_one(
            lookup,
            {
                "$set": record,
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )

        if not result.acknowledged:
            raise HTTPException(
                status_code=503,
                detail="The database did not confirm the save.",
            )

    except (DatabaseUnavailable, PyMongoError):
        raise HTTPException(
            status_code=503,
            detail=(
                "Could not confirm that the check-in was saved. "
                "Please retry using the same user and date."
            ),
        )

    return {
        "status": "saved",
        "saved": True,
        "storage": "mongodb",
        "operation": (
            "created"
            if result.upserted_id is not None
            else "updated"
        ),
        "message": "Your check-in was saved.",
        "log": record,
    }

class SurveyAnswers(BaseModel):
    nickname: str = Field(min_length=1, max_length=20)
    city: str = Field(min_length=1)
    rescueDays: str = Field(min_length=1)
    puffsPerDay: str = Field(min_length=1)
    nightWaking: str = Field(min_length=1)
    controller: str = Field(min_length=1)
    preExercise: str = Field(min_length=1)


class ProfileRequest(BaseModel):
    user: str = Field(min_length=1)
    nickname: str = Field(min_length=1, max_length=20)
    city: str = Field(min_length=1)
    companion_name: str = Field(min_length=1)
    survey: SurveyAnswers
    baseline_estimate: float | None = Field(
        default=None,
        ge=0,
        allow_inf_nan=False
    )


@app.post("/profile")
def receive_profile(profile: ProfileRequest):
    raise HTTPException(
        status_code=501,
        detail={
            "status": "validated_not_saved",
            "saved": False,
            "message": (
                "Profile format is valid, but storage "
                "is not connected yet."
            ),
            "received": profile.model_dump(mode="json")
        }
    )

class FeedbackRequest(BaseModel):
    user: str = Field(min_length=1)
    date: Date
    predicted_risk: float = Field(
        ge=0,
        le=1,
        allow_inf_nan=False
    )
    had_flare_up: bool = Field(strict=True)


@app.post("/feedback")
def receive_feedback(feedback: FeedbackRequest):
    raise HTTPException(
        status_code=501,
        detail={
            "status": "validated_not_saved",
            "saved": False,
            "message": (
                "Feedback format is valid, but storage "
                "is not connected yet."
            ),
            "received": feedback.model_dump(mode="json")
        }
    )

