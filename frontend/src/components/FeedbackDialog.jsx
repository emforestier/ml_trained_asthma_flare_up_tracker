// Closed-loop feedback: once a day, asks whether yesterday's prediction came true,
// then shows the updated rolling accuracy.
import { useState } from 'react';
import { submitFeedback } from '../api';
import { FLARE_PREDICTION_THRESHOLD, XP_PER_FEEDBACK } from '../config';
import { todayString, useGame } from '../state/GameContext';
import GameDialog from './GameDialog';

export default function FeedbackDialog({ lastPrediction, onClose }) {
  const { profile, game, recordFeedback } = useGame();
  const [step, setStep] = useState('ask');
  const percent = Math.round(lastPrediction.risk_score * 100);

  async function answer(hadFlareUp) {
    setStep('sending');
    await submitFeedback({
      user: profile.user,
      date: todayString(-1),
      predicted_risk: lastPrediction.risk_score,
      had_flare_up: hadFlareUp,
    });
    recordFeedback(lastPrediction.risk_score >= FLARE_PREDICTION_THRESHOLD, hadFlareUp);
    setStep('thanks');
  }

  if (step === 'thanks') {
    const { correct, total } = game.accuracy;
    return (
      <GameDialog
        title={`Thanks! +${XP_PER_FEEDBACK} XP`}
        message={`${profile.companionName} has been right ${correct} of ${total} times (${Math.round((correct / total) * 100)}%). Every answer helps it learn your patterns.`}
        confirmLabel="OK"
        onConfirm={onClose}
        onCancel={onClose}
      />
    );
  }

  return (
    <GameDialog
      title="Did you have a flare-up yesterday?"
      message={`${profile.companionName} predicted ${percent}% risk.`}
      confirmLabel="Yes"
      cancelLabel="No"
      busy={step === 'sending'}
      onConfirm={() => answer(true)}
      onCancel={() => answer(false)}
    />
  );
}
