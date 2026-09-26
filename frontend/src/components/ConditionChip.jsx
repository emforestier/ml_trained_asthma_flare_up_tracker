// Shows today's worst environmental condition, like a weather badge on a game map.
import { CONDITION_ALERTS as A } from '../config';

const SEVERITY = { low: 0, moderate: 1, high: 2 };

// Returns the single worst condition from environment.current.
export function worstCondition(current) {
  const pollenType = Object.entries(current.pollen).sort((a, b) => b[1] - a[1])[0];
  const [type, pollen] = pollenType;
  const candidates = [
    {
      icon: '🌳',
      text: `Synthetic ${type} pollen`,
      level: pollen >= A.pollenHigh ? 'high' : pollen >= A.pollenModerate ? 'moderate' : 'low',
    },
    {
      icon: '💨',
      text: 'Air quality',
      level: current.aqi > A.aqiHigh ? 'high' : current.aqi >= A.aqiModerate ? 'moderate' : 'low',
    },
    {
      icon: '🌧️',
      text: 'Pressure drop',
      level:
        current.pressure_change_24h <= A.pressureDropHigh
          ? 'high'
          : current.pressure_change_24h <= A.pressureDropModerate
            ? 'moderate'
            : 'low',
    },
  ];
  return candidates.sort((a, b) => SEVERITY[b.level] - SEVERITY[a.level])[0];
}

export default function ConditionChip({ current }) {
  const worst = worstCondition(current);
  if (worst.level === 'low') {
    return <span className="condition-chip level-low">☀️ All clear</span>;
  }
  return (
    <span className={`condition-chip level-${worst.level}`}>
      {worst.icon} {worst.text} {worst.level}
    </span>
  );
}
