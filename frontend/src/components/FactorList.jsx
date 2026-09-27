// The top factors behind the demo score, as named in the contract: { name, direction, strength },
// with an optional value and unit. Strength is shown in words as well as bar length.
import Icon from './Icon';

const ICONS = [
  ['pollen', 'pollen'],
  ['pressure', 'pressure'],
  ['puff', 'puffs'],
  ['air', 'air'],
  ['pm2', 'air'],
  ['ozone', 'air'],
  ['humid', 'humidity'],
  ['temp', 'temperature'],
];
const STRENGTH_WIDTH = { strong: 100, moderate: 62, weak: 30 };

function iconFor(name) {
  const lower = name.toLowerCase();
  return ICONS.find(([word]) => lower.includes(word))?.[1] || 'target';
}

function formatValue({ value, unit }) {
  if (value === undefined || value === null) return null;
  const size = Math.abs(value);
  const number = Number.isInteger(size) ? size : size.toFixed(1);
  const sign = value < 0 ? '−' : unit?.startsWith('above') ? '+' : '';
  return `${sign}${number} ${unit || ''}`.trim();
}

export default function FactorList({ factors }) {
  return (
    <ul className="factor-list">
      {factors.map((factor) => {
        const raises = factor.direction !== 'decreases';
        const value = formatValue(factor);
        const synthetic = factor.name.toLowerCase().includes('pollen');
        return (
          <li key={factor.name}>
            <span className="factor-icon">
              <Icon name={iconFor(factor.name)} size={18} />
            </span>
            <div className="factor-body">
              <div className="factor-head">
                <strong>
                  {factor.name}
                  {synthetic && !factor.name.toLowerCase().includes('synthetic') && <span className="synthetic-tag">Synthetic</span>}
                </strong>
                <span className={`factor-effect ${raises ? 'up' : 'down'}`}>
                  {raises ? '↑ raises' : '↓ lowers'} · {factor.strength}
                </span>
              </div>
              {value && <span className="muted factor-value">{value}</span>}
              <div className="factor-bar" aria-hidden="true">
                <span className={raises ? 'up' : 'down'} style={{ width: `${STRENGTH_WIDTH[factor.strength] || 50}%` }} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
