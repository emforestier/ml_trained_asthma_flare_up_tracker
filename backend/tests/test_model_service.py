"""Tests for connecting the model (build guide, step 10). They run offline with fake weather."""

from datetime import date, timedelta

import math
import pytest

from backend import model_service as ms

TODAY = date(2026, 9, 26)


def fake_env(days=31):
    rows = []
    for i in range(days + 1):
        day = TODAY - timedelta(days=days - i)
        rows.append(
            {
                "date": day.isoformat(),
                "temperature_2m_max": 30.0,
                "windspeed_10m_max": 12.0,
                "precipitation_sum": 0.0,
                "surface_pressure_mean": 1010.0 + (i % 3),
                "pm2_5_mean": 6.0,
                "pollen": 2.0,
            }
        )
    return {"days": rows, "data_mode": "live"}


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    monkeypatch.setattr(ms, "daily_environment", lambda: fake_env())
    monkeypatch.setattr(ms, "today_local", lambda: TODAY)
    monkeypatch.setattr(ms, "saved_baseline_estimate", lambda user, db=None: None)


def test_model_reproduces_emilys_saved_scores():
    import json

    import pandas as pd
    from sklearn.model_selection import train_test_split

    model, cols, _ = ms.load_model()
    frame = pd.read_csv(ms.MODEL_DIR / "env_data_with_flareup_labels.csv").dropna(subset=cols + ["label_next_day_flareup"])
    _, x_test, _, _ = train_test_split(frame[cols], frame["label_next_day_flareup"], test_size=0.2, stratify=frame["label_next_day_flareup"], random_state=42)
    saved = json.loads((ms.MODEL_DIR / "risk.json").read_text())
    for i, expected in enumerate(saved):
        score, contributions, _ = ms.predict_row(x_test.iloc[i].to_dict())
        assert round(score, 3) == expected["risk_score"]
        top = max(contributions.items(), key=lambda item: abs(item[1]))[0]
        assert top == expected["top_factors"][0]["factor"]


def test_features_match_the_training_definitions():
    env = fake_env()["days"]
    puffs = {row["date"]: 2.0 for row in env}
    puffs[TODAY.isoformat()] = 5.0  # today spikes
    puffs[(TODAY - timedelta(days=1)).isoformat()] = 3.0
    rows = ms.build_feature_rows(env, puffs)
    today = rows.iloc[-1]
    # Baseline: median of the previous 14 days, excluding today.
    assert today["baseline_puffs"] == 2.0
    assert today["puffs_above_baseline"] == 3.0
    assert today["puffs_yesterday"] == 3.0
    assert today["puffs_3day_avg"] == pytest.approx((5 + 3 + 2) / 3)
    assert today["pressure_24h_change"] == pytest.approx(rows.iloc[-1]["surface_pressure_mean"] - rows.iloc[-2]["surface_pressure_mean"])
    # Two days above usual in the last 7 (yesterday and today).
    assert today["days_above_baseline_7d"] == 2


def test_new_history_uses_survey_baseline_and_keeps_missing_values_missing():
    env = fake_env()["days"]
    puffs = {TODAY.isoformat(): 1.0}
    rows = ms.build_feature_rows(env, puffs, survey_baseline=0.43)
    today = rows.iloc[-1]
    assert today["baseline_puffs"] == pytest.approx(0.43)
    assert math.isnan(today["puffs_yesterday"])  # unknown, not zero


def test_synthetic_pollen_is_stable_and_on_the_0_to_5_scale():
    first = ms.synthetic_pollen(date(2026, 3, 31), 0.0, 10.0)
    assert first == ms.synthetic_pollen(date(2026, 3, 31), 0.0, 10.0)
    assert 0 <= first <= 5
    assert ms.synthetic_pollen(date(2026, 3, 31), 0.0, 10.0) > ms.synthetic_pollen(date(2026, 9, 26), 0.0, 10.0)


def test_demo_user_prediction_matches_the_frontend_contract(monkeypatch):
    monkeypatch.setattr(ms, "saved_history", lambda user, db=None: {})
    result = ms.risk_for("demo-user-1")
    assert result["data_mode"] == "demo_history"
    assert 0 <= result["risk_score"] <= 1
    assert result["risk_level"] in {"low", "moderate", "high"}
    assert result["prediction_for"] == (TODAY + timedelta(days=1)).isoformat()
    assert len(result["top_factors"]) == 3
    for factor in result["top_factors"]:
        assert set(factor) >= {"name", "direction", "strength", "value", "unit"}
        assert factor["direction"] in {"increases", "decreases"}
        assert factor["strength"] in {"strong", "moderate", "weak"}
    assert result["model_status"] == "trained_on_synthetic_patient_data"
    assert result["recommendation"]
    assert result["explanation"].startswith("Your experimental demo score")


def test_saved_check_ins_replace_demo_days_for_the_demo_user(monkeypatch):
    monkeypatch.setattr(ms, "saved_history", lambda user, db=None: {TODAY.isoformat(): 7.0})
    result = ms.risk_for("demo-user-1")
    assert result["data_mode"] == "demo_history_plus_saved"
    assert result["based_on_check_in"] == TODAY.isoformat()


def test_new_user_without_check_ins_gets_an_explicit_state(monkeypatch):
    monkeypatch.setattr(ms, "saved_history", lambda user, db=None: {})
    result = ms.risk_for("someone-new")
    assert result["status"] == "insufficient_data"
    assert "risk_score" not in result


def test_trigger_profile_needs_enough_history(monkeypatch):
    monkeypatch.setattr(ms, "saved_history", lambda user, db=None: {})
    learned = ms.trigger_profile("demo-user-1")
    assert learned["days_used"] >= ms.LEARNING_DAYS
    assert any(t["discovered"] for t in learned["triggers"])
    assert {t["feature"] for t in learned["triggers"]} >= {"pollen", "air_quality", "pressure_drop", "humidity", "cold_air"}
    # A user with only three check-ins sees nothing learned yet.
    few = {(TODAY - timedelta(days=i)).isoformat(): 2.0 for i in range(3)}
    monkeypatch.setattr(ms, "saved_history", lambda user, db=None: few)
    early = ms.trigger_profile("someone-new")
    assert not any(t["discovered"] for t in early["triggers"])
