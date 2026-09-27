// Fixed, rule-based urgent-care message. Never generated, never waits on the backend.
// Used on the emergency screen and inline the moment an emergency sign is selected.
import { EMERGENCY_SIGNS } from '../config';

export default function UrgentNotice({ compact = false }) {
  return (
    <div className={`urgent${compact ? ' compact' : ''}`} role="alert">
      <h2>Get medical help now</h2>
      <p>
        These can be signs of a severe asthma attack. <strong>Call 911</strong> or go to the nearest emergency room right away.
      </p>
      {!compact && (
        <ul>
          {EMERGENCY_SIGNS.map((sign) => (
            <li key={sign}>{sign}</li>
          ))}
        </ul>
      )}
      <p>While you get help, follow your asthma action plan and use your rescue inhaler as your doctor told you.</p>
      <a className="urgent-call" href="tel:911">
        Call 911
      </a>
    </div>
  );
}
