import json
import sqlite3
from pathlib import Path


DB_PATH = (
    Path(__file__).resolve().parent
    / "data"
    / "local_checkins.sqlite3"
)


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(DB_PATH, timeout=5)

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS daily_logs (
            user TEXT NOT NULL,
            date TEXT NOT NULL,
            document TEXT NOT NULL,
            PRIMARY KEY (user, date)
        )
        """
    )
    connection.commit()

    return connection


def save_local_log(record):
    connection = connect()

    try:
        # Keep each save and its snapshot-preservation check
        # together, even if two requests arrive at once.
        connection.execute("BEGIN IMMEDIATE")

        existing_row = connection.execute(
            """
            SELECT document
            FROM daily_logs
            WHERE user = ? AND date = ?
            """,
            (record["user"], record["date"]),
        ).fetchone()

        saved = dict(record)

        if existing_row:
            existing = json.loads(existing_row[0])

            saved["created_at"] = existing.get(
                "created_at",
                saved.get("updated_at"),
            )

            if (
                saved.get("environment") is None
                and existing.get("environment") is not None
            ):
                saved["environment"] = existing["environment"]
                saved["environment_status"] = existing.get(
                    "environment_status",
                    "snapshot_at_check_in",
                )
        else:
            saved.setdefault(
                "created_at",
                saved.get("updated_at"),
            )

        connection.execute(
            """
            INSERT INTO daily_logs (user, date, document)
            VALUES (?, ?, ?)
            ON CONFLICT(user, date)
            DO UPDATE SET document = excluded.document
            """,
            (
                saved["user"],
                saved["date"],
                json.dumps(saved),
            ),
        )

        connection.commit()

        return {
            "record": saved,
            "operation": "updated" if existing_row else "created",
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


def read_local_logs(user):
    connection = connect()

    try:
        rows = connection.execute(
            """
            SELECT document
            FROM daily_logs
            WHERE user = ?
            ORDER BY date DESC
            """,
            (user,),
        ).fetchall()

        return [json.loads(row[0]) for row in rows]

    finally:
        connection.close()