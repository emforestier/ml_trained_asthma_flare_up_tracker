// Tomorrow's experimental demo score as an encounter-style scene: the companion in a little
// world with a name tag showing the score, and the details in a sheet underneath.
import { Link } from 'react-router-dom';
import { getEnvironment, getRisk, useApi } from '../api';
import Companion from '../components/Companion';
import ConditionChip from '../components/ConditionChip';
import ConditionsCard from '../components/ConditionsCard';
import FactorList from '../components/FactorList';
import RiskRing from '../components/RiskRing';
import { BASELINE_WINDOW_DAYS, DISCLAIMER, MODEL_NOTE, MOOD_LINES, RISK_LEVELS, SCORE_NAME, levelFromScore } from '../config';
import { useGame } from '../state/GameContext';
import Icon from '../components/Icon';

// The contract sends the suggestion as text; older mocks sent { text }.
const recommendationText = (recommendation) => (typeof recommendation === 'string' ? recommendation : recommendation?.text);

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

  const { risk_score: score, top_factors: factors = [], explanation } = risk.data;
  const level = RISK_LEVELS[risk.data.risk_level] ? risk.data.risk_level : levelFromScore(score);
  const { label, mood } = RISK_LEVELS[level];
  const daysLogged = profile.isDemo ? risk.data.days_logged ?? game.checkIns : game.checkIns;
  const { correct, total } = game.accuracy;
  const suggestion = recommendationText(risk.data.recommendation);

  return (
    <div className="forecast">
      <section className={`scene level-${level}`}>
        <Link to="/" className="round-button scene-back" aria-label="Back to map">
          <Icon name="back" size={22} />
        </Link>
        <div className="glass-pill">
          <span>{profile.companionName}</span>
          <span className="divider">/</span>
          <small>DEMO SCORE</small>
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
            <p className="eyebrow">{SCORE_NAME} for tomorrow</p>
            <h2>{label}</h2>
            {environment.data && <ConditionChip current={environment.data.current} />}
          </div>
        </section>
        <p className="model-note">{MODEL_NOTE}</p>

        {daysLogged < BASELINE_WINDOW_DAYS && (
          <p className="learning-banner">
            <Icon name="learning" size={17} /> Still learning your patterns (day {Math.max(daysLogged, 1)} of {BASELINE_WINDOW_DAYS})
          </p>
        )}

        {suggestion && (
          <section className="card">
            <p className="eyebrow">Suggestion</p>
            <p className="tip-text">{suggestion}</p>
          </section>
        )}

        <section className="card">
          <p className="eyebrow">What the demo model weighed most</p>
          <FactorList factors={factors} />
          {explanation && <p className="explanation">{explanation}</p>}
        </section>

        {environment.data && <ConditionsCard environment={environment.data} />}

        {total > 0 && (
          <p className="accuracy" style={{ textAlign: 'center' }}>
            <Icon name="target" size={16} /> <strong>{correct}</strong> matching {correct === 1 ? 'outcome' : 'outcomes'} out of <strong>{total}</strong> answered{' '}
            {total === 1 ? 'day' : 'days'}
          </p>
        )}
        <p className="disclaimer">{DISCLAIMER}</p>
      </div>
    </div>
  );
}
