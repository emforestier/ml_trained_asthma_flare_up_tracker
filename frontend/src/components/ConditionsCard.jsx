// Today's weather, air quality and pollen, with when the data was fetched and where it came from.
// Pollen is always labeled synthetic, and saved fallback data is never shown as live.
import { CITY_TIME_ZONE } from '../config';
import Icon from './Icon';

function formatTime(iso) {
  if (!iso) return 'unknown time';
  const date = new Date(iso);
  return date.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: CITY_TIME_ZONE, timeZoneName: 'short' });
}

const show = (value, suffix = '') => (value === null || value === undefined ? 'Not available' : `${value}${suffix}`);

export default function ConditionsCard({ environment }) {
  const { current, sources = {}, fetched_at: fetchedAt, valid_for: validFor, is_stale: isStale, fromMock, city } = environment;
  // Prefer the exact fetch time; fall back to the day the data is for.
  const when = fetchedAt
    ? `Updated ${formatTime(fetchedAt)}`
    : validFor
      ? `For ${new Date(`${validFor}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`
      : 'Update time unknown';
  const pressure = current.pressure_change_24h;
  const rows = [
    ['temperature', 'Temperature', show(current.temperature_c, '°C')],
    ['humidity', 'Humidity', show(current.humidity, '%')],
    ['pressure', 'Pressure change', pressure === undefined || pressure === null ? 'Not available' : `${pressure > 0 ? '+' : pressure < 0 ? '−' : ''}${Math.abs(pressure)} hPa in 24h`],
    ['air', 'Air quality (AQI)', show(current.aqi)],
    ['air', 'PM2.5', show(current.pm25, ' µg/m³')],
  ];
  const pollen = current.pollen || {};

  return (
    <section className="card conditions">
      <p className="eyebrow">Today's conditions · {city}</p>
      {(isStale || fromMock) && <p className="stale-note">Some readings may be out of date.</p>}
      <ul className="condition-rows">
        {rows.map(([icon, label, value]) => (
          <li key={label}>
            <Icon name={icon} size={18} />
            <span>{label}</span>
            <strong>{value}</strong>
          </li>
        ))}
        {Object.entries(pollen).map(([type, value]) => (
          <li key={type}>
            <Icon name="pollen" size={18} />
            <span>
              {type[0].toUpperCase() + type.slice(1)} pollen <span className="synthetic-tag">Synthetic</span>
            </span>
            <strong>{show(value, ' of 5')}</strong>
          </li>
        ))}
      </ul>
      <p className="muted conditions-source">
        {when}. Weather: {sources.weather || 'unknown'}. Air quality: {sources.air_quality || 'unknown'}. Pollen:{' '}
        {sources.pollen || 'synthetic pollen index'}.
      </p>
    </section>
  );
}
