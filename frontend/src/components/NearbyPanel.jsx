// "Nearby" tracker in the bottom-right corner: the closest trigger enemies.
// Tapping one flies the map to it.
import Enemy from './Enemy';

export default function NearbyPanel({ zones, onSelect }) {
  const nearest = zones.slice(0, 3);
  return (
    <div className="nearby">
      <span className="nearby-title">Nearby</span>
      <div className="nearby-list">
        {nearest.map((zone) => (
          <button key={zone.id} className="nearby-item" onClick={() => onSelect(zone)} aria-label={`${zone.label}, ${zone.level}, ${zone.distanceKm.toFixed(1)} km away`}>
            <Enemy type={zone.type} level={zone.level} size={38} />
            <span>{zone.distanceKm < 1 ? `${Math.round(zone.distanceKm * 1000)} m` : `${zone.distanceKm.toFixed(1)} km`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
