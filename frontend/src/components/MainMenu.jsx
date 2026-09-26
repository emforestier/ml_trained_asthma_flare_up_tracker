// Menu opened by the big round button: a drawer that slides up over the map
// instead of covering the whole screen.
import { Link } from 'react-router-dom';
import Wordmark from './Wordmark';

const ITEMS = [
  { to: '/forecast', icon: '🌤️', label: 'Demo score' },
  { to: '/check-in', icon: '⭐', label: 'Check-in' },
  { to: '/triggers', icon: '🔍', label: 'Patterns' },
  { to: '/profile', icon: '👤', label: 'Profile' },
];

export default function MainMenu({ onClose }) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <nav className="menu-drawer" aria-label="Main menu">
        <Wordmark size="small" tone="dark" />
        <div className="menu-grid">
          {ITEMS.map(({ to, icon, label }) => (
            <Link key={to} to={to} className="menu-item">
              <span className="round-button" aria-hidden="true">
                {icon}
              </span>
              {label}
            </Link>
          ))}
        </div>
        <button className="close-button" onClick={onClose} aria-label="Close menu">
          ×
        </button>
      </nav>
    </>
  );
}
