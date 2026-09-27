from datetime import datetime, timezone

from backend.local_storage import (
    read_local_logs,
    save_local_log,
)


def main():
    user = "local-storage-test-user"

    record = {
        "user": user,
        "date": "2026-09-26",
        "puffs": 3,
        "pre_exercise_puffs": 1,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "environment": {
            "source": "fictional storage test",
        },
        "environment_status": "test_snapshot",
    }

    save_local_log(record)

    # Update the same day without a new environmental snapshot.
    record["puffs"] = 5
    record["environment"] = None
    record["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = save_local_log(record)
    entries = read_local_logs(user)

    assert result["operation"] == "updated"
    assert len(entries) == 1
    assert entries[0]["puffs"] == 5
    assert entries[0]["environment"] == {
        "source": "fictional storage test"
    }

    print("[OK] Local check-in saved.")
    print("[OK] Updating the same day did not create a duplicate.")
    print("[OK] Existing environmental snapshot was preserved.")


if __name__ == "__main__":
    main()