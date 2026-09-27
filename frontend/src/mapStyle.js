// Game-world map style: bright green ground, dark slate roads with yellow edges, blue water,
// no labels when zoomed out and street names when zoomed in.
// Tiles come from OpenFreeMap (free, no API key), using the OpenMapTiles layer schema.

export const STREET_NAME_MIN_ZOOM = 17;

const COLORS = {
  ground: '#8fe69a',
  residential: '#a4ecae',
  park: '#6fd48a',
  wood: '#5ec27a',
  water: '#4aa3df',
  building: '#7fd4bd',
  road: '#3d6668',
  roadEdge: '#f2e27a',
  path: '#5f8f86',
  label: '#ffffff',
  labelHalo: '#2f5557',
};

// Road width grows with zoom; major roads are wider.
const width = (minor, major) => [
  'interpolate', ['exponential', 1.6], ['zoom'],
  12, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], major * 0.35, ['secondary', 'tertiary'], major * 0.25, minor * 0.15],
  16, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], major * 1.4, ['secondary', 'tertiary'], major, minor],
  19, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], major * 5, ['secondary', 'tertiary'], major * 4, minor * 4],
];

// Service roads and parking aisles are left out, like in location games, to keep the map clean.
const ROAD_CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor'];

export const gameMapStyle = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  layers: [
    // If tiles fail to load (no internet), this green field is still a playable map.
    { id: 'ground', type: 'background', paint: { 'background-color': COLORS.ground } },
    {
      id: 'residential',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood', 'commercial', 'retail']]],
      paint: { 'fill-color': COLORS.residential },
    },
    {
      id: 'wood',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['wood', 'forest']]],
      paint: { 'fill-color': COLORS.wood },
    },
    {
      id: 'park',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'park',
      paint: { 'fill-color': COLORS.park },
    },
    {
      id: 'grass',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['grass', 'farmland', 'wetland']]],
      paint: { 'fill-color': COLORS.park, 'fill-opacity': 0.7 },
    },
    { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': COLORS.water } },
    {
      id: 'waterway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      paint: { 'line-color': COLORS.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 18, 6] },
    },
    {
      id: 'building',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 15,
      paint: { 'fill-color': COLORS.building, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, 0.55] },
    },
    {
      id: 'path',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 15,
      filter: ['in', ['get', 'class'], ['literal', ['path', 'track']]],
      paint: { 'line-color': COLORS.path, 'line-width': 1.5, 'line-dasharray': [2, 1.5], 'line-opacity': 0.7 },
    },
    // Yellow edge first, then the dark road on top of it.
    {
      id: 'road-edge',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ROAD_CLASSES]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': COLORS.roadEdge, 'line-width': width(9, 14) },
    },
    {
      id: 'road',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ROAD_CLASSES]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': COLORS.road, 'line-width': width(6.5, 10.5) },
    },
    {
      id: 'street-names',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      minzoom: STREET_NAME_MIN_ZOOM,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], STREET_NAME_MIN_ZOOM, 11, 19, 14],
        'text-letter-spacing': 0.04,
      },
      paint: { 'text-color': COLORS.label, 'text-halo-color': COLORS.labelHalo, 'text-halo-width': 1.6 },
    },
    // Place names reveal themselves as you zoom in: neighborhoods first, then parks and lakes,
    // then landmarks and named buildings (most important first). MapLibre hides any label that
    // would overlap another.
    {
      id: 'neighborhood-names',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      minzoom: 13,
      maxzoom: 16.5,
      filter: ['in', ['get', 'class'], ['literal', ['suburb', 'quarter', 'neighbourhood']]],
      layout: {
        'text-field': ['upcase', ['coalesce', ['get', 'name:en'], ['get', 'name']]],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 11, 16, 14],
        'text-letter-spacing': 0.18,
        'text-max-width': 8,
      },
      paint: { 'text-color': 'rgba(47, 85, 87, 0.75)', 'text-halo-color': 'rgba(255, 255, 255, 0.6)', 'text-halo-width': 1.4 },
    },
    {
      id: 'water-names',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'water_name',
      minzoom: 14,
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-font': ['Noto Sans Italic'],
        'text-size': 12,
        'text-max-width': 8,
      },
      paint: { 'text-color': '#1f5f8f', 'text-halo-color': 'rgba(255, 255, 255, 0.8)', 'text-halo-width': 1.4 },
    },
    {
      id: 'park-names',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'park',
      minzoom: 15,
      filter: ['has', 'name'],
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-font': ['Noto Sans Bold'],
        'text-size': 12,
        'text-max-width': 8,
      },
      paint: { 'text-color': '#1f6e3f', 'text-halo-color': 'rgba(255, 255, 255, 0.85)', 'text-halo-width': 1.5 },
    },
    // Landmarks and named buildings: the most important from zoom 16, more at 17, the rest at 18.
    ...[
      ['place-names-major', 16, 0, 8],
      ['place-names-more', 17, 9, 20],
      ['place-names-all', 18, 21, 1000],
    ].map(([id, minzoom, minRank, maxRank]) => ({
      id,
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'poi',
      minzoom,
      filter: [
        'all',
        ['has', 'name'],
        ['>=', ['get', 'rank'], minRank],
        ['<=', ['get', 'rank'], maxRank],
        // Bus and train stops are named after street corners, which just clutters the map.
        ['!', ['in', ['get', 'class'], ['literal', ['bus', 'railway', 'ferry_terminal', 'aerialway']]]],
      ],
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 16, 11, 19, 13],
        'text-max-width': 9,
        'text-padding': 4,
      },
      paint: { 'text-color': '#2f5557', 'text-halo-color': 'rgba(255, 255, 255, 0.9)', 'text-halo-width': 1.6 },
    })),
  ],
};
