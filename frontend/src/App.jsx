import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import Wordmark from './components/Wordmark';
import CheckIn from './screens/CheckIn';
import DesignPreview from './screens/DesignPreview';
import Emergency from './screens/Emergency';
import Forecast from './screens/Forecast';
import MapHome from './screens/MapHome';
import Onboarding from './screens/Onboarding';
import Patterns from './screens/Patterns';
import Profile from './screens/Profile';
import { GameProvider, useGame } from './state/GameContext';
import './phone-frame.css';

// First-time users see onboarding on every route until they finish it.
function Screens() {
  const { profile } = useGame();
  if (!profile.onboarded) {
    return (
      <Routes>
        <Route path="design" element={<DesignPreview />} />
        <Route path="*" element={<Onboarding />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route index element={<MapHome />} />
      <Route path="forecast" element={<Forecast />} />
      <Route element={<AppLayout />}>
        <Route path="check-in" element={<CheckIn />} />
        <Route path="triggers" element={<Patterns />} />
      </Route>
      <Route path="profile" element={<Profile />} />
      <Route path="profile/edit" element={<Onboarding mode="edit" />} />
      <Route path="emergency" element={<Emergency />} />
      <Route path="design" element={<DesignPreview />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <GameProvider>
      <HashRouter>
        {/* On laptops the app sits in a phone frame; on phones only the app shows. */}
        <div className="stage">
          <aside className="stage-brand">
            <Wordmark tagline />
            <p>Learns your personal asthma triggers and gives you a heads-up the day before a likely flare-up.</p>
            <p className="stage-note">Prototype · fictional demo data</p>
          </aside>
          <div className="phone">
            <span className="phone-island" aria-hidden="true" />
            <Screens />
          </div>
        </div>
      </HashRouter>
    </GameProvider>
  );
}
