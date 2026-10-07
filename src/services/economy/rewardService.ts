import type { EarningEntry } from '../../types';
import { StorageService } from '../storageService';
import { lifeSimService } from '../lifeSimService';
import {
  DAILY_SOFT_CAPS,
  applyDiminishing,
  computePayout,
} from './rewardRules';
import type { RewardEvent } from './rewardRules';

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

/**
 * The single place XP and tokens are paid out. It values the event, applies the
 * daily soft cap for its kind, pays through the existing services and records the
 * payout in the earnings log.
 */
export const grantReward = (event: RewardEvent, options: GrantOptions = {}): GrantResult => {
  const now = options.now ?? new Date();
  const today = localDay(now);

  const raw = computePayout(event);
  const caps = DAILY_SOFT_CAPS[event.kind];

  const log = StorageService.getEarnings();
  const earnedToday = log
    .filter(entry => entry.day === today && entry.kind === event.kind)
    .reduce(
      (sum, entry) => ({ xp: sum.xp + entry.rawXp, tokens: sum.tokens + entry.rawTokens }),
      { xp: 0, tokens: 0 },
    );

  const xp = applyDiminishing(raw.xp, earnedToday.xp, caps.xp);
  const tokens = applyDiminishing(raw.tokens, earnedToday.tokens, caps.tokens);

  if (xp > 0) {
    if (options.weekly) StorageService.addWeeklyXP(xp);
    else StorageService.addXP(xp);
  }
  const wage = tokens > 0 ? lifeSimService.awardStudyWage(options.label ?? event.kind, tokens) : null;

  if (raw.xp > 0 || raw.tokens > 0) {
    const entry: EarningEntry = {
      id: `earn_${now.getTime()}_${Math.random().toString(36).slice(2, 6)}`,
      at: now.toISOString(),
      day: today,
      kind: event.kind,
      rawXp: raw.xp,
      rawTokens: raw.tokens,
      paidXp: xp,
      paidTokens: tokens,
    };
    const cutoff = localDay(new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000));
    StorageService.saveEarnings([...log.filter(e => e.day >= cutoff), entry]);
  }

  return { xp, tokens, capped: xp < raw.xp || tokens < raw.tokens, wage };
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
