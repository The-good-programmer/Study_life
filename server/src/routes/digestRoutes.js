/**
 * Weekly progress email routes: whether it's on, turning it on or off, and the no-sign-in
 * unsubscribe link from the email.
 */

import { db } from '../db.js';
import { getAuthUser } from '../auth.js';
import { clientIp, limiters } from '../rateLimit.js';
import { isValidTimeZone } from '../reminders.js';
import { newUnsubscribeToken } from '../digest.js';

function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify(payload));
}

function page(res, status, heading, text) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  return res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Studify</title></head>
<body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:15vh auto;padding:0 16px;color:#1c1c28">
<h1 style="font-size:20px">${heading}</h1><p style="color:#4b4b5c;line-height:1.5">${text}</p></body></html>`);
}

export async function handleDigestRoutes(req, res, pathname, body, searchParams, { mailer } = {}) {
  if (pathname === '/api/digest/unsubscribe' && (req.method === 'GET' || req.method === 'POST')) {
    if (!limiters.digest.take(clientIp(req))) return page(res, 429, 'Too many tries', 'Wait a few minutes and open the link again.');
    const token = searchParams.get('t');
    if (!token || token.length > 100) return page(res, 400, 'That link is not complete', 'Open the link from the email again, or turn the email off in Studify under Settings → Reminders.');
    await db.run('DELETE FROM digest_subscriptions WHERE unsubscribe_token = $1', [token]);
    return page(res, 200, "You won't get weekly emails any more", 'You can turn them back on any time in Studify under Settings → Reminders.');
  }

  if (pathname !== '/api/digest') return false;
  const user = await getAuthUser(req);
  if (!user) return send(res, 401, { error: 'Sign in to get the weekly email.' });

  if (req.method === 'GET') {
    const row = await db.one('SELECT time_zone FROM digest_subscriptions WHERE user_id = $1', [user.id]);
    return send(res, 200, { enabled: !!row, timeZone: row?.time_zone ?? null, email: user.email, available: !!mailer });
  }

  if (req.method === 'POST') {
    if (!limiters.digest.take(clientIp(req))) return send(res, 429, { error: 'Too many requests. Try again in a few minutes.' });
    if (body?.enabled === false) {
      await db.run('DELETE FROM digest_subscriptions WHERE user_id = $1', [user.id]);
      return send(res, 200, { enabled: false });
    }
    if (body?.enabled !== true) return send(res, 400, { error: 'Say whether to turn it on or off.' });
    if (!isValidTimeZone(body?.timeZone)) return send(res, 400, { error: 'Unknown time zone.' });
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO digest_subscriptions (user_id, time_zone, unsubscribe_token, last_sent_week, created_at, updated_at)
       VALUES ($1, $2, $3, NULL, $4, $4)
       ON CONFLICT (user_id) DO UPDATE SET time_zone = excluded.time_zone, updated_at = excluded.updated_at`,
      [user.id, body.timeZone, newUnsubscribeToken(), now],
    );
    return send(res, 200, { enabled: true });
  }

  return send(res, 405, { error: 'Method not allowed.' });
}
