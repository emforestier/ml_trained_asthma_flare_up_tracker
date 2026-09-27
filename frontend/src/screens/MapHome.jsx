// Home: a tilted game-world map. The companion stands at the user's location, and nearby
// triggers (pollen, weather, air quality) appear as animated enemies when you zoom in.
// Streets show when zoomed out; street names appear when zoomed in.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { buildTriggerAlerts } from '../alerts';
import { getEnvironment, getLog, getRisk, getTriggers, useApi } from '../api';
import AlertToast from '../components/AlertToast';
import ConditionChip from '../components/ConditionChip';
import EnemyDialog from '../components/EnemyDialog';
import FeedbackDialog from '../components/FeedbackDialog';
import GameMap from '../components/GameMap';
import MainMenu from '../components/MainMenu';
import MenuEmblem from '../components/MenuEmblem';
import MapEntities, { MIN_ENEMY_ZOOM } from '../components/MapEntities';
import NearbyPanel from '../components/NearbyPanel';
import TrainerBadge from '../components/TrainerBadge';
import { RISK_LEVELS, USE_MOCK, levelFromScore } from '../config';
import { distanceKm } from '../geo';
import { sendSystemNotification } from '../notify';
import { alertsSeenToday, currentStreak, todayString, useGame } from '../state/GameContext';
import Icon from '../components/Icon';

const DEFAULT_CENTER = { lat: 29.6516, lon: -82.3248 };
const DEFAULT_ZOOM = 16;
const MIN_ZOOM = 13;
const MAX_ZOOM = 19;

export default function MapHome() {
  const navigate = useNavigate();
  const { profile, game, markAlertsSeen } = useGame();
  const risk = useApi(getRisk);
  const environment = useApi(getEnvironment);
  const triggers = useApi(getTriggers);
  const log = useApi(getLog);
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

  // Trigger alerts the user hasn't seen today. One shows at a time, and only when no dialog is open.
  const alerts = useMemo(
    () =>
      buildTriggerAlerts({
        environment: environment.data,
        triggers: triggers.data?.triggers,
        profile,
        game,
        entry: game.lastCheckInDate === todayString() ? game.todayEntry : null,
        date: todayString(),
      }),
    [environment.data, triggers.data, profile, game],
  );
  const seen = alertsSeenToday(game);
  const pendingAlerts = alerts.filter((alert) => !seen.includes(alert.id));
  const currentAlert = !askFeedback && !menuOpen && !selectedZone ? pendingAlerts[0] : null;

  // Also send it as a system notification, if the user allowed them.
  useEffect(() => {
    if (currentAlert) sendSystemNotification(currentAlert);
  }, [currentAlert?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function mapReady(instance) {
    setMap(instance);
    instance?.on('zoomend', () => setZoom(instance.getZoom()));
  }

  const flyTo = (lat, lon, targetZoom) => map?.flyTo({ center: [lon, lat], zoom: targetZoom, duration: 1200 });

  return (
    <div className="map-home">
      <GameMap user={user} zones={zones} zoom={DEFAULT_ZOOM} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} onReady={mapReady} />
      <div className="horizon" />

      <MapEntities
        map={map}
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
            <Link to="/forecast" className="glass-pill risk-pill" aria-label={`Experimental demo score for tomorrow: ${Math.round(risk.data.risk_score * 100)}%, ${RISK_LEVELS[level].label}`}>
              <span className="risk-dot" style={{ background: RISK_LEVELS[level].color }} />
              <small>DEMO SCORE</small>
              <span className="divider">/</span>
              <strong>{Math.round(risk.data.risk_score * 100)}%</strong>
              <small>{RISK_LEVELS[level].label.toUpperCase()}</small>
            </Link>
          )}
          {environment.data && <ConditionChip current={environment.data.current} />}
          {zones.length > 0 && <span className="overlay-tag on-map">Illustrative demo overlay</span>}
        </div>
        <div className="hud-top-right">
          <span className="streak-chip" title="Check-in streak">
            <Icon name="streak" size={16} /> {currentStreak(game)}
          </span>
          {USE_MOCK && <span className="mock-flag">Mock data</span>}
        </div>
      </div>

      <div className="hud-right">
        <Link to="/emergency" className="round-button emergency-button" aria-label="Emergency help">
          <Icon name="emergency" size={22} />
        </Link>
        <button className="round-button" onClick={() => flyTo(user.lat, user.lon, DEFAULT_ZOOM)} aria-label="Back to my location">
          <Icon name="locate" size={22} />
        </button>
        <button className="round-button" onClick={() => map?.zoomIn()} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in">
          <Icon name="zoomIn" size={22} />
        </button>
        <button className="round-button" onClick={() => map?.zoomOut()} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out">
          <Icon name="zoomOut" size={22} />
        </button>
      </div>

      {zoom < MIN_ENEMY_ZOOM && <p className="zoom-hint">Zoom in to find triggers</p>}

      {currentAlert && (
        <div className="alert-slot">
          <AlertToast
            key={currentAlert.id}
            alert={currentAlert}
            remaining={pendingAlerts.length - 1}
            onDismiss={() => markAlertsSeen([currentAlert.id])}
            onOpen={() => {
              markAlertsSeen([currentAlert.id]);
              navigate('/forecast');
            }}
          />
        </div>
      )}

      <div className="hud-bottom">
        <TrainerBadge />
        <button className="main-button" onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <MenuEmblem />
        </button>
        <NearbyPanel zones={zones} onSelect={(zone) => flyTo(zone.lat, zone.lon, 17)} />
      </div>
      <p className="map-credit">
        <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> ·{' '}
        <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a> ·{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
      </p>

      {menuOpen && <MainMenu onClose={() => setMenuOpen(false)} />}
      {selectedZone && <EnemyDialog zone={selectedZone} triggers={triggers.data?.triggers} onClose={() => setSelectedZone(null)} />}
      {askFeedback && <FeedbackDialog lastPrediction={log.data.last_prediction} onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}
