// Profile and game progress (XP, streak, badges), saved in the browser so a refresh keeps them.
// The backend owns the health data; this only holds what the game layer needs.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  CITY_TIME_ZONE,
  DEFAULT_COMPANION_NAME,
  STREAK_CARD_DAYS,
  XP_PER_CHECK_IN,
  XP_PER_FEEDBACK,
  XP_PER_LEVEL,
  XP_PER_STREAK_DAY,
  XP_STREAK_CARD_BONUS,
} from '../config';
import demoLog from '../mocks/log.json';
import { DEMO_USER_ID } from '../survey';

const STORAGE_KEY = 'breezy-state-v2';

export const BADGES = [
  { id: 'first', icon: '🌱', name: 'First breath', description: 'Finish your first check-in', earned: (g) => g.checkIns >= 1 },
  { id: 'streak3', icon: '🔥', name: 'On a roll', description: 'Check in 3 days in a row', earned: (g) => g.bestStreak >= 3 },
  { id: 'streak7', icon: '⭐', name: 'Week warrior', description: 'Check in 7 days in a row', earned: (g) => g.bestStreak >= 7 },
  { id: 'pattern', icon: '🧠', name: 'Pattern unlocked', description: 'Log 14 days so your baseline is fully personal', earned: (g) => g.checkIns >= 14 },
  { id: 'feedback', icon: '🎯', name: 'Truth teller', description: 'Tell us 5 times whether a flare-up happened', earned: (g) => g.feedbackCount >= 5 },
  { id: 'explorer', icon: '🗺️', name: 'Air explorer', description: 'Open the air map', earned: (g) => g.visitedMap },
];

// Local date (YYYY-MM-DD) in the team's city time zone, offset by whole days.
export function todayString(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return date.toLocaleDateString('en-CA', { timeZone: CITY_TIME_ZONE });
}

const EMPTY_GAME = {
  xp: 0,
  streak: 0,
  bestStreak: 0,
  checkIns: 0,
  lastCheckInDate: null,
  todayEntry: null,
  feedbackCount: 0,
  lastFeedbackDate: null,
  accuracy: { correct: 0, total: 0 },
  visitedMap: false,
};

// The demo user arrives with three weeks of history, checked in through yesterday.
function demoGame() {
  return {
    ...EMPTY_GAME,
    xp: demoLog.xp,
    streak: demoLog.streak,
    bestStreak: demoLog.streak,
    checkIns: demoLog.days_logged,
    lastCheckInDate: todayString(-1),
    feedbackCount: 4,
    accuracy: { ...demoLog.accuracy },
  };
}

const DEMO_PROFILE = {
  onboarded: true,
  isDemo: true,
  user: DEMO_USER_ID,
  nickname: 'Sam',
  city: 'Gainesville, FL',
  companionName: DEFAULT_COMPANION_NAME,
  survey: {
    nickname: 'Sam',
    city: 'Gainesville, FL',
    rescueDays: '1–2 days',
    puffsPerDay: '2 puffs',
    nightWaking: 'Once or twice in the past four weeks',
    controller: 'Yes',
    triggers: ['Pollen', 'Smoke or air pollution'],
    preExercise: 'Yes',
  },
  baselineEstimate: 0.43,
};

const EMPTY_PROFILE = {
  onboarded: false,
  isDemo: false,
  user: DEMO_USER_ID,
  nickname: '',
  city: '',
  companionName: DEFAULT_COMPANION_NAME,
  survey: {},
  baselineEstimate: null,
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.profile && saved.game) return saved;
  } catch {
    // Storage blocked or corrupt: start fresh.
  }
  // No saved state yet: a first-time user, who starts with onboarding.
  return { profile: EMPTY_PROFILE, game: EMPTY_GAME };
}

// The streak still counts only if the last check-in was today or yesterday.
export function currentStreak(game) {
  return game.lastCheckInDate === todayString() || game.lastCheckInDate === todayString(-1) ? game.streak : 0;
}

export function levelInfo(xp) {
  return {
    level: Math.floor(xp / XP_PER_LEVEL) + 1,
    progress: xp % XP_PER_LEVEL,
    needed: XP_PER_LEVEL,
  };
}

const earnedIds = (game) => BADGES.filter((badge) => badge.earned(game)).map((badge) => badge.id);

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [state, setState] = useState(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked: progress just won't survive a refresh.
    }
  }, [state]);

  const startDemo = useCallback(() => setState({ profile: DEMO_PROFILE, game: demoGame() }), []);

  const finishOnboarding = useCallback((profile) => {
    setState((previous) => ({
      profile: { ...previous.profile, ...profile, onboarded: true },
      game: previous.profile.onboarded ? previous.game : EMPTY_GAME,
    }));
  }, []);

  const reset = useCallback(() => setState({ profile: EMPTY_PROFILE, game: EMPTY_GAME }), []);

  // Records today's check-in and returns what to celebrate. The streak counts days with at
  // least one check-in, so checking in again the same day only updates the entry: no XP.
  const recordCheckIn = useCallback(
    (entry) => {
      const today = todayString();
      const game = state.game;
      if (game.lastCheckInDate === today) {
        setState((previous) => ({ ...previous, game: { ...previous.game, todayEntry: entry } }));
        return { updated: true, streak: game.streak };
      }
      const streak = game.lastCheckInDate === todayString(-1) ? game.streak + 1 : 1;
      const cardFilled = streak % STREAK_CARD_DAYS === 0;
      const xpGained = XP_PER_CHECK_IN + XP_PER_STREAK_DAY * streak + (cardFilled ? XP_STREAK_CARD_BONUS : 0);
      const next = {
        ...game,
        xp: game.xp + xpGained,
        streak,
        bestStreak: Math.max(game.bestStreak, streak),
        checkIns: game.checkIns + 1,
        lastCheckInDate: today,
        todayEntry: entry,
      };
      const before = earnedIds(game);
      setState((previous) => ({ ...previous, game: next }));
      return {
        xpGained,
        streak,
        cardFilled,
        xpBefore: game.xp,
        xpAfter: next.xp,
        leveledUp: levelInfo(next.xp).level > levelInfo(game.xp).level,
        newBadges: BADGES.filter((badge) => badge.earned(next) && !before.includes(badge.id)),
      };
    },
    [state.game],
  );

  // hadFlareUp is compared with yesterday's prediction to update the rolling accuracy.
  const recordFeedback = useCallback((predictedHigh, hadFlareUp) => {
    setState((previous) => {
      const game = previous.game;
      const correct = predictedHigh === hadFlareUp;
      return {
        ...previous,
        game: {
          ...game,
          xp: game.xp + XP_PER_FEEDBACK,
          feedbackCount: game.feedbackCount + 1,
          lastFeedbackDate: todayString(),
          accuracy: { correct: game.accuracy.correct + (correct ? 1 : 0), total: game.accuracy.total + 1 },
        },
      };
    });
  }, []);

  const markMapVisited = useCallback(() => {
    setState((previous) => (previous.game.visitedMap ? previous : { ...previous, game: { ...previous.game, visitedMap: true } }));
  }, []);

  const value = useMemo(
    () => ({ ...state, startDemo, finishOnboarding, reset, recordCheckIn, recordFeedback, markMapVisited }),
    [state, startDemo, finishOnboarding, reset, recordCheckIn, recordFeedback, markMapVisited],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  return useContext(GameContext);
}
