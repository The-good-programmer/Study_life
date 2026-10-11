/**
 * Cloud Sync & State Persistence Routes
 */

import { db } from '../db.js';
import { getAuthUser } from '../auth.js';

function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify(payload));
}

const UNAUTHORIZED = 'Unauthorized. Please provide valid Bearer token.';

// Per-account storage limits, so one account cannot fill the database.
const MAX_SESSIONS_PER_USER = 2000;
const MAX_SESSION_BYTES_PER_USER = 25 * 1024 * 1024;
const MAX_STATS_BYTES = 1024 * 1024;

class OverLimit extends Error {}

/** A date from the client as an ISO string, or the fallback when it isn't a real date. */
function validDate(value, fallback) {
  const parsed = new Date(value);
  return value && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : fallback;
}

// How the avatar looks, and nothing else. Tokens, level and XP are never taken from a client,
// whatever it sends (the wallet is kept apart from sync).
const LOOK_KEYS = [
  'gender', 'bodyType', 'skinTone', 'hairStyle', 'hairColor', 'facialHair', 'facialHairColor', 'eyeColor',
  'eyewear', 'eyewearColor', 'headwear', 'headwearColor', 'outfitTop', 'topColor', 'topSecondaryColor',
  'outfitBottom', 'bottomColor', 'shoes', 'shoesColor',
];

export function sanitizeCharacter(source) {
  if (!source || typeof source !== 'object') return null;
  const look = {};
  for (const key of LOOK_KEYS) {
    const value = source[key];
    const pattern = key === 'skinTone' || key.endsWith('Color') ? /^#[0-9a-f]{3,8}$/i : /^[a-z-]{1,24}$/;
    if (typeof value === 'string' && pattern.test(value)) look[key] = value;
  }
  const name = typeof source.name === 'string' ? source.name.trim().slice(0, 24) : '';
  if (name) look.name = name;
  return Object.keys(look).length > 0 ? look : null;
}

/** Writes a push that is within the account's limits. statsJson is null when the push carried no stats. */
async function saveSync(t, user, sessions, statsJson, characterState, now) {
  for (const session of sessions.values()) {
    await t.run(
      `INSERT INTO study_sessions (id, user_id, title, subject, data_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         title = excluded.title,
         subject = excluded.subject,
         data_json = excluded.data_json,
         updated_at = excluded.updated_at
       WHERE study_sessions.user_id = excluded.user_id`,
      [
        session.id,
        user.id,
        String(session.title || 'Untitled Session'),
        String(session.subject || 'General'),
        JSON.stringify(session),
        validDate(session.createdAt, now),
        now,
      ],
    );
  }

  const character = sanitizeCharacter(characterState);
  if (statsJson || character) {
    await t.run(
      `INSERT INTO user_stats (user_id, stats_json, character_json, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         stats_json = excluded.stats_json,
         character_json = excluded.character_json,
         updated_at = excluded.updated_at`,
      [user.id, statsJson || '{}', character ? JSON.stringify(character) : null, now],
    );
  }
}

export async function handleSyncRoutes(req, res, pathname, body) {
  // 1. SYNC PUSH
  if (pathname === '/api/sync/push' && req.method === 'POST') {
    const user = await getAuthUser(req);
    if (!user) return send(res, 401, { error: UNAUTHORIZED });

    const { sessions, stats, characterState } = body || {};

    if (!Array.isArray(sessions) && !stats) {
      return send(res, 400, { error: 'Payload must contain sessions array or stats object.' });
    }

    const now = new Date().toISOString();
    const statsJson = JSON.stringify(stats || {});
    if (Buffer.byteLength(statsJson) > MAX_STATS_BYTES) {
      return send(res, 413, { error: 'Study stats are too large to sync.' });
    }
    const incoming = new Map();
    for (const session of Array.isArray(sessions) ? sessions : []) {
      if (session && typeof session.id === 'string' && session.id) incoming.set(session.id, session);
    }

    try {
      await db.tx(async (t) => {
        if (incoming.size > 0) {
          // What the account will hold after this push: its other sessions plus the ones sent now.
          const stored = await t.all('SELECT id, octet_length(data_json) AS bytes FROM study_sessions WHERE user_id = $1', [user.id]);
          let count = incoming.size;
          let bytes = 0;
          for (const row of stored) {
            if (incoming.has(row.id)) continue;
            count += 1;
            bytes += Number(row.bytes);
          }
          for (const session of incoming.values()) bytes += Buffer.byteLength(JSON.stringify(session));
          if (count > MAX_SESSIONS_PER_USER || bytes > MAX_SESSION_BYTES_PER_USER) throw new OverLimit();
        }
        await saveSync(t, user, incoming, stats ? statsJson : null, characterState, now);
      });
    } catch (err) {
      if (!(err instanceof OverLimit)) throw err;
      return send(res, 413, {
        error: `Cloud sync is full: an account can keep up to ${MAX_SESSIONS_PER_USER} decks and ${MAX_SESSION_BYTES_PER_USER / 1024 / 1024} MB in the cloud. Your decks are still saved on this device.`,
      });
    }

    return send(res, 200, {
      success: true,
      syncedAt: Date.now(),
      sessionCount: Array.isArray(sessions) ? sessions.length : 0,
      message: 'Cloud sync payload successfully saved to Studify server.',
    });
  }

  // 2. SYNC PULL
  if (pathname === '/api/sync/pull' && req.method === 'GET') {
    const user = await getAuthUser(req);
    if (!user) return send(res, 401, { error: UNAUTHORIZED });

    const sessionsRows = await db.all('SELECT data_json FROM study_sessions WHERE user_id = $1 ORDER BY updated_at DESC', [user.id]);
    const sessions = sessionsRows
      .map((row) => {
        try {
          return JSON.parse(row.data_json);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const statsRow = await db.one('SELECT * FROM user_stats WHERE user_id = $1', [user.id]);
    let stats = null;
    let characterState = null;
    if (statsRow) {
      try { stats = JSON.parse(statsRow.stats_json); } catch {}
      try { characterState = JSON.parse(statsRow.character_json); } catch {}
    }

    return send(res, 200, {
      success: true,
      syncedAt: Date.now(),
      userId: user.id,
      sessions,
      stats,
      characterState,
    });
  }

  return false;
}
