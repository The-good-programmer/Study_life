/**
 * Calendar feed routes: the app sends its planner as an iCalendar file, and calendar apps
 * subscribe to it by a private link (/api/calendar/feed.ics?token=...). The token is in the
 * query, not the path, so request logs (which print the path) never contain it.
 */

import crypto from 'node:crypto';
import { db } from '../db.js';
import { getAuthUser } from '../auth.js';

function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify(payload));
}

const UNAUTHORIZED = 'Unauthorized. Please provide valid Bearer token.';

/** A planner of a few hundred items is well under this. */
export const MAX_FEED_BYTES = 512 * 1024;

const newToken = () => crypto.randomBytes(24).toString('base64url');

/** Only a whole iCalendar file, as the app writes it, is stored. */
function isCalendar(ics) {
  return (
    typeof ics === 'string' &&
    ics.startsWith('BEGIN:VCALENDAR\r\n') &&
    ics.endsWith('END:VCALENDAR\r\n') &&
    !ics.includes('\0') &&
    Buffer.byteLength(ics) <= MAX_FEED_BYTES
  );
}

export async function handleCalendarRoutes(req, res, pathname, body, searchParams) {
  // The feed itself, for calendar apps. No account: the token is the key.
  if (pathname === '/api/calendar/feed.ics' && req.method === 'GET') {
    const token = searchParams.get('token') || '';
    const feed = token ? await db.one('SELECT ics FROM calendar_feeds WHERE token = $1', [token]) : null;
    if (!feed) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('This calendar link has been turned off or reset.');
    }
    res.writeHead(200, {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="studify.ics"',
    });
    return res.end(feed.ics);
  }

  if (pathname !== '/api/calendar/feed' && pathname !== '/api/calendar/feed/reset') return false;

  const user = await getAuthUser(req);
  if (!user) return send(res, 401, { error: UNAUTHORIZED });

  // Whether the account has a link, and what it is.
  if (pathname === '/api/calendar/feed' && req.method === 'GET') {
    const feed = await db.one('SELECT token, updated_at FROM calendar_feeds WHERE user_id = $1', [user.id]);
    return send(res, 200, { token: feed?.token ?? null, updatedAt: feed?.updated_at ?? null });
  }

  // Stores the latest calendar, making a link the first time.
  if (pathname === '/api/calendar/feed' && req.method === 'PUT') {
    const ics = body?.ics;
    if (!isCalendar(ics)) return send(res, 400, { error: 'Send the planner as an iCalendar file (up to 512 KB).' });
    const now = new Date().toISOString();
    const row = await db.one(
      `INSERT INTO calendar_feeds (user_id, token, ics, updated_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET ics = excluded.ics, updated_at = excluded.updated_at
       RETURNING token`,
      [user.id, newToken(), ics, now],
    );
    return send(res, 200, { token: row.token, updatedAt: now });
  }

  // Turns the link off.
  if (pathname === '/api/calendar/feed' && req.method === 'DELETE') {
    await db.run('DELETE FROM calendar_feeds WHERE user_id = $1', [user.id]);
    return send(res, 200, { token: null });
  }

  // A new link; the old one stops working.
  if (pathname === '/api/calendar/feed/reset' && req.method === 'POST') {
    const row = await db.one('UPDATE calendar_feeds SET token = $2 WHERE user_id = $1 RETURNING token', [user.id, newToken()]);
    if (!row) return send(res, 404, { error: 'There is no calendar link to reset.' });
    return send(res, 200, { token: row.token });
  }

  return send(res, 405, { error: 'Method not allowed.' });
}
