// Profile, laid out like a location game's trainer page: name, companion, level and XP,
// three round actions (edit answers, history, settings), total activity and weekly progress.
// A second tab shows medals with bronze, silver and gold tiers.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getLog, useApi } from '../api';
import Companion from '../components/Companion';
import GameDialog from '../components/GameDialog';
import StreakCard from '../components/StreakCard';
import { BASELINE_WINDOW_DAYS } from '../config';
import { notificationPermission, requestNotifications } from '../notify';
import { MEDALS, MEDAL_TIERS, currentStreak, levelInfo, medalTier, todayString, useGame } from '../state/GameContext';
import { NOT_SURE_TRIGGER } from '../survey';
import Icon from '../components/Icon';

const ANSWER_LABELS = [
  ['nickname', 'Name'],
  ['city', 'City'],
  ['rescueDays', 'Rescue inhaler days (good week)'],
  ['puffsPerDay', 'Puffs on those days'],
  ['nightWaking', 'Night waking (past 4 weeks)'],
  ['controller', 'Daily controller inhaler'],
  ['triggers', 'Triggers you reported'],
  ['preExercise', 'Rescue inhaler before exercise'],
];

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function MeTab({ onOpenSettings }) {
  const { profile, game } = useGame();
  const log = useApi(getLog);
  const [panel, setPanel] = useState(null);
  const { level, progress, needed } = levelInfo(game.xp);
  const streak = currentStreak(game);
  const { correct, total } = game.accuracy;
  const stillLearning = !profile.isDemo && game.checkIns < BASELINE_WINDOW_DAYS;

  // Recent check-ins: today's (if any) plus the saved history from the log.
  const today = game.lastCheckInDate === todayString() && game.todayEntry ? [{ ...game.todayEntry, date: todayString() }] : [];
  const earlier = profile.isDemo ? log.data?.entries || [] : [];
  const history = [...today, ...earlier.filter((entry) => entry.date !== todayString())].slice(0, 7);

  const activity = [
    ['calendar', 'Days checked in', game.checkIns],
    ['streak', 'Current streak', `${streak} ${streak === 1 ? 'day' : 'days'}`],
    ['medal', 'Best streak', `${game.bestStreak} ${game.bestStreak === 1 ? 'day' : 'days'}`],
    ['target', 'Matching outcomes', total ? `${correct} of ${total} answered days` : 'None answered yet'],
    ['star', 'Total XP', game.xp.toLocaleString()],
  ];

  return (
    <>
      <section className="profile-hero">
        <h1 className="profile-name">{profile.nickname || 'Trainer'}</h1>
        <p className="profile-buddy">& {profile.companionName}</p>
        <div className="profile-companion">
          <Companion mood="happy" size={190} />
        </div>
        <div className="profile-level">
          <div className="level-number">
            <strong>{level}</strong>
            <span>Level</span>
          </div>
          <div className="level-bar">
            <div className="level-track" aria-hidden="true">
              <span style={{ width: `${(progress / needed) * 100}%` }} />
            </div>
            <p>
              {progress} / {needed} XP to level {level + 1}
            </p>
          </div>
          <span className="level-streak" title="Current streak">
            <Icon name="streak" size={16} /> {streak}
          </span>
        </div>
        <div className="profile-actions">
          <Link to="/profile/edit" className="profile-action">
            <span className="profile-action-icon" aria-hidden="true">
              <Icon name="edit" size={24} />
            </span>
            Edit answers
          </Link>
          <button className="profile-action" onClick={() => setPanel(panel === 'history' ? null : 'history')} aria-expanded={panel === 'history'}>
            <span className="profile-action-icon" aria-hidden="true">
              <Icon name="history" size={24} />
            </span>
            History
          </button>
          <button className="profile-action" onClick={onOpenSettings}>
            <span className="profile-action-icon" aria-hidden="true">
              <Icon name="settings" size={24} />
            </span>
            Settings
          </button>
        </div>
      </section>

      <section className="profile-sheet">
        {panel === 'history' && (
          <div className="profile-block">
            <p className="sheet-title">Recent check-ins</p>
            {history.length === 0 ? (
              <p className="muted">No check-ins yet. Your first one starts your streak.</p>
            ) : (
              <ul className="history-list">
                {history.map((entry) => {
                  const score = entry.symptoms.breath + entry.symptoms.wheeze + entry.symptoms.cough;
                  return (
                    <li key={entry.date}>
                      <strong>{formatDate(entry.date)}</strong>
                      <span>
                        {entry.puffs} {entry.puffs === 1 ? 'puff' : 'puffs'} · symptoms {score}/9 · {entry.night_waking ? 'woke at night' : 'slept through'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <p className="sheet-title">Total activity</p>
        <ul className="activity-list">
          {activity.map(([icon, label, value]) => (
            <li key={label}>
              <span className="activity-icon">
                <Icon name={icon} size={16} />
              </span>
              <span>{label}</span>
              <strong>{value}</strong>
            </li>
          ))}
        </ul>

        <p className="sheet-title">Weekly progress</p>
        <StreakCard streak={streak} checkedInToday={game.lastCheckInDate === todayString()} />

        <div className="profile-block">
          <div className="section-head">
            <p className="sheet-title">Your answers</p>
            <Link to="/profile/edit" className="text-button small">
              Edit
            </Link>
          </div>
          {stillLearning && (
            <p className="learning-banner">
              <Icon name="learning" size={17} /> Still learning your patterns ({game.checkIns} of {BASELINE_WINDOW_DAYS} days logged)
            </p>
          )}
          <dl className="answer-list">
            {ANSWER_LABELS.map(([id, label]) => {
              const value = profile.survey?.[id];
              const shown = Array.isArray(value) ? (value.length ? value.join(', ') : NOT_SURE_TRIGGER) : value || '—';
              return (
                <div key={id}>
                  <dt>{label}</dt>
                  <dd>{shown}</dd>
                </div>
              );
            })}
          </dl>
          <p className="muted">Fictional prototype data. You can change these answers any time.</p>
        </div>
      </section>
    </>
  );
}

function BadgesTab() {
  const { game } = useGame();
  const earned = MEDALS.reduce((sum, medal) => sum + medalTier(medal, game), 0);
  return (
    <section className="profile-sheet badges-sheet">
      <p className="sheet-title">
        Medals · {earned} of {MEDALS.length * MEDAL_TIERS.length} tiers earned
      </p>
      <ul className="medal-grid">
        {MEDALS.map((medal) => {
          const tier = medalTier(medal, game);
          const value = medal.stat(game);
          const next = medal.tiers[tier];
          const tierName = tier ? MEDAL_TIERS[tier - 1] : 'Not earned yet';
          return (
            <li key={medal.id} className={`medal tier-${tier}`}>
              <span className="medal-disc">
                <Icon name={medal.icon} size={32} />
              </span>
              <strong>{medal.name}</strong>
              <span className="medal-tier">{tierName}</span>
              <div className="medal-progress" aria-hidden="true">
                <span style={{ width: `${next ? Math.min(100, (value / next) * 100) : 100}%` }} />
              </div>
              <span className="muted medal-next">
                {next ? `${value} / ${next} ${medal.unit} for ${MEDAL_TIERS[tier]}` : 'Gold earned!'}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="muted">Medals reward checking in and answering, never having fewer symptoms or using less medication.</p>
    </section>
  );
}

function SettingsDialog({ onClose }) {
  const navigate = useNavigate();
  const { profile, startDemo, reset } = useGame();
  const [permission, setPermission] = useState(notificationPermission);
  const [confirmReset, setConfirmReset] = useState(false);

  if (confirmReset) {
    return (
      <GameDialog
        title="Start over?"
        message="This clears your profile, check-ins and progress on this device, and opens the welcome questions again."
        confirmLabel="Start over"
        cancelLabel="Cancel"
        onConfirm={() => {
          reset();
          navigate('/');
        }}
        onCancel={() => setConfirmReset(false)}
      />
    );
  }

  const permissionText = {
    granted: 'On',
    denied: 'Blocked in your browser settings',
    default: 'Off',
    unsupported: 'Not supported in this browser',
  }[permission];

  return (
    <GameDialog title="Settings" confirmLabel="Done" onConfirm={onClose} onDismiss={onClose}>
      <div className="settings-list">
        <div className="settings-row">
          <span>
            Trigger notifications
            <small>{permissionText}</small>
          </span>
          {permission === 'default' && (
            <button className="text-button small" onClick={async () => setPermission(await requestNotifications())}>
              Turn on
            </button>
          )}
        </div>
        {!profile.isDemo && (
          <div className="settings-row">
            <span>
              Demo profile
              <small>Three weeks of example history</small>
            </span>
            <button
              className="text-button small"
              onClick={() => {
                startDemo();
                navigate('/');
              }}
            >
              Switch
            </button>
          </div>
        )}
        <div className="settings-row">
          <span>
            Start over
            <small>Clears data on this device</small>
          </span>
          <button className="text-button small danger" onClick={() => setConfirmReset(true)}>
            Reset
          </button>
        </div>
      </div>
    </GameDialog>
  );
}

export default function Profile() {
  const [tab, setTab] = useState('me');
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="profile-screen">
      <header className="profile-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'me'} className={tab === 'me' ? 'active' : ''} onClick={() => setTab('me')}>
          Me
        </button>
        <button role="tab" aria-selected={tab === 'badges'} className={tab === 'badges' ? 'active' : ''} onClick={() => setTab('badges')}>
          Badges
        </button>
        <button className="round-button profile-settings" onClick={() => setSettingsOpen(true)} aria-label="Settings">
          <Icon name="settings" size={20} />
        </button>
      </header>

      {tab === 'me' ? <MeTab onOpenSettings={() => setSettingsOpen(true)} /> : <BadgesTab />}

      <Link to="/" className="close-button profile-close" aria-label="Back to map">
        <Icon name="close" size={26} />
      </Link>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
