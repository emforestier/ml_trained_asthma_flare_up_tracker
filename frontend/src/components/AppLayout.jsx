// Mobile frame shared by every tab: scrolling content above a fixed bottom navigation.
import { Outlet } from 'react-router-dom';
import { USE_MOCK } from '../config';
import BottomNav from './BottomNav';

export default function AppLayout() {
  return (
    <div className="app">
      {USE_MOCK && <div className="mock-flag">Mock data</div>}
      <main className="screen">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
