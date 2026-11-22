/**
 * One free AI deck for a guest, so a visitor can try "type a topic, get a deck" before signing up.
 *
 * The app asks for a pass (POST /api/ai/guest-pass), then sends it with the two requests a deck takes:
 * writing the cards and checking them. A pass is good for a few requests (room for one retry), for a
 * short time, only for those two kinds of request, and a network gets only a few passes a day. The app
 * remembers a used free deck; these limits are what hold when someone clears their browser.
 */

import crypto from 'node:crypto';
import { STUDY_SESSION_GENERATION_SCHEMA, DECK_REVIEW_SCHEMA } from './aiSchemas.js';

/** Requests per pass: a deck is two (write, then check), and a failed attempt can be tried once more. */
export const GUEST_PASS_REQUESTS = 4;
export const GUEST_PASS_TTL_SEC = 30 * 60;

/** What a guest's requests may ask for: a new deck, and the check of it. */
const GUEST_SCHEMAS = new Set([STUDY_SESSION_GENERATION_SCHEMA, DECK_REVIEW_SCHEMA].map((schema) => JSON.stringify(schema)));

export function isGuestDeckRequest(request, { stream = false } = {}) {
  return !stream && Boolean(request?.responseSchema) && GUEST_SCHEMAS.has(JSON.stringify(request.responseSchema));
}

export const newPassId = () => crypto.randomBytes(12).toString('base64url');

// Requests used per pass, in memory (one server process). After a restart a pass still holding time could
// be used again, which the per-network and guests' daily quotas (in the database) still bound.
const used = new Map(); // passId -> { count, exp }

const timer = setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [pid, entry] of used) if (entry.exp < now) used.delete(pid);
}, 10 * 60_000);
timer.unref();

/** Counts one request against the pass. False when the pass has none left. */
export function takeGuestRequest(pid, exp) {
  const entry = used.get(pid) || { count: 0, exp };
  if (entry.count >= GUEST_PASS_REQUESTS) return false;
  entry.count += 1;
  used.set(pid, entry);
  return true;
}
