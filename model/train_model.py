import pandas as pd
import numpy as np
import joblib
import json
import shap
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import recall_score, precision_score, average_precision_score
import lightgbm as lgb

env_df = pd.read_csv("model/env_data_with_flareup_labels.csv")
env_df["date"] = pd.to_datetime(env_df["date"])

feature_cols = [
    "pollen", "pm2_5_mean", "surface_pressure_mean", "temperature_2m_max",
    "windspeed_10m_max", "precipitation_sum",
    "puffs_3day_avg", "pollen_3day_avg", "aqi_3day_avg",
    "pressure_24h_change", "puffs_yesterday", "baseline_puffs",
    "puffs_above_baseline", "days_above_baseline_7d"
]

model_df = env_df.dropna(subset=feature_cols + ["label_next_day_flareup"])
X = model_df[feature_cols]
y = model_df["label_next_day_flareup"]

# Stratified split so both train and test keep a representative mix of flare-up/non-flare-up days
# (a plain chronological split put almost all real flare-ups in training and almost none in testing)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)

# Creates the regression baseline model
logreg = LogisticRegression(max_iter=2000, class_weight="balanced")
logreg.fit(X_train, y_train)
pred_lr = logreg.predict(X_test)

lgb_model = lgb.LGBMClassifier(n_estimators=200, class_weight="balanced")
lgb_model.fit(X_train, y_train)
pred_lgb = lgb_model.predict(X_test)
proba_lgb = lgb_model.predict_proba(X_test)[:, 1]

print("LogReg   — recall:", recall_score(y_test, pred_lr), "precision:", precision_score(y_test, pred_lr))
print("LightGBM — recall:", recall_score(y_test, pred_lgb), "precision:", precision_score(y_test, pred_lgb))
print("LightGBM AUPRC:", average_precision_score(y_test, proba_lgb))

# Lowered from the default 0.5 cutoff to catch more real flare-ups (missing one is worse than a false alarm)
chosen_threshold = 0.35
pred_lgb_adjusted = (proba_lgb >= chosen_threshold).astype(int)
print("Adjusted — recall:", recall_score(y_test, pred_lgb_adjusted),
      "precision:", precision_score(y_test, pred_lgb_adjusted))

explainer = shap.TreeExplainer(lgb_model)
shap_values = explainer.shap_values(X_test)

def bucket_strength(abs_val, all_abs_vals):
    # top third of magnitude range = strong, middle = moderate, bottom = weak
    lo, hi = min(all_abs_vals), max(all_abs_vals)
    span = hi - lo if hi > lo else 1
    pct = (abs_val - lo) / span
    if pct >= 0.66:
        return "strong"
    elif pct >= 0.33:
        return "moderate"
    else:
        return "weak"

def get_trigger_profile(row_idx, top_n=3):
    row_shap = shap_values[row_idx]
    all_abs = [abs(v) for v in row_shap]
    factor_impact = list(zip(feature_cols, row_shap))
    factor_impact.sort(key=lambda x: abs(x[1]), reverse=True)
    return [
        {"factor": f, "impact": float(v), "strength": bucket_strength(abs(v), all_abs)}
        for f, v in factor_impact[:top_n]
    ]

joblib.dump(lgb_model, "model/flare_model.pkl")
joblib.dump(feature_cols, "model/feature_cols.pkl")

def predict(user_features: dict) -> dict:
    row = pd.DataFrame([user_features])[feature_cols]
    proba = float(lgb_model.predict_proba(row)[0][1])

    if proba < chosen_threshold:
        level = "low"
    elif proba < 0.6:
        level = "moderate"
    else:
        level = "high"

    row_shap = explainer.shap_values(row)[0]
    all_abs = [abs(v) for v in row_shap]
    factors = sorted(zip(feature_cols, row_shap), key=lambda x: abs(x[1]), reverse=True)[:3]
    top_factors = [
        {"factor": f, "impact": float(v), "strength": bucket_strength(abs(v), all_abs)}
        for f, v in factors
    ]

    recommendation = f"Consider limiting exposure related to {top_factors[0]['factor']} today."

    return {
        "risk_score": round(proba, 3),
        "risk_level": level,
        "top_factors": top_factors,
        "recommendation": recommendation
    }

# safety check — if this errors, something is still a numpy type
sample = X_test.iloc[0].to_dict()
result = predict(sample)
print(json.dumps(result, indent=2))

sample_outputs = [predict(X_test.iloc[i].to_dict()) for i in range(5)]
with open("model/risk.json", "w") as f:
    json.dump(sample_outputs, f, indent=2)

# triggers.json = just the top_factors from each sample
trigger_outputs = [o["top_factors"] for o in sample_outputs]
with open("model/triggers.json", "w") as f:
    json.dump(trigger_outputs, f, indent=2)
