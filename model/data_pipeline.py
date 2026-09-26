import requests
import pandas as pd
import numpy as np

LAT, LON = 29.6516, -82.3248  # Gainesville coordinates
START = "2025-09-01"
END   = "2026-09-01"

# Weather
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

# Pulls a request of this data from the internet
r = requests.get(weather_url, params=params)

# Converts the data from the internet into a json file and then uses panda to create a table
weather_df = pd.DataFrame(r.json()["daily"])
weather_df.rename(columns={"time":"date"}, inplace=True)
weather_df.to_csv("weather.csv", index=False)

# Takes hourly readings of the air quality from the API and averages them into a single day
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

# Converts the weather date into an actual date time data type so that it matches with
# the air quality panda table and the columns can merge
weather_df["date"] = pd.to_datetime(weather_df["date"])
aq_df["date"] = pd.to_datetime(aq_df["date"])

# Combines the two panda tables, making sure each date is associated with its proper characteristics
env_df = weather_df.merge(aq_df, on="date", how="inner")
env_df = env_df.sort_values("date").reset_index(drop=True)

# Cell where we create the synthetic pollen data (because the Open Meteo API does not have that information)

# Starts by creating a new column for the merged table which is for the day of the year associated with each date
# Each column is now numbered and each date is associated with a number from 1 - 366
env_df["day_of_year"] = env_df["date"].dt.dayofyear

# creates a function which takes the day of the year and makes the default peak day 90 for March
# and 40 being the amount of days around the peak day where pollen levels are still somewhat elevated
def seasonal_pollen(doy, peak_day=90, width=40):
    # Creates a 0 - 5 pollen scale by using the bell curve formula
    # Day 90 being a level 5 pollen scale and days outside of the range of the curve being 0
    return 5 * np.exp(-((doy - peak_day) ** 2) / (2 * width ** 2))

# Makes a random but predictable number for consistent synthetic data revolving the pollen
# (42 doesn't matter bc it can be any number)
np.random.seed(42)

# Runs seasonal pollen function on every day of the year in every column and assigns it a baseline pollen number
env_df["pollen_base"] = env_df["day_of_year"].apply(seasonal_pollen)

# Creates another column in the table which:
# - subtracts 30 percent of the day's rainfall from the pollen value (pollen is washed out of the air)
# - adds 10 percent of the day's wind speed since wind increases pollen count
# - adds a random number (bell curve of numbers) to generate random noise of pollen to every day
#   (accounts for various pollen fluctuation levels)
env_df["pollen"] = (
    env_df["pollen_base"]
    - 0.3 * env_df["precipitation_sum"]
    + 0.1 * env_df["windspeed_10m_max"]
    + np.random.normal(0, 0.4, len(env_df))
)

# Makes sure that any previous math doesn't leave the boundary of 1 through 5,
# so it forced any number below 0 to at least 0 and any number above 5 to just 5
env_df["pollen"] = env_df["pollen"].clip(0, 5)

# Generates an entire year's worth of effects on higher sensitivity symptoms
# for the model to identify the differences between different times of year
np.random.seed(1)
n = len(env_df)

pollen_sensitivity = 0.6
aq_sensitivity = 0.2
pressure_sensitivity = 0.3

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

env_df["symptom_total"] = env_df[["symptom_breath", "symptom_wheeze", "symptom_cough"]].sum(axis=1)

# rolling baseline: median of previous 14 days, excluding today
# Makes it so that each day has the previous day's puff count average and makes up for the days
# before the first 7 day period so that they also have data, and takes the median for those 14 day windows
env_df["baseline_puffs"] = env_df["puffs"].shift(1).rolling(14, min_periods=7).median()

# Defines a flare up:
# - The amount of puffs that day is 2 above the day's baseline, or 4+ symptoms were true for the day,
#   or they woke up that night
env_df["is_flareup"] = (
    (env_df["puffs"] - env_df["baseline_puffs"] >= 2) |
    (env_df["symptom_total"] >= 4) |
    (env_df["night_waking"] == 1)
).astype(int)

# Shifts each day back so that each row now instead holds the next day's flare up prediction
env_df["label_next_day_flareup"] = env_df["is_flareup"].shift(-1)

# Drops any days without usable data
env_df = env_df.dropna(subset=["label_next_day_flareup", "baseline_puffs"])
env_df["label_next_day_flareup"] = env_df["label_next_day_flareup"].astype(int)

# Past 2 day + that day's puff avg
env_df["puffs_3day_avg"] = env_df["puffs"].rolling(3).mean()

# Past 2 day + that day's environmental stimulant average (pollen and particulate matter of size 2.5)
env_df["pollen_3day_avg"] = env_df["pollen"].rolling(3).mean()
env_df["aqi_3day_avg"] = env_df["pm2_5_mean"].rolling(3).mean()

# Updates name for pressure change column so it reflects change over 24 hour periods
env_df["pressure_24h_change"] = env_df["pressure_change"]

# Shifts every value down to see yesterday's puff amount
env_df["puffs_yesterday"] = env_df["puffs"].shift(1)

# Creates new column to calculate the amount of puffs above the baseline
# (pos. means more puffs than usual and neg. means less)
env_df["puffs_above_baseline"] = env_df["puffs"] - env_df["baseline_puffs"]

# True or false column of if the day's puff count was higher than normal and adds up those number of days
env_df["days_above_baseline_7d"] = (env_df["puffs_above_baseline"] > 0).rolling(7).sum()

# Defines featured columns to be fed to the model
feature_cols = [
    "pollen", "pm2_5_mean", "surface_pressure_mean", "temperature_2m_max",
    "windspeed_10m_max", "precipitation_sum",
    "puffs_3day_avg", "pollen_3day_avg", "aqi_3day_avg",
    "pressure_24h_change", "puffs_yesterday", "baseline_puffs",
    "puffs_above_baseline", "days_above_baseline_7d"
]

# Some of the days with not enough data will be dropped
model_df = env_df.dropna(subset=feature_cols + ["label_next_day_flareup"])

# Separates the table into an X-Y relationship where X is the columns for the calculated data
# and y is the information that the model is trying to predict
X = model_df[feature_cols]
y = model_df["label_next_day_flareup"]

env_df.to_csv("model/env_data_with_flareup_labels.csv", index=False)
