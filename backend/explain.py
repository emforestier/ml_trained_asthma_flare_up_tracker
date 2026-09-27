"""Plain-language explanations with Gemini (build guide, step 11).

Gemini only rewords facts that Python already calculated: the experimental demo score and level,
the top factors, the approved suggestion and whether the data is synthetic. It never makes the
prediction, never picks the suggestion, and never writes the urgent-care message.

Every reply is checked before it's used. Anything that breaks the rules (medication advice,
diagnosis words, numbers other than the score, too long) is thrown away and the template
explanation from model_service is used instead. With no GEMINI_API_KEY, or if Gemini fails or is
slow, the template is used too, so the result is always complete.
"""

import json
import os
import re
import threading

from dotenv import load_dotenv

from backend.db import ROOT

load_dotenv(ROOT / ".env")

DEFAULT_MODEL = "gemini-3.1-flash-lite"  # newer flash models ignore thinking_budget=0 and run out of tokens
TIMEOUT_MS = 15000  # Gemini rejects deadlines under 10s
MAX_CHARS = 320

# Words that mean the reply strayed into medical advice or claims.
BANNED = re.compile(
    r"\b(dose|dosage|mg|milligram|prednisone|steroid|increase your|decrease your|double|stop taking|skip your|"
    r"diagnos\w*|cure|guarantee\w*|definitely|you will have|you won't have|emergency room|911)\b",
    re.IGNORECASE,
)

_cache = {}
_lock = threading.Lock()
_client = None


def _get_client():
    global _client
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        return None
    if _client is None:
        from google import genai
        from google.genai import types

        _client = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=TIMEOUT_MS))
    return _client


def facts_for(result):
    """Only the already-calculated facts Gemini is allowed to talk about."""
    return {
        "score_percent": round(result["risk_score"] * 100),
        "level": result["risk_level"],
        "top_factors": [{"name": f["name"], "effect": "raises" if f["direction"] == "increases" else "lowers", "strength": f["strength"]} for f in result["top_factors"]],
        "suggestion": result["recommendation"],
        "data_note": "Experimental demo score from a model trained on simulated patient data; pollen values are synthetic.",
    }


def build_prompt(facts):
    return (
        "You write for an asthma companion app prototype. Using ONLY the facts below, write exactly two short, "
        "friendly sentences for the user explaining tomorrow's experimental demo score.\n"
        "Rules:\n"
        "- Call it an experimental demo score, not a diagnosis or a guaranteed prediction.\n"
        "- Mention the factor or factors that raised or lowered it, using their names as given.\n"
        "- Do not give medication, dosing or treatment advice, and do not add any medical claims.\n"
        "- Do not include any numbers except the score percent.\n"
        "- Do not repeat the suggestion word for word, and do not mention emergencies.\n"
        "- Plain text only, no lists, no emojis.\n\n"
        f"Facts: {json.dumps(facts)}"
    )


def is_acceptable(text, facts):
    """True if a Gemini reply follows the rules; otherwise the template is used."""
    if not text or len(text) > MAX_CHARS:
        return False
    if BANNED.search(text):
        return False
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s]
    if len(sentences) > 2:
        return False
    allowed = {str(facts["score_percent"])}
    numbers = set(re.findall(r"\d+(?:\.\d+)?", text))
    if not numbers.issubset(allowed):
        return False
    if "demo" not in text.lower():
        return False
    return True


def explain(result, cache_key=None):
    """Returns (explanation, source) where source is "gemini" or "template"."""
    template = result["explanation"]
    client = _get_client()
    if client is None:
        return template, "template"

    facts = facts_for(result)
    key = cache_key or json.dumps(facts, sort_keys=True)
    with _lock:
        if key in _cache:
            return _cache[key]

    try:
        from google.genai import types

        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", DEFAULT_MODEL),
            contents=build_prompt(facts),
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=150,
                # Thinking tokens count against max_output_tokens and cut the reply off.
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        if response.candidates[0].finish_reason != types.FinishReason.STOP:
            return template, "template"  # cut off or blocked; don't show half a sentence
        text =(response.text or "").strip().replace("\n", " ")
    except Exception:  # noqa: BLE001 - any Gemini problem falls back to the template
        return template, "template"

    outcome = (text, "gemini") if is_acceptable(text, facts) else (template, "template")
    with _lock:
        _cache[key] = outcome
    return outcome
