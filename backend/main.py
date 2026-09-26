from datetime import date
from pydantic import BaseModel, Field, model_validator
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/environment")
def get_environment():
    return {
        "city": "Demo city",
        "date": "2026-09-26",
        "data_mode": "mock",
        "weather": {
            "temperature_c": 24,
            "humidity_percent": 60,
            "pressure_hpa": 1012,
            "wind_speed_kmh": 12,
            "rain_mm": 0,
            "source": "sample data",
            "is_synthetic": True
        },
        "air_quality": {
            "pm2_5": 12,
            "unit": "micrograms per cubic meter",
            "source": "sample data",
            "is_synthetic": True
        },
        "pollen": {
            "tree": 2,
            "grass": 4,
            "weed": 1,
            "scale": "0 to 5 internal demo scale",
            "source": "synthetic demo data",
            "is_synthetic": True
        }
    }

@app.get("/risk")
def get_risk():
    return {
        "user_id": "demo-user-1",
        "prediction_for": "2026-09-27",
        "risk_score": 0.62,
        "risk_level": "elevated",
        "top_factors": [
            {
                "name": "Pollen",
                "direction": "increases",
                "strength": "strong"
            },
            {
                "name": "Weather",
                "direction": "increases",
                "strength": "moderate"
            },
            {
                "name": "Air quality",
                "direction": "increases",
                "strength": "weak"
            }
        ],
        "recommendation": "Review your existing asthma action plan.",
        "data_mode": "mock",
        "model_status": "not_connected",
        "disclaimer": (
            "This is a fixed sample prediction for testing the interface. "
            "It is not a medical assessment."
        )
    }

@app.get("/triggers")
def get_triggers():
    return {
        "user_id": "demo-user-1",
        "title": "Environmental patterns",
        "data_mode": "mock",
        "model_status": "not_connected",
        "patterns": [
            {
                "factor": "pollen",
                "label": "Pollen",
                "strength": "strong",
                "description": (
                    "Placeholder: pollen has a strong influence "
                    "in this example."
                )
            },
            {
                "factor": "weather",
                "label": "Weather",
                "strength": "moderate",
                "description": (
                    "Placeholder: weather has a moderate influence "
                    "in this example."
                )
            },
            {
                "factor": "air_quality",
                "label": "Air quality",
                "strength": "weak",
                "description": (
                    "Placeholder: air quality has a weak influence "
                    "in this example."
                )
            }
        ],
        "disclaimer": (
            "These are sample patterns for testing the interface. "
            "They are not learned from a person's health history "
            "and do not establish medical causes."
        )
    }

@app.get("/summary")
def get_summary():
    return {
        "user_id": "demo-user-1",
        "title": "Weekly environmental summary",
        "period_start": "2026-09-20",
        "period_end": "2026-09-26",
        "data_mode": "mock",
        "model_status": "not_connected",
        "summary": (
            "This example shows how your weekly summary will look. "
            "Once connected, it will summarize your recorded check-ins "
            "and the model's weather, pollen, and air-quality patterns."
        ),
        "days_logged": 0,
        "disclaimer": (
            "This is placeholder text. No health history has been "
            "analyzed, and Gemini is not connected yet."
        )
    }
class DailyLog(BaseModel):
    user_id: str = Field(min_length=1)
    log_date: date

    total_rescue_puffs: int = Field(ge=0, strict=True)
    pre_exercise_puffs: int = Field(ge=0, strict=True)

    shortness_of_breath: int = Field(ge=0, le=3, strict=True)
    wheezing_or_chest_tightness: int = Field(
        ge=0, le=3, strict=True
    )
    cough: int = Field(ge=0, le=3, strict=True)

    night_waking: bool = Field(strict=True)

    @model_validator(mode="after")
    def check_puff_counts(self):
        if self.pre_exercise_puffs > self.total_rescue_puffs:
            raise ValueError(
                "Pre-exercise puffs cannot exceed total rescue puffs."
            )
        return self


@app.post("/log")
def receive_log(log: DailyLog):
    eligible_puffs = (
        log.total_rescue_puffs - log.pre_exercise_puffs
    )

    symptom_total = (
        log.shortness_of_breath
        + log.wheezing_or_chest_tightness
        + log.cough
    )

    return {
        "status": "validated_not_saved",
        "saved": False,
        "message": (
            "Check-in received and validated. "
            "Permanent storage is not connected yet."
        ),
        "log": log.model_dump(mode="json"),
        "eligible_rescue_puffs": eligible_puffs,
        "symptom_total": symptom_total
    }