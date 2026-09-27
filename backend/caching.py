"""Caching and fallback for outside services (build guide, step 7).

Two pieces:

* ``fetch_json`` calls a URL with a timeout and a small number of retries, so one slow or
  failed request does not hang the app.
* ``cached_with_fallback`` reuses a recent response for up to an hour and, when the service
  is down, falls back to the last good response and then to a saved demo file.

Every response it returns is labeled with where it came from, so an old response is never
presented as live data:

    data_mode    "live", "cached", "last_good" or "saved_demo"
    fetched_at   when the data was actually fetched (kept from the original, never reset)
    valid_for    the local date the data describes
    is_stale     True whenever the data did not come from a recent successful fetch
    cache        details: age in seconds and, for fallbacks, why the fallback was used

Example, once ``get_environment`` (step 6) exists::

    @app.get("/environment")
    def environment(user: str = "demo-user-1"):
        return cached_with_fallback(
            "environment",
            lambda: get_environment(CITY, today()),
            fallback=lambda: load_sample("environment"),
        )
"""

import copy
import json
import threading
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

CITY_TIME_ZONE = ZoneInfo("America/New_York")
CACHE_SECONDS = 60 * 60  # reuse a response for up to one hour
REQUEST_TIMEOUT_SECONDS = 8
RETRIES = 2  # extra attempts after the first one
RETRY_WAIT_SECONDS = 0.5

# Last good responses are saved here so a restart without internet can still show them.
CACHE_DIR = Path(__file__).resolve().parent / "data" / "cache"

_memory = {}
_lock = threading.Lock()


class FetchError(Exception):
    """An outside service could not be reached or returned an error."""

    def __init__(self, message, retryable=True):
        super().__init__(message)
        self.retryable = retryable


def fetch_json(url, params=None, *, timeout=REQUEST_TIMEOUT_SECONDS, retries=RETRIES, wait=RETRY_WAIT_SECONDS, session=None):
    """GET a JSON response, retrying a few times on network errors and server errors.

    Client errors (4xx) are not retried, because asking again would not change the answer.
    Raises FetchError when every attempt fails.
    """
    http = session or requests
    last_error = None
    for attempt in range(retries + 1):
        try:
            response = http.get(url, params=params, timeout=timeout)
            if response.status_code >= 500:
                raise FetchError(f"{url} returned {response.status_code}")
            if response.status_code >= 400:
                raise FetchError(f"{url} returned {response.status_code}: {response.text[:200]}", retryable=False)
            return response.json()
        except FetchError as error:
            last_error = error
            if not error.retryable:
                break
        except (requests.RequestException, ValueError) as error:
            last_error = error
        if attempt < retries:
            time.sleep(wait * (attempt + 1))
    raise FetchError(f"Could not fetch {url} after {retries + 1} attempts: {last_error}") from last_error


def local_now():
    return datetime.now(CITY_TIME_ZONE)


def _label(data, *, mode, fetched_at, valid_for, is_stale, age_seconds, reason=None):
    labeled = copy.deepcopy(data)
    labeled["data_mode"] = mode
    labeled["fetched_at"] = fetched_at
    labeled["valid_for"] = valid_for
    labeled["is_stale"] = is_stale
    labeled["cache"] = {"age_seconds": None if age_seconds is None else round(age_seconds)}
    if reason:
        labeled["cache"]["fallback_reason"] = reason
    return labeled


def _disk_path(key):
    return CACHE_DIR / f"{key}.json"


def _save_to_disk(key, entry):
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        temporary = _disk_path(key).with_suffix(".tmp")
        temporary.write_text(json.dumps(entry), encoding="utf-8")
        temporary.replace(_disk_path(key))
    except OSError:
        pass  # Caching to disk is a convenience; the response still works without it.


def _load_from_disk(key):
    try:
        return json.loads(_disk_path(key).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def cached_with_fallback(key, fetch, *, fallback=None, max_age=CACHE_SECONDS, clock=time.time, now=local_now):
    """Return fresh, cached or fallback data for ``key``, always labeled with its source.

    ``fetch`` returns a dict of fresh data or raises. ``fallback`` returns saved demo data.
    Order: recent cache → fresh fetch → last good response (memory, then disk) → saved demo.
    """
    today = now().date().isoformat()

    with _lock:
        entry = _memory.get(key) or _load_from_disk(key)
        if entry:
            _memory[key] = entry

    # 1. A recent response for today is reused instead of calling the service again.
    if entry:
        age = clock() - entry["stored_at"]
        if age < max_age and entry["valid_for"] == today:
            return _label(entry["data"], mode="cached", fetched_at=entry["fetched_at"], valid_for=entry["valid_for"], is_stale=False, age_seconds=age)

    # 2. Otherwise fetch fresh data.
    try:
        data = fetch()
        fetched_at = now().isoformat(timespec="seconds")
        new_entry = {"data": data, "fetched_at": fetched_at, "valid_for": today, "stored_at": clock()}
        with _lock:
            _memory[key] = new_entry
        _save_to_disk(key, new_entry)
        return _label(data, mode="live", fetched_at=fetched_at, valid_for=today, is_stale=False, age_seconds=0)
    except Exception as error:  # noqa: BLE001 - any failure should fall back, not crash
        reason = f"{type(error).__name__}: {error}"[:300]

    # 3. The service failed: the last good response, clearly marked as stale.
    if entry:
        age = clock() - entry["stored_at"]
        return _label(entry["data"], mode="last_good", fetched_at=entry["fetched_at"], valid_for=entry["valid_for"], is_stale=True, age_seconds=age, reason=reason)

    # 4. Nothing saved yet: the saved demo response, marked as stale and never as live.
    if fallback is not None:
        saved = fallback()
        return _label(
            saved,
            mode="saved_demo",
            fetched_at=saved.get("fetched_at"),
            valid_for=saved.get("valid_for"),
            is_stale=True,
            age_seconds=None,
            reason=reason,
        )
    raise FetchError(f"{key} unavailable and no fallback configured: {reason}")


def clear_cache(key=None):
    """Forget cached responses (all of them, or one key), in memory and on disk."""
    with _lock:
        keys = [key] if key else list(_memory)
        for name in keys:
            _memory.pop(name, None)
            try:
                _disk_path(name).unlink()
            except OSError:
                pass
        if key is None and CACHE_DIR.exists():
            for path in CACHE_DIR.glob("*.json"):
                path.unlink(missing_ok=True)
