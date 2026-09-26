// Home: a tilted game-world map with the companion standing at the user's location.
// The map stays centered on the companion (no panning), like a location game.
import 'leaflet/dist/leaflet.css';
import { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { getEnvironment, getLog, getRisk, useApi } from '../api';
import Companion from '../components/Companion';
import ConditionChip from '../components/ConditionChip';
import FeedbackDialog from '../components/FeedbackDialog';
import MainMenu from '../components/MainMenu';
import TrainerBadge from '../components/TrainerBadge';
import { RISK_LEVELS, USE_MOCK, levelFromScore } from '../config';
import { todayString, useGame } from '../state/GameContext';

const DEFAULT_CENTER = [29.6516, -82.3248];
const DEFAULT_ZOOM = 15;
// OpenStreetMap tiles are free for light use and require the credit shown in the corner.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export default function MapHome() {
  const { profile, game } = useGame();
  const risk = useApi(getRisk);
  const environment = useApi(getEnvironment);
  const log = useApi(getLog);
  const [map, setMap] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Decided once on open, so answering doesn't close the dialog before the thank-you step.
  const [feedbackOpen, setFeedbackOpen] = useState(() => game.lastFeedbackDate !== todayString());

  const level = risk.data ? risk.data.risk_level || levelFromScore(risk.data.risk_score) : 'low';
  const mood = RISK_LEVELS[level].mood;
  const center = environment.data ? [environment.data.lat, environment.data.lon] : DEFAULT_CENTER;
  const askFeedback = log.data?.last_prediction && feedbackOpen && !menuOpen;

  return (
    <div className="map-home">
      <div className="map-tilt" aria-hidden="true">
        <MapContainer
          key={center.join(',')}
          center={center}
          zoom={DEFAULT_ZOOM}
          minZoom={13}
          maxZoom={17}
          dragging={false}
          zoomControl={false}
          attributionControl={false}
          scrollWheelZoom="center"
          touchZoom="center"
          doubleClickZoom="center"
          keyboard={false}
          ref={setMap}
        >
          <TileLayer url={TILE_URL} />
          <div className="map-tint" />
          <div className="range-ring" />
        </MapContainer>
      </div>
      <div className="horizon" />

      <Link to="/forecast" className="map-companion" aria-label={`${profile.companionName}. Open tomorrow's forecast`}>
        <Companion mood={mood} size={120} />
      </Link>

      <div className="hud-top">
        <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
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
        <button className="round-button" onClick={() => map?.setZoom(DEFAULT_ZOOM)} aria-label="Reset zoom">
          🧭
        </button>
        <Link to="/triggers" className="round-button" aria-label="Your triggers">
          🔍
        </Link>
      </div>

      <div className="hud-bottom">
        <TrainerBadge />
        <button className="main-button" onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <Companion mood="happy" size={50} label="Menu" />
        </button>
        <a className="map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          © OpenStreetMap
        </a>
      </div>

      {menuOpen && <MainMenu onClose={() => setMenuOpen(false)} />}
      {askFeedback && <FeedbackDialog lastPrediction={log.data.last_prediction} onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}
