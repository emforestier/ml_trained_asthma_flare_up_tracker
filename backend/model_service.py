"""Connects Emily's trained model to the API (build guide, step 10).

The model is loaded once at startup. For each prediction this module:

1. Gets daily environment values the same way the training data was built: daily max temperature,
   daily max wind, daily rain, daily mean surface pressure and daily mean PM2.5 from Open-Meteo, plus
   synthetic pollen from the same formula as model/data_pipeline.py. Current readings are NOT used,
   because a current reading and a daily mean are different quantities.
2. Gets the user's check-in history (MongoDB daily_logs). With no saved history it uses the fictional
   demo history in model/alexis_demo_log.csv and labels the result data_mode "demo_history".
3. Builds the 14 features exactly as data_pipeline.py does, runs the model, and explains the result
   with LightGBM's built-in SHAP values (identical to shap.TreeExplainer for this model).

Missing inputs stay missing (NaN, which LightGBM handles), never silently zero.
"""

import math
from datetime import date, datetime, timedelta
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from backend.caching import CITY_TIME_ZONE, cached_with_fallback, fetch_json

ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = ROOT / "model"
LATITUDE, LONGITUDE = 29.6516, -82.3248
TIME_ZONE_NAME = "America/New_York"
HISTORY_DAYS = 31  # enough days for 14-day baselines, 7-day counts and the trigger profile
DEMO_USER_ID = "demo-user-1"  # the team's fictional demo person: simulated history plus any live check-ins
LEARNING_DAYS = 14  # check-ins needed before patterns are shown as learned

# Same cut-offs as model/train_model.py (0.35 was chosen to catch more real flare-ups).
LOW_BELOW = 0.35
HIGH_FROM = 0.6
DEFAULT_BASELINE = 1.5  # data_pipeline.py's baseline when no survey estimate exists

# Plain names and units for the model's features, as shown in the app.
FEATURE_INFO = {
    "pollen": ("Synthetic pollen", "of 5", "pollen"),
    "pm2_5_mean": ("PM2.5 air pollution", "µg/m³", "air_quality"),
    "surface_pressure_mean": ("Air pressure", "hPa", "pressure_drop"),
    "temperature_2m_max": ("High temperature", "°C", "temperature"),
    "windspeed_10m_max": ("Wind", "km/h", "weather"),
    "precipitation_sum": ("Rain", "mm", "weather"),
    "puffs_3day_avg": ("Rescue puffs, 3-day average", "puffs a day", "puffs"),
    "pollen_3day_avg": ("Synthetic pollen, 3-day average", "of 5", "pollen"),
    "aqi_3day_avg": ("PM2.5, 3-day average", "µg/m³", "air_quality"),
    "pressure_24h_change": ("Pressure change", "hPa in 24h", "pressure_drop"),
    "puffs_yesterday": ("Rescue puffs yesterday", "puffs", "puffs"),
    "baseline_puffs": ("Your usual rescue puffs", "puffs a day", "puffs"),
    "puffs_above_baseline": ("Extra rescue puffs", "above usual", "puffs"),
    "days_above_baseline_7d": ("Days above usual this week", "days", "puffs"),
}

# Predefined suggestions, picked by the factor that raised the score most. Never generated.
SUGGESTIONS = {
    "pollen": "Synthetic pollen is a big factor today: keep windows closed, keep your rescue inhaler with you, and review your asthma action plan.",
    "air_quality": "Air pollution is a factor today: limit time near smoke or heavy traffic, and review your asthma action plan.",
    "pressure_drop": "Changing weather is a factor today: keep your rescue inhaler handy and review your asthma action plan.",
    "weather": "Weather is a factor today: keep your rescue inhaler handy and review your asthma action plan.",
    "temperature": "Temperature is a factor today: keep your rescue inhaler handy and review your asthma action plan.",
    "puffs": "Your recent rescue inhaler use is up: review your asthma action plan, and talk to your doctor if it keeps rising.",
}
DEFAULT_SUGGESTION = "Review your existing asthma action plan."

# Trigger cards shown on the Patterns screen, and which model features belong to each.
TRIGGERS = [
    ("pollen", "Pollen", ["pollen", "pollen_3day_avg"]),
    ("pressure_drop", "Pressure drops", ["pressure_24h_change", "surface_pressure_mean"]),
    ("air_quality", "Air quality", ["pm2_5_mean", "aqi_3day_avg"]),
    ("temperature", "Temperature", ["temperature_2m_max"]),
    ("humidity", "Humidity", []),
    ("cold_air", "Cold air", []),
]


class ModelUnavailable(Exception):
    pass


@lru_cache(maxsize=1)
def load_model():
    """Loads the saved model and feature order once."""
    try:
        model = joblib.load(MODEL_DIR / "flare_model.pkl")
        feature_cols = list(joblib.load(MODEL_DIR / "feature_cols.pkl"))
    except (OSError, ValueError, ImportError) as error:
        raise ModelUnavailable(f"Could not load the model from {MODEL_DIR}: {error}") from error
    version = datetime.fromtimestamp((MODEL_DIR / "flare_model.pkl").stat().st_mtime).strftime("%Y%m%d-%H%M")
    return model, feature_cols, f"lightgbm-{version}"


def today_local():
    return datetime.now(CITY_TIME_ZONE).date()


# ---------- Environment: daily values like the training data ----------

def synthetic_pollen(day, precipitation, wind):
    """Same formula as model/data_pipeline.py, with noise seeded by the date so a day's value is stable."""
    doy = day.timetuple().tm_yday
    base = 5 * math.exp(-((doy - 90) ** 2) / (2 * 40**2))
    noise = np.random.default_rng(int(day.strftime("%Y%m%d"))).normal(0, 0.4)
    rain = 0 if precipitation is None or math.isnan(precipitation) else precipitation
    breeze = 0 if wind is None or math.isnan(wind) else wind
    return float(min(5.0, max(0.0, base - 0.3 * rain + 0.1 * breeze + noise)))


def today_conditions():
    """Today's synthetic pollen and 24-hour pressure change, exactly as the model sees them.

    The model has one overall pollen index (model/data_pipeline.py), so that is the only pollen
    value shown; separate tree, grass and weed values would not match what the model used.
    """
    days = daily_environment()["days"]
    today, yesterday = days[-1], days[-2] if len(days) > 1 else None
    change = None
    if yesterday and today.get("surface_pressure_mean") is not None and yesterday.get("surface_pressure_mean") is not None:
        change = round(today["surface_pressure_mean"] - yesterday["surface_pressure_mean"], 1)
    pollen = today.get("pollen")
    return {"pollen": {"overall": None if pollen is None else round(pollen, 1)}, "pressure_change_24h": change}


def _daily_mean(times, values):
    frame = pd.DataFrame({"time": pd.to_datetime(times), "value": pd.to_numeric(values, errors="coerce")})
    frame["date"] = frame["time"].dt.date
    return frame.groupby("date")["value"].mean()


def fetch_daily_environment(days=HISTORY_DAYS):
    """Daily environment values for the last ``days`` days up to today (local dates)."""
    weather = fetch_json(
        "https://api.open-meteo.com/v1/forecast",
        {
            "latitude": LATITUDE,
            "longitude": LONGITUDE,
            "timezone": TIME_ZONE_NAME,
            "past_days": days,
            "forecast_days": 1,
            # Daily values, the same variables the training data used (hourly data is much slower to fetch).
            "daily": "temperature_2m_max,wind_speed_10m_max,precipitation_sum,surface_pressure_mean",
            "wind_speed_unit": "kmh",
        },
    )
    air = fetch_json(
        "https://air-quality-api.open-meteo.com/v1/air-quality",
        {"latitude": LATITUDE, "longitude": LONGITUDE, "timezone": TIME_ZONE_NAME, "past_days": days, "forecast_days": 1, "hourly": "pm2_5"},
    )
    pm25 = _daily_mean(air["hourly"]["time"], air["hourly"]["pm2_5"])
    rows = []
    for i, day_text in enumerate(weather["daily"]["time"]):
        day = date.fromisoformat(day_text)
        rain = weather["daily"]["precipitation_sum"][i]
        wind = weather["daily"]["wind_speed_10m_max"][i]
        rows.append(
            {
                "date": day_text,
                "temperature_2m_max": weather["daily"]["temperature_2m_max"][i],
                "windspeed_10m_max": wind,
                "precipitation_sum": rain,
                "surface_pressure_mean": weather["daily"]["surface_pressure_mean"][i],
                "pm2_5_mean": None if pd.isna(pm25.get(day)) else float(pm25.get(day)),
                "pollen": synthetic_pollen(day, rain, wind),
            }
        )
    return {"days": rows, "sources": {"weather": "Open-Meteo daily values", "air_quality": "Open-Meteo daily mean PM2.5", "pollen": "Synthetic (training formula, 0–5 scale)"}}


def _saved_environment_sample():
    """Offline fallback: the most recent days of the training environment data, re-dated to now."""
    frame = pd.read_csv(MODEL_DIR / "env_data_with_pollen.csv").tail(HISTORY_DAYS + 1).reset_index(drop=True)
    end = today_local()
    rows = []
    for i, row in frame.iterrows():
        rows.append(
            {
                "date": (end - timedelta(days=len(frame) - 1 - i)).isoformat(),
                "temperature_2m_max": row["temperature_2m_max"],
                "windspeed_10m_max": row["windspeed_10m_max"],
                "precipitation_sum": row["precipitation_sum"],
                "surface_pressure_mean": row["surface_pressure_mean"],
                "pm2_5_mean": row["pm2_5_mean"],
                "pollen": row["pollen"],
            }
        )
    return {"days": rows, "sources": {"weather": "Saved sample (Open-Meteo history)", "air_quality": "Saved sample", "pollen": "Synthetic"}, "fetched_at": None, "valid_for": None}


def daily_environment():
    return cached_with_fallback("daily_environment", fetch_daily_environment, fallback=_saved_environment_sample)


# ---------- Check-in history ----------

def _eligible_puffs(entry):
    total = entry.get("puffs")
    if total is None:
        return None
    return max(0, total - (entry.get("pre_exercise_puffs") or 0))


def saved_history(user, db=None):
    """The user's saved check-ins as {date: eligible puffs}, or {} if none or MongoDB is unavailable."""
    try:
        if db is None:
            from backend.db import get_db

            db = get_db()
        cursor = db.daily_logs.find({"user": user}, {"_id": 0, "date": 1, "puffs": 1, "pre_exercise_puffs": 1})
        return {str(doc["date"]): _eligible_puffs(doc) for doc in cursor if doc.get("date")}
    except Exception:  # noqa: BLE001 - no database means no saved history, not an error for the user
        return {}


def saved_baseline_estimate(user, db=None):
    try:
        if db is None:
            from backend.db import get_db

            db = get_db()
        profile = db.profiles.find_one({"user": user}, {"_id": 0, "baseline_estimate": 1}) or {}
        return profile.get("baseline_estimate")
    except Exception:  # noqa: BLE001
        return None


def demo_history(end):
    """Fictional demo history (model/alexis_demo_log.csv), laid out as the days ending ``end``."""
    puffs = pd.read_csv(MODEL_DIR / "alexis_demo_log.csv")["puffs"].tolist()
    return {(end - timedelta(days=len(puffs) - 1 - i)).isoformat(): float(p) for i, p in enumerate(puffs)}


# ---------- Features (same definitions as model/data_pipeline.py) ----------

def build_feature_rows(env_days, puffs_by_date, survey_baseline=None):
    """One feature row per environment day. Uses only information available by the end of that day."""
    frame = pd.DataFrame(env_days).sort_values("date").reset_index(drop=True)
    frame["puffs"] = [puffs_by_date.get(d, np.nan) for d in frame["date"]]
    fallback_baseline = survey_baseline if survey_baseline is not None else DEFAULT_BASELINE

    baseline = frame["puffs"].shift(1).rolling(14, min_periods=7).median()
    frame["baseline_puffs"] = baseline.fillna(fallback_baseline)
    frame["pressure_24h_change"] = frame["surface_pressure_mean"].diff()
    frame["puffs_3day_avg"] = frame["puffs"].rolling(3).mean()
    frame["pollen_3day_avg"] = frame["pollen"].rolling(3).mean()
    frame["aqi_3day_avg"] = frame["pm2_5_mean"].rolling(3).mean()
    frame["puffs_yesterday"] = frame["puffs"].shift(1)
    frame["puffs_above_baseline"] = frame["puffs"] - frame["baseline_puffs"]
    above = (frame["puffs_above_baseline"] > 0).astype(float).where(frame["puffs_above_baseline"].notna())
    frame["days_above_baseline_7d"] = above.rolling(7).sum()
    return frame


def _bucket(abs_value, all_abs):
    """Emily's strength buckets: top third of the range strong, middle moderate, bottom weak."""
    lo, hi = min(all_abs), max(all_abs)
    share = (abs_value - lo) / (hi - lo if hi > lo else 1)
    return "strong" if share >= 0.66 else "moderate" if share >= 0.33 else "weak"


def _level(score):
    return "low" if score < LOW_BELOW else "moderate" if score < HIGH_FROM else "high"


def _rounded(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    return round(float(value), 1)


def predict_row(features):
    """Runs the model on one feature row. Returns score, level and SHAP contributions."""
    model, feature_cols, version = load_model()
    row = pd.DataFrame([features])[feature_cols].astype(float)
    score = float(model.predict_proba(row)[0][1])
    contributions = model.booster_.predict(row, pred_contrib=True)[0][:-1]
    return score, dict(zip(feature_cols, (float(c) for c in contributions))), version


def explain_factors(features, contributions, top_n=3):
    all_abs = [abs(v) for v in contributions.values()]
    ranked = sorted(contributions.items(), key=lambda item: abs(item[1]), reverse=True)[:top_n]
    factors = []
    for feature, impact in ranked:
        name, unit, _ = FEATURE_INFO.get(feature, (feature, "", "other"))
        factors.append(
            {
                "name": name,
                "feature": feature,
                "direction": "increases" if impact > 0 else "decreases",
                "strength": _bucket(abs(impact), all_abs),
                "value": _rounded(features.get(feature)),
                "unit": unit,
            }
        )
    return factors


def suggestion_for(contributions):
    raising = sorted(((f, v) for f, v in contributions.items() if v > 0), key=lambda item: item[1], reverse=True)
    if not raising:
        return DEFAULT_SUGGESTION
    category = FEATURE_INFO.get(raising[0][0], ("", "", ""))[2]
    return SUGGESTIONS.get(category, DEFAULT_SUGGESTION)


def template_explanation(result):
    """Plain-language explanation built only from computed facts. Also the Gemini fallback."""
    percent = round(result["risk_score"] * 100)
    shown = "under 1%" if percent < 1 else f"{percent}%"
    raising = [f["name"].lower() for f in result["top_factors"] if f["direction"] == "increases"]
    lowering = [f["name"].lower() for f in result["top_factors"] if f["direction"] == "decreases"]
    first = f"Your experimental demo score for tomorrow is {shown} ({result['risk_level']})."
    if raising:
        second = f"The model weighed {raising[0]} most in raising it" + (f", while {lowering[0]} pulled it down." if lowering else ".")
    elif lowering:
        second = f"{lowering[0].capitalize()} helped keep it lower."
    else:
        second = "No single factor stood out."
    return f"{first} {second}"


def _inputs(user, db=None):
    env = daily_environment()
    end = today_local().isoformat()
    saved = saved_history(user, db)
    live_env = env.get("data_mode") in ("live", "cached")
    if user == DEMO_USER_ID:
        # The fictional demo person has simulated history; real saved check-ins replace those days.
        history = {**demo_history(today_local()), **{d: v for d, v in saved.items() if v is not None}}
        mode = "demo_history_plus_saved" if saved else "demo_history"
    elif saved:
        history = saved
        mode = "live" if live_env else "saved_environment"
    else:
        history = {}
        mode = "no_history"
    rows = build_feature_rows(env["days"], history, saved_baseline_estimate(user, db))
    return env, rows, history, mode, end


def risk_for(user, db=None):
    """Tomorrow's experimental demo score for ``user``, in the frontend's risk.json format."""
    env, rows, history, mode, end = _inputs(user, db)
    _, feature_cols, _ = load_model()
    latest = rows[rows["puffs"].notna()]
    if latest.empty:
        return {"user_id": user, "status": "insufficient_data", "message": "No check-ins yet. Complete today's check-in to get a demo score.", "data_mode": mode}
    today_row = latest.iloc[-1]
    features = {col: today_row[col] for col in feature_cols}
    score, contributions, version = predict_row(features)
    based_on = today_row["date"]
    result = {
        "user_id": user,
        "prediction_for": (date.fromisoformat(based_on) + timedelta(days=1)).isoformat(),
        "based_on_check_in": based_on,
        "generated_at": datetime.now(CITY_TIME_ZONE).isoformat(timespec="seconds"),
        "risk_score": round(score, 3),
        "risk_level": _level(score),
        "top_factors": explain_factors(features, contributions),
        "recommendation": suggestion_for(contributions),
        "days_logged": sum(1 for v in history.values() if v is not None),
        "data_mode": mode,
        "environment_mode": env.get("data_mode"),
        "model_status": "trained_on_synthetic_patient_data",
        "model_version": version,
        "cutoffs": {"moderate_from": LOW_BELOW, "high_from": HIGH_FROM},
    }
    result["explanation"] = template_explanation(result)
    result["explanation_source"] = "template"
    return result


def trigger_profile(user, db=None):
    """Which trigger groups the model leaned on across recent days, in the frontend's triggers.json format."""
    env, rows, history, mode, _ = _inputs(user, db)
    _, feature_cols, _ = load_model()
    usable = rows[rows["puffs"].notna()]
    days = len(usable)
    totals = {feature: 0.0 for feature in feature_cols}
    top_counts = {key: 0 for key, _, _ in TRIGGERS}
    for _, row in usable.iterrows():
        _, contributions, _ = predict_row({col: row[col] for col in feature_cols})
        for feature, value in contributions.items():
            totals[feature] += abs(value)
        best = max(contributions.items(), key=lambda item: abs(item[1]))[0]
        for key, _, features in TRIGGERS:
            if best in features:
                top_counts[key] += 1

    group_scores = {key: sum(totals[f] for f in features) / max(days, 1) for key, _, features in TRIGGERS}
    scored = [v for v in group_scores.values() if v > 0]
    learned = days >= LEARNING_DAYS
    triggers = []
    for key, label, features in TRIGGERS:
        if not features:
            triggers.append({"feature": key, "label": label, "strength": "none", "score": 0.0, "discovered": False, "evidence": f"The demo model doesn't use {label.lower()} data yet."})
            continue
        score = group_scores[key]
        discovered = learned and score > 0
        triggers.append(
            {
                "feature": key,
                "label": label,
                "strength": _bucket(score, scored) if discovered and scored else "none",
                "score": round(score, 3),
                "discovered": discovered,
                "evidence": (
                    (
                        f"It was the model's single biggest factor on {top_counts[key]} of the last {days} days."
                        if top_counts[key]
                        else f"It contributed to the model's predictions over the last {days} days, but was never the biggest factor."
                    )
                    if discovered
                    else f"Needs {LEARNING_DAYS} days of check-ins (currently {days})."
                ),
            }
        )
    triggers.sort(key=lambda t: t["score"], reverse=True)
    return {"user_id": user, "updated": today_local().isoformat(), "data_mode": mode, "days_used": days, "triggers": triggers}


def warm_up():
    """Loads the model, connects to MongoDB and fetches today's weather, so the first request is fast."""
    try:
        load_model()
        saved_history(DEMO_USER_ID)
        daily_environment()
    except Exception:  # noqa: BLE001 - warm-up is best effort; requests still work without it
        pass
