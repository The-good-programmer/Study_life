/** Tokens every new profile (guest or account) starts with. */
export const STARTING_COINS = 150;

/**
 * Tokens a guest brings into an account that already has its own wallet: what the guest
 * has beyond the starting gift. The gift stays behind, so signing out and back in can't
 * mint a fresh gift into the account each time.
 */
export const transferableGuestCoins = (guestCoins: number): number =>
  Math.max(0, Math.floor(guestCoins) - STARTING_COINS);
