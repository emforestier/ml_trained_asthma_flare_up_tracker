import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { getLog } from './api';
import AppLayout from './components/AppLayout';
import Placeholder from './components/Placeholder';
import CheckIn from './screens/CheckIn';
import DesignPreview from './screens/DesignPreview';
import Emergency from './screens/Emergency';
import Forecast from './screens/Forecast';
import MapHome from './screens/MapHome';
import Onboarding from './screens/Onboarding';
import Patterns from './screens/Patterns';
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
        <Route path="check-in" element={<CheckIn />} />
        <Route path="triggers" element={<Patterns />} />
        <Route path="profile" element={<Placeholder title="Profile" milestone="Sat 8 PM" loader={getLog} endpoint="log" />} />
      </Route>
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
        <div className="phone">
          <Screens />
        </div>
      </HashRouter>
    </GameProvider>
  );
}
