import requests
import threading
from backend.environment import fetch_environment
from backend import model_service
from backend.explain import explain
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


# Step 10: load the model (and connect to the database) once, in the background, at startup.
threading.Thread(target=model_service.warm_up, daemon=True).start()

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
    # Step 10: Emily's model on real daily weather and saved check-ins.
    # Step 11: Gemini rewords the computed facts, with the template as a fallback.
    try:
        result = model_service.risk_for(user)
    except Exception as error:  # the app must keep working even if the model can't run
        sample = load_sample("risk")
        sample["data_mode"] = "sample_fallback"
        sample["fallback_reason"] = f"{type(error).__name__}: {error}"[:200]
        return sample
    if result.get("status") == "insufficient_data":
        return result
    text, source = explain(result, cache_key=f"{user}:{result['prediction_for']}:{result['risk_score']}")
    result["explanation"] = text
    result["explanation_source"] = source
    return result


@app.get("/triggers")
def get_triggers(user: str = "demo-user-1"):
    # Which trigger groups the model leaned on across the user's recent days.
    try:
        return model_service.trigger_profile(user)
    except Exception as error:
        sample = load_sample("triggers")
        sample["data_mode"] = "sample_fallback"
        sample["fallback_reason"] = f"{type(error).__name__}: {error}"[:200]
        return sample


@app.get("/summary")
def get_summary(user: str = "demo-user-1"):
    return load_sample("summary")


@app.get("/log")
def get_log(user: str = "demo-user-1"):
    return load_sample("log")




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
    eligible_puffs = log.puffs - log.pre_exercise_puffs

    symptom_total = (
        log.symptoms.breath
        + log.symptoms.wheeze
        + log.symptoms.cough
    )

    # Step 3 checks the request format.
    # Storage will be connected in a later step.
    raise HTTPException(
        status_code=501,
        detail={
            "status": "validated_not_saved",
            "saved": False,
            "message": (
                "Check-in format is valid, but storage "
                "is not connected yet."
            ),
            "received": log.model_dump(mode="json"),
            "eligible_rescue_puffs": eligible_puffs,
            "symptom_total": symptom_total
        }
    )

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