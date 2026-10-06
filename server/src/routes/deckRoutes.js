/**
 * Community Deck Marketplace & Public Sharing Routes
 */

import { db } from '../db.js';
import { getAuthUser } from '../auth.js';

export function handleDeckRoutes(req, res, pathname, body, searchParams) {
  // 1. LIST PUBLIC COMMUNITY DECKS
  if (pathname === '/api/decks/public' && req.method === 'GET') {
    const query = (searchParams.get('q') || '').toLowerCase().trim();
    const subject = (searchParams.get('subject') || '').toLowerCase().trim();

    let sql = 'SELECT id, slug, author_name, title, subject, description, card_count, likes, created_at FROM shared_decks';
    const params = [];
    const conditions = [];

    if (query) {
      conditions.push('(LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(subject) LIKE ?)');
      params.push(`%${query}%`, `%${query}%`, `%${query}%`);
    }

    if (subject && subject !== 'all') {
      conditions.push('LOWER(subject) = ?');
      params.push(subject);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY likes DESC, created_at DESC LIMIT 50';

    const rows = db.prepare(sql).all(...params);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, decks: rows }));
  }

  // 2. SHARE / PUBLISH A DECK
  if (pathname === '/api/decks/share' && req.method === 'POST') {
    const user = getAuthUser(req);
    const { title, subject, description, session, cards } = body || {};

    if (!title || !session) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Deck title and study session payload are required.' }));
    }

    const cardCount = Array.isArray(cards)
      ? cards.length
      : (session.concepts?.flatMap(c => c.retrievalCards || []) || []).length;

    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Math.random().toString(36).substring(2, 6)}`;
    const deckId = `deck_pub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const authorName = user ? user.name : 'Community Scholar';
    const authorId = user ? user.id : null;
    const now = new Date().toISOString();

    const insertStmt = db.prepare(`
      INSERT INTO shared_decks (id, slug, author_id, author_name, title, subject, description, card_count, likes, deck_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    insertStmt.run(
      deckId,
      slug,
      authorId,
      authorName,
      title.trim(),
      (subject || 'General').trim(),
      (description || '').trim(),
      cardCount,
      JSON.stringify(session),
      now
    );

    res.writeHead(201, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      deckId,
      slug,
      shareUrl: `/d/${slug}`,
      message: 'Deck successfully published to community marketplace!',
    }));
  }

  // 3. GET A SPECIFIC DECK BY ID OR SLUG
  if (pathname.startsWith('/api/decks/') && req.method === 'GET') {
    const identifier = pathname.replace('/api/decks/', '').trim();
    if (!identifier) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing deck ID or slug.' }));
    }

    const stmt = db.prepare('SELECT * FROM shared_decks WHERE id = ? OR slug = ?');
    const row = stmt.get(identifier, identifier);

    if (!row) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Community deck not found.' }));
    }

    let session = null;
    try {
      session = JSON.parse(row.deck_json);
    } catch {}

    // Increment like / view counter
    db.prepare('UPDATE shared_decks SET likes = likes + 1 WHERE id = ?').run(row.id);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      deck: {
        id: row.id,
        slug: row.slug,
        authorName: row.author_name,
        title: row.title,
        subject: row.subject,
        description: row.description,
        cardCount: row.card_count,
        likes: row.likes + 1,
        createdAt: row.created_at,
        session,
      }
    }));
  }

  return false;
}
