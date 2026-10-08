/**
 * Sliding-window rate limits for the sign-in routes (in memory: one limiter per server process).
 *
 * The AI proxy has its own per-user limit in ai.js. These stop password guessing and mass sign-ups.
 */

export function createLimiter({ max, windowMs }) {
  const hits = new Map(); // key -> timestamps within the window

  const recent = (key, now) => (hits.get(key) || []).filter((t) => t > now - windowMs);

  const timer = setInterval(() => {
    const now = Date.now();
    for (const key of hits.keys()) {
      const kept = recent(key, now);
      if (kept.length === 0) hits.delete(key);
      else hits.set(key, kept);
    }
  }, windowMs);
  timer.unref();

  return {
    /** Counts one attempt for the key. False when the key is over its limit (the attempt is not counted). */
    take(key) {
      const now = Date.now();
      const history = recent(key, now);
      if (history.length >= max) {
        hits.set(key, history);
        return false;
      }
      history.push(now);
      hits.set(key, history);
      return true;
    },
    /** Forgets a key, e.g. after a successful sign-in. */
    reset(key) {
      hits.delete(key);
    },
  };
}

const MINUTE = 60_000;
const IN_TEST = process.env.NODE_ENV === 'test';
const unlimited = { max: Infinity, windowMs: MINUTE };

/** Attempts allowed per window. Tests run with no limits unless they set their own (configureLimits). */
const DEFAULTS = {
  register: { max: 5, windowMs: 60 * MINUTE }, // per IP
  login: { max: 20, windowMs: 10 * MINUTE }, // per IP
  loginEmail: { max: 8, windowMs: 10 * MINUTE }, // per IP + email: stops guessing one account's password
  google: { max: 40, windowMs: 10 * MINUTE }, // per IP
};

export const limiters = {};

export function configureLimits(overrides = {}) {
  for (const [name, defaults] of Object.entries(DEFAULTS)) {
    limiters[name] = createLimiter(overrides[name] || (IN_TEST ? unlimited : defaults));
  }
}
configureLimits();

/**
 * The caller's IP. Behind a proxy (Render) the socket address is the proxy's, so the real address comes
 * from X-Forwarded-For. Only the entry added by our own proxy is trusted: a client can put anything at the
 * front of that header, so we count TRUST_PROXY_HOPS entries from the end (default 1, Render's single proxy;
 * 0 = not behind a proxy).
 */
export function clientIp(req) {
  const hops = Number(process.env.TRUST_PROXY_HOPS ?? 1);
  if (hops > 0) {
    const forwarded = String(req.headers['x-forwarded-for'] || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const ip = forwarded[forwarded.length - hops];
    if (ip) return ip;
  }
  return req.socket?.remoteAddress || 'unknown';
}
