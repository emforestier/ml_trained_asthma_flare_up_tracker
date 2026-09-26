// Tomorrow's forecast as an encounter-style scene: the companion in a little world with a
// name tag showing the risk, and the details in a sheet underneath.
import { Link } from 'react-router-dom';
import { getEnvironment, getRisk, useApi } from '../api';
import Companion from '../components/Companion';
import ConditionChip from '../components/ConditionChip';
import FactorList from '../components/FactorList';
import RiskRing from '../components/RiskRing';
import { BASELINE_WINDOW_DAYS, DISCLAIMER, RISK_LEVELS, levelFromScore } from '../config';
import { useGame } from '../state/GameContext';

const MOOD_LINES = {
  low: 'Clear skies ahead. Tomorrow looks calm!',
  moderate: "There's a bit in the air tomorrow. Let's keep an eye out.",
  high: "Tomorrow could be rough. Let's get ready together.",
};

export default function Forecast() {
  const { profile, game } = useGame();
  const risk = useApi(getRisk);
  const environment = useApi(getEnvironment);

  if (risk.loading || !risk.data) {
    return (
      <div className="forecast">
        <div className="scene">
          <p className="scene-line" style={{ marginTop: 160 }}>
            {profile.companionName} is checking the air…
          </p>
        </div>
      </div>
    );
  }

  const { risk_score: score, top_factors: factors, recommendation, explanation, learning } = risk.data;
  const level = risk.data.risk_level || levelFromScore(score);
  const { label, mood } = RISK_LEVELS[level];
  const daysLogged = profile.isDemo ? learning?.days_logged ?? game.checkIns : game.checkIns;
  const { correct, total } = game.accuracy;

  return (
    <div className="forecast">
      <section className={`scene level-${level}`}>
        <Link to="/" className="round-button scene-back" aria-label="Back to map">
          ←
        </Link>
        <div className="glass-pill">
          <span>{profile.companionName}</span>
          <span className="divider">/</span>
          <small>RISK</small>
          <strong>{Math.round(score * 100)}%</strong>
        </div>
        <div className="scene-companion">
          <Companion mood={mood} size={170} label={`${profile.companionName} looks ${mood}`} />
        </div>
        <p className="scene-line">{MOOD_LINES[level]}</p>
      </section>

      <div className="sheet">
        <div className="sheet-handle" />

        <section className="card risk-summary">
          <RiskRing score={score} level={level} />
          <div style={{ display: 'grid', gap: 6 }}>
            <p className="eyebrow">Tomorrow's flare-up risk</p>
            <h2>{label} risk</h2>
            {environment.data && <ConditionChip current={environment.data.current} />}
          </div>
        </section>

        {daysLogged < BASELINE_WINDOW_DAYS && (
          <p className="learning-banner">
            🌱 Still learning your patterns (day {Math.max(daysLogged, 1)} of {BASELINE_WINDOW_DAYS})
          </p>
        )}

        <section className="card">
          <p className="eyebrow">Today's tip</p>
          <p className="tip-text">{recommendation.text}</p>
        </section>

        <section className="card">
          <p className="eyebrow">Why {profile.companionName} thinks so</p>
          <FactorList factors={factors} />
          {explanation && <p className="explanation">{explanation}</p>}
        </section>

        {total > 0 && (
          <p className="accuracy" style={{ textAlign: 'center' }}>
            🎯 {profile.companionName} has been right <strong>{correct} of {total}</strong> times ({Math.round((correct / total) * 100)}%)
          </p>
        )}
        <p className="disclaimer">{DISCLAIMER}</p>
      </div>
    </div>
  );
}
