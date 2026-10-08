import type { EarningEntry } from '../../types';
import { StorageService } from '../storageService';
import { lifeSimService } from '../lifeSimService';
import {
  DAILY_SOFT_CAPS,
  applyDiminishing,
  cardIdsOf,
  computePayout,
} from './rewardRules';
import type { Payout, RewardEvent, RewardKind } from './rewardRules';

/** Earnings older than this are dropped; caps only need today, the rest is a short audit trail. */
const RETENTION_DAYS = 14;

const localDay = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export interface GrantResult {
  xp: number;
  tokens: number;
  /** True when a daily cap reduced (or removed) the payout. */
  capped: boolean;
  /** How many of the event's cards were already paid for today, and so paid nothing again. */
  repeatCards: number;
  /** Set when tokens were paid, so callers can show the wage banner. */
  wage: ReturnType<typeof lifeSimService.awardStudyWage> | null;
}

export interface GrantOptions {
  /** Label shown in the wage ledger; defaults to the event kind. */
  label?: string;
  /** Also count the XP towards the weekly leaderboard total. */
  weekly?: boolean;
  now?: Date;
}

/** Raw totals so far today for one kind, for its daily cap. */
const rawTotals = (entries: readonly EarningEntry[]) =>
  entries.reduce((sum, entry) => ({ xp: sum.xp + entry.rawXp, tokens: sum.tokens + entry.rawTokens }), { xp: 0, tokens: 0 });

/** The cards already paid for today, for one kind. */
const paidCards = (entries: readonly EarningEntry[]): Set<string> => new Set(entries.flatMap(entry => entry.cardIds ?? []));

/**
 * The single place XP and tokens are paid out. It values the event (leaving out cards
 * already paid for today), applies the daily soft cap for its kind, pays through the
 * existing services and records the payout in the earnings log.
 */
export const grantReward = (event: RewardEvent, options: GrantOptions = {}): GrantResult => {
  const now = options.now ?? new Date();
  const today = localDay(now);

  const log = StorageService.getEarnings();
  const todays = log.filter(entry => entry.day === today && entry.kind === event.kind);
  const alreadyPaid = paidCards(todays);
  const cardIds = cardIdsOf(event);
  const newCardIds = cardIds.filter(id => !alreadyPaid.has(id));

  const raw = computePayout(event, alreadyPaid);
  const caps = DAILY_SOFT_CAPS[event.kind];
  const before = rawTotals(todays);
  const xp = applyDiminishing(raw.xp, before.xp, caps.xp);
  const tokens = applyDiminishing(raw.tokens, before.tokens, caps.tokens);

  if (xp > 0) {
    if (options.weekly) StorageService.addWeeklyXP(xp);
    else StorageService.addXP(xp);
  }
  const wage = tokens > 0 ? lifeSimService.awardStudyWage(options.label ?? event.kind, tokens) : null;

  // New cards are recorded even when they paid nothing (an exam scored below zero, say),
  // so a retake with the answers now known doesn't pay for them either.
  if (raw.xp > 0 || raw.tokens > 0 || newCardIds.length > 0) {
    const entry: EarningEntry = {
      id: `earn_${now.getTime()}_${Math.random().toString(36).slice(2, 6)}`,
      at: now.toISOString(),
      day: today,
      kind: event.kind,
      rawXp: raw.xp,
      rawTokens: raw.tokens,
      paidXp: xp,
      paidTokens: tokens,
      ...(newCardIds.length > 0 ? { cardIds: newCardIds } : {}),
    };
    const cutoff = localDay(new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000));
    // Card ids only matter on the day they were paid, so older entries drop them.
    const kept = log
      .filter(e => e.day >= cutoff)
      .map(({ cardIds: ids, ...rest }) => (ids && rest.day === today ? { ...rest, cardIds: ids } : rest));
    StorageService.saveEarnings([...kept, entry]);
  }

  return {
    xp,
    tokens,
    capped: xp < raw.xp || tokens < raw.tokens,
    repeatCards: cardIds.length - newCardIds.length,
    wage,
  };
};

/** What has been earned today for one kind, as raw and paid totals (for UI such as "cap reached"). */
export const earnedToday = (kind: RewardEvent['kind'], now: Date = new Date()) => {
  const today = localDay(now);
  return StorageService.getEarnings()
    .filter(entry => entry.day === today && entry.kind === kind)
    .reduce(
      (sum, entry) => ({
        rawXp: sum.rawXp + entry.rawXp,
        rawTokens: sum.rawTokens + entry.rawTokens,
        paidXp: sum.paidXp + entry.paidXp,
        paidTokens: sum.paidTokens + entry.paidTokens,
      }),
      { rawXp: 0, rawTokens: 0, paidXp: 0, paidTokens: 0 },
    );
};

/**
 * What an event would pay right now, after today's caps and leaving out cards already
 * paid for today, without paying it. Used to show honest "earns about N" estimates
 * (before any wage multiplier).
 */
export const estimateReward = (event: RewardEvent, now: Date = new Date()): Payout => {
  const today = localDay(now);
  const todays = StorageService.getEarnings().filter(entry => entry.day === today && entry.kind === event.kind);
  const raw = computePayout(event, paidCards(todays));
  const caps = DAILY_SOFT_CAPS[event.kind];
  const before = rawTotals(todays);
  return {
    xp: applyDiminishing(raw.xp, before.xp, caps.xp),
    tokens: applyDiminishing(raw.tokens, before.tokens, caps.tokens),
  };
};

export interface EarningsByKind {
  kind: RewardKind;
  rawXp: number;
  rawTokens: number;
  paidXp: number;
  paidTokens: number;
}

/** Today's payouts grouped by activity, biggest token earners first. */
export const earningsForDay = (now: Date = new Date()): EarningsByKind[] => {
  const today = localDay(now);
  const byKind = new Map<string, EarningsByKind>();
  for (const entry of StorageService.getEarnings()) {
    // Entries that only record cards (they paid nothing) aren't earnings to show.
    if (entry.day !== today || (entry.rawXp === 0 && entry.rawTokens === 0)) continue;
    const current = byKind.get(entry.kind) ?? {
      kind: entry.kind as RewardKind,
      rawXp: 0,
      rawTokens: 0,
      paidXp: 0,
      paidTokens: 0,
    };
    current.rawXp += entry.rawXp;
    current.rawTokens += entry.rawTokens;
    current.paidXp += entry.paidXp;
    current.paidTokens += entry.paidTokens;
    byKind.set(entry.kind, current);
  }
  return [...byKind.values()].sort((a, b) => b.paidTokens - a.paidTokens || b.paidXp - a.paidXp);
};
