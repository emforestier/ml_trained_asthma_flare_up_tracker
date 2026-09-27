import pandas as pd
import numpy as np

env_df = pd.read_csv("model/env_data_with_pollen.csv")
env_df["date"] = pd.to_datetime(env_df["date"])

# updated version of Alexis's baseline data using the multiple choice options provided by the evaluation questions
# Exact option-to-number mapping, based on the real survey buckets
days_options = {"0 days": 0, "1-2 days": 1.5, "3-4 days": 3.5, "5-7 days": 6}
puffs_options = {"1 puff": 1, "2 puffs": 2, "3-4 puffs": 3.5, "5 or more puffs": 5.5}

survey_days_per_week = days_options["1-2 days"]
survey_puffs_per_day = puffs_options["3-4 puffs"]

# Calculates average puff per day
survey_baseline_puffs = (survey_days_per_week / 7) * survey_puffs_per_day

# Picks a 30-day period from the year of weather and synthetic pollen data (during peak pollen times)
# Reorders the columns based on this filtered data and creates a separate table
demo_window = env_df[(env_df["date"] >= "2026-03-01") & (env_df["date"] <= "2026-03-30")].reset_index(drop=True)

# Generates a random seed to create random but consistent data
# (we use 7 for patient synthetic data to get some consistent noise numbers)
np.random.seed(7)

# Counts amount of days in the demo window (should be 30 days)
n_demo = len(demo_window)

# numbers representing Alexis's asthma sensitivity based on her evaluation answers
demo_pollen_sensitivity = 0.4
demo_aq_sensitivity = 0.15
demo_pressure_sensitivity = 0.25

# Calculates the difference in pressure change each day with exception of the first day which has no previous day
demo_window["pressure_change"] = demo_window["surface_pressure_mean"].diff().fillna(0)

# Risk signal to calculate the day's risk based on various environmental factor sensitivity characteristics
demo_risk_signal = (
    demo_pollen_sensitivity * (demo_window["pollen"] / 5)
    + demo_aq_sensitivity * (demo_window["pm2_5_mean"] / demo_window["pm2_5_mean"].max())
    + demo_pressure_sensitivity * (-demo_window["pressure_change"] / 5).clip(0, 1)
)

# Calculates the synthetic puff count for each day using the baseline puff number, the risk signal
# calculation, and the bell curve to add some consistent randomness to the data
demo_window["puffs"] = np.round(
    survey_baseline_puffs + demo_risk_signal * 3 + np.random.normal(0, 0.3, n_demo)
    # makes sure no number goes below 0
).clip(0)

demo_window["pre_exercise"] = 0

# Takes each symptom into account and uses Alexis's specific risk signal number and the bell curve
# randomness to generate a number for each symptom's severity
demo_window["symptom_breath"] = np.round((demo_risk_signal * 2 + np.random.normal(0, 0.3, n_demo)).clip(0, 3))
demo_window["symptom_wheeze"] = np.round((demo_risk_signal * 2 + np.random.normal(0, 0.3, n_demo)).clip(0, 3))
demo_window["symptom_cough"]  = np.round((demo_risk_signal * 1.5 + np.random.normal(0, 0.3, n_demo)).clip(0, 3))
demo_window["night_waking"]   = 0

# Puts all symptoms and scores into a column
demo_window["symptom_total"] = demo_window[["symptom_breath","symptom_wheeze","symptom_cough"]].sum(axis=1)

demo_window.to_csv("model/alexis_demo_log.csv", index=False)
