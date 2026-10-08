import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from '../storageService';
import { lifeSimService } from '../lifeSimService';
import { earnedToday, earningsForDay, estimateReward, grantReward } from './rewardService';

const NOON = new Date(2026, 2, 4, 12, 0, 0);

describe('grantReward', () => {
  let awardWage: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    StorageService.setActiveUserId(null);
    awardWage = vi.spyOn(lifeSimService, 'awardStudyWage').mockImplementation((activity, rawAmount) => ({
      rawAmount,
      buffBonus: 0,
      totalAmount: rawAmount,
      activity,
    }));
  });

  it('pays XP and tokens for a valued event and records it in the earnings log', () => {
    const result = grantReward({ kind: 'match-clear' }, { now: NOON, label: 'Match Arena Clear' });
    expect(result).toMatchObject({ xp: 45, tokens: 20, capped: false });
    expect(awardWage).toHaveBeenCalledWith('Match Arena Clear', 20);
    expect(StorageService.getStats().xp).toBe(45);

    const log = StorageService.getEarnings();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ kind: 'match-clear', day: '2026-03-04', rawXp: 45, rawTokens: 20, paidXp: 45, paidTokens: 20 });
  });

  it('pays nothing and logs nothing for an event worth nothing', () => {
    const result = grantReward({ kind: 'exam', answers: [] }, { now: NOON });
    expect(result).toMatchObject({ xp: 0, tokens: 0, wage: null, repeatCards: 0 });
    expect(awardWage).not.toHaveBeenCalled();
    expect(StorageService.getStats().xp).toBe(0);
    expect(StorageService.getEarnings()).toEqual([]);
  });

  it('pays each card once a day for each kind', () => {
    const sprint = { kind: 'sprint', cardIds: ['a', 'b', 'c'], minutes: 3 } as const;
    expect(grantReward({ ...sprint, cardIds: [...sprint.cardIds] }, { now: NOON })).toMatchObject({ tokens: 24, repeatCards: 0 });

    // A second pass over the same cards pays nothing; one new card pays for itself and its share of the time.
    expect(grantReward({ ...sprint, cardIds: [...sprint.cardIds] }, { now: NOON })).toMatchObject({ tokens: 0, repeatCards: 3, wage: null });
    expect(grantReward({ kind: 'sprint', cardIds: ['a', 'b', 'c', 'd'], minutes: 4 }, { now: NOON })).toMatchObject({ tokens: 8, repeatCards: 3 });

    // Other kinds of activity are separate, and the next day starts over.
    expect(grantReward({ kind: 'interleave-session', cardIds: ['a', 'b', 'c'], shifts: 2 }, { now: NOON }).tokens).toBe(14);
    expect(grantReward({ ...sprint, cardIds: [...sprint.cardIds] }, { now: new Date(2026, 2, 5, 9) }).tokens).toBe(24);
  });

  it('records an exam\'s cards even when it paid nothing, so a retake pays nothing for them', () => {
    const wrong = grantReward({ kind: 'exam', answers: [{ cardId: 'a', points: -15 }, { cardId: 'b', points: 0 }] }, { now: NOON });
    expect(wrong).toMatchObject({ xp: 0, tokens: 0 });
    expect(StorageService.getEarnings()).toEqual([expect.objectContaining({ kind: 'exam', rawTokens: 0, cardIds: ['a', 'b'] })]);

    const retake = grantReward({ kind: 'exam', answers: [{ cardId: 'a', points: 20 }, { cardId: 'b', points: 20 }] }, { now: NOON });
    expect(retake).toMatchObject({ xp: 0, tokens: 0, repeatCards: 2 });
    expect(awardWage).not.toHaveBeenCalled();
  });

  it('keeps card ids only on today\'s entries', () => {
    grantReward({ kind: 'leech-cure', method: 'mnemonic', cardId: 'old' }, { now: new Date(2026, 2, 3, 12) });
    grantReward({ kind: 'leech-cure', method: 'mnemonic', cardId: 'new' }, { now: NOON });
    const [yesterday, today] = StorageService.getEarnings();
    expect(yesterday.cardIds).toBeUndefined();
    expect(today.cardIds).toEqual(['new']);
  });

  it('skips the wage call when only XP is earned', () => {
    grantReward({ kind: 'review', rating: 'good' }, { now: NOON });
    expect(awardWage).not.toHaveBeenCalled();
    expect(StorageService.getStats().xp).toBe(10);
  });

  it('counts XP towards the weekly total only when asked', () => {
    grantReward({ kind: 'review', rating: 'good' }, { now: NOON, weekly: true });
    expect(StorageService.getWeeklyXP().current).toBe(10);
    grantReward({ kind: 'priming' }, { now: NOON });
    expect(StorageService.getWeeklyXP().current).toBe(10);
  });

  it('stops paying a repeatable activity once its daily cap is exhausted', () => {
    // rest: cap 30 xp / 15 tokens, hard cap 90 / 45 raw
    const paid: number[] = [];
    for (let i = 0; i < 6; i++) paid.push(grantReward({ kind: 'rest' }, { now: NOON }).tokens);

    expect(paid[0]).toBe(15); // full
    expect(paid[1]).toBe(3); // 25% of 15, floored
    expect(paid.slice(-2)).toEqual([0, 0]); // past the hard cap
    expect(grantReward({ kind: 'rest' }, { now: NOON }).capped).toBe(true);
  });

  it('flags when a cap reduced the payout', () => {
    expect(grantReward({ kind: 'rest' }, { now: NOON }).capped).toBe(false);
    expect(grantReward({ kind: 'rest' }, { now: NOON }).capped).toBe(true);
  });

  it('tracks caps per kind, so one activity does not use up another', () => {
    for (let i = 0; i < 6; i++) grantReward({ kind: 'rest' }, { now: NOON });
    expect(grantReward({ kind: 'match-clear' }, { now: NOON }).tokens).toBe(20);
  });

  it('resets caps on a new day', () => {
    for (let i = 0; i < 6; i++) grantReward({ kind: 'rest' }, { now: NOON });
    const tomorrow = new Date(2026, 2, 5, 9, 0, 0);
    expect(grantReward({ kind: 'rest' }, { now: tomorrow }).tokens).toBe(15);
  });

  it('keeps raw and paid amounts apart in the log and reports daily totals', () => {
    for (let i = 0; i < 3; i++) grantReward({ kind: 'rest' }, { now: NOON });
    expect(earnedToday('rest', NOON)).toEqual({ rawXp: 90, rawTokens: 45, paidXp: 30 + 7 + 7, paidTokens: 15 + 3 + 3 });
  });

  it('drops log entries older than the retention window', () => {
    grantReward({ kind: 'match-clear' }, { now: new Date(2026, 0, 1, 12) });
    grantReward({ kind: 'match-clear' }, { now: NOON });
    const days = StorageService.getEarnings().map(e => e.day);
    expect(days).toEqual(['2026-03-04']);
  });

  it('keeps each account\'s earnings separate', () => {
    StorageService.setActiveUserId('user-a');
    grantReward({ kind: 'rest' }, { now: NOON });
    StorageService.setActiveUserId('user-b');
    expect(StorageService.getEarnings()).toEqual([]);
    expect(grantReward({ kind: 'rest' }, { now: NOON }).capped).toBe(false);
    StorageService.setActiveUserId(null);
  });
});

describe('estimateReward', () => {
  beforeEach(() => {
    localStorage.clear();
    StorageService.setActiveUserId(null);
    vi.spyOn(lifeSimService, 'awardStudyWage').mockImplementation((activity, rawAmount) => ({
      rawAmount,
      buffBonus: 0,
      totalAmount: rawAmount,
      activity,
    }));
  });

  it('matches what granting would pay, without paying anything', () => {
    const estimate = estimateReward({ kind: 'match-clear' }, NOON);
    expect(estimate).toEqual({ xp: 45, tokens: 20 });
    expect(StorageService.getEarnings()).toEqual([]);
    expect(grantReward({ kind: 'match-clear' }, { now: NOON })).toMatchObject(estimate);
  });

  it('reflects today\'s caps', () => {
    grantReward({ kind: 'rest' }, { now: NOON });
    expect(estimateReward({ kind: 'rest' }, NOON).tokens).toBe(3);
  });

  it('leaves out cards already paid for today', () => {
    grantReward({ kind: 'sprint', cardIds: ['a', 'b'], minutes: 2 }, { now: NOON });
    expect(estimateReward({ kind: 'sprint', cardIds: ['a', 'b'], minutes: 2 }, NOON).tokens).toBe(0);
    expect(estimateReward({ kind: 'sprint', cardIds: ['a', 'b', 'c', 'd'], minutes: 2 }, NOON).tokens).toBe(13);
  });
});

describe('earningsForDay', () => {
  beforeEach(() => {
    localStorage.clear();
    StorageService.setActiveUserId(null);
    vi.spyOn(lifeSimService, 'awardStudyWage').mockImplementation((activity, rawAmount) => ({
      rawAmount,
      buffBonus: 0,
      totalAmount: rawAmount,
      activity,
    }));
  });

  it('groups today\'s payouts by kind, biggest token earners first, and ignores other days', () => {
    grantReward({ kind: 'review', rating: 'good' }, { now: NOON });
    grantReward({ kind: 'review', rating: 'good' }, { now: NOON });
    grantReward({ kind: 'match-clear' }, { now: NOON });
    grantReward({ kind: 'match-clear' }, { now: new Date(2026, 2, 3, 12) });

    const summary = earningsForDay(NOON);
    expect(summary.map(s => s.kind)).toEqual(['match-clear', 'review']);
    expect(summary[0]).toMatchObject({ paidTokens: 20, paidXp: 45 });
    expect(summary[1]).toMatchObject({ paidXp: 20, paidTokens: 0 });
  });

  it('is empty when nothing was earned', () => {
    expect(earningsForDay(NOON)).toEqual([]);
  });

  it('leaves out entries that only record cards and paid nothing', () => {
    grantReward({ kind: 'exam', answers: [{ cardId: 'a', points: -15 }] }, { now: NOON });
    expect(earningsForDay(NOON)).toEqual([]);
  });
});
