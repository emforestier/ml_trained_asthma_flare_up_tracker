import requests
import pandas as pd
import numpy as np

LAT, LON = 29.6516, -82.3248  # Gainesville coordinates
START = "2025-09-01"
END   = "2026-09-01"

# --- Weather ---
weather_url = "https://archive-api.open-meteo.com/v1/archive"
params = {
    "latitude": LAT, "longitude": LON, "start_date": START, "end_date": END,
    "daily": ["temperature_2m_max","temperature_2m_min","relative_humidity_2m_max",
              "surface_pressure_mean","windspeed_10m_max","precipitation_sum"],
    "timezone": "auto"
}
r = requests.get(weather_url, params=params)
weather_df = pd.DataFrame(r.json()["daily"])
weather_df.rename(columns={"time":"date"}, inplace=True)

# --- Air quality (hourly, averaged into daily) ---
aq_url = "https://air-quality-api.open-meteo.com/v1/air-quality"
params = {
    "latitude": LAT, "longitude": LON, "start_date": START, "end_date": END,
    "hourly": ["pm2_5", "pm10", "ozone"], "timezone": "auto"
}
r = requests.get(aq_url, params=params)
aq_hourly = pd.DataFrame(r.json()["hourly"])
aq_hourly["time"] = pd.to_datetime(aq_hourly["time"])
aq_hourly["date"] = aq_hourly["time"].dt.date
aq_df = aq_hourly.groupby("date")[["pm2_5", "pm10", "ozone"]].mean().reset_index()
aq_df.rename(columns={"pm2_5":"pm2_5_mean", "pm10":"pm10_mean", "ozone":"ozone_mean"}, inplace=True)
aq_df["date"] = pd.to_datetime(aq_df["date"])

# --- Merge ---
weather_df["date"] = pd.to_datetime(weather_df["date"])
env_df = weather_df.merge(aq_df, on="date", how="inner")
env_df = env_df.sort_values("date").reset_index(drop=True)

# --- Synthetic pollen ---
env_df["day_of_year"] = env_df["date"].dt.dayofyear
def seasonal_pollen(doy, peak_day=90, width=40):
    return 5 * np.exp(-((doy - peak_day) ** 2) / (2 * width ** 2))
np.random.seed(42)
env_df["pollen_base"] = env_df["day_of_year"].apply(seasonal_pollen)
env_df["pollen"] = (
    env_df["pollen_base"] - 0.3 * env_df["precipitation_sum"]
    + 0.1 * env_df["windspeed_10m_max"] + np.random.normal(0, 0.4, len(env_df))
)
env_df["pollen"] = env_df["pollen"].clip(0, 5)

# --- Synthetic patient logs (training data) ---
np.random.seed(1)
n = len(env_df)
pollen_sensitivity, aq_sensitivity, pressure_sensitivity = 0.6, 0.2, 0.3
env_df["pressure_change"] = env_df["surface_pressure_mean"].diff().fillna(0)
risk_signal = (
    pollen_sensitivity * (env_df["pollen"] / 5)
    + aq_sensitivity * (env_df["pm2_5_mean"] / env_df["pm2_5_mean"].max())
    + pressure_sensitivity * (-env_df["pressure_change"] / 5).clip(0, 1)
)
baseline_puffs = 1.5
env_df["puffs"] = np.round(baseline_puffs + risk_signal * 3 + np.random.normal(0, 0.5, n)).clip(0)
env_df["pre_exercise"] = np.random.choice([0, 1], n, p=[0.85, 0.15])
env_df["symptom_breath"] = np.round((risk_signal * 3 + np.random.normal(0, 0.4, n)).clip(0, 3))
env_df["symptom_wheeze"] = np.round((risk_signal * 3 + np.random.normal(0, 0.4, n)).clip(0, 3))
env_df["symptom_cough"]  = np.round((risk_signal * 2 + np.random.normal(0, 0.4, n)).clip(0, 3))
env_df["night_waking"]   = (risk_signal + np.random.normal(0, 0.2, n) > 0.6).astype(int)
env_df["symptom_total"] = env_df[["symptom_breath","symptom_wheeze","symptom_cough"]].sum(axis=1)

# --- Flare-up label (no leakage) ---
env_df["baseline_puffs"] = env_df["puffs"].shift(1).rolling(14, min_periods=7).median()
env_df["is_flareup"] = (
    (env_df["puffs"] - env_df["baseline_puffs"] >= 2) |
    (env_df["symptom_total"] >= 4) | (env_df["night_waking"] == 1)
).astype(int)
env_df["label_next_day_flareup"] = env_df["is_flareup"].shift(-1)
env_df = env_df.dropna(subset=["label_next_day_flareup", "baseline_puffs"])
env_df["label_next_day_flareup"] = env_df["label_next_day_flareup"].astype(int)

# --- Features ---
env_df["puffs_3day_avg"] = env_df["puffs"].rolling(3).mean()
env_df["pollen_3day_avg"] = env_df["pollen"].rolling(3).mean()
env_df["aqi_3day_avg"] = env_df["pm2_5_mean"].rolling(3).mean()
env_df["pressure_24h_change"] = env_df["pressure_change"]
env_df["puffs_yesterday"] = env_df["puffs"].shift(1)
env_df["puffs_above_baseline"] = env_df["puffs"] - env_df["baseline_puffs"]
env_df["days_above_baseline_7d"] = (env_df["puffs_above_baseline"] > 0).rolling(7).sum()

feature_cols = [
    "pollen", "pm2_5_mean", "surface_pressure_mean", "temperature_2m_max",
    "windspeed_10m_max", "precipitation_sum", "puffs_3day_avg", "pollen_3day_avg",
    "aqi_3day_avg", "pressure_24h_change", "puffs_yesterday", "baseline_puffs",
    "puffs_above_baseline", "days_above_baseline_7d"
]

model_df = env_df.dropna(subset=feature_cols + ["label_next_day_flareup"])
env_df.to_csv("model/env_data_with_flareup_labels.csv", index=False)
