import { describe, it, expect } from 'vitest';
import {
  DAILY_SOFT_CAPS,
  HARD_CAP_MULTIPLE,
  NO_PAYOUT,
  applyDiminishing,
  cardIdsOf,
  computePayout,
  payableMinutes,
} from './rewardRules';
import type { RewardEvent } from './rewardRules';

/** Card ids c0, c1, ... */
const ids = (count: number, from = 0) => Array.from({ length: count }, (_, i) => `c${from + i}`);
const answers = (...points: number[]) => points.map((p, i) => ({ cardId: `c${i}`, points: p }));

describe('computePayout', () => {
  it('pays the same for every self-graded flashcard rating, so lying about the grade gains nothing', () => {
    const payouts = (['again', 'hard', 'good', 'easy'] as const).map(rating => computePayout({ kind: 'review', rating }));
    payouts.forEach(p => expect(p).toEqual(payouts[0]));
    expect(payouts[0].xp).toBeGreaterThan(0);
  });

  describe('exam', () => {
    it('pays in proportion to the confidence-weighted score', () => {
      expect(computePayout({ kind: 'exam', answers: answers(...Array(10).fill(20)) })).toEqual({ xp: 100, tokens: 200 });
    });

    it('pays nothing for a zero or negative score (no participation floor)', () => {
      expect(computePayout({ kind: 'exam', answers: answers(0, 0) })).toEqual(NO_PAYOUT);
      expect(computePayout({ kind: 'exam', answers: answers(-15, -15, -5) })).toEqual(NO_PAYOUT);
      expect(computePayout({ kind: 'exam', answers: [] })).toEqual(NO_PAYOUT);
    });
  });

  describe('blurt', () => {
    it('pays nothing for an empty recall', () => {
      expect(computePayout({ kind: 'blurt', recalled: 0, total: 5 })).toEqual(NO_PAYOUT);
      expect(computePayout({ kind: 'blurt', recalled: 0, total: 0 })).toEqual(NO_PAYOUT);
    });

    it('scales with how much was recalled, never above the maximum', () => {
      expect(computePayout({ kind: 'blurt', recalled: 2, total: 4 }).xp).toBe(20);
      expect(computePayout({ kind: 'blurt', recalled: 9, total: 4 }).xp).toBe(40);
    });
  });

  it('pays sprint tokens from cards and minutes, and nothing for a sprint without cards', () => {
    expect(computePayout({ kind: 'sprint', cardIds: ids(10), minutes: 4 })).toEqual({ xp: 0, tokens: 62 });
    expect(computePayout({ kind: 'sprint', cardIds: [], minutes: 0 })).toEqual(NO_PAYOUT);
    // Time alone, with no card rated, pays nothing.
    expect(computePayout({ kind: 'sprint', cardIds: [], minutes: 30 })).toEqual(NO_PAYOUT);
  });

  it('counts a card rated twice in one sprint once', () => {
    expect(computePayout({ kind: 'sprint', cardIds: ['a', 'a', 'b'], minutes: 0 }).tokens).toBe(10);
  });

  it('pays a mixed-deck session for cards completed and switches, not for self-graded answers', () => {
    expect(computePayout({ kind: 'interleave-session', cardIds: ids(15), shifts: 10 })).toEqual({ xp: 50, tokens: 70 });
    // More switches between subjects pay a little more for the same cards.
    expect(computePayout({ kind: 'interleave-session', cardIds: ids(15), shifts: 14 }).tokens).toBeGreaterThan(
      computePayout({ kind: 'interleave-session', cardIds: ids(15), shifts: 2 }).tokens,
    );
  });

  it('pays nothing for an empty mixed-deck session', () => {
    expect(computePayout({ kind: 'interleave-session', cardIds: [], shifts: 0 })).toEqual(NO_PAYOUT);
  });

  it('values splitting a leech above a mnemonic cure', () => {
    expect(computePayout({ kind: 'leech-cure', method: 'split', cardId: 'a' }).xp).toBeGreaterThan(
      computePayout({ kind: 'leech-cure', method: 'mnemonic', cardId: 'a' }).xp,
    );
  });

  describe('cards already paid for today', () => {
    const paid = (...cardIds: string[]) => new Set(cardIds);

    it('pays a sprint for its new cards and their share of the time', () => {
      // 5 of 10 cards are new: 5 * 5 tokens, plus half of 4 minutes at 3 tokens.
      expect(computePayout({ kind: 'sprint', cardIds: ids(10), minutes: 4 }, paid(...ids(5)))).toEqual({ xp: 0, tokens: 31 });
    });

    it('pays nothing for a second pass over the same cards', () => {
      expect(computePayout({ kind: 'sprint', cardIds: ids(10), minutes: 12 }, paid(...ids(10)))).toEqual(NO_PAYOUT);
      expect(computePayout({ kind: 'interleave-session', cardIds: ids(6), shifts: 5 }, paid(...ids(6)))).toEqual(NO_PAYOUT);
    });

    it('pays a mixed-deck session for its new cards and their share of the switches', () => {
      // 3 of 6 cards are new: 20 + 3 * 2 XP; 3 * 4 tokens plus half of 4 switches.
      expect(computePayout({ kind: 'interleave-session', cardIds: ids(6), shifts: 4 }, paid(...ids(3)))).toEqual({ xp: 26, tokens: 14 });
    });

    it('scores an exam on the cards not yet counted today, each card once', () => {
      const exam: RewardEvent = { kind: 'exam', answers: [...answers(20, 20, 20), { cardId: 'c0', points: 20 }] };
      expect(computePayout(exam)).toEqual({ xp: 30, tokens: 60 });
      expect(computePayout(exam, paid('c0', 'c1'))).toEqual({ xp: 10, tokens: 20 });
      expect(computePayout(exam, paid('c0', 'c1', 'c2'))).toEqual(NO_PAYOUT);
    });

    it('keeps the penalty for confidently wrong answers among the new cards', () => {
      expect(computePayout({ kind: 'exam', answers: answers(20, -15) })).toEqual({ xp: 3, tokens: 5 });
    });

    it('pays nothing for fixing the same hard card twice in a day', () => {
      expect(computePayout({ kind: 'leech-cure', method: 'mnemonic', cardId: 'a' }, paid('a'))).toEqual(NO_PAYOUT);
      expect(computePayout({ kind: 'leech-cure', method: 'mnemonic', cardId: 'b' }, paid('a')).tokens).toBe(25);
    });
  });

  it('defines a non-negative payout and a daily cap for every kind', () => {
    const events: RewardEvent[] = [
      { kind: 'review', rating: 'good' },
      { kind: 'exam', answers: answers(20, 14, 5, 5, 6) },
      { kind: 'sprint', cardIds: ids(5), minutes: 3 },
      { kind: 'blurt', recalled: 1, total: 2 },
      { kind: 'rest' },
      { kind: 'interleave-session', cardIds: ids(3), shifts: 2 },
      { kind: 'match-clear' },
      { kind: 'leech-cure', method: 'mnemonic', cardId: 'c0' },
      { kind: 'viva-round' },
      { kind: 'viva-verdict' },
      { kind: 'explain' },
      { kind: 'priming' },
      { kind: 'diagnostic' },
    ];
    events.forEach(event => {
      const p = computePayout(event);
      expect(p.xp).toBeGreaterThanOrEqual(0);
      expect(p.tokens).toBeGreaterThanOrEqual(0);
      expect(DAILY_SOFT_CAPS[event.kind]).toBeDefined();
    });
  });
});

describe('cardIdsOf', () => {
  it('lists the distinct cards an event pays for', () => {
    expect(cardIdsOf({ kind: 'exam', answers: [{ cardId: 'a', points: 5 }, { cardId: 'a', points: 20 }, { cardId: 'b', points: 0 }] })).toEqual(['a', 'b']);
    expect(cardIdsOf({ kind: 'sprint', cardIds: ['a', 'b', 'a'], minutes: 3 })).toEqual(['a', 'b']);
    expect(cardIdsOf({ kind: 'interleave-session', cardIds: ['x'], shifts: 0 })).toEqual(['x']);
    expect(cardIdsOf({ kind: 'leech-cure', method: 'split', cardId: 'h' })).toEqual(['h']);
  });

  it('is empty for activities that are not paid per card', () => {
    expect(cardIdsOf({ kind: 'rest' })).toEqual([]);
    expect(cardIdsOf({ kind: 'review', rating: 'good' })).toEqual([]);
    expect(cardIdsOf({ kind: 'match-clear' })).toEqual([]);
  });
});

describe('payableMinutes', () => {
  it('pays a session\'s time up to 1.5x the deck\'s estimate', () => {
    expect(payableMinutes(12, 10)).toBe(12);
    expect(payableMinutes(240, 10)).toBe(15);
    expect(payableMinutes(240, 5)).toBe(8);
  });

  it('never pays negative time', () => {
    expect(payableMinutes(-3, 10)).toBe(0);
  });
});

describe('applyDiminishing', () => {
  it('pays in full under the cap', () => {
    expect(applyDiminishing(40, 0, 100)).toBe(40);
    expect(applyDiminishing(40, 60, 100)).toBe(40);
  });

  it('pays full up to the cap and a quarter of the remainder when straddling it', () => {
    // 10 under the cap at full rate, 40 over at 25% = 10 -> 20
    expect(applyDiminishing(50, 90, 100)).toBe(20);
  });

  it('pays a quarter rate once past the cap', () => {
    expect(applyDiminishing(100, 100, 100)).toBe(25);
  });

  it('pays nothing past the hard cap', () => {
    expect(applyDiminishing(100, 100 * HARD_CAP_MULTIPLE, 100)).toBe(0);
    expect(applyDiminishing(100, 5000, 100)).toBe(0);
  });

  it('truncates the soft zone at the hard cap', () => {
    // 50 left in the soft zone (250 -> 300): 100 requested pays 50 * 25% = 12
    expect(applyDiminishing(100, 250, 100)).toBe(12);
  });

  it('treats an infinite cap as uncapped and ignores non-positive requests', () => {
    expect(applyDiminishing(500, 99999, Infinity)).toBe(500);
    expect(applyDiminishing(0, 0, 100)).toBe(0);
    expect(applyDiminishing(-5, 0, 100)).toBe(0);
  });

  it('never pays more when a payout is split into small grants than as one lump sum', () => {
    let earned = 0;
    let paid = 0;
    for (let i = 0; i < 80; i++) {
      paid += applyDiminishing(10, earned, 100);
      earned += 10;
    }
    const lumpSum = applyDiminishing(800, 0, 100); // 100 full + 200 soft-zone at 25% = 150
    expect(lumpSum).toBe(150);
    expect(paid).toBeLessThanOrEqual(lumpSum);
    // Small grants lose their fraction in the reduced zone (10 * 25% floors to 2), so 100 + 20 * 2.
    expect(paid).toBe(140);
  });
});
