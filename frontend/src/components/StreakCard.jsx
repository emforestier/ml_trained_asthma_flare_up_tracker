// Seven-stamp streak card: one stamp per daily check-in; the seventh earns a bonus.
import { STREAK_CARD_DAYS, XP_STREAK_CARD_BONUS } from '../config';

// Stamps filled on the current card. A full card stays full on the day it fills.
export function stampsFilled(streak) {
  if (streak <= 0) return 0;
  return ((streak - 1) % STREAK_CARD_DAYS) + 1;
}

export default function StreakCard({ streak, checkedInToday, justStamped = false }) {
  const filled = stampsFilled(streak);
  // Before today's check-in, the next empty stamp is today's.
  const todayIndex = checkedInToday ? filled - 1 : filled % STREAK_CARD_DAYS;
  const shown = !checkedInToday && filled === STREAK_CARD_DAYS ? 0 : filled;

  return (
    <section className="card streak-card" aria-label={`${streak}-day streak. ${shown} of ${STREAK_CARD_DAYS} stamps`}>
      <div className="streak-card-head">
        <p className="eyebrow">Streak card</p>
        <strong>🔥 {streak}-day streak</strong>
      </div>
      <ol className="stamps">
        {Array.from({ length: STREAK_CARD_DAYS }, (_, index) => {
          const done = index < shown;
          const isToday = index === todayIndex;
          const isBonus = index === STREAK_CARD_DAYS - 1;
          const classes = ['stamp', done && 'done', isToday && !checkedInToday && 'today', isToday && justStamped && 'pop', isBonus && 'bonus'];
          return (
            <li key={index} className={classes.filter(Boolean).join(' ')}>
              {done ? (isBonus ? '🎁' : '✓') : isBonus ? '🎁' : index + 1}
            </li>
          );
        })}
      </ol>
      <p className="muted">Check in {STREAK_CARD_DAYS} days in a row for a +{XP_STREAK_CARD_BONUS} XP bonus.</p>
    </section>
  );
}
