import type { FSRSRating } from '../../types';

/**
 * Payout rules for the study economy. Pure functions only: given what happened, say what it is worth.
 *
 * Principles:
 *  - Self-graded activities (flashcard grades) pay for effort, never for the grade, so there is
 *    no reason to over-claim "Easy" and corrupt the FSRS schedule.
 *  - Objectively checked activities (exams, drills) pay for correctness.
 *  - Nothing pays for doing nothing, and every kind has a daily soft cap with diminishing returns.
 */

export type RewardEvent =
  | { kind: 'review'; rating: FSRSRating }
  | { kind: 'exam'; weightedScore: number }
  | { kind: 'sprint'; cards: number; minutes: number }
  | { kind: 'blurt'; recalled: number; total: number }
  | { kind: 'rest' }
  | { kind: 'interleave-session'; cards: number; shifts: number }
  | { kind: 'match-clear' }
  | { kind: 'leech-cure'; method: 'mnemonic' | 'split' }
  | { kind: 'viva-round' }
  | { kind: 'viva-verdict' }
  | { kind: 'priming' }
  | { kind: 'diagnostic' };

export type RewardKind = RewardEvent['kind'];

export interface Payout {
  xp: number;
  tokens: number;
}

export const NO_PAYOUT: Payout = { xp: 0, tokens: 0 };

/** The raw (pre-cap) value of one event. */
export const computePayout = (event: RewardEvent): Payout => {
  switch (event.kind) {
    case 'review':
      // Flat on purpose: paying more for a better self-grade would reward lying.
      return { xp: 10, tokens: 0 };
    case 'exam': {
      const points = Math.max(0, Math.round(event.weightedScore));
      return { xp: Math.round(points / 2), tokens: points };
    }
    case 'sprint':
      return { xp: 0, tokens: Math.max(0, Math.round(event.cards * 5 + event.minutes * 3)) };
    case 'blurt': {
      if (event.total <= 0 || event.recalled <= 0) return NO_PAYOUT;
      return { xp: Math.round(40 * Math.min(1, event.recalled / event.total)), tokens: 0 };
    }
    case 'rest':
      return { xp: 30, tokens: 15 };
    case 'interleave-session': {
      // Mixed decks are self-graded, so the bonus pays for cards worked through and
      // subject switches made, never for how well the learner says they did.
      if (event.cards <= 0) return NO_PAYOUT;
      return { xp: 20 + event.cards * 2, tokens: event.cards * 4 + Math.max(0, event.shifts) };
    }
    case 'match-clear':
      return { xp: 45, tokens: 20 };
    case 'leech-cure':
      return event.method === 'split' ? { xp: 60, tokens: 30 } : { xp: 40, tokens: 25 };
    case 'viva-round':
      return { xp: 25, tokens: 0 };
    case 'viva-verdict':
      return { xp: 100, tokens: 0 };
    case 'priming':
      return { xp: 20, tokens: 0 };
    case 'diagnostic':
      return { xp: 30, tokens: 0 };
  }
};

/** Daily soft caps per kind, in raw (pre-cap) units. Beyond a cap, payouts shrink; far beyond, they stop. */
export const DAILY_SOFT_CAPS: Record<RewardKind, { xp: number; tokens: number }> = {
  review: { xp: 600, tokens: Infinity },
  exam: { xp: 300, tokens: 600 },
  sprint: { xp: Infinity, tokens: 400 },
  blurt: { xp: 160, tokens: Infinity },
  rest: { xp: 30, tokens: 15 },
  'interleave-session': { xp: 200, tokens: 200 },
  'match-clear': { xp: 90, tokens: 40 },
  'leech-cure': { xp: 200, tokens: 100 },
  'viva-round': { xp: 150, tokens: Infinity },
  'viva-verdict': { xp: 200, tokens: Infinity },
  priming: { xp: 120, tokens: Infinity },
  diagnostic: { xp: 90, tokens: Infinity },
};

/** Between the cap and this multiple of it, payouts are reduced; past it, they are zero. */
export const HARD_CAP_MULTIPLE = 3;
export const OVER_CAP_RATE = 0.25;

/**
 * How much of `requested` is actually paid, given how much of this kind was already
 * earned today. Full rate up to the soft cap, a quarter rate up to 3x, then nothing.
 */
export const applyDiminishing = (requested: number, earnedBefore: number, softCap: number): number => {
  if (requested <= 0) return 0;
  if (!Number.isFinite(softCap)) return requested;

  const hardCap = softCap * HARD_CAP_MULTIPLE;
  const fullRate = Math.max(0, Math.min(requested, softCap - earnedBefore));
  const softStart = Math.max(earnedBefore, softCap);
  const softRoom = Math.max(0, hardCap - softStart);
  const softPart = Math.max(0, Math.min(requested - fullRate, softRoom));
  return Math.floor(fullRate + softPart * OVER_CAP_RATE);
};
