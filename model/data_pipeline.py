
import requests
import pandas as pd
import numpy as np

LAT, LON = 29.6516, -82.3248  # Gainesville coordinates
START = "2025-09-01"
END   = "2026-09-01"

# --- Weather ---
weather_url = "https://archive-api.open-meteo.com/v1/archive"
params = {
    "latitude": LAT,
    "longitude": LON,
    "start_date": START,
    "end_date": END,
    "daily": ["temperature_2m_max","temperature_2m_min","relative_humidity_2m_max",
              "surface_pressure_mean","windspeed_10m_max","precipitation_sum"],
    "timezone": "auto"
}
r = requests.get(weather_url, params=params)
weather_df = pd.DataFrame(r.json()["daily"])
weather_df.rename(columns={"time":"date"}, inplace=True)
weather_df.to_csv("weather.csv", index=False)

# --- Air quality (hourly, averaged into daily) ---
aq_url = "https://air-quality-api.open-meteo.com/v1/air-quality"
params = {
    "latitude": LAT,
    "longitude": LON,
    "start_date": START,
    "end_date": END,
    "hourly": ["pm2_5", "pm10", "ozone"],
    "timezone": "auto"
}
r = requests.get(aq_url, params=params)
aq_hourly = pd.DataFrame(r.json()["hourly"])
aq_hourly["time"] = pd.to_datetime(aq_hourly["time"])
aq_hourly["date"] = aq_hourly["time"].dt.date

aq_df = aq_hourly.groupby("date")[["pm2_5", "pm10", "ozone"]].mean().reset_index()
aq_df.rename(columns={"pm2_5":"pm2_5_mean", "pm10":"pm10_mean", "ozone":"ozone_mean"}, inplace=True)
aq_df["date"] = pd.to_datetime(aq_df["date"])
aq_df.to_csv("air_quality.csv", index=False)

# --- Merge weather + air quality ---
weather_df["date"] = pd.to_datetime(weather_df["date"])
aq_df["date"] = pd.to_datetime(aq_df["date"])

env_df = weather_df.merge(aq_df, on="date", how="inner")
env_df = env_df.sort_values("date").reset_index(drop=True)

# --- Synthetic pollen ---
env_df["day_of_year"] = env_df["date"].dt.dayofyear

def seasonal_pollen(doy, peak_day=90, width=40):
    return 5 * np.exp(-((doy - peak_day) ** 2) / (2 * width ** 2))

np.random.seed(42)
env_df["pollen_base"] = env_df["day_of_year"].apply(seasonal_pollen)

env_df["pollen"] = (
    env_df["pollen_base"]
    - 0.3 * env_df["precipitation_sum"]
    + 0.1 * env_df["windspeed_10m_max"]
    + np.random.normal(0, 0.4, len(env_df))
)
env_df["pollen"] = env_df["pollen"].clip(0, 5)

env_df.to_csv("model/env_data_with_pollen.csv", index=False)
