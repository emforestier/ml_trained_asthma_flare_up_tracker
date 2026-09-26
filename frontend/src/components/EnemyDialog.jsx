// Details for a tapped trigger enemy: how bad it is, how far away, and how much it
// affects this user according to their trigger profile.
import { useNavigate } from 'react-router-dom';
import Enemy from './Enemy';
import GameDialog from './GameDialog';

// Which entry in triggers.json each map zone belongs to.
function triggerFeature(zone) {
  if (zone.type === 'weather') return zone.label.toLowerCase().includes('pressure') ? 'pressure_drop' : 'humidity';
  return zone.type;
}

function strengthLine(trigger) {
  if (!trigger || !trigger.discovered) return "Still learning whether this one affects you.";
  const lines = {
    strong: `${trigger.label} is one of your strongest triggers. Take care around it.`,
    moderate: `${trigger.label} is a moderate trigger for you.`,
    weak: `${trigger.label} only affects you a little.`,
  };
  return lines[trigger.strength] || "Still learning whether this one affects you.";
}

export default function EnemyDialog({ zone, triggers, onClose }) {
  const navigate = useNavigate();
  const trigger = triggers?.find((item) => item.feature === triggerFeature(zone));
  const value = Number.isInteger(zone.value) ? zone.value : zone.value.toFixed(1);
  const distance = zone.distanceKm < 1 ? `${Math.round(zone.distanceKm * 1000)} m` : `${zone.distanceKm.toFixed(1)} km`;

  return (
    <GameDialog
      title={`${zone.label}: ${zone.level}`}
      message={`${value} ${zone.unit}, ${distance} away. ${strengthLine(trigger)}`}
      confirmLabel="Got it"
      cancelLabel="My triggers"
      onConfirm={onClose}
      onCancel={() => navigate('/triggers')}
      onDismiss={onClose}
    >
      <div className="dialog-enemy">
        <Enemy type={zone.type} level={zone.level} size={110} />
      </div>
    </GameDialog>
  );
}
