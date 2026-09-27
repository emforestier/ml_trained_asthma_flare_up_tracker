// The only file that talks to the backend. Screens call these functions and never use fetch directly.
// With USE_MOCK on, reads come from src/mocks. With it off, reads go to FastAPI and fall back
// to the mocks if a request fails, so the demo keeps working if the backend goes down.
import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, CITY_TIME_ZONE, USE_MOCK } from './config';
import { DEMO_USER_ID } from './survey';
import risk from './mocks/risk.json';
import triggers from './mocks/triggers.json';
import environment from './mocks/environment.json';
import log from './mocks/log.json';
import summary from './mocks/summary.json';

const MOCKS = { risk, triggers, environment, log, summary };
const MOCK_DELAY_MS = 250;
// Give up on a slow backend instead of leaving a screen waiting forever.
const REQUEST_TIMEOUT_MS = 8000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const copy = (value) => JSON.parse(JSON.stringify(value));

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options,
    });
    if (!response.ok) throw new Error(`${path} returned ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function cityDate(offsetDays = 0) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: CITY_TIME_ZONE });
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function mockResponse(name, user, checkIns = 0) {
  if (user === DEMO_USER_ID) {
    const data = copy(MOCKS[name]);
    if (name === 'log') {
      data.entries = data.entries.map((entry, index) => ({ ...entry, date: cityDate(-index - 1) }));
    }
    return data;
  }

  if (name === 'risk') {
    if (checkIns < 1) {
      return { user_id: user, status: 'insufficient_data', message: 'Complete your first daily check-in to start your forecast.', data_mode: 'no_history' };
    }
    return { ...copy(risk), user_id: user, days_logged: checkIns };
  }
  if (name === 'triggers') {
    const data = copy(triggers);
    data.user_id = user;
    data.days_used = checkIns;
    data.triggers = data.triggers.map((trigger) => ({
      ...trigger,
      strength: 'none',
      score: 0,
      discovered: false,
      evidence: checkIns < 14 ? `Needs 14 days of check-ins (currently ${checkIns}).` : 'Your personal patterns are still being calculated.',
    }));
    return data;
  }
  if (name === 'log') {
    return { user, days_logged: checkIns, streak: 0, xp: 0, accuracy: { correct: 0, total: 0 }, last_prediction: null, entries: [] };
  }
  if (name === 'summary') {
    return { user_id: user, check_ins: checkIns, flare_ups: 0, days_in_week: 7, text: 'Your activity summary will appear as your check-ins accumulate.' };
  }
  return copy(MOCKS[name]);
}

// The backend's /environment nests weather, air_quality and pollen. The screens read one flat
// `current` block, so convert here. Responses already in the flat shape pass through unchanged.
// Anything the backend doesn't send yet becomes null ("Not available"), never a made-up zero.
const valueOrNull = (value) => (value === undefined ? null : value);

export function normalizeEnvironment(data) {
  if (!data || data.current) return data;
  const weather = data.weather || {};
  const air = data.air_quality || {};
  const pollen = data.pollen || {};
  const { tree, grass, weed } = pollen;
  return {
    city: data.city,
    lat: data.lat,
    lon: data.lon,
    fetched_at: data.fetched_at ?? null,
    valid_for: data.valid_for ?? data.date ?? null,
    // Sample data from the backend is labeled as not live.
    is_stale: data.is_stale ?? data.data_mode !== 'live',
    sources: {
      weather: weather.source,
      air_quality: air.source,
      pollen: pollen.source ? `${pollen.source}${pollen.scale ? ` (${pollen.scale})` : ''}` : undefined,
    },
    current: {
      temperature_c: valueOrNull(weather.temperature_c),
      humidity: valueOrNull(weather.humidity_percent ?? weather.humidity),
      pressure_hpa: valueOrNull(weather.pressure_hpa),
      pressure_change_24h: valueOrNull(weather.pressure_change_24h),
      wind_kph: valueOrNull(weather.wind_speed_kmh),
      rain_mm: valueOrNull(weather.rain_mm),
      aqi: valueOrNull(air.aqi ?? air.us_aqi),
      pm25: valueOrNull(air.pm2_5),
      ozone: valueOrNull(air.ozone),
      pollen: { tree: valueOrNull(tree), grass: valueOrNull(grass), weed: valueOrNull(weed) },
    },
    // Map zones are a frontend-only illustrative overlay until the backend provides them.
    zones_note: data.zones_note ?? environment.zones_note,
    zones: data.zones ?? copy(environment.zones),
    forecast: data.forecast ?? [],
  };
}

const NORMALIZE = { environment: normalizeEnvironment };

async function read(name, user, checkIns = 0) {
  if (USE_MOCK) {
    await wait(MOCK_DELAY_MS);
    return mockResponse(name, user, checkIns);
  }
  try {
    const data = await request(`/${name}?user=${encodeURIComponent(user)}`);
    return NORMALIZE[name] ? NORMALIZE[name](data) : data;
  } catch (error) {
    console.warn(`[api] GET /${name} failed, showing mock data instead`, error);
    return { ...mockResponse(name, user, checkIns), fromMock: true };
  }
}

// Returns { ok: true, mock, data } when saved, or { ok: false, error } so screens only
// report success after a save actually worked. Mock saves live in this browser only.
async function send(name, body) {
  if (USE_MOCK) {
    await wait(MOCK_DELAY_MS);
    return { ok: true, mock: true, data: null };
  }
  try {
    const data = await request(`/${name}`, { method: 'POST', body: JSON.stringify(body) });
    return { ok: true, mock: false, data };
  } catch (error) {
    console.warn(`[api] POST /${name} failed`, error);
    return { ok: false, error: error.message };
  }
}

// Reads (one per contract file).
export const getRisk = (user = DEMO_USER_ID, checkIns = 0) => read('risk', user, checkIns);
export const getTriggers = (user = DEMO_USER_ID, checkIns = 0) => read('triggers', user, checkIns);
export const getEnvironment = (user = DEMO_USER_ID) => read('environment', user);
export const getLog = (user = DEMO_USER_ID, checkIns = 0) => read('log', user, checkIns);
export const getSummary = (user = DEMO_USER_ID, checkIns = 0) => read('summary', user, checkIns);

// Writes.
// entry: { user, date, puffs (total, including pre-exercise), pre_exercise_puffs, symptoms: {breath, wheeze, cough},
//          night_waking, emergency_signs: [] }. Saving the same user and date again updates that day.
export const saveLog = (entry) => send('log', entry);
// feedback: { user, date, predicted_risk, had_flare_up }
export const saveFeedback = (feedback) => send('feedback', feedback);
// profile: { user, companion_name, survey, baseline_estimate }
export const saveProfile = (profile) => send('profile', profile);

// Loads one endpoint for a screen: const { data, loading } = useApi(getRisk);
export function useApi(loader, user, checkIns = 0) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const load = useCallback(() => {
    let active = true;
    setState((previous) => ({ ...previous, loading: true }));
    loader(user, checkIns)
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [loader, user, checkIns]);

  useEffect(() => load(), [load]);
  return { ...state, reload: load };
}
