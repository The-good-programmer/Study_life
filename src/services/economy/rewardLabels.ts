import type { RewardKind } from './rewardRules';

/** Plain-language names for each kind of payout, for earnings lists. */
export const REWARD_LABELS: Record<RewardKind, string> = {
  review: 'Flashcard reviews',
  exam: 'Mock exams',
  sprint: 'Study sessions',
  blurt: 'Free recall',
  rest: 'Rest breaks',
  'interleave-session': 'Mix-deck sessions',
  'match-clear': 'Speed match',
  'leech-cure': 'Fixed hard cards',
  'viva-round': 'Oral exam rounds',
  'viva-verdict': 'Oral exam verdicts',
  explain: 'Written explanations',
  priming: 'Overviews',
  diagnostic: 'Warm-up checks',
};
