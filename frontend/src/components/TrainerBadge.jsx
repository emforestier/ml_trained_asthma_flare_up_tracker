// Bottom-left of the map: companion portrait, level, the user's nickname and XP bar. Opens the profile.
import { Link } from 'react-router-dom';
import { levelInfo, useGame } from '../state/GameContext';
import Companion from './Companion';

export default function TrainerBadge() {
  const { profile, game } = useGame();
  const { level, progress, needed } = levelInfo(game.xp);

  return (
    <Link to="/profile" className="trainer" aria-label={`Level ${level}, ${progress} of ${needed} XP. Open profile`}>
      <span className="trainer-portrait">
        <Companion mood="happy" size={50} label={profile.companionName} />
      </span>
      <span className="trainer-text">
        <span className="trainer-level">
          <small>Lv</small> {level}
        </span>
        <span className="trainer-name">{profile.nickname || profile.companionName}</span>
        <span className="xp-bar">
          <span style={{ width: `${(progress / needed) * 100}%` }} />
        </span>
      </span>
    </Link>
  );
}
