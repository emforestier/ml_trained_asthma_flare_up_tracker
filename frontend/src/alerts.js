// Trigger alerts: cautions raised when one of the user's triggers is high near them today.
// Which triggers count comes from the model's per-user trigger profile (triggers.json). Until a
// user has enough history, it comes from the triggers they reported during onboarding instead.
// Wording says "may" and describes model influence, never proven causes or medication changes.
import { BASELINE_WINDOW_DAYS, CONDITION_ALERTS as A } from './config';

const band = (value, high, moderate, lowerIsWorse = false) => {
  if (value === null || value === undefined) return null;
  if (lowerIsWorse) return value <= high ? 'high' : value <= moderate ? 'moderate' : 'low';
  return value >= high ? 'high' : value >= moderate ? 'moderate' : 'low';
};

// One rule per trigger: where it lives in triggers.json and the survey, how bad it is today,
// and how to describe it.
const RULES = [
  {
    id: 'pollen',
    feature: 'pollen',
    reported: 'Pollen',
    enemy: 'pollen',
    title: 'Heads up: pollen near you',
    level: (c) => {
      const values = Object.values(c.pollen || {}).filter((v) => v !== null && v !== undefined);
      return values.length ? band(Math.max(...values), A.pollenHigh, A.pollenModerate) : null;
    },
    describe: (c, level) => {
      const [type, value] = Object.entries(c.pollen).sort((a, b) => b[1] - a[1])[0];
      return `synthetic ${type} pollen is ${level} (${value} of 5)`;
    },
  },
  {
    id: 'air_quality',
    feature: 'air_quality',
    reported: 'Smoke or air pollution',
    enemy: 'air_quality',
    title: 'Heads up: air quality near you',
    level: (c) => (c.aqi === null || c.aqi === undefined ? null : c.aqi > A.aqiHigh ? 'high' : c.aqi >= A.aqiModerate ? 'moderate' : 'low'),
    describe: (c, level) => `air quality is ${level === 'high' ? 'poor' : 'moderate'} (AQI ${c.aqi})`,
  },
  {
    id: 'pressure_drop',
    feature: 'pressure_drop',
    reported: null,
    enemy: 'weather',
    title: 'Heads up: a big pressure drop',
    level: (c) => band(c.pressure_change_24h, A.pressureDropHigh, A.pressureDropModerate, true),
    describe: (c) => `air pressure dropped ${Math.abs(c.pressure_change_24h)} hPa in the last 24 hours`,
  },
  {
    id: 'humidity',
    feature: 'humidity',
    reported: 'Humid weather',
    enemy: 'weather',
    title: 'Heads up: humid weather today',
    level: (c) => band(c.humidity, A.humidityHigh, A.humidityModerate),
    describe: (c, level) => `humidity is ${level} (${c.humidity}%)`,
  },
  {
    id: 'cold_air',
    feature: 'cold_air',
    reported: 'Cold air',
    enemy: 'weather',
    title: 'Heads up: cold air today',
    level: (c) => band(c.temperature_c, A.coldHighC, A.coldModerateC, true),
    describe: (c) => `it's cold (${c.temperature_c}°C)`,
  },
];

const STRENGTH_ORDER = { strong: 3, moderate: 2, weak: 1 };
const capitalize = (text) => text[0].toUpperCase() + text.slice(1);

// True if a check-in shows any symptoms, symptom-related puffs or night waking.
export function loggedSymptoms(entry) {
  if (!entry) return false;
  const score = (entry.symptoms?.breath || 0) + (entry.symptoms?.wheeze || 0) + (entry.symptoms?.cough || 0);
  const eligiblePuffs = (entry.puffs || 0) - (entry.pre_exercise_puffs || 0);
  return score > 0 || eligiblePuffs > 0 || entry.night_waking === true;
}

// Returns today's alerts, most important first. `entry` is today's check-in, if any.
export function buildTriggerAlerts({ environment, triggers, profile, game, entry, date }) {
  if (!environment?.current) return [];
  const learned = profile.isDemo || game.checkIns >= BASELINE_WINDOW_DAYS;
  const reportedList = profile.survey?.triggers || [];
  const symptoms = loggedSymptoms(entry);
  const alerts = [];

  for (const rule of RULES) {
    const today = rule.level(environment.current);
    if (!today || today === 'low') continue;

    const trigger = (triggers || []).find((item) => item.feature === rule.feature && item.discovered);
    const strength = learned && trigger && STRENGTH_ORDER[trigger.strength] ? trigger.strength : null;
    const reported = Boolean(rule.reported && reportedList.includes(rule.reported));

    // Strong triggers alert on moderate or high conditions; moderate triggers and reported
    // triggers alert on high conditions only; weak triggers never alert.
    const qualifies = strength === 'strong' || ((strength === 'moderate' || reported) && today === 'high');
    if (!qualifies) continue;

    const situation = rule.describe(environment.current, today);
    const lead = symptoms
      ? `You logged symptoms today while ${situation} near you.`
      : `${capitalize(situation)} near you today.`;
    const reason =
      strength && strength !== 'weak'
        ? `${trigger.label} had a ${strength} influence on this demo model's predictions for you.`
        : `You reported ${rule.reported.toLowerCase()} as a trigger.`;
    const body = `${lead} ${reason} You may be more likely to have a flare-up. Consider keeping your rescue inhaler with you and reviewing your asthma action plan.`;

    alerts.push({
      // A check-in with symptoms gets its own id, so it alerts even if today's general alert was seen.
      id: `${rule.id}-${date}${symptoms ? '-symptoms' : ''}`,
      trigger: rule.id,
      enemy: rule.enemy,
      level: today,
      title: rule.title,
      body,
      // Shorter version for the map banner.
      summary: `${lead} You may be more likely to have a flare-up.`,
      rank: (STRENGTH_ORDER[strength] || 1.5) * 10 + (today === 'high' ? 1 : 0),
    });
  }
  return alerts.sort((a, b) => b.rank - a.rank);
}
