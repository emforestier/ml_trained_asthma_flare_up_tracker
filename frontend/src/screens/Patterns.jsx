// Patterns: what the demo model weighs for this user, kept separate from the triggers the user
// reported. Describes model influence, never proven causes. New users see a "still learning"
// view until they have enough check-ins.
import { getSummary, getTriggers, useApi } from '../api';
import Companion from '../components/Companion';
import Enemy from '../components/Enemy';
import { BASELINE_WINDOW_DAYS, MODEL_NOTE } from '../config';
import { useGame } from '../state/GameContext';
import { NOT_SURE_TRIGGER } from '../survey';

// Which enemy creature stands for each trigger.
const ENEMY_FOR = { pollen: 'pollen', air_quality: 'air_quality', pressure_drop: 'weather', humidity: 'weather', cold_air: 'weather' };
const STRENGTH_LEVEL = { strong: 'high', moderate: 'moderate', weak: 'low' };
const STRENGTH_WIDTH = { strong: 100, moderate: 62, weak: 30 };

function PatternCard({ trigger }) {
  const enemy = ENEMY_FOR[trigger.feature] || 'weather';
  if (!trigger.discovered) {
    return (
      <li className="pattern-card undiscovered">
        <span className="pattern-enemy silhouette" aria-hidden="true">
          <Enemy type={enemy} level="low" size={64} />
        </span>
        <div>
          <h3>{trigger.label}</h3>
          <p className="pattern-strength">Not discovered yet</p>
          <p className="muted">{trigger.evidence}</p>
        </div>
      </li>
    );
  }
  const synthetic = trigger.feature === 'pollen';
  return (
    <li className={`pattern-card strength-${trigger.strength}`}>
      <span className="pattern-enemy" aria-hidden="true">
        <Enemy type={enemy} level={STRENGTH_LEVEL[trigger.strength] || 'moderate'} size={64} />
      </span>
      <div>
        <h3>
          {trigger.label}
          {synthetic && <span className="synthetic-tag">Synthetic</span>}
        </h3>
        <p className="pattern-strength">{trigger.strength} influence</p>
        <div className="pattern-bar" aria-hidden="true">
          <span style={{ width: `${STRENGTH_WIDTH[trigger.strength] || 50}%` }} />
        </div>
        <p>
          {trigger.label} had a {trigger.strength} influence on this demo model's predictions.
        </p>
        {trigger.evidence && <p className="muted">{trigger.evidence}</p>}
      </div>
    </li>
  );
}

export default function Patterns() {
  const { profile, game } = useGame();
  const triggers = useApi(getTriggers);
  const summary = useApi(getSummary);

  const daysLogged = profile.isDemo ? Math.max(game.checkIns, BASELINE_WINDOW_DAYS) : game.checkIns;
  const enoughHistory = daysLogged >= BASELINE_WINDOW_DAYS;
  const reported = profile.survey?.triggers || [];
  const sorted = [...(triggers.data?.triggers || [])].sort(
    (a, b) => Number(b.discovered) - Number(a.discovered) || (b.score || 0) - (a.score || 0),
  );
  const found = sorted.filter((trigger) => trigger.discovered).length;

  return (
    <div className="patterns">
      <h1>Patterns</h1>

      {enoughHistory && summary.data && (
        <section className="card">
          <p className="eyebrow">This week</p>
          <p className="summary-counts">
            <strong>{summary.data.check_ins}</strong> check-ins · <strong>{summary.data.flare_ups}</strong> recorded{' '}
            {summary.data.flare_ups === 1 ? 'flare-up' : 'flare-ups'}
          </p>
          <p>{summary.data.text}</p>
        </section>
      )}

      <section className="card">
        <div className="section-head">
          <p className="eyebrow">Patterns the demo model found</p>
          {enoughHistory && triggers.data && (
            <span className="found-count">
              {found} of {sorted.length} found
            </span>
          )}
        </div>

        {!enoughHistory ? (
          <div className="learning-state">
            <Companion mood="happy" size={110} />
            <h2>Still learning your patterns</h2>
            <p className="muted">
              The demo model needs about {BASELINE_WINDOW_DAYS} days of check-ins before it can show which conditions influence your
              predictions. Keep checking in each day.
            </p>
            <div className="learning-progress" aria-label={`${daysLogged} of ${BASELINE_WINDOW_DAYS} days logged`}>
              <span style={{ width: `${(daysLogged / BASELINE_WINDOW_DAYS) * 100}%` }} />
            </div>
            <p className="learning-count">
              {daysLogged} of {BASELINE_WINDOW_DAYS} days logged
            </p>
          </div>
        ) : triggers.loading ? (
          <p className="muted">Loading patterns…</p>
        ) : (
          <ul className="pattern-list">
            {sorted.map((trigger) => (
              <PatternCard key={trigger.feature} trigger={trigger} />
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <p className="eyebrow">Triggers you reported</p>
        <p className="muted">Your own observations from onboarding, not confirmed causes.</p>
        {reported.length === 0 || (reported.length === 1 && reported[0] === NOT_SURE_TRIGGER) ? (
          <p className="reported-empty">You weren't sure yet. That's fine: the patterns above will fill in as you check in.</p>
        ) : (
          <ul className="reported-list">
            {reported.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </section>

      <p className="patterns-note">Patterns describe how this demo model makes predictions, not proven causes. {MODEL_NOTE}</p>
    </div>
  );
}
