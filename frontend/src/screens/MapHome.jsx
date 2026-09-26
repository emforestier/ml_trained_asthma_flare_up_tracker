// Home: a tilted game-world map. The companion stands at the user's location, and nearby
// triggers (pollen, weather, air quality) appear as animated enemies when you zoom in.
import 'leaflet/dist/leaflet.css';
import { useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, TileLayer } from 'react-leaflet';
import { Link, useNavigate } from 'react-router-dom';
import { getEnvironment, getLog, getRisk, getTriggers, useApi } from '../api';
import Companion from '../components/Companion';
import ConditionChip from '../components/ConditionChip';
import EnemyDialog from '../components/EnemyDialog';
import FeedbackDialog from '../components/FeedbackDialog';
import MainMenu from '../components/MainMenu';
import MapEntities, { MAP_PERSPECTIVE_PX, MAP_TILT_DEG, MIN_ENEMY_ZOOM } from '../components/MapEntities';
import NearbyPanel from '../components/NearbyPanel';
import TrainerBadge from '../components/TrainerBadge';
import { RISK_LEVELS, USE_MOCK, levelFromScore } from '../config';
import { distanceKm } from '../geo';
import { todayString, useGame } from '../state/GameContext';

const DEFAULT_CENTER = { lat: 29.6516, lon: -82.3248 };
const DEFAULT_ZOOM = 15;
const MIN_ZOOM = 12;
const MAX_ZOOM = 18;
// OpenStreetMap tiles are free for light use and require the credit shown in the corner.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ZONE_COLORS = { pollen: '#e8b923', air_quality: '#8a78e0', weather: '#4f9bd9' };
const TILT_STYLE = { transform: `perspective(${MAP_PERSPECTIVE_PX}px) rotateX(${MAP_TILT_DEG}deg)` };

export default function MapHome() {
  const navigate = useNavigate();
  const { profile, game } = useGame();
  const risk = useApi(getRisk);
  const environment = useApi(getEnvironment);
  const triggers = useApi(getTriggers);
  const log = useApi(getLog);
  const tiltRef = useRef(null);
  const [map, setMap] = useState(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  // Decided once on open, so answering doesn't close the dialog before the thank-you step.
  const [feedbackOpen, setFeedbackOpen] = useState(() => game.lastFeedbackDate !== todayString());

  const level = risk.data ? risk.data.risk_level || levelFromScore(risk.data.risk_score) : 'low';
  const userLat = environment.data?.lat ?? DEFAULT_CENTER.lat;
  const userLon = environment.data?.lon ?? DEFAULT_CENTER.lon;
  const user = useMemo(() => ({ lat: userLat, lon: userLon }), [userLat, userLon]);

  // Trigger zones, nearest first.
  const zones = useMemo(
    () =>
      (environment.data?.zones || [])
        .map((zone) => ({ ...zone, distanceKm: distanceKm(user, zone) }))
        .sort((a, b) => a.distanceKm - b.distanceKm),
    [environment.data, user],
  );

  // Only ask about yesterday once the user has a yesterday in the app.
  const hasHistory = profile.isDemo || game.checkIns > 0;
  const askFeedback = hasHistory && log.data?.last_prediction && feedbackOpen && !menuOpen && !selectedZone;

  function mapReady(instance) {
    if (!instance || instance === map) return;
    setMap(instance);
    instance.on('zoomend', () => setZoom(instance.getZoom()));
  }

  const flyTo = (lat, lon, targetZoom) => map?.flyTo([lat, lon], targetZoom, { duration: 1.2 });

  return (
    <div className="map-home">
      <div className="map-tilt" ref={tiltRef} style={TILT_STYLE} aria-hidden="true">
        <MapContainer
          key={`${user.lat},${user.lon}`}
          center={[user.lat, user.lon]}
          zoom={DEFAULT_ZOOM}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          zoomControl={false}
          attributionControl={false}
          scrollWheelZoom="center"
          touchZoom="center"
          doubleClickZoom="center"
          keyboard={false}
          ref={mapReady}
        >
          <TileLayer url={TILE_URL} />
          <div className="map-tint" />
          {zones.map((zone) => (
            <Circle
              key={zone.id}
              center={[zone.lat, zone.lon]}
              radius={zone.radius_m}
              interactive={false}
              pathOptions={{ className: `zone-aura zone-${zone.level}`, color: ZONE_COLORS[zone.type], weight: 2, fillOpacity: 0.16 }}
            />
          ))}
          <Circle
            center={[user.lat, user.lon]}
            radius={220}
            interactive={false}
            pathOptions={{ className: 'range-ring', color: '#ffffff', weight: 3, fillColor: '#ffffff', fillOpacity: 0.12 }}
          />
        </MapContainer>
      </div>
      <div className="horizon" />

      <MapEntities
        map={map}
        tiltRef={tiltRef}
        user={user}
        companionMood={RISK_LEVELS[level].mood}
        companionName={profile.companionName}
        zones={zones}
        onCompanionTap={() => navigate('/forecast')}
        onEnemyTap={setSelectedZone}
      />

      <div className="hud-top">
        <div className="hud-top-left">
          {risk.data && (
            <Link to="/forecast" className="glass-pill risk-pill">
              <span className="risk-dot" style={{ background: RISK_LEVELS[level].color }} />
              <small>TOMORROW</small>
              <span className="divider">/</span>
              <strong>{Math.round(risk.data.risk_score * 100)}%</strong>
              <small>{RISK_LEVELS[level].label.toUpperCase()}</small>
            </Link>
          )}
          {environment.data && <ConditionChip current={environment.data.current} />}
        </div>
        <div className="hud-top-right">
          <span className="streak-chip" title="Check-in streak">
            🔥 {game.streak}
          </span>
          {USE_MOCK && <span className="mock-flag">Mock data</span>}
        </div>
      </div>

      <div className="hud-right">
        <button className="round-button" onClick={() => flyTo(user.lat, user.lon, DEFAULT_ZOOM)} aria-label="Back to my location">
          🧭
        </button>
        <button className="round-button" onClick={() => map?.zoomIn()} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in">
          +
        </button>
        <button className="round-button" onClick={() => map?.zoomOut()} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out">
          −
        </button>
      </div>

      {zoom < MIN_ENEMY_ZOOM && <p className="zoom-hint">Zoom in to find triggers</p>}

      <div className="hud-bottom">
        <TrainerBadge />
        <button className="main-button" onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <Companion mood="happy" size={50} label="Menu" />
        </button>
        <NearbyPanel zones={zones} onSelect={(zone) => flyTo(zone.lat, zone.lon, 16)} />
      </div>
      <a className="map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        © OpenStreetMap
      </a>

      {menuOpen && <MainMenu onClose={() => setMenuOpen(false)} />}
      {selectedZone && <EnemyDialog zone={selectedZone} triggers={triggers.data?.triggers} onClose={() => setSelectedZone(null)} />}
      {askFeedback && <FeedbackDialog lastPrediction={log.data.last_prediction} onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}
