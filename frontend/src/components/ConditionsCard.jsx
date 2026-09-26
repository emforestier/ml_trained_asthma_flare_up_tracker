// Today's weather, air quality and pollen, with when the data was fetched and where it came from.
// Pollen is always labeled synthetic, and saved fallback data is never shown as live.
import { CITY_TIME_ZONE } from '../config';

function formatTime(iso) {
  if (!iso) return 'unknown time';
  const date = new Date(iso);
  return date.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: CITY_TIME_ZONE, timeZoneName: 'short' });
}

const show = (value, suffix = '') => (value === null || value === undefined ? 'Not available' : `${value}${suffix}`);

export default function ConditionsCard({ environment }) {
  const { current, sources = {}, fetched_at: fetchedAt, is_stale: isStale, fromMock, city } = environment;
  const pressure = current.pressure_change_24h;
  const rows = [
    ['🌡️', 'Temperature', show(current.temperature_c, '°C')],
    ['💧', 'Humidity', show(current.humidity, '%')],
    ['🌧️', 'Pressure change', pressure === undefined || pressure === null ? 'Not available' : `${pressure > 0 ? '+' : pressure < 0 ? '−' : ''}${Math.abs(pressure)} hPa in 24h`],
    ['💨', 'Air quality (AQI)', show(current.aqi)],
    ['💨', 'PM2.5', show(current.pm25, ' µg/m³')],
  ];
  const pollen = current.pollen || {};

  return (
    <section className="card conditions">
      <p className="eyebrow">Today's conditions · {city}</p>
      {(isStale || fromMock) && <p className="stale-note">Saved demo data, not a live reading.</p>}
      <ul className="condition-rows">
        {rows.map(([icon, label, value]) => (
          <li key={label}>
            <span aria-hidden="true">{icon}</span>
            <span>{label}</span>
            <strong>{value}</strong>
          </li>
        ))}
        {Object.entries(pollen).map(([type, value]) => (
          <li key={type}>
            <span aria-hidden="true">🌳</span>
            <span>
              {type[0].toUpperCase() + type.slice(1)} pollen <span className="synthetic-tag">Synthetic</span>
            </span>
            <strong>{show(value, ' of 5')}</strong>
          </li>
        ))}
      </ul>
      <p className="muted conditions-source">
        Updated {formatTime(fetchedAt)}. Weather: {sources.weather || 'unknown'}. Air quality: {sources.air_quality || 'unknown'}. Pollen:{' '}
        {sources.pollen || 'synthetic demo data'}.
      </p>
    </section>
  );
}
