// Layout for the screens opened from the menu: a teal gradient page with a round
// close button at the bottom that returns to the map.
import { Link, Outlet } from 'react-router-dom';

export default function AppLayout() {
  return (
    <div className="menu-screen">
      <Outlet />
      <Link to="/" className="close-button menu-screen-close" aria-label="Back to map">
        ×
      </Link>
    </div>
  );
}
