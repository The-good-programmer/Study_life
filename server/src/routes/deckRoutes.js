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

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

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
        JSON.stringify(session),
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
    const row = await db.one('SELECT id FROM shared_decks WHERE id = $1 OR slug = $1', [identifier]);
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

  // 4. GET A SPECIFIC DECK BY ID OR SLUG
  if (pathname.startsWith('/api/decks/') && req.method === 'GET') {
    const identifier = safeDecode(pathname.replace('/api/decks/', '').trim());
    if (!identifier) {
      return send(res, 400, { error: 'Missing deck ID or slug.' });
    }

    const row = await db.one('SELECT * FROM shared_decks WHERE id = $1 OR slug = $1', [identifier]);
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
