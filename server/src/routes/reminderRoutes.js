/**
 * Study reminder routes: the Web Push key, and turning reminders on or off for this browser.
 */

import { db } from '../db.js';
import { getAuthUser } from '../auth.js';
import { clientIp, limiters } from '../rateLimit.js';
import { getVapidKeys, isTimeOfDay, isValidTimeZone } from '../reminders.js';

const MAX_SUBSCRIPTIONS_PER_USER = 10;

function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify(payload));
}

/** A browser's push subscription, checked, or null. */
function readSubscription(value) {
  const endpoint = value?.endpoint;
  const keys = value?.keys;
  if (typeof endpoint !== 'string' || endpoint.length > 1000 || !endpoint.startsWith('https://')) return null;
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string' || keys.p256dh.length > 200 || keys.auth.length > 100) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export async function handleReminderRoutes(req, res, pathname, body) {
  if (pathname === '/api/reminders/key' && req.method === 'GET') {
    const { publicKey } = await getVapidKeys();
    return send(res, 200, { publicKey });
  }

  if (pathname === '/api/reminders/subscribe' && req.method === 'POST') {
    if (!limiters.reminders.take(clientIp(req))) return send(res, 429, { error: 'Too many requests. Try again in a few minutes.' });
    const user = await getAuthUser(req);
    if (!user) return send(res, 401, { error: 'Sign in to get reminders.' });
    const subscription = readSubscription(body?.subscription);
    if (!subscription) return send(res, 400, { error: 'That notification subscription is not valid.' });
    if (!isValidTimeZone(body?.timeZone)) return send(res, 400, { error: 'Unknown time zone.' });
    if (!isTimeOfDay(body?.remindAt)) return send(res, 400, { error: 'Pick a reminder time like 19:00.' });

    const count = await db.one('SELECT COUNT(*)::int AS n FROM push_subscriptions WHERE user_id = $1 AND endpoint <> $2', [user.id, subscription.endpoint]);
    if (count.n >= MAX_SUBSCRIPTIONS_PER_USER) return send(res, 400, { error: 'Reminders are already on for 10 browsers. Turn them off on one first.' });

    const now = new Date().toISOString();
    // A browser belongs to whoever signed in last; switching accounts moves its reminders over.
    await db.run(
      `INSERT INTO push_subscriptions (endpoint, user_id, keys_json, time_zone, remind_at, last_sent_day, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NULL, $6, $6)
       ON CONFLICT (endpoint) DO UPDATE SET
         user_id = excluded.user_id,
         keys_json = excluded.keys_json,
         time_zone = excluded.time_zone,
         remind_at = excluded.remind_at,
         last_sent_day = CASE WHEN push_subscriptions.user_id = excluded.user_id THEN push_subscriptions.last_sent_day ELSE NULL END,
         updated_at = excluded.updated_at`,
      [subscription.endpoint, user.id, JSON.stringify(subscription.keys), body.timeZone, body.remindAt, now],
    );
    return send(res, 200, { success: true });
  }

  if (pathname === '/api/reminders/unsubscribe' && req.method === 'POST') {
    const user = await getAuthUser(req);
    if (!user) return send(res, 401, { error: 'Sign in first.' });
    if (typeof body?.endpoint !== 'string') return send(res, 400, { error: 'Missing endpoint.' });
    await db.run('DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2', [body.endpoint, user.id]);
    return send(res, 200, { success: true });
  }

  return false;
}
