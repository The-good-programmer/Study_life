import { describe, it, expect } from 'vitest';
import {
  DAILY_SOFT_CAPS,
  HARD_CAP_MULTIPLE,
  NO_PAYOUT,
  applyDiminishing,
  computePayout,
} from './rewardRules';
import type { RewardEvent } from './rewardRules';

describe('computePayout', () => {
  it('pays the same for every self-graded flashcard rating, so lying about the grade gains nothing', () => {
    const payouts = (['again', 'hard', 'good', 'easy'] as const).map(rating => computePayout({ kind: 'review', rating }));
    payouts.forEach(p => expect(p).toEqual(payouts[0]));
    expect(payouts[0].xp).toBeGreaterThan(0);
  });

  describe('exam', () => {
    it('pays in proportion to the confidence-weighted score', () => {
      expect(computePayout({ kind: 'exam', weightedScore: 200 })).toEqual({ xp: 100, tokens: 200 });
    });

    it('pays nothing for a zero or negative score (no participation floor)', () => {
      expect(computePayout({ kind: 'exam', weightedScore: 0 })).toEqual(NO_PAYOUT);
      expect(computePayout({ kind: 'exam', weightedScore: -35 })).toEqual(NO_PAYOUT);
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

  it('pays sprint tokens from cards and minutes, and nothing for an empty sprint', () => {
    expect(computePayout({ kind: 'sprint', cards: 10, minutes: 4 })).toEqual({ xp: 0, tokens: 62 });
    expect(computePayout({ kind: 'sprint', cards: 0, minutes: 0 })).toEqual(NO_PAYOUT);
  });

  it('pays a mixed-deck session for cards completed and switches, not for self-graded answers', () => {
    expect(computePayout({ kind: 'interleave-session', cards: 15, shifts: 10 })).toEqual({ xp: 50, tokens: 70 });
    // More switches between subjects pay a little more for the same cards.
    expect(computePayout({ kind: 'interleave-session', cards: 15, shifts: 14 }).tokens).toBeGreaterThan(
      computePayout({ kind: 'interleave-session', cards: 15, shifts: 2 }).tokens,
    );
  });

  it('pays nothing for an empty mixed-deck session', () => {
    expect(computePayout({ kind: 'interleave-session', cards: 0, shifts: 0 })).toEqual(NO_PAYOUT);
  });

  it('values splitting a leech above a mnemonic cure', () => {
    expect(computePayout({ kind: 'leech-cure', method: 'split' }).xp).toBeGreaterThan(
      computePayout({ kind: 'leech-cure', method: 'mnemonic' }).xp,
    );
  });

  it('defines a non-negative payout and a daily cap for every kind', () => {
    const events: RewardEvent[] = [
      { kind: 'review', rating: 'good' },
      { kind: 'exam', weightedScore: 50 },
      { kind: 'sprint', cards: 5, minutes: 3 },
      { kind: 'blurt', recalled: 1, total: 2 },
      { kind: 'rest' },
      { kind: 'interleave-session', cards: 3, shifts: 2 },
      { kind: 'match-clear' },
      { kind: 'leech-cure', method: 'mnemonic' },
      { kind: 'viva-round' },
      { kind: 'viva-verdict' },
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
