// Onboarding survey: the questions, their options, and how answers become a starting
// baseline. Kept in one place so the profile screen can reuse it for editing answers.
import { DEFAULT_CITY } from './config';

export const DEMO_USER_ID = 'demo-user-1';

export const SURVEY_INTRO =
  'Meet your asthma companion! Answer a few questions so we can set up your profile. Estimates are okay, and you can change your answers later. For this prototype, please use fictional information.';

export const NO_RESCUE_DAYS = '0 days';
export const ZERO_PUFFS = '0 puffs';

export const QUESTIONS = [
  {
    id: 'nickname',
    type: 'text',
    prompt: 'What should your companion call you?',
    placeholder: 'Nickname',
    maxLength: 20,
  },
  {
    id: 'city',
    type: 'single',
    prompt: 'Which city should we use for environmental conditions?',
    options: [DEFAULT_CITY],
    why: 'The app needs the same location for weather, air quality, and synthetic pollen.',
  },
  {
    id: 'rescueDays',
    type: 'single',
    prompt: 'During a typical week when your asthma feels well controlled, on how many days do you use your rescue inhaler for symptoms?',
    helper: 'Do not include doses taken only before exercise.',
    options: [NO_RESCUE_DAYS, '1–2 days', '3–4 days', '5–7 days', 'Not sure'],
    why: 'This helps estimate your usual rescue inhaler use before daily logs are available.',
  },
  {
    id: 'puffsPerDay',
    type: 'single',
    prompt: 'On those days, about how many rescue inhaler puffs do you usually take in total?',
    helper: 'Count the whole day, excluding doses taken only before exercise.',
    options: ['1 puff', '2 puffs', '3–4 puffs', '5 or more puffs', 'Not sure'],
    why: 'Together with the last question, this gives a rough starting estimate of your daily use.',
    skipWhen: (answers) => answers.rescueDays === NO_RESCUE_DAYS,
  },
  {
    id: 'nightWaking',
    type: 'single',
    prompt: 'During the past four weeks, how often have asthma symptoms woken you at night?',
    options: [
      'Never',
      'Once or twice in the past four weeks',
      'About once a week',
      'Several nights a week',
      'Every night or almost every night',
      'Not sure',
    ],
    why: 'This is background for your profile. Daily check-ins will record individual nights.',
  },
  {
    id: 'controller',
    type: 'single',
    prompt: 'Do you currently use a daily controller or preventer inhaler?',
    options: ['Yes', 'No', 'Not sure'],
    why: "This is saved as profile information. Controller doses are never counted as rescue puffs, and the app won't suggest changing your medication.",
  },
  {
    id: 'preExercise',
    type: 'single',
    prompt: 'Do you sometimes take your rescue inhaler before exercise?',
    options: ['Yes', 'No', 'Not sure'],
    why: "If so, check-ins let you tag those puffs so they don't count toward a flare-up.",
  },
];

const DAYS_PER_WEEK = { '0 days': 0, '1–2 days': 1.5, '3–4 days': 3.5, '5–7 days': 6 };
const PUFFS_PER_DAY = { '0 puffs': 0, '1 puff': 1, '2 puffs': 2, '3–4 puffs': 3.5, '5 or more puffs': 5 };

// Typical symptom-related rescue puffs per day, or null if the user wasn't sure.
export function baselineEstimate(answers) {
  if (answers.rescueDays === NO_RESCUE_DAYS) return 0;
  const days = DAYS_PER_WEEK[answers.rescueDays];
  const puffs = PUFFS_PER_DAY[answers.puffsPerDay];
  if (days === undefined || puffs === undefined) return null;
  return Math.round(((days / 7) * puffs) * 100) / 100;
}
