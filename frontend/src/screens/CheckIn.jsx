// Daily check-in as a quest: a safety check first, then puffs, symptoms and last night, then a
// reward with XP, the streak stamp card and any new badges. Urgent information appears the
// moment an emergency sign is selected, without finishing the quest or waiting on the backend.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { submitCheckIn } from '../api';
import Companion from '../components/Companion';
import StreakCard from '../components/StreakCard';
import UrgentNotice from '../components/UrgentNotice';
import {
  EMERGENCY_SIGNS,
  STREAK_CARD_DAYS,
  SYMPTOMS,
  SYMPTOM_LEVELS,
  XP_PER_CHECK_IN,
  XP_PER_STREAK_DAY,
  XP_STREAK_CARD_BONUS,
} from '../config';
import { currentStreak, levelInfo, todayString, useGame } from '../state/GameContext';

const OBJECTIVES = [
  { id: 'safety', label: 'Safety check' },
  { id: 'puffs', label: 'Log your rescue puffs' },
  { id: 'symptoms', label: 'Rate your symptoms' },
  { id: 'night', label: 'Tell me about last night' },
];
const NONE_OF_THESE = 'None of these';
const MAX_PUFFS = 30;

// Checks a check-in before it is saved. Returns a message per problem field.
export function validateCheckIn({ puffs, pre_exercise_puffs: preExercise, symptoms, night_waking: nightWaking }) {
  const errors = {};
  const isCount = (value) => Number.isInteger(value) && value >= 0 && value <= MAX_PUFFS;
  if (!isCount(puffs)) errors.puffs = `Total puffs must be a whole number from 0 to ${MAX_PUFFS}.`;
  if (!isCount(preExercise)) errors.preExercise = `Before-exercise puffs must be a whole number from 0 to ${MAX_PUFFS}.`;
  else if (isCount(puffs) && preExercise > puffs) errors.preExercise = "Before-exercise puffs can't be more than your total puffs today.";
  for (const { id, label } of SYMPTOMS) {
    const score = symptoms[id];
    if (!Number.isInteger(score) || score < 0 || score > 3) errors[id] = `Choose a level for ${label.toLowerCase()}.`;
  }
  if (typeof nightWaking !== 'boolean') errors.night = 'Choose yes or no.';
  return errors;
}

function Stepper({ label, value, onChange, max = MAX_PUFFS, error }) {
  return (
    <div className="stepper-block">
      <div className="stepper">
        <span className="stepper-label">{label}</span>
        <div className="stepper-controls">
          <button className="round-button" onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0} aria-label={`Fewer: ${label}`}>
            −
          </button>
          <output aria-live="polite">{value}</output>
          <button className="round-button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More: ${label}`}>
            +
          </button>
        </div>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Choice({ selected, onClick, children, role = 'radio' }) {
  return (
    <button className={`option compact${selected ? ' selected' : ''}`} role={role} aria-checked={selected} onClick={onClick}>
      <span className="option-mark" aria-hidden="true">
        {selected ? '✓' : ''}
      </span>
      {children}
    </button>
  );
}

// Counts up to the XP just earned.
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

function SaveNote({ mock }) {
  return mock ? <p className="save-note">Demo save: stored in this browser only.</p> : <p className="save-note">Saved.</p>;
}

function Reward({ reward, companionName, mock }) {
  const xp = useCountUp(reward.xpGained);
  const { level } = levelInfo(reward.xpAfter);
  return (
    <div className="quest-reward">
      <div className="reward-burst">
        <Companion mood="happy" size={150} />
      </div>
      <h1>Quest complete!</h1>
      <p className="reward-xp">+{xp} XP</p>
      {reward.cardFilled && <p className="reward-banner">🎁 Streak card full! +{XP_STREAK_CARD_BONUS} XP bonus</p>}
      {reward.leveledUp && <p className="reward-banner">⬆️ Level up! You're now level {level}</p>}
      {reward.newBadges.map((badge) => (
        <p key={badge.id} className="reward-banner">
          {badge.icon} New badge: {badge.name}
        </p>
      ))}
      <StreakCard streak={reward.streak} checkedInToday justStamped />
      <SaveNote mock={mock} />
      <p className="muted">{companionName} will use today's check-in to learn your patterns.</p>
      <Link to="/" className="pill-button as-link">
        Back to the map
      </Link>
    </div>
  );
}

function Updated({ streak, mock }) {
  return (
    <div className="quest">
      <h1>Daily quest</h1>
      <section className="card quest-card done">
        <p className="eyebrow">Updated</p>
        <h2>✓ Today's check-in was updated</h2>
        <p className="muted">Your streak already counts today, so there's no extra XP for updating.</p>
        <SaveNote mock={mock} />
      </section>
      <StreakCard streak={streak} checkedInToday />
      <Link to="/" className="pill-button as-link" style={{ justifySelf: 'center' }}>
        Back to the map
      </Link>
    </div>
  );
}

export default function CheckIn() {
  const navigate = useNavigate();
  const { profile, game, recordCheckIn } = useGame();
  const previous = game.lastCheckInDate === todayString() ? game.todayEntry : null;
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState(0);
  const [puffs, setPuffs] = useState(previous?.puffs ?? 0);
  const [preExercisePuffs, setPreExercisePuffs] = useState(previous?.pre_exercise_puffs ?? 0);
  const [symptoms, setSymptoms] = useState(previous?.symptoms ?? { breath: 0, wheeze: 0, cough: 0 });
  const [nightWaking, setNightWaking] = useState(previous?.night_waking ?? null);
  const [signs, setSigns] = useState([]);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const askPreExercise = profile.survey?.preExercise !== 'No';
  const checkedInToday = game.lastCheckInDate === todayString();
  const streak = currentStreak(game);
  const fillsCard = (streak + 1) % STREAK_CARD_DAYS === 0;
  const potentialXp = XP_PER_CHECK_IN + XP_PER_STREAK_DAY * (streak + 1) + (fillsCard ? XP_STREAK_CARD_BONUS : 0);
  const emergencySigns = signs.filter((sign) => sign !== NONE_OF_THESE);

  if (result?.reward?.updated) return <Updated streak={streak} mock={result.mock} />;
  if (result) return <Reward reward={result.reward} companionName={profile.companionName} mock={result.mock} />;

  if (checkedInToday && !editing) {
    const entry = game.todayEntry;
    const score = entry ? entry.symptoms.breath + entry.symptoms.wheeze + entry.symptoms.cough : null;
    return (
      <div className="quest">
        <h1>Daily quest</h1>
        <section className="card quest-card done">
          <p className="eyebrow">Completed today</p>
          <h2>✓ You checked in with {profile.companionName}</h2>
          {entry && (
            <p className="muted">
              {entry.puffs} rescue {entry.puffs === 1 ? 'puff' : 'puffs'}
              {entry.pre_exercise_puffs > 0 && ` (${entry.pre_exercise_puffs} before exercise)`} · symptom score {score} of 9 ·{' '}
              {entry.night_waking ? 'woke up at night' : 'slept through'}
            </p>
          )}
          <p className="muted">Your streak counts every day you check in at least once. Come back tomorrow to keep it going.</p>
          <button className="text-button" style={{ justifySelf: 'start', paddingLeft: 0 }} onClick={() => setEditing(true)}>
            Update today's check-in
          </button>
        </section>
        <StreakCard streak={streak} checkedInToday />
      </div>
    );
  }

  const entry = {
    user: profile.user,
    date: todayString(),
    puffs,
    pre_exercise_puffs: askPreExercise ? preExercisePuffs : 0,
    symptoms,
    night_waking: nightWaking,
    emergency_signs: emergencySigns,
  };
  const errors = validateCheckIn(entry);

  async function submit() {
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    setSaveError(null);
    const saved = await submitCheckIn(entry);
    setSaving(false);
    if (!saved.ok) {
      setSaveError("Couldn't save your check-in. Check your connection and try again.");
      return;
    }
    const reward = recordCheckIn(entry);
    // No celebration when emergency signs were reported.
    if (emergencySigns.length > 0) {
      navigate('/emergency');
      return;
    }
    setResult({ reward, mock: saved.mock });
  }

  function toggleSign(sign) {
    if (sign === NONE_OF_THESE) {
      setSigns(signs.includes(NONE_OF_THESE) ? [] : [NONE_OF_THESE]);
      return;
    }
    const withoutNone = signs.filter((item) => item !== NONE_OF_THESE);
    setSigns(withoutNone.includes(sign) ? withoutNone.filter((item) => item !== sign) : [...withoutNone, sign]);
  }

  const objective = OBJECTIVES[step].id;
  const stepErrors = {
    safety: signs.length === 0 ? 'Choose any that apply, or "None of these".' : null,
    puffs: errors.puffs || errors.preExercise || null,
    symptoms: SYMPTOMS.map(({ id }) => errors[id]).find(Boolean) || null,
    night: errors.night || null,
  };
  const canContinue = !stepErrors[objective];
  const isLast = step === OBJECTIVES.length - 1;

  return (
    <div className="quest">
      <h1>{editing ? "Update today's check-in" : 'Daily quest'}</h1>
      <section className="card quest-card">
        <div className="quest-card-head">
          <div>
            <p className="eyebrow">{editing ? 'Already checked in today' : "Today's quest"}</p>
            <h2>Check in with {profile.companionName}</h2>
          </div>
          {!editing && <span className="quest-xp">+{potentialXp} XP</span>}
        </div>
        <ol className="objectives">
          {OBJECTIVES.map((item, index) => (
            <li key={item.id} className={index < step ? 'done' : index === step ? 'current' : ''}>
              <span className="objective-mark" aria-hidden="true">
                {index < step ? '✓' : index + 1}
              </span>
              {item.label}
            </li>
          ))}
        </ol>
        <div className="quest-progress" aria-hidden="true">
          <span style={{ width: `${(step / OBJECTIVES.length) * 100}%` }} />
        </div>
      </section>

      {emergencySigns.length > 0 && <UrgentNotice compact />}

      <section className="card quest-step">
        {objective === 'safety' && (
          <>
            <h3>First, are you having any of these right now?</h3>
            <div className="option-list" role="group">
              {[...EMERGENCY_SIGNS, NONE_OF_THESE].map((sign) => (
                <Choice key={sign} role="checkbox" selected={signs.includes(sign)} onClick={() => toggleSign(sign)}>
                  {sign}
                </Choice>
              ))}
            </div>
          </>
        )}

        {objective === 'puffs' && (
          <>
            <h3>How many rescue inhaler puffs did you take today?</h3>
            <Stepper label="Total rescue puffs today" value={puffs} onChange={setPuffs} error={errors.puffs} />
            {askPreExercise && (
              <Stepper label="Of those, taken before exercise" value={preExercisePuffs} onChange={setPreExercisePuffs} error={errors.preExercise} />
            )}
            <p className="muted">Only your rescue inhaler counts here, not your daily controller.</p>
          </>
        )}

        {objective === 'symptoms' && (
          <>
            <h3>How were your symptoms today?</h3>
            {SYMPTOMS.map((symptom) => (
              <div key={symptom.id} className="symptom-row" role="radiogroup" aria-label={symptom.label}>
                <span className="symptom-label">{symptom.label}</span>
                <div className="segments">
                  {SYMPTOM_LEVELS.map((levelName, value) => (
                    <button
                      key={levelName}
                      className={`segment${symptoms[symptom.id] === value ? ' selected' : ''}`}
                      role="radio"
                      aria-checked={symptoms[symptom.id] === value}
                      onClick={() => setSymptoms({ ...symptoms, [symptom.id]: value })}
                    >
                      {levelName}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {objective === 'night' && (
          <>
            <h3>Did asthma wake you up last night?</h3>
            <div className="option-list" role="radiogroup">
              <Choice selected={nightWaking === true} onClick={() => setNightWaking(true)}>
                Yes
              </Choice>
              <Choice selected={nightWaking === false} onClick={() => setNightWaking(false)}>
                No
              </Choice>
            </div>
          </>
        )}
      </section>

      {saveError && (
        <p className="save-error" role="alert">
          {saveError}
        </p>
      )}

      <div className="quest-actions">
        <button className="pill-button" onClick={isLast ? submit : () => setStep(step + 1)} disabled={!canContinue || saving}>
          {saving ? 'Saving…' : isLast ? (saveError ? 'Try again' : editing ? 'Save update' : 'Finish quest') : 'Next'}
        </button>
        {step > 0 && (
          <button className="text-button" onClick={() => setStep(step - 1)} disabled={saving}>
            Back
          </button>
        )}
        {emergencySigns.length > 0 && (
          <button className="text-button" onClick={() => navigate('/emergency')}>
            Open emergency screen
          </button>
        )}
      </div>

      {!editing && <StreakCard streak={streak} checkedInToday={false} />}
    </div>
  );
}
