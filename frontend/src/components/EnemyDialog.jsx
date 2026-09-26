// Details for a tapped trigger enemy: its reading, distance, what the demo model found, and
// what the user reported. Zones are an illustrative overlay, and pollen is synthetic.
import { useNavigate } from 'react-router-dom';
import { BASELINE_WINDOW_DAYS } from '../config';
import { useGame } from '../state/GameContext';
import Enemy from './Enemy';
import GameDialog from './GameDialog';

// Which entry in triggers.json each map zone belongs to.
function triggerFeature(zone) {
  if (zone.type === 'weather') return zone.label.toLowerCase().includes('pressure') ? 'pressure_drop' : 'humidity';
  return zone.type;
}

// Which onboarding answer each zone type matches.
const REPORTED = { pollen: 'Pollen', air_quality: 'Smoke or air pollution' };

function modelLine(trigger, enoughHistory) {
  if (!enoughHistory) return "Not enough check-ins yet to see how this affects the demo model's predictions for you.";
  if (!trigger || !trigger.discovered || trigger.strength === 'none') return 'No clear influence on the demo model yet.';
  return `${trigger.label} had a ${trigger.strength} influence on this demo model's predictions.`;
}

export default function EnemyDialog({ zone, triggers, onClose }) {
  const navigate = useNavigate();
  const { profile, game } = useGame();
  const enoughHistory = profile.isDemo || game.checkIns >= BASELINE_WINDOW_DAYS;
  const trigger = triggers?.find((item) => item.feature === triggerFeature(zone));
  const reported = profile.survey?.triggers?.includes(REPORTED[zone.type]);
  const value = Number.isInteger(zone.value) ? zone.value : zone.value.toFixed(1);
  const distance = zone.distanceKm < 1 ? `${Math.round(zone.distanceKm * 1000)} m` : `${zone.distanceKm.toFixed(1)} km`;
  const reading = zone.type === 'pollen' ? `${value} ${zone.unit} (synthetic pollen)` : `${value} ${zone.unit}`;

  return (
    <GameDialog
      title={`${zone.label}: ${zone.level}`}
      message={`${reading}, ${distance} away. ${modelLine(trigger, enoughHistory)}${reported ? ' You also reported this as a trigger.' : ''}`}
      confirmLabel="Got it"
      cancelLabel="My patterns"
      onConfirm={onClose}
      onCancel={() => navigate('/triggers')}
      onDismiss={onClose}
      media={
        <>
          <div className="dialog-enemy">
            <Enemy type={zone.type} level={zone.level} size={110} />
          </div>
          <p className="overlay-tag">Illustrative demo overlay, not measured neighborhood data</p>
        </>
      }
    />
  );
}
