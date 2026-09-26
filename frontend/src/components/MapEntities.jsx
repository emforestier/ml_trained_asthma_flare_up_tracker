// Draws the companion and the trigger enemies standing upright on the tilted map.
// For smooth panning and zooming, sprites are rendered once at a fixed size, then moved and
// scaled directly with a GPU-friendly CSS transform in the same frame MapLibre draws the map.
// React only re-renders when the set of sprites changes, never on every map frame.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Companion from './Companion';
import Enemy from './Enemy';

export const MIN_ENEMY_ZOOM = 14.5;
const BASE_ZOOM = 16;
const ENEMY_SIZE = { low: 58, moderate: 70, high: 84 };
const COMPANION_SIZE = 110;
const RENDER_SIZE = 150; // sprites are drawn at this size and scaled with CSS
const MIN_SIZE = 20;
const MAX_SIZE = 230;
const HORIZON = 0.2; // fraction of screen height where the map fades into the sky
const PROBE_METERS = 30;
const FEET = 0.94; // where a sprite's feet are, as a fraction of its height

// Screen length of a short east-west step at a point, used to measure perspective.
function stepLength(map, lon, lat) {
  const dLon = PROBE_METERS / (111320 * Math.cos((lat * Math.PI) / 180));
  const a = map.project([lon, lat]);
  const b = map.project([lon + dLon, lat]);
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export default function MapEntities({ map, user, companionMood, companionName, zones, onCompanionTap, onEnemyTap }) {
  const elements = useRef(new Map());
  const [enemiesShown, setEnemiesShown] = useState(true);

  // Everything that stands on the map, with where it stands and how big it is.
  const items = useMemo(
    () => [
      ...zones.map((zone) => ({ key: zone.id, kind: 'enemy', zone, lat: zone.lat, lon: zone.lon, size: ENEMY_SIZE[zone.level] || ENEMY_SIZE.moderate, growth: 1 })),
      { key: 'companion', kind: 'companion', lat: user.lat, lon: user.lon, size: COMPANION_SIZE, growth: 0.5 },
    ],
    [zones, user],
  );
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Positions every sprite for the map's current view. Runs inside the map's own render frame.
  const place = useCallback(() => {
    if (!map) return;
    const container = map.getContainer();
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;

    const zoom = map.getZoom();
    const showEnemies = zoom >= MIN_ENEMY_ZOOM;
    setEnemiesShown((previous) => (previous === showEnemies ? previous : showEnemies));
    const zoomScale = 2 ** ((zoom - BASE_ZOOM) * 0.6);
    const center = map.getCenter();
    const centerStep = stepLength(map, center.lng, center.lat) || 1;

    for (const item of itemsRef.current) {
      const element = elements.current.get(item.key);
      if (!element) continue;
      if (item.kind === 'enemy' && !showEnemies) {
        element.style.visibility = 'hidden';
        continue;
      }
      const { x, y } = map.project([item.lon, item.lat]);
      const perspective = Math.min(2.2, Math.max(0.25, stepLength(map, item.lon, item.lat) / centerStep));
      const size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, item.size * perspective * zoomScale ** item.growth));
      const offScreen = y < height * HORIZON || y > height + size || x < -size || x > width + size;
      if (offScreen) {
        element.style.visibility = 'hidden';
        continue;
      }
      // The transform origin is the sprite's feet, so scaling keeps them planted on the ground.
      const tx = x - RENDER_SIZE / 2;
      const ty = y - RENDER_SIZE * FEET;
      element.style.visibility = 'visible';
      element.style.opacity = String(Math.min(1, (y - height * HORIZON) / (height * 0.1)));
      element.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${size / RENDER_SIZE})`;
      element.style.zIndex = String(Math.round(y));
    }
  }, [map]);

  // Follow the map frame by frame.
  useEffect(() => {
    if (!map) return undefined;
    map.on('render', place);
    map.on('resize', place);
    place();
    return () => {
      map.off('render', place);
      map.off('resize', place);
    };
  }, [map, place]);

  // Place newly mounted sprites before the browser paints them.
  useLayoutEffect(() => {
    place();
  }, [items, enemiesShown, place]);

  const register = (key) => (element) => {
    if (element) elements.current.set(key, element);
    else elements.current.delete(key);
  };

  return (
    <div className="map-entities">
      {items.map((item) => {
        if (item.kind === 'companion') {
          return (
            <button
              key={item.key}
              ref={register(item.key)}
              className="sprite companion-sprite"
              onClick={onCompanionTap}
              aria-label={`${companionName}. Open tomorrow's forecast`}
            >
              <Companion mood={companionMood} size={RENDER_SIZE} />
            </button>
          );
        }
        if (!enemiesShown) return null;
        const { zone } = item;
        return (
          <button
            key={item.key}
            ref={register(item.key)}
            className="sprite"
            onClick={() => onEnemyTap(zone)}
            aria-label={`${zone.label}, ${zone.level}. Show details`}
          >
            <Enemy type={zone.type} level={zone.level} size={RENDER_SIZE} />
          </button>
        );
      })}
    </div>
  );
}
