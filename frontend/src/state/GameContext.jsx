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

// Medals with bronze, silver and gold tiers, earned by showing up (never by having fewer
// symptoms or using less medication).
export const MEDAL_TIERS = ['Bronze', 'Silver', 'Gold'];
export const MEDALS = [
  { id: 'streak', icon: 'streak', name: 'Streak keeper', unit: 'day streak', stat: (g) => g.bestStreak, tiers: [3, 7, 30] },
  { id: 'checkins', icon: 'calendar', name: 'Check-in pro', unit: 'check-ins', stat: (g) => g.checkIns, tiers: [7, 14, 30] },
  { id: 'feedback', icon: 'target', name: 'Truth teller', unit: 'answers', stat: (g) => g.feedbackCount, tiers: [3, 10, 25] },
  { id: 'level', icon: 'star', name: 'Rising star', unit: 'level', stat: (g) => levelInfo(g.xp).level, tiers: [3, 5, 10] },
];

// How many tiers of a medal are earned: 0 (none) to 3 (gold).
export function medalTier(medal, game) {
  const value = medal.stat(game);
  return medal.tiers.filter((needed) => value >= needed).length;
}

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
  alertsSeen: { date: null, ids: [] },
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

// Alert ids already shown today.
export function alertsSeenToday(game) {
  return game.alertsSeen?.date === todayString() ? game.alertsSeen.ids : [];
}

export function levelInfo(xp) {
  return {
    level: Math.floor(xp / XP_PER_LEVEL) + 1,
    progress: xp % XP_PER_LEVEL,
    needed: XP_PER_LEVEL,
  };
}

// One id per earned medal tier, for example "streak-2" for silver.
const earnedIds = (game) =>
  MEDALS.flatMap((medal) => Array.from({ length: medalTier(medal, game) }, (_, tier) => `${medal.id}-${tier + 1}`));

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

  // Saves edited survey answers without touching progress or demo status.
  const updateProfile = useCallback((changes) => {
    setState((previous) => ({ ...previous, profile: { ...previous.profile, ...changes } }));
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
        newBadges: earnedIds(next)
          .filter((id) => !before.includes(id))
          .map((id) => {
            const [medalId, tier] = id.split('-');
            const medal = MEDALS.find((item) => item.id === medalId);
            return { id, icon: medal.icon, name: `${MEDAL_TIERS[tier - 1]} ${medal.name}` };
          }),
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

  // Remembers which trigger alerts were shown today so each appears at most once a day.
  const markAlertsSeen = useCallback((ids) => {
    const today = todayString();
    setState((previous) => {
      const seen = previous.game.alertsSeen?.date === today ? previous.game.alertsSeen.ids : [];
      const merged = [...new Set([...seen, ...ids])];
      return { ...previous, game: { ...previous.game, alertsSeen: { date: today, ids: merged } } };
    });
  }, []);

  const markMapVisited = useCallback(() => {
    setState((previous) => (previous.game.visitedMap ? previous : { ...previous, game: { ...previous.game, visitedMap: true } }));
  }, []);

  const value = useMemo(
    () => ({ ...state, startDemo, finishOnboarding, updateProfile, reset, recordCheckIn, recordFeedback, markAlertsSeen, markMapVisited }),
    [state, startDemo, finishOnboarding, updateProfile, reset, recordCheckIn, recordFeedback, markAlertsSeen, markMapVisited],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  return useContext(GameContext);
}
