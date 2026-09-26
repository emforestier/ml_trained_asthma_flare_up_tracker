import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { getEnvironment, getLog, getRisk, getTriggers } from './api';
import AppLayout from './components/AppLayout';
import Placeholder from './components/Placeholder';
import DesignPreview from './screens/DesignPreview';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Placeholder title="Home" milestone="Sat 10 AM" loader={getRisk} endpoint="risk" />} />
          <Route path="map" element={<Placeholder title="Air map" milestone="Sat 1 PM" loader={getEnvironment} endpoint="environment" />} />
          <Route path="check-in" element={<Placeholder title="Daily quest" milestone="Sat 4 PM" loader={getLog} endpoint="log" />} />
          <Route path="triggers" element={<Placeholder title="Triggers" milestone="Sat 6 PM" loader={getTriggers} endpoint="triggers" />} />
          <Route path="profile" element={<Placeholder title="Profile" milestone="Sat 8 PM" loader={getLog} endpoint="log" />} />
        </Route>
        <Route path="design" element={<DesignPreview />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
