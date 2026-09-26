// Every tunable number for the frontend lives here.

// Mock switch: set VITE_USE_MOCK=false in .env to call the real backend.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Risk levels, matching risk_level in risk.json.
export const RISK_LEVELS = {
  low: { label: 'Low', color: 'var(--mint)', mood: 'happy' },
  moderate: { label: 'Moderate', color: 'var(--sun)', mood: 'uneasy' },
  high: { label: 'High', color: 'var(--coral)', mood: 'worried' },
};

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

export const DISCLAIMER = "This app helps you track risk and doesn't replace advice from your doctor.";
