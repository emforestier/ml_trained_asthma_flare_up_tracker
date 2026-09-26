// "Meet your companion": the first-run survey, one question per screen, asked by the companion.
// With mode="edit" it reopens the same questions, pre-filled, to change answers from the profile.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveProfile } from '../api';
import Companion from '../components/Companion';
import { DEFAULT_COMPANION_NAME, DISCLAIMER } from '../config';
import { useGame } from '../state/GameContext';
import { DEMO_USER_ID, NO_RESCUE_DAYS, QUESTIONS, SURVEY_INTRO, ZERO_PUFFS, baselineEstimate, toggleTrigger } from '../survey';

const EMPTY_ANSWERS = { nickname: '', city: QUESTIONS[1].options[0], triggers: [] };

function isAnswered(question, answers) {
  const value = answers[question.id];
  if (question.type === 'text') return Boolean(value && value.trim());
  if (question.type === 'multi') return value.length > 0;
  return Boolean(value);
}

export default function Onboarding({ mode = 'create' }) {
  const editing = mode === 'edit';
  const navigate = useNavigate();
  const { profile: savedProfile, startDemo, finishOnboarding, updateProfile } = useGame();
  const [answers, setAnswers] = useState(() =>
    editing ? { ...EMPTY_ANSWERS, ...savedProfile.survey, triggers: savedProfile.survey?.triggers || [] } : EMPTY_ANSWERS,
  );
  const [step, setStep] = useState(editing ? 0 : 'intro'); // 'intro', a question index, or 'done'
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const visible = QUESTIONS.filter((question) => !question.skipWhen?.(answers));
  const index = typeof step === 'number' ? step : -1;
  const question = visible[index];

  const set = (id, value) => setAnswers((previous) => ({ ...previous, [id]: value }));
  const next = () => setStep(index + 1 < visible.length ? index + 1 : 'done');
  const back = () => {
    if (index > 0) setStep(index - 1);
    else if (editing) navigate('/profile');
    else setStep('intro');
  };

  async function finish() {
    setSaving(true);
    const survey = {
      ...answers,
      nickname: answers.nickname.trim(),
      puffsPerDay: answers.rescueDays === NO_RESCUE_DAYS ? ZERO_PUFFS : answers.puffsPerDay,
    };
    const profile = {
      user: editing ? savedProfile.user : DEMO_USER_ID,
      nickname: survey.nickname,
      city: survey.city,
      companionName: DEFAULT_COMPANION_NAME,
      survey,
      baselineEstimate: baselineEstimate(survey),
      isDemo: editing ? savedProfile.isDemo : false,
    };
    setSaveError(null);
    const saved = await saveProfile({
      user: profile.user,
      nickname: profile.nickname,
      city: profile.city,
      companion_name: profile.companionName,
      survey,
      baseline_estimate: profile.baselineEstimate,
    });
    setSaving(false);
    if (!saved.ok) {
      setSaveError("Couldn't save your profile. Check your connection and try again.");
      return;
    }
    if (editing) {
      updateProfile(profile);
      navigate('/profile');
      return;
    }
    finishOnboarding(profile);
  }

  if (step === 'intro') {
    return (
      <div className="onboarding">
        <div className="onboarding-companion">
          <Companion mood="happy" size={170} />
        </div>
        <div className="speech-card">
          <p className="speaker">{DEFAULT_COMPANION_NAME}</p>
          <p>{SURVEY_INTRO}</p>
        </div>
        <div className="onboarding-actions">
          <button className="pill-button" onClick={() => setStep(0)}>
            Let's go
          </button>
          <button className="text-button" onClick={startDemo}>
            Use the demo profile instead
          </button>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="onboarding">
        <div className="onboarding-companion">
          <Companion mood="happy" size={170} />
        </div>
        <div className="speech-card">
          <p className="speaker">{DEFAULT_COMPANION_NAME}</p>
          {editing ? (
            <p>
              All set, <strong>{answers.nickname.trim()}</strong>. Save your updated answers?
            </p>
          ) : (
            <p>
              Nice to meet you, <strong>{answers.nickname.trim()}</strong>! I'll keep an eye on the air around {answers.city} and learn
              your patterns as you check in each day.
            </p>
          )}
          <p className="muted">{DISCLAIMER}</p>
        </div>
        {saveError && (
          <p className="save-error" role="alert">
            {saveError}
          </p>
        )}
        <div className="onboarding-actions">
          <button className="pill-button" onClick={finish} disabled={saving}>
            {saving ? 'Saving…' : saveError ? 'Try again' : editing ? 'Save' : 'Start'}
          </button>
          <button className="text-button" onClick={() => setStep(visible.length - 1)} disabled={saving}>
            Back
          </button>
        </div>
      </div>
    );
  }

  const answered = isAnswered(question, answers);
  return (
    <div className="onboarding">
      <div className="onboarding-progress" aria-label={`Question ${index + 1} of ${visible.length}`}>
        <span style={{ width: `${((index + 1) / visible.length) * 100}%` }} />
      </div>
      <div className="onboarding-companion small">
        <Companion mood="happy" size={96} />
      </div>
      <div className="speech-card">
        <p className="speaker">
          Question {index + 1} of {visible.length}
        </p>
        <h2 id="question">{question.prompt}</h2>
        {question.helper && <p className="muted">{question.helper}</p>}
      </div>

      {question.type === 'text' && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (answered) next();
          }}
        >
          <input
            className="text-input"
            aria-labelledby="question"
            placeholder={question.placeholder}
            maxLength={question.maxLength}
            value={answers[question.id]}
            onChange={(event) => set(question.id, event.target.value)}
            autoFocus
          />
        </form>
      )}

      {question.type !== 'text' && (
        <div className="option-list" role={question.type === 'multi' ? 'group' : 'radiogroup'} aria-labelledby="question">
          {question.options.map((option) => {
            const selected = question.type === 'multi' ? answers.triggers.includes(option) : answers[question.id] === option;
            return (
              <button
                key={option}
                className={`option${selected ? ' selected' : ''}`}
                role={question.type === 'multi' ? 'checkbox' : 'radio'}
                aria-checked={selected}
                onClick={() => set(question.id, question.type === 'multi' ? toggleTrigger(answers.triggers, option) : option)}
              >
                <span className="option-mark" aria-hidden="true">
                  {selected ? '✓' : ''}
                </span>
                {option}
              </button>
            );
          })}
        </div>
      )}

      {question.why && (
        <p className="why">
          <strong>Why we ask:</strong> {question.why}
        </p>
      )}

      <div className="onboarding-actions">
        <button className="pill-button" onClick={next} disabled={!answered}>
          Next
        </button>
        <button className="text-button" onClick={back}>
          Back
        </button>
      </div>
    </div>
  );
}
