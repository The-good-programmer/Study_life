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
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const MAX_DELETED_SESSIONS = 2000;

/** The kinds of synced document an account can hold (see migration 005). */
export const DOCUMENT_KINDS = ['folders', 'planner', 'timetable', 'lesson_logs', 'focus_tasks', 'focus_log', 'focus_notes', 'deletions'];

class BadRequest extends Error {}

/** The documents in a push, checked: known kinds, JSON objects or arrays, within the size limit. */
function readDocuments(documents) {
  if (documents === undefined || documents === null) return new Map();
  if (typeof documents !== 'object' || Array.isArray(documents)) throw new BadRequest('documents must be an object.');
  const out = new Map();
  for (const [kind, value] of Object.entries(documents)) {
    if (!DOCUMENT_KINDS.includes(kind)) throw new BadRequest(`Unknown document kind: ${kind}.`);
    if (!value || typeof value !== 'object') throw new BadRequest(`Document ${kind} must be an object or array.`);
    const json = JSON.stringify(value);
    if (Buffer.byteLength(json) > MAX_DOCUMENT_BYTES) throw new BadRequest(`Document ${kind} is too large to sync.`);
    out.set(kind, json);
  }
  return out;
}

/** Deck ids to delete from the account, checked. */
function readDeletedSessionIds(ids) {
  if (ids === undefined || ids === null) return [];
  if (!Array.isArray(ids) || ids.length > MAX_DELETED_SESSIONS || ids.some((id) => typeof id !== 'string' || !id || id.length > 200)) {
    throw new BadRequest('deletedSessionIds must be a list of deck ids.');
  }
  return ids;
}

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

export async function handleSyncRoutes(req, res, pathname, body, searchParams) {
  // 1. SYNC PUSH
  if (pathname === '/api/sync/push' && req.method === 'POST') {
    const user = await getAuthUser(req);
    if (!user) return send(res, 401, { error: UNAUTHORIZED });

    const { sessions, stats, characterState } = body || {};

    let documents;
    let deletedSessionIds;
    try {
      documents = readDocuments(body?.documents);
      deletedSessionIds = readDeletedSessionIds(body?.deletedSessionIds);
    } catch (err) {
      if (err instanceof BadRequest) return send(res, 400, { error: err.message });
      throw err;
    }

    if (!Array.isArray(sessions) && !stats && documents.size === 0 && deletedSessionIds.length === 0) {
      return send(res, 400, { error: 'Payload must contain sessions, stats, documents or deletedSessionIds.' });
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
        if (deletedSessionIds.length > 0) {
          await t.run('DELETE FROM study_sessions WHERE user_id = $1 AND id = ANY($2::text[])', [user.id, deletedSessionIds]);
        }
        for (const [kind, json] of documents) {
          await t.run(
            `INSERT INTO user_documents (user_id, kind, data_json, updated_at)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, kind) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`,
            [user.id, kind, json, now],
          );
        }
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

    // The time is read before the decks, so a deck saved while this runs is sent again next time, not missed.
    const serverTime = Date.now();
    // With ?since=<ms>, only decks saved since then (from the previous pull's serverTime).
    const since = Number(searchParams?.get('since'));
    const sessionsRows = Number.isFinite(since) && since > 0
      ? await db.all('SELECT data_json FROM study_sessions WHERE user_id = $1 AND updated_at > $2 ORDER BY updated_at DESC', [user.id, new Date(since).toISOString()])
      : await db.all('SELECT data_json FROM study_sessions WHERE user_id = $1 ORDER BY updated_at DESC', [user.id]);
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

    const documents = {};
    for (const row of await db.all('SELECT kind, data_json FROM user_documents WHERE user_id = $1', [user.id])) {
      try { documents[row.kind] = JSON.parse(row.data_json); } catch {}
    }

    return send(res, 200, {
      success: true,
      syncedAt: serverTime,
      serverTime,
      userId: user.id,
      sessions,
      stats,
      characterState,
      documents,
    });
  }

  return false;
}
