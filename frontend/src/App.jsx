import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { getLog, getTriggers } from './api';
import AppLayout from './components/AppLayout';
import Placeholder from './components/Placeholder';
import DesignPreview from './screens/DesignPreview';
import Forecast from './screens/Forecast';
import MapHome from './screens/MapHome';
import Onboarding from './screens/Onboarding';
import { GameProvider, useGame } from './state/GameContext';

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
        <Route path="check-in" element={<Placeholder title="Daily quest" milestone="Sat 4 PM" loader={getLog} endpoint="log" />} />
        <Route path="triggers" element={<Placeholder title="Triggers" milestone="Sat 6 PM" loader={getTriggers} endpoint="triggers" />} />
        <Route path="profile" element={<Placeholder title="Profile" milestone="Sat 8 PM" loader={getLog} endpoint="log" />} />
      </Route>
      <Route path="design" element={<DesignPreview />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <GameProvider>
      <HashRouter>
        <div className="phone">
          <Screens />
        </div>
      </HashRouter>
    </GameProvider>
  );
}
