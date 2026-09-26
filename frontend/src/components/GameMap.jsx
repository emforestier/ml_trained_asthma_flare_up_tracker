// Tilted game-world map (MapLibre) with trigger zones and the player's range ring drawn flat on
// the ground. Sprites standing on the map are drawn separately by MapEntities.
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre decodes tiles in a web worker. Vite bundles it and gives us its URL, which works in
// both the dev server and the production build.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useEffect, useRef } from 'react';
import { gameMapStyle } from '../mapStyle';

maplibregl.setWorkerUrl(workerUrl);

const ZONE_COLORS = { pollen: '#e8b923', air_quality: '#8a78e0', weather: '#4f9bd9' };

// A circle of the given radius as a GeoJSON polygon.
function circle(lat, lon, radiusM, steps = 64) {
  const coordinates = [];
  const latRadius = radiusM / 111320;
  const lonRadius = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * 2 * Math.PI;
    coordinates.push([lon + lonRadius * Math.cos(angle), lat + latRadius * Math.sin(angle)]);
  }
  return { type: 'Polygon', coordinates: [coordinates] };
}

const zoneFeatures = (zones) => ({
  type: 'FeatureCollection',
  features: zones.map((zone) => ({
    type: 'Feature',
    properties: { color: ZONE_COLORS[zone.type] || '#ffffff', high: zone.level === 'high' },
    geometry: circle(zone.lat, zone.lon, zone.radius_m),
  })),
});

const ringFeature = (user, radiusM) => ({ type: 'Feature', properties: {}, geometry: circle(user.lat, user.lon, radiusM) });

export default function GameMap({ user, zones, zoom, minZoom, maxZoom, pitch = 58, rangeRadiusM = 120, onReady }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const latest = useRef({ zones, user });
  latest.current = { zones, user };

  // Create the map once.
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: gameMapStyle,
      center: [user.lon, user.lat],
      zoom,
      minZoom,
      maxZoom,
      pitch,
      maxPitch: pitch,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: false,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    map.on('load', () => {
      const { zones: currentZones, user: currentUser } = latest.current;
      map.addSource('zones', { type: 'geojson', data: zoneFeatures(currentZones) });
      map.addLayer({ id: 'zone-fill', type: 'fill', source: 'zones', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.2 } });
      map.addLayer({
        id: 'zone-edge',
        type: 'line',
        source: 'zones',
        paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['get', 'high'], 3, 2], 'line-opacity': 0.8 },
      });
      map.addSource('range', { type: 'geojson', data: ringFeature(currentUser, rangeRadiusM) });
      map.addLayer({ id: 'range-fill', type: 'fill', source: 'range', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.12 } });
      map.addLayer({ id: 'range-edge', type: 'line', source: 'range', paint: { 'line-color': '#ffffff', 'line-width': 2.5, 'line-opacity': 0.85 } });
    });

    onReady?.(map);
    return () => {
      onReady?.(null);
      map.remove();
      mapRef.current = null;
    };
    // The map is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep zones and the range ring in sync with new data.
  useEffect(() => {
    const map = mapRef.current;
    const zonesSource = map?.getSource('zones');
    if (zonesSource) zonesSource.setData(zoneFeatures(zones));
    const rangeSource = map?.getSource('range');
    if (rangeSource) rangeSource.setData(ringFeature(user, rangeRadiusM));
  }, [zones, user, rangeRadiusM]);

  // Recenter when the user's location changes (for example once real data loads).
  useEffect(() => {
    mapRef.current?.jumpTo({ center: [user.lon, user.lat] });
  }, [user]);

  return <div ref={containerRef} className="game-map" aria-hidden="true" />;
}
