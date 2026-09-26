// Draws the companion and the trigger enemies standing upright on the tilted map.
// MapLibre tells us where each spot is on screen; comparing how long a short distance looks
// there versus at the screen center gives the perspective scale, so far sprites look smaller.
import { useEffect, useState } from 'react';
import Companion from './Companion';
import Enemy from './Enemy';

export const MIN_ENEMY_ZOOM = 14.5;
const BASE_ZOOM = 16;
const ENEMY_SIZE = { low: 58, moderate: 70, high: 84 };
const COMPANION_SIZE = 110;
const HORIZON = 0.2; // fraction of screen height where the map fades into the sky
const PROBE_METERS = 30;

// Screen length of a short east-west step at a point, used to measure perspective.
function stepLength(map, lon, lat) {
  const dLon = PROBE_METERS / (111320 * Math.cos((lat * Math.PI) / 180));
  const a = map.project([lon, lat]);
  const b = map.project([lon + dLon, lat]);
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export default function MapEntities({ map, user, companionMood, companionName, zones, onCompanionTap, onEnemyTap }) {
  const [, setFrame] = useState(0);

  // Re-render whenever the map moves or zooms.
  useEffect(() => {
    if (!map) return undefined;
    let request = 0;
    const update = () => {
      cancelAnimationFrame(request);
      request = requestAnimationFrame(() => setFrame((frame) => frame + 1));
    };
    map.on('move', update);
    map.on('resize', update);
    map.on('load', update);
    update();
    return () => {
      cancelAnimationFrame(request);
      map.off('move', update);
      map.off('resize', update);
      map.off('load', update);
    };
  }, [map]);

  if (!map) return null;
  const container = map.getContainer();
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (!width || !height) return null;

  const zoom = map.getZoom();
  const zoomScale = 2 ** ((zoom - BASE_ZOOM) * 0.6);
  const center = map.getCenter();
  const centerStep = stepLength(map, center.lng, center.lat) || 1;

  // growth: how strongly the sprite scales with zoom (enemies 1, the companion less).
  function place(lat, lon, baseSize, growth = 1) {
    const { x, y } = map.project([lon, lat]);
    const perspective = Math.min(2.2, Math.max(0.25, stepLength(map, lon, lat) / centerStep));
    const size = Math.min(230, Math.max(20, baseSize * perspective * zoomScale ** growth));
    if (y < height * HORIZON || y > height + size || x < -size || x > width + size) return null;
    // Fade sprites out as they approach the horizon.
    const opacity = Math.min(1, (y - height * HORIZON) / (height * 0.1));
    return { x, y, size, opacity };
  }

  const sprites = [];
  if (zoom >= MIN_ENEMY_ZOOM) {
    for (const zone of zones) {
      const spot = place(zone.lat, zone.lon, ENEMY_SIZE[zone.level] || ENEMY_SIZE.moderate);
      if (spot) sprites.push({ kind: 'enemy', zone, ...spot });
    }
  }
  const me = place(user.lat, user.lon, COMPANION_SIZE, 0.5);
  if (me) sprites.push({ kind: 'companion', ...me });
  sprites.sort((a, b) => a.y - b.y);

  return (
    <div className="map-entities">
      {sprites.map((sprite) => {
        const style = { left: sprite.x, top: sprite.y, zIndex: Math.round(sprite.y), opacity: sprite.opacity };
        if (sprite.kind === 'companion') {
          return (
            <button key="companion" className="sprite companion-sprite" style={style} onClick={onCompanionTap} aria-label={`${companionName}. Open tomorrow's forecast`}>
              <Companion mood={companionMood} size={sprite.size} />
            </button>
          );
        }
        const { zone } = sprite;
        return (
          <button key={zone.id} className="sprite" style={style} onClick={() => onEnemyTap(zone)} aria-label={`${zone.label}, ${zone.level}. Show details`}>
            <Enemy type={zone.type} level={zone.level} size={sprite.size} />
          </button>
        );
      })}
    </div>
  );
}
