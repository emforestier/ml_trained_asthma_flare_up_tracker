"""Tests for caching and fallback (build guide, step 7). Run from the repository folder:

    .\\.venv\\Scripts\\python.exe -m pytest backend/tests
"""

from datetime import datetime

import pytest
import requests

from backend import caching
from backend.caching import FetchError, cached_with_fallback, fetch_json

TZ = caching.CITY_TIME_ZONE
SAMPLE = {"city": "Gainesville, FL", "fetched_at": "2026-09-27T08:00:00-04:00", "valid_for": "2026-09-27", "current": {"temperature_c": 27}}


class FakeClock:
    def __init__(self, start=1_000_000.0):
        self.t = start

    def __call__(self):
        return self.t


@pytest.fixture(autouse=True)
def isolated_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(caching, "CACHE_DIR", tmp_path / "cache")
    caching._memory.clear()
    yield
    caching._memory.clear()


def fixed_now(day=26, hour=9):
    return lambda: datetime(2026, 9, day, hour, 0, tzinfo=TZ)


def offline():
    raise requests.ConnectionError("no internet")


def test_fresh_fetch_is_labeled_live():
    result = cached_with_fallback("env", lambda: {"current": {"temperature_c": 25}}, clock=FakeClock(), now=fixed_now())
    assert result["data_mode"] == "live"
    assert result["is_stale"] is False
    assert result["valid_for"] == "2026-09-26"
    assert result["fetched_at"].startswith("2026-09-26T09:00")


def test_recent_response_is_reused_without_calling_the_service():
    clock = FakeClock()
    calls = []
    fetch = lambda: calls.append(1) or {"current": {"temperature_c": 25}}
    cached_with_fallback("env", fetch, clock=clock, now=fixed_now())
    clock.t += 30 * 60
    result = cached_with_fallback("env", fetch, clock=clock, now=fixed_now())
    assert len(calls) == 1
    assert result["data_mode"] == "cached"
    assert result["is_stale"] is False
    assert result["cache"]["age_seconds"] == 1800
    # The original fetch time is kept, not reset to now.
    assert result["fetched_at"].startswith("2026-09-26T09:00")


def test_cache_expires_after_an_hour():
    clock = FakeClock()
    calls = []
    fetch = lambda: calls.append(1) or {"n": len(calls)}
    cached_with_fallback("env", fetch, clock=clock, now=fixed_now())
    clock.t += 61 * 60
    result = cached_with_fallback("env", fetch, clock=clock, now=fixed_now())
    assert len(calls) == 2
    assert result["data_mode"] == "live"


def test_new_day_is_not_served_from_yesterdays_cache():
    clock = FakeClock()
    calls = []
    fetch = lambda: calls.append(1) or {}
    cached_with_fallback("env", fetch, clock=clock, now=fixed_now(day=26, hour=23))
    clock.t += 5 * 60
    result = cached_with_fallback("env", fetch, clock=clock, now=fixed_now(day=27, hour=0))
    assert len(calls) == 2
    assert result["valid_for"] == "2026-09-27"


def test_internet_down_serves_last_good_response_marked_stale():
    clock = FakeClock()
    cached_with_fallback("env", lambda: {"current": {"temperature_c": 25}}, clock=clock, now=fixed_now())
    clock.t += 2 * 60 * 60
    result = cached_with_fallback("env", offline, clock=clock, now=fixed_now(hour=11))
    assert result["data_mode"] == "last_good"
    assert result["is_stale"] is True
    assert result["current"]["temperature_c"] == 25
    assert result["fetched_at"].startswith("2026-09-26T09:00")  # still the real fetch time
    assert "ConnectionError" in result["cache"]["fallback_reason"]


def test_last_good_response_survives_a_restart():
    clock = FakeClock()
    cached_with_fallback("env", lambda: {"current": {"temperature_c": 25}}, clock=clock, now=fixed_now())
    caching._memory.clear()  # simulate restarting the backend
    clock.t += 2 * 60 * 60
    result = cached_with_fallback("env", offline, clock=clock, now=fixed_now(hour=11))
    assert result["data_mode"] == "last_good"
    assert result["current"]["temperature_c"] == 25


def test_nothing_cached_and_offline_serves_saved_demo_never_as_live():
    result = cached_with_fallback("env", offline, fallback=lambda: dict(SAMPLE), clock=FakeClock(), now=fixed_now())
    assert result["data_mode"] == "saved_demo"
    assert result["is_stale"] is True
    # The sample keeps its own dates instead of pretending to be fetched now.
    assert result["fetched_at"] == SAMPLE["fetched_at"]
    assert result["valid_for"] == SAMPLE["valid_for"]


def test_offline_without_fallback_raises_a_clear_error():
    with pytest.raises(FetchError):
        cached_with_fallback("env", offline, clock=FakeClock(), now=fixed_now())


def test_fallback_does_not_modify_the_saved_sample():
    sample = dict(SAMPLE)
    cached_with_fallback("env", offline, fallback=lambda: sample, clock=FakeClock(), now=fixed_now())
    assert "data_mode" not in sample


class FakeResponse:
    def __init__(self, status, payload=None):
        self.status_code = status
        self._payload = payload
        self.text = ""

    def json(self):
        return self._payload


class FakeSession:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = 0

    def get(self, url, params=None, timeout=None):
        self.calls += 1
        item = self.responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def test_fetch_json_retries_after_a_timeout():
    session = FakeSession([requests.Timeout("slow"), FakeResponse(200, {"ok": True})])
    assert fetch_json("https://example.test", session=session, wait=0) == {"ok": True}
    assert session.calls == 2


def test_fetch_json_retries_server_errors_then_gives_up():
    session = FakeSession([FakeResponse(503), FakeResponse(503), FakeResponse(503)])
    with pytest.raises(FetchError):
        fetch_json("https://example.test", session=session, retries=2, wait=0)
    assert session.calls == 3


def test_fetch_json_does_not_retry_client_errors():
    session = FakeSession([FakeResponse(400), FakeResponse(200, {})])
    with pytest.raises(FetchError):
        fetch_json("https://example.test", session=session, wait=0)
    assert session.calls == 1
