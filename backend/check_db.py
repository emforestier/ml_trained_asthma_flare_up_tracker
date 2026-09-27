"""Step 8 check: connect to MongoDB Atlas, create the collections, then save and read back a
fictional record. Run from the repository's main folder:

    .\\.venv\\Scripts\\python.exe -m backend.check_db
"""

import sys
from datetime import datetime, timezone

from backend.db import DatabaseUnavailable, get_db, ping, setup_collections

FICTIONAL_PROFILE = {
    "user": "demo-user-1",
    "nickname": "Sam",
    "city": "Gainesville, FL",
    "companion_name": "Breezy",
    "fictional": True,
    "note": "Connection check record. Fictional prototype data.",
}


def main():
    status = ping()
    if not status["ok"]:
        print("[FAILED] Could not connect to MongoDB.")
        print("  " + status["error"])
        return 1
    print(f"[OK] Connected to MongoDB (database: {status['database']})")

    try:
        collections = setup_collections()
        print("[OK] Collections ready: " + ", ".join(collections))

        db = get_db()
        record = {**FICTIONAL_PROFILE, "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
        # Upsert: running this again updates the same record instead of adding a duplicate.
        db.profiles.update_one({"user": record["user"]}, {"$set": record}, upsert=True)
        saved = db.profiles.find_one({"user": record["user"]}, {"_id": 0})
        print(f"[OK] Saved and read back a fictional profile: {saved['nickname']} ({saved['user']}), checked at {saved['checked_at']}")
        print(f"[OK] Profiles for demo-user-1: {db.profiles.count_documents({'user': 'demo-user-1'})} (upsert keeps it at one)")
    except DatabaseUnavailable as error:
        print("[FAILED] " + str(error))
        return 1
    print("Step 8 is working.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
