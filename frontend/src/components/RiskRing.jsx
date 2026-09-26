// Circular gauge for tomorrow's experimental demo score, colored and labeled by level.
import { RISK_LEVELS } from '../config';

const RADIUS = 44;
const LENGTH = 2 * Math.PI * RADIUS;

export default function RiskRing({ score, level }) {
  const percent = Math.round(score * 100);
  const { label, color } = RISK_LEVELS[level];
  return (
    <div className="risk-ring" role="img" aria-label={`Experimental demo score for tomorrow: ${percent}%, ${label.toLowerCase()}`}>
      <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden="true">
        <circle cx="56" cy="56" r={RADIUS} fill="none" stroke="var(--line)" strokeWidth="10" />
        <circle
          className="risk-ring-fill"
          cx="56"
          cy="56"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${LENGTH * score} ${LENGTH}`}
          transform="rotate(-90 56 56)"
        />
      </svg>
      <div className="risk-ring-text">
        <strong>{percent}%</strong>
        <span style={{ color }}>{label}</span>
      </div>
    </div>
  );
}
