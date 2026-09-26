// The only file that talks to the backend. Screens call these functions and never use fetch directly.
// With USE_MOCK on, reads come from src/mocks. With it off, reads go to FastAPI and fall back
// to the mocks if a request fails, so the demo keeps working if the backend goes down.
import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, USE_MOCK } from './config';
import risk from './mocks/risk.json';
import triggers from './mocks/triggers.json';
import environment from './mocks/environment.json';
import log from './mocks/log.json';
import summary from './mocks/summary.json';

const MOCKS = { risk, triggers, environment, log, summary };
const MOCK_DELAY_MS = 250;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const copy = (value) => JSON.parse(JSON.stringify(value));

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

async function read(name, user) {
  if (USE_MOCK) {
    await wait(MOCK_DELAY_MS);
    return copy(MOCKS[name]);
  }
  try {
    return await request(`/${name}?user=${encodeURIComponent(user)}`);
  } catch (error) {
    console.warn(`[api] GET /${name} failed, showing mock data instead`, error);
    return { ...copy(MOCKS[name]), fromMock: true };
  }
}

async function send(name, body) {
  if (USE_MOCK) {
    await wait(MOCK_DELAY_MS);
    return { ok: true, mock: true };
  }
  try {
    return await request(`/${name}`, { method: 'POST', body: JSON.stringify(body) });
  } catch (error) {
    console.warn(`[api] POST /${name} failed`, error);
    return { ok: false, error: error.message };
  }
}

// Reads (one per contract file).
export const getRisk = (user = 'demo') => read('risk', user);
export const getTriggers = (user = 'demo') => read('triggers', user);
export const getEnvironment = (user = 'demo') => read('environment', user);
export const getLog = (user = 'demo') => read('log', user);
export const getSummary = (user = 'demo') => read('summary', user);

// Writes.
// entry: { user, date, puffs, pre_exercise_puffs, symptoms: {breath, wheeze, cough}, night_waking, emergency_signs: [] }
export const submitCheckIn = (entry) => send('log', entry);
// feedback: { user, date, predicted_risk, had_flare_up }
export const submitFeedback = (feedback) => send('feedback', feedback);
// profile: { user, companion_name, survey, baseline_estimate }
export const saveProfile = (profile) => send('profile', profile);

// Loads one endpoint for a screen: const { data, loading } = useApi(getRisk);
export function useApi(loader) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const load = useCallback(() => {
    let active = true;
    setState((previous) => ({ ...previous, loading: true }));
    loader()
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [loader]);

  useEffect(() => load(), [load]);
  return { ...state, reload: load };
}
