// Every tunable number for the frontend lives here.

// Mock switch: set VITE_USE_MOCK=false in .env to call the real backend.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
// Requests go to /api, which the Vite dev and preview servers forward to the backend (see vite.config.js).
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Levels for the experimental demo score, matching risk_level in risk.json. Every level has a
// word as well as a color. "elevated" is the contract's name for the middle level.
export const RISK_LEVELS = {
  low: { label: 'Low', color: 'var(--mint)', mood: 'happy' },
  moderate: { label: 'Moderate', color: 'var(--sun)', mood: 'uneasy' },
  elevated: { label: 'Elevated', color: 'var(--sun)', mood: 'uneasy' },
  high: { label: 'High', color: 'var(--coral)', mood: 'worried' },
};

// What the companion says for each level. A low score never promises a safe day.
export const MOOD_LINES = {
  low: 'Lower score for tomorrow. Keep your action plan handy anyway.',
  moderate: "Some things in the air tomorrow. Let's keep an eye out.",
  elevated: "Some things in the air tomorrow. Let's keep an eye out.",
  high: "Higher score for tomorrow. Let's get ready together.",
};

export const SCORE_NAME = 'Experimental demo score';
export const MODEL_NOTE = 'Demo model trained on simulated patient data. Not a medical prediction or diagnosis.';

// Used only if the backend sends a score without a level.
export function levelFromScore(score) {
  if (score >= 0.66) return 'high';
  if (score >= 0.33) return 'moderate';
  return 'low';
}

// "Still learning your patterns" period, from the planning notes.
export const BASELINE_WINDOW_DAYS = 14;

// Game rules.
export const XP_PER_CHECK_IN = 50;
export const XP_PER_STREAK_DAY = 10;
export const XP_PER_FEEDBACK = 15;
export const XP_PER_LEVEL = 200;

export const DEFAULT_COMPANION_NAME = 'Breezy';
export const DEFAULT_CITY = 'Gainesville, FL';
// Everyone uses the city's time zone so one person's Saturday is everyone's Saturday.
export const CITY_TIME_ZONE = 'America/New_York';

export const DISCLAIMER = "This app helps you track risk and doesn't replace advice from your doctor.";

// A prediction counts as "flare-up expected" at or above this score when scoring feedback.
export const FLARE_PREDICTION_THRESHOLD = 0.5;

// When a condition counts as bad enough to flag on the condition chip.
export const CONDITION_ALERTS = {
  pollenHigh: 3.5, // 0-5 index
  pollenModerate: 2.5,
  aqiHigh: 100,
  aqiModerate: 51,
  pressureDropHigh: -6, // hPa in 24h
  pressureDropModerate: -3,
  humidityHigh: 80, // %
  humidityModerate: 70,
  coldHighC: 5, // °C and below
  coldModerateC: 10,
};

// Streak stamp card: one stamp per daily check-in, with a bonus when the card fills.
export const STREAK_CARD_DAYS = 7;
export const XP_STREAK_CARD_BONUS = 100;

// Daily symptom check-in scale (0 = none ... 3 = severe), from the planning notes.
export const SYMPTOM_LEVELS = ['None', 'Mild', 'Moderate', 'Severe'];
export const SYMPTOMS = [
  { id: 'breath', label: 'Shortness of breath' },
  { id: 'wheeze', label: 'Wheezing or chest tightness' },
  { id: 'cough', label: 'Cough' },
];
// Any of these sends the user to the urgent-care screen instead of the quest reward.
export const EMERGENCY_SIGNS = ['Severe breathlessness', 'Blue or gray lips', 'Rescue inhaler not helping'];
