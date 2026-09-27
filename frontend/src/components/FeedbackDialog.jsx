// Closed-loop feedback: once a day, asks whether yesterday's demo score matched what happened,
// then shows matching outcomes as a count. Only counts the answer once it has been saved.
import { useState } from 'react';
import { saveFeedback } from '../api';
import { FLARE_PREDICTION_THRESHOLD, XP_PER_FEEDBACK } from '../config';
import { todayString, useGame } from '../state/GameContext';
import GameDialog from './GameDialog';

export default function FeedbackDialog({ lastPrediction, onClose }) {
  const { profile, game, recordFeedback } = useGame();
  const [step, setStep] = useState('ask');
  const [answer, setAnswer] = useState(null);
  const percent = Math.round(lastPrediction.risk_score * 100);

  async function send(hadFlareUp) {
    setAnswer(hadFlareUp);
    setStep('sending');
    const saved = await saveFeedback({
      user: profile.user,
      date: todayString(-1),
      predicted_risk: lastPrediction.risk_score,
      had_flare_up: hadFlareUp,
    });
    if (!saved.ok) {
      setStep('failed');
      return;
    }
    recordFeedback(lastPrediction.risk_score >= FLARE_PREDICTION_THRESHOLD, hadFlareUp);
    setStep('thanks');
  }

  if (step === 'failed') {
    return (
      <GameDialog
        title="Couldn't save your answer"
        message="Check your connection and try again."
        confirmLabel="Try again"
        cancelLabel="Later"
        onConfirm={() => send(answer)}
        onCancel={onClose}
      />
    );
  }

  if (step === 'thanks') {
    const { correct, total } = game.accuracy;
    return (
      <GameDialog
        title={`Thanks! +${XP_PER_FEEDBACK} XP`}
        message={`${correct} matching ${correct === 1 ? 'outcome' : 'outcomes'} out of ${total} answered ${total === 1 ? 'day' : 'days'} so far. Your answers help us make better predictions.`}
        confirmLabel="OK"
        onConfirm={onClose}
        onCancel={onClose}
      />
    );
  }

  return (
    <GameDialog
      title="Did you have a flare-up yesterday?"
      message={`Yesterday's asthma risk estimate was ${percent}%.`}
      confirmLabel="Yes"
      cancelLabel="No"
      busy={step === 'sending'}
      onConfirm={() => send(true)}
      onCancel={() => send(false)}
      onDismiss={onClose}
    />
  );
}
