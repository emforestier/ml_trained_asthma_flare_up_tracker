// Bottom-left corner badge: companion portrait, level, name and XP bar. Opens the profile.
import { Link } from 'react-router-dom';
import { levelInfo, useGame } from '../state/GameContext';
import Companion from './Companion';

export default function TrainerBadge() {
  const { profile, game } = useGame();
  const { level, progress, needed } = levelInfo(game.xp);

  return (
    <Link to="/profile" className="trainer" aria-label={`Level ${level}, ${progress} of ${needed} XP. Open profile`}>
      <span className="trainer-portrait">
        <Companion mood="happy" size={52} label={profile.companionName} />
      </span>
      <span className="trainer-level">{level}</span>
      <span className="trainer-name">{profile.companionName}</span>
      <span className="xp-bar">
        <span style={{ width: `${(progress / needed) * 100}%` }} />
      </span>
    </Link>
  );
}
