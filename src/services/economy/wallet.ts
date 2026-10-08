import type { EarningEntry } from '../../types';
import { DAILY_SOFT_CAPS, applyDiminishing } from './rewardRules';
import type { RewardKind } from './rewardRules';

/** Tokens every new profile (guest or account) starts with. */
export const STARTING_COINS = 150;

/**
 * The tokens a guest earned, paid again under an account's daily caps, which already count
 * what the account earned on those days (boosts left out). Earning as a guest and then
 * signing in can't add more than earning signed in would have.
 */
export const guestEarningsAllowance = (accountLog: readonly EarningEntry[], guestLog: readonly EarningEntry[]): number => {
  const rawSoFar = new Map<string, number>();
  const keyOf = (entry: EarningEntry) => `${entry.day}|${entry.kind}`;
  for (const entry of accountLog) rawSoFar.set(keyOf(entry), (rawSoFar.get(keyOf(entry)) ?? 0) + entry.rawTokens);

  let allowance = 0;
  for (const entry of [...guestLog].sort((a, b) => a.at.localeCompare(b.at))) {
    const cap = DAILY_SOFT_CAPS[entry.kind as RewardKind];
    if (!cap) continue;
    const before = rawSoFar.get(keyOf(entry)) ?? 0;
    allowance += applyDiminishing(entry.rawTokens, before, cap.tokens);
    rawSoFar.set(keyOf(entry), before + entry.rawTokens);
  }
  return allowance;
};

/**
 * Tokens a guest brings into an account that already has its own wallet: what the guest has
 * beyond the starting gift, up to what its earnings come to under the account's daily caps
 * (guestEarningsAllowance). The gift stays behind, so signing out and back in can't mint a
 * fresh gift into the account each time, and a guest can't stretch the account's caps.
 */
export const transferableGuestCoins = (guestCoins: number, allowance: number): number =>
  Math.max(0, Math.min(Math.floor(guestCoins) - STARTING_COINS, Math.floor(allowance)));
