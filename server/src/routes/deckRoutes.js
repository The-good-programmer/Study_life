/**
 * Community Deck Marketplace & Public Sharing Routes
 */

import crypto from 'node:crypto';
import { db } from '../db.js';
import { getAuthUser } from '../auth.js';

function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify(payload));
}

const iso = (value) => (value instanceof Date ? value.toISOString() : value);

/** decodeURIComponent that returns null (instead of throwing) on a malformed % sequence. */
const safeDecode = (text) => {
  try {
    return decodeURIComponent(text);
  } catch {
    return null;
  }
};

/** Escapes % and _ so a search for them matches the characters themselves. */
const likePattern = (text) => `%${text.replace(/[\\%_]/g, '\\$&')}%`;

const MAX_TITLE = 120;
const MAX_SUBJECT = 60;
const MAX_DESCRIPTION = 1000;
const MAX_DECK_BYTES = 2 * 1024 * 1024;
const MAX_PUBLISHES_PER_DAY = 20;
const MAX_REPORT_REASON = 500;
/** Reports from this many different people hide a deck until someone reviews it. */
export const REPORTS_TO_HIDE = 3;

/** A visible deck by id or slug. Hidden (reported) decks are treated as missing. */
const findVisibleDeck = (identifier) =>
  db.one('SELECT * FROM shared_decks WHERE (id = $1 OR slug = $1) AND hidden_at IS NULL', [identifier]);

export async function handleDeckRoutes(req, res, pathname, body, searchParams) {
  // 1. LIST PUBLIC COMMUNITY DECKS
  if (pathname === '/api/decks/public' && req.method === 'GET') {
    const query = (searchParams.get('q') || '').trim();
    const subject = (searchParams.get('subject') || '').trim();

    let sql = 'SELECT id, slug, author_name, title, subject, description, card_count, likes, created_at FROM shared_decks';
    const params = [];
    const conditions = [];

    if (query) {
      params.push(likePattern(query));
      conditions.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length} OR subject ILIKE $${params.length})`);
    }

    if (subject && subject.toLowerCase() !== 'all') {
      params.push(subject.toLowerCase());
      conditions.push(`LOWER(subject) = $${params.length}`);
    }

    conditions.push('hidden_at IS NULL');
    sql += ' WHERE ' + conditions.join(' AND ');

    sql += ' ORDER BY likes DESC, created_at DESC LIMIT 50';

    const rows = (await db.all(sql, params)).map((row) => ({ ...row, created_at: iso(row.created_at) }));
    return send(res, 200, { success: true, decks: rows });
  }

  // 2. SHARE / PUBLISH A DECK
  if (pathname === '/api/decks/share' && req.method === 'POST') {
    const user = await getAuthUser(req);
    if (!user) {
      return send(res, 401, { error: 'Sign in to publish decks to the community.' });
    }
    const { title, subject, description, session, cards } = body || {};

    if (typeof title !== 'string' || !title.trim() || !session || typeof session !== 'object') {
      return send(res, 400, { error: 'Deck title and study session payload are required.' });
    }
    if (title.trim().length > MAX_TITLE || String(subject || '').trim().length > MAX_SUBJECT || String(description || '').trim().length > MAX_DESCRIPTION) {
      return send(res, 400, { error: `Keep the title under ${MAX_TITLE} characters, the subject under ${MAX_SUBJECT} and the description under ${MAX_DESCRIPTION}.` });
    }
    const deckJson = JSON.stringify(session);
    if (Buffer.byteLength(deckJson) > MAX_DECK_BYTES) {
      return send(res, 413, { error: 'This deck is too large to publish (2 MB at most).' });
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recent = await db.one('SELECT COUNT(*)::int AS n FROM shared_decks WHERE author_id = $1 AND created_at > $2', [user.id, since]);
    if (recent.n >= MAX_PUBLISHES_PER_DAY) {
      return send(res, 429, { error: `You can publish up to ${MAX_PUBLISHES_PER_DAY} decks a day. Try again tomorrow.` });
    }

    const cardCount = Array.isArray(cards)
      ? cards.length
      : (session.concepts?.flatMap((c) => c.retrievalCards || []) || []).length;

    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${crypto.randomBytes(3).toString('hex')}`;
    const deckId = `deck_pub_${crypto.randomUUID()}`;

    await db.run(
      `INSERT INTO shared_decks (id, slug, author_id, author_name, title, subject, description, card_count, likes, deck_json, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10)`,
      [
        deckId,
        slug,
        user.id,
        user.name,
        title.trim(),
        String(subject || 'General').trim(),
        String(description || '').trim(),
        cardCount,
        deckJson,
        new Date().toISOString(),
      ],
    );

    return send(res, 201, {
      success: true,
      deckId,
      slug,
      shareUrl: `/d/${slug}`,
      message: 'Deck successfully published to community marketplace!',
    });
  }

  // 3. LIKE A DECK (once per signed-in user)
  const likeMatch = /^\/api\/decks\/([^/]+)\/like$/.exec(pathname);
  if (likeMatch && req.method === 'POST') {
    const user = await getAuthUser(req);
    if (!user) {
      return send(res, 401, { error: 'Sign in to like decks.' });
    }

    const identifier = safeDecode(likeMatch[1]);
    if (!identifier) return send(res, 400, { error: 'Missing deck ID or slug.' });
    const row = await findVisibleDeck(identifier);
    if (!row) {
      return send(res, 404, { error: 'Community deck not found.' });
    }

    const likes = await db.tx(async (t) => {
      const inserted = await t.run(
        'INSERT INTO deck_likes (deck_id, user_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [row.id, user.id, new Date().toISOString()],
      );
      if (inserted > 0) await t.run('UPDATE shared_decks SET likes = likes + 1 WHERE id = $1', [row.id]);
      return (await t.one('SELECT likes FROM shared_decks WHERE id = $1', [row.id])).likes;
    });
    return send(res, 200, { success: true, likes, liked: true });
  }

  // 4. REPORT A DECK (once per signed-in user; enough reports hide it)
  const reportMatch = /^\/api\/decks\/([^/]+)\/report$/.exec(pathname);
  if (reportMatch && req.method === 'POST') {
    const user = await getAuthUser(req);
    if (!user) {
      return send(res, 401, { error: 'Sign in to report decks.' });
    }
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (!reason || reason.length > MAX_REPORT_REASON) {
      return send(res, 400, { error: `Say briefly what is wrong with this deck (up to ${MAX_REPORT_REASON} characters).` });
    }
    const identifier = safeDecode(reportMatch[1]);
    if (!identifier) return send(res, 400, { error: 'Missing deck ID or slug.' });
    const row = await findVisibleDeck(identifier);
    if (!row) {
      return send(res, 404, { error: 'Community deck not found.' });
    }
    if (row.author_id === user.id) {
      return send(res, 400, { error: 'You cannot report your own deck. Delete it instead.' });
    }

    const hidden = await db.tx(async (t) => {
      await t.run(
        'INSERT INTO deck_reports (deck_id, user_id, reason, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [row.id, user.id, reason, new Date().toISOString()],
      );
      const { n } = await t.one('SELECT COUNT(*)::int AS n FROM deck_reports WHERE deck_id = $1', [row.id]);
      if (n < REPORTS_TO_HIDE) return false;
      return (await t.run('UPDATE shared_decks SET hidden_at = $2 WHERE id = $1 AND hidden_at IS NULL', [row.id, new Date().toISOString()])) > 0;
    });
    if (hidden) console.warn(`[Decks] Deck ${row.id} ("${row.title}") was hidden after ${REPORTS_TO_HIDE} reports.`);
    return send(res, 200, { success: true, message: 'Thanks. The deck has been reported.' });
  }

  // 5. DELETE YOUR OWN DECK
  const deleteMatch = /^\/api\/decks\/([^/]+)$/.exec(pathname);
  if (deleteMatch && req.method === 'DELETE') {
    const user = await getAuthUser(req);
    if (!user) {
      return send(res, 401, { error: 'Sign in to delete your decks.' });
    }
    const identifier = safeDecode(deleteMatch[1]);
    if (!identifier) return send(res, 400, { error: 'Missing deck ID or slug.' });
    const deleted = await db.run('DELETE FROM shared_decks WHERE (id = $1 OR slug = $1) AND author_id = $2', [identifier, user.id]);
    if (!deleted) {
      return send(res, 404, { error: 'You have no published deck with that ID.' });
    }
    return send(res, 200, { success: true });
  }

  // 6. GET A SPECIFIC DECK BY ID OR SLUG
  if (pathname.startsWith('/api/decks/') && req.method === 'GET') {
    const identifier = safeDecode(pathname.replace('/api/decks/', '').trim());
    if (!identifier) {
      return send(res, 400, { error: 'Missing deck ID or slug.' });
    }

    const row = await findVisibleDeck(identifier);
    if (!row) {
      return send(res, 404, { error: 'Community deck not found.' });
    }

    let session = null;
    try {
      session = JSON.parse(row.deck_json);
    } catch {}

    return send(res, 200, {
      success: true,
      deck: {
        id: row.id,
        slug: row.slug,
        authorName: row.author_name,
        title: row.title,
        subject: row.subject,
        description: row.description,
        cardCount: row.card_count,
        likes: row.likes,
        createdAt: iso(row.created_at),
        session,
      },
    });
  }

  return false;
}
