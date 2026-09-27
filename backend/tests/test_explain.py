"""Tests for Gemini explanations (build guide, step 11). No real Gemini calls are made."""

from types import SimpleNamespace

import pytest
from google.genai import types

from backend import explain as ex

RESULT = {
    "risk_score": 0.62,
    "risk_level": "high",
    "top_factors": [
        {"name": "Synthetic pollen", "direction": "increases", "strength": "strong"},
        {"name": "Pressure change", "direction": "increases", "strength": "moderate"},
        {"name": "Rain", "direction": "decreases", "strength": "weak"},
    ],
    "recommendation": "Review your existing asthma action plan.",
    "explanation": "Your experimental demo score for tomorrow is 62% (high). TEMPLATE",
}
FACTS = ex.facts_for(RESULT)


class FakeResponse:
    def __init__(self, text, finish_reason=types.FinishReason.STOP):
        self.text = text
        self.candidates = [SimpleNamespace(finish_reason=finish_reason)]


class FakeModels:
    def __init__(self, reply=None, error=None, finish_reason=types.FinishReason.STOP):
        self.reply, self.error, self.finish_reason, self.calls = reply, error, finish_reason, 0

    def generate_content(self, **kwargs):
        self.calls += 1
        if self.error:
            raise self.error
        return FakeResponse(self.reply, self.finish_reason)


class FakeClient:
    def __init__(self, **kwargs):
        self.models = FakeModels(**kwargs)


@pytest.fixture(autouse=True)
def fresh_cache():
    ex._cache.clear()


@pytest.mark.parametrize(
    "text",
    [
        "Your experimental demo score is 62% and high. Synthetic pollen raised it the most today.",
        "This experimental demo score of 62% is high, mostly because of synthetic pollen. A pressure change added to it.",
    ],
)
def test_good_replies_are_accepted(text):
    assert ex.is_acceptable(text, FACTS)


@pytest.mark.parametrize(
    "text",
    [
        "Your experimental demo score is 62%. Take 2 extra puffs of your inhaler.",  # invented number
        "Your experimental demo score is 62%. Increase your controller dose today.",  # medication advice
        "Your experimental demo score is 62%. This could mean you have a diagnosis.",  # medical claim
        "Your score is 62% and high. Pollen raised it.",  # doesn't say it's a demo score
        "Your experimental demo score is 62%. Pollen raised it. Rain lowered it. Stay safe.",  # too many sentences
        "",
    ],
)
def test_unsafe_or_odd_replies_are_rejected(text):
    assert not ex.is_acceptable(text, FACTS)


def test_no_api_key_uses_the_template(monkeypatch):
    monkeypatch.setattr(ex, "_get_client", lambda: None)
    assert ex.explain(RESULT) == (RESULT["explanation"], "template")


def test_good_gemini_reply_is_used_and_cached(monkeypatch):
    client = FakeClient(reply="Your experimental demo score is 62% and high. Synthetic pollen raised it the most.")
    monkeypatch.setattr(ex, "_get_client", lambda: client)
    first = ex.explain(RESULT, cache_key="k")
    second = ex.explain(RESULT, cache_key="k")
    assert first[1] == "gemini" and first == second
    assert client.models.calls == 1


def test_rejected_gemini_reply_falls_back_to_the_template(monkeypatch):
    client = FakeClient(reply="Your experimental demo score is 62%. Double your inhaler dose.")
    monkeypatch.setattr(ex, "_get_client", lambda: client)
    assert ex.explain(RESULT) == (RESULT["explanation"], "template")


def test_cut_off_gemini_reply_falls_back_to_the_template(monkeypatch):
    # Passes is_acceptable on its own, but Gemini stopped mid-sentence.
    client = FakeClient(reply="Your experimental demo score for tomorrow", finish_reason=types.FinishReason.MAX_TOKENS)
    monkeypatch.setattr(ex, "_get_client", lambda: client)
    assert ex.explain(RESULT) == (RESULT["explanation"], "template")


def test_gemini_error_falls_back_to_the_template(monkeypatch):
    client = FakeClient(error=TimeoutError("slow"))
    monkeypatch.setattr(ex, "_get_client", lambda: client)
    assert ex.explain(RESULT) == (RESULT["explanation"], "template")


def test_prompt_contains_only_the_computed_facts():
    prompt = ex.build_prompt(FACTS)
    assert '"score_percent": 62' in prompt
    assert "Synthetic pollen" in prompt
    assert "medication" in prompt.lower()
