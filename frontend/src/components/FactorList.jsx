// The top factors behind tomorrow's prediction, with bars sized by how much each one adds.
const FACTOR_ICONS = {
  tree_pollen: '🌳',
  grass_pollen: '🌾',
  weed_pollen: '🌿',
  pollen: '🌳',
  pressure_change_24h: '🌧️',
  aqi: '💨',
  pm25: '💨',
  ozone: '💨',
  humidity: '💧',
  temperature: '🌡️',
  puffs_above_baseline: '💊',
};

function formatValue({ value, unit }) {
  const size = Math.abs(value);
  const number = Number.isInteger(size) ? size : size.toFixed(1);
  const sign = value < 0 ? '−' : unit.startsWith('above') ? '+' : '';
  return `${sign}${number} ${unit}`;
}

export default function FactorList({ factors }) {
  const largest = Math.max(...factors.map((factor) => Math.abs(factor.impact)), 0.01);
  return (
    <ul className="factor-list">
      {factors.map((factor) => (
        <li key={factor.feature}>
          <span className="factor-icon" aria-hidden="true">
            {FACTOR_ICONS[factor.feature] || '•'}
          </span>
          <div className="factor-body">
            <div className="factor-head">
              <strong>{factor.label}</strong>
              <span className="muted">{formatValue(factor)}</span>
            </div>
            <div className="factor-bar" aria-hidden="true">
              <span style={{ width: `${(Math.abs(factor.impact) / largest) * 100}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
