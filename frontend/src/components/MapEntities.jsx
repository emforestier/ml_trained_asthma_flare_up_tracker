// Draws the companion and the trigger enemies standing upright on the tilted map.
// The map itself is tilted with a CSS 3D transform, so each sprite's screen position is
// computed with the same perspective math, then scaled so far-away sprites look smaller.
import { useEffect, useState } from 'react';
import Companion from './Companion';
import Enemy from './Enemy';

export const MAP_TILT_DEG = 42;
export const MAP_PERSPECTIVE_PX = 900;
export const MIN_ENEMY_ZOOM = 14;
const BASE_ZOOM = 15;
const ENEMY_SIZE = { low: 58, moderate: 70, high: 84 };
const COMPANION_SIZE = 110;
const HORIZON = 0.24; // fraction of screen height where the map fades into the sky

// Screen position and perspective scale for a lat/lng on the tilted map.
function project(map, tiltElement, latlng) {
  const width = tiltElement.offsetWidth;
  const height = tiltElement.offsetHeight;
  const point = map.latLngToContainerPoint(latlng);
  const dx = point.x - width / 2;
  const dy = point.y - height / 2;
  const angle = (MAP_TILT_DEG * Math.PI) / 180;
  const depth = dy * Math.sin(angle);
  if (MAP_PERSPECTIVE_PX - depth < 60) return null;
  const scale = MAP_PERSPECTIVE_PX / (MAP_PERSPECTIVE_PX - depth);
  return {
    x: tiltElement.offsetLeft + width / 2 + dx * scale,
    y: tiltElement.offsetTop + height / 2 + dy * Math.cos(angle) * scale,
    scale,
  };
}

export default function MapEntities({ map, tiltRef, user, companionMood, companionName, zones, onCompanionTap, onEnemyTap }) {
  const [, setFrame] = useState(0);

  // Re-render whenever the map moves or zooms.
  useEffect(() => {
    if (!map) return undefined;
    let request = 0;
    const update = () => {
      cancelAnimationFrame(request);
      request = requestAnimationFrame(() => setFrame((frame) => frame + 1));
    };
    const events = 'move zoom zoomend moveend resize viewreset';
    map.on(events, update);
    window.addEventListener('resize', update);
    update();
    return () => {
      cancelAnimationFrame(request);
      map.off(events, update);
      window.removeEventListener('resize', update);
    };
  }, [map]);

  const tiltElement = tiltRef.current;
  if (!map || !tiltElement) return null;

  const screenHeight = tiltElement.parentElement.clientHeight;
  const screenWidth = tiltElement.parentElement.clientWidth;
  const zoom = map.getZoom();
  const zoomScale = 2 ** ((zoom - BASE_ZOOM) * 0.6);

  // growth: how strongly the sprite scales with zoom (enemies 1, the companion less).
  function place(latlng, baseSize, growth = 1) {
    const position = project(map, tiltElement, latlng);
    if (!position) return null;
    const { x, y, scale } = position;
    const size = Math.min(230, Math.max(20, baseSize * scale * zoomScale ** growth));
    if (y < screenHeight * HORIZON || y > screenHeight + size || x < -size || x > screenWidth + size) return null;
    // Fade sprites out as they approach the horizon.
    const opacity = Math.min(1, (y - screenHeight * HORIZON) / (screenHeight * 0.1));
    return { x, y, size, opacity };
  }

  const sprites = [];
  if (zoom >= MIN_ENEMY_ZOOM) {
    for (const zone of zones) {
      const spot = place([zone.lat, zone.lon], ENEMY_SIZE[zone.level] || ENEMY_SIZE.moderate);
      if (spot) sprites.push({ kind: 'enemy', zone, ...spot });
    }
  }
  const me = place([user.lat, user.lon], COMPANION_SIZE, 0.5);
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
