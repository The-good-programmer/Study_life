/**
 * Counts failed sign-in attempts per email in a sliding window, to slow down
 * password guessing. Keyed by email only: behind a reverse proxy every client
 * shares one IP, so an IP limit would let one attacker lock out everyone.
 * In-memory only, so counts reset on restart.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_EMAIL = 10;

const failures = new Map();

function recentFailures(email, now) {
  const entries = (failures.get(email) || []).filter((t) => now - t < WINDOW_MS);
  if (entries.length === 0) failures.delete(email);
  else failures.set(email, entries);
  return entries;
}

export function isLoginBlocked(email) {
  return recentFailures(email, Date.now()).length >= MAX_FAILURES_PER_EMAIL;
}

export function recordLoginFailure(email) {
  const now = Date.now();
  const entries = recentFailures(email, now);
  entries.push(now);
  failures.set(email, entries);
}

export function clearLoginFailures(email) {
  failures.delete(email);
}
