"""MongoDB Atlas connection and collections (build guide, step 8).

The connection string comes from MONGODB_URI in the .env file at the repository's main folder,
never from code. Collections:

    profiles      one document per user                      unique on user
    daily_logs    one check-in per user per local date        unique on (user, date)
    predictions   one prediction per user per predicted date  unique on (user, prediction_for)
    feedback      one reported outcome per user per date      unique on (user, date)

The unique indexes are what make "saving again updates the day instead of duplicating it"
(step 9) safe even if the Save button is double-clicked. Dates are stored as "YYYY-MM-DD"
strings in the city's time zone.

Check the connection with:

    .\\.venv\\Scripts\\python.exe -m backend.check_db
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import ASCENDING, MongoClient
from pymongo.errors import ConfigurationError, OperationFailure, PyMongoError, ServerSelectionTimeoutError

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

DEFAULT_DB_NAME = "asthma_demo"
CONNECT_TIMEOUT_MS = 5000

COLLECTIONS = {
    "profiles": [("user", ASCENDING)],
    "daily_logs": [("user", ASCENDING), ("date", ASCENDING)],
    "predictions": [("user", ASCENDING), ("prediction_for", ASCENDING)],
    "feedback": [("user", ASCENDING), ("date", ASCENDING)],
}

_client = None


class DatabaseUnavailable(Exception):
    """MongoDB is not configured or cannot be reached. The message says how to fix it."""


def _explain(error):
    text = str(error)
    if isinstance(error, OperationFailure) and ("auth" in text.lower() or error.code == 18):
        return "MongoDB rejected the username or password in MONGODB_URI. Check the database user in Atlas (Database Access)."
    if isinstance(error, ServerSelectionTimeoutError):
        return (
            "Could not reach MongoDB Atlas. Usually this computer's IP address isn't allowed yet: "
            "in Atlas, open Network Access and add your current IP address. Recheck this on the presentation network."
        )
    if isinstance(error, ConfigurationError):
        return f"MONGODB_URI looks malformed: {text}"
    return f"MongoDB error: {text}"


def get_client():
    """One shared client for the whole app. Raises DatabaseUnavailable with a helpful message."""
    global _client
    if _client is None:
        uri = os.getenv("MONGODB_URI", "").strip()
        if not uri:
            raise DatabaseUnavailable("MONGODB_URI is not set. Add it to the .env file in the repository's main folder (see .env.example).")
        try:
            _client = MongoClient(uri, serverSelectionTimeoutMS=CONNECT_TIMEOUT_MS, appname="asthma-demo-backend")
        except PyMongoError as error:
            raise DatabaseUnavailable(_explain(error)) from error
    return _client


def get_db():
    return get_client()[os.getenv("MONGODB_DB", DEFAULT_DB_NAME)]


def setup_collections(db=None):
    """Create any missing collections and their unique indexes. Safe to run more than once."""
    db = db if db is not None else get_db()
    try:
        existing = set(db.list_collection_names())
        for name, keys in COLLECTIONS.items():
            if name not in existing:
                db.create_collection(name)
            db[name].create_index(keys, unique=True, name="unique_" + "_".join(field for field, _ in keys))
    except PyMongoError as error:
        raise DatabaseUnavailable(_explain(error)) from error
    return sorted(COLLECTIONS)


def ping():
    """Returns {"ok": True} or {"ok": False, "error": "<how to fix it>"} without raising."""
    try:
        get_client().admin.command("ping")
        return {"ok": True, "database": get_db().name}
    except DatabaseUnavailable as error:
        return {"ok": False, "error": str(error)}
    except PyMongoError as error:
        return {"ok": False, "error": _explain(error)}
