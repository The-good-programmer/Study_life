/**
 * Friends: each student has an invite code; adding someone's code makes you friends both ways
 * (sharing your code is the consent). A friend sees only your name, avatar, streak, when you last
 * studied and today's minutes, never your decks or email.
 */

import crypto from 'node:crypto';
import { db, isUniqueViolation } from '../db.js';
import { getAuthUser } from '../auth.js';
import { clientIp, limiters } from '../rateLimit.js';

export const MAX_FRIENDS = 50;
/** No I, O, 0 or 1, which are easy to mix up when a code is read out. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const DAY_MS = 86_400_000;

function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify(payload));
}

const newCode = () => Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');

/** A code as typed (any case, with spaces or dashes), or null if it can't be one. */
export function normalizeCode(input) {
  if (typeof input !== 'string') return null;
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== CODE_LENGTH || [...code].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return code;
}

/** The student's invite code, made the first time it's asked for. */
export async function friendCodeOf(userId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await db.one('SELECT code FROM friend_codes WHERE user_id = $1', [userId]);
    if (row) return row.code;
    try {
      await db.run('INSERT INTO friend_codes (user_id, code, created_at) VALUES ($1, $2, $3)', [userId, newCode(), new Date().toISOString()]);
    } catch (err) {
      // Another request made this student's code first, or (very rarely) the code was taken: read or try again.
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error('Could not make a friend code.');
}

/**
 * What a friend sees. The stored streak only resets when the student next opens the app, so a
 * streak whose last study was over two days ago shows as 0. Today's minutes count only when the
 * last study was within the past day.
 */
export function friendView(row, now = new Date()) {
  let stats = {};
  try {
    stats = row.stats_json ? JSON.parse(row.stats_json) || {} : {};
  } catch {
    stats = {};
  }
  const exact = Date.parse(stats.lastStudiedAt ?? '');
  // Older apps only send the date of the last study day: take its end, the latest it could have been.
  const fromDate = Date.parse(`${stats.lastActiveDate ?? ''}T23:59:59.000Z`);
  const last = Number.isFinite(exact) ? exact : Number.isFinite(fromDate) ? Math.min(fromDate, now.getTime()) : null;
  const sinceLast = last === null ? Infinity : now.getTime() - last;
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar || '🧠',
    pictureUrl: row.picture_url || null,
    streak: sinceLast <= 2 * DAY_MS ? Math.max(0, Number(stats.currentStreak) || 0) : 0,
    lastStudiedAt: last === null ? null : new Date(last).toISOString(),
    todayMinutes: sinceLast <= DAY_MS ? Math.max(0, Math.round(Number(stats.todayMinutes) || 0)) : 0,
    friendsSince: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

const FRIEND_COLUMNS = `u.id, u.name, u.avatar, u.picture_url, s.stats_json, f.created_at
  FROM friendships f JOIN users u ON u.id = f.friend_id LEFT JOIN user_stats s ON s.user_id = u.id`;

const countFriends = async (t, userId) => (await t.one('SELECT COUNT(*)::int AS n FROM friendships WHERE user_id = $1', [userId])).n;

export async function handleFriendRoutes(req, res, pathname, body) {
  if (!pathname.startsWith('/api/friends')) return false;
  const user = await getAuthUser(req);
  if (!user) return send(res, 401, { error: 'Sign in to add friends.' });

  if (pathname === '/api/friends' && req.method === 'GET') {
    const [code, rows] = await Promise.all([friendCodeOf(user.id), db.all(`SELECT ${FRIEND_COLUMNS} WHERE f.user_id = $1`, [user.id])]);
    const now = new Date();
    return send(res, 200, { code, friends: rows.map((row) => friendView(row, now)) });
  }

  if (pathname === '/api/friends/add' && req.method === 'POST') {
    if (!limiters.friends.take(clientIp(req))) return send(res, 429, { error: 'Too many tries. Wait a few minutes and try again.' });
    const code = normalizeCode(body?.code);
    if (!code) return send(res, 400, { error: 'A friend code is 8 letters and numbers, like K7M2-QX9P.' });
    const owner = await db.one('SELECT user_id FROM friend_codes WHERE code = $1', [code]);
    if (!owner) return send(res, 404, { error: 'No one has that code. Check it with your friend.' });
    if (owner.user_id === user.id) return send(res, 400, { error: "That's your own code. Send it to a friend instead." });

    const result = await db.tx(async (t) => {
      if (await t.one('SELECT 1 AS ok FROM friendships WHERE user_id = $1 AND friend_id = $2', [user.id, owner.user_id])) return 'already';
      if ((await countFriends(t, user.id)) >= MAX_FRIENDS) return 'mine-full';
      if ((await countFriends(t, owner.user_id)) >= MAX_FRIENDS) return 'theirs-full';
      const now = new Date().toISOString();
      await t.run(
        'INSERT INTO friendships (user_id, friend_id, created_at) VALUES ($1, $2, $3), ($2, $1, $3) ON CONFLICT DO NOTHING',
        [user.id, owner.user_id, now],
      );
      return 'added';
    });
    if (result === 'mine-full') return send(res, 400, { error: `You already have ${MAX_FRIENDS} friends. Remove one to add another.` });
    if (result === 'theirs-full') return send(res, 400, { error: `Your friend already has ${MAX_FRIENDS} friends.` });
    const row = await db.one(`SELECT ${FRIEND_COLUMNS} WHERE f.user_id = $1 AND f.friend_id = $2`, [user.id, owner.user_id]);
    return send(res, 200, { success: true, alreadyFriends: result === 'already', friend: friendView(row) });
  }

  if (pathname === '/api/friends/remove' && req.method === 'POST') {
    if (typeof body?.friendId !== 'string') return send(res, 400, { error: 'Missing friend.' });
    await db.run(
      'DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
      [user.id, body.friendId],
    );
    return send(res, 200, { success: true });
  }

  return send(res, 404, { error: `Route not found: ${req.method} ${pathname}` });
}
