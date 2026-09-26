import { NavLink } from 'react-router-dom';
import { HomeIcon, MapIcon, ProfileIcon, QuestIcon, TriggerIcon } from './Icons';

const TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/map', label: 'Map', Icon: MapIcon },
  { to: '/check-in', label: 'Check-in', Icon: QuestIcon, primary: true },
  { to: '/triggers', label: 'Triggers', Icon: TriggerIcon },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map(({ to, label, Icon, end, primary }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab${isActive ? ' active' : ''}${primary ? ' primary' : ''}`}>
          <span className="tab-icon">
            <Icon />
          </span>
          <span className="tab-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
