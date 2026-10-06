/**
 * Cloud Sync & State Persistence Routes
 */

import { db } from '../db.js';
import { getAuthUser } from '../auth.js';

export function handleSyncRoutes(req, res, pathname, body) {
  // 1. SYNC PUSH
  if (pathname === '/api/sync/push' && req.method === 'POST') {
    const user = getAuthUser(req);
    const userId = user ? user.id : (body?.userId || 'anonymous_user');

    const { sessions, stats, characterState, axolotlState } = body || {};

    if (!Array.isArray(sessions) && !stats) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Payload must contain sessions array or stats object.' }));
    }

    const now = new Date().toISOString();

    // Persist sessions in SQLite
    if (Array.isArray(sessions)) {
      const upsertStmt = db.prepare(`
        INSERT INTO study_sessions (id, user_id, title, subject, data_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          subject = excluded.subject,
          data_json = excluded.data_json,
          updated_at = excluded.updated_at
      `);

      for (const session of sessions) {
        if (!session.id) continue;
        upsertStmt.run(
          session.id,
          userId,
          session.title || 'Untitled Session',
          session.subject || 'General',
          JSON.stringify(session),
          session.createdAt || now,
          now
        );
      }
    }

    // Persist stats and avatar states in SQLite
    if (stats || characterState || axolotlState) {
      const upsertStatsStmt = db.prepare(`
        INSERT INTO user_stats (user_id, stats_json, character_json, axolotl_json, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          stats_json = excluded.stats_json,
          character_json = excluded.character_json,
          axolotl_json = excluded.axolotl_json,
          updated_at = excluded.updated_at
      `);

      upsertStatsStmt.run(
        userId,
        JSON.stringify(stats || {}),
        characterState ? JSON.stringify(characterState) : null,
        axolotlState ? JSON.stringify(axolotlState) : null,
        now
      );
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      syncedAt: Date.now(),
      sessionCount: Array.isArray(sessions) ? sessions.length : 0,
      message: 'Cloud sync payload successfully saved to Studify server.',
    }));
  }

  // 2. SYNC PULL
  if (pathname === '/api/sync/pull' && req.method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized. Please provide valid Bearer token.' }));
    }

    const sessionsRows = db.prepare('SELECT data_json FROM study_sessions WHERE user_id = ? ORDER BY updated_at DESC').all(user.id);
    const sessions = sessionsRows.map(r => {
      try {
        return JSON.parse(r.data_json);
      } catch {
        return null;
      }
    }).filter(Boolean);

    const statsRow = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(user.id);
    let stats = null;
    let characterState = null;
    let axolotlState = null;

    if (statsRow) {
      try { stats = JSON.parse(statsRow.stats_json); } catch {}
      try { characterState = JSON.parse(statsRow.character_json); } catch {}
      try { axolotlState = JSON.parse(statsRow.axolotl_json); } catch {}
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      syncedAt: Date.now(),
      userId: user.id,
      sessions,
      stats,
      characterState,
      axolotlState,
    }));
  }

  return false;
}
