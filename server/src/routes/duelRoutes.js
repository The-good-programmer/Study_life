/**
 * Duels: a student answers a few multiple-choice questions from one of their decks and challenges a
 * friend to the same questions. Answers are graded here, and the friend sees which answer is right
 * only after answering. A duel not played within a week expires.
 */

import crypto from 'node:crypto';
import { db } from '../db.js';
import { getAuthUser } from '../auth.js';
import { clientIp, limiters } from '../rateLimit.js';

export const MIN_QUESTIONS = 4;
export const MAX_QUESTIONS = 10;
const OPTIONS = 4;
const MAX_TEXT = 400;
const MAX_TITLE = 120;
const WEEK_MS = 7 * 86_400_000;
/** At most this many duels a student has sent that are still waiting. */
const MAX_OPEN_SENT = 20;

function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify(payload));
}

class BadRequest extends Error {}

const text = (value, max = MAX_TEXT) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new BadRequest('A question or choice is empty or too long.');
  return value.trim();
};

/** The questions as sent by the app, checked: 4–10 of them, each with 4 different choices and the right one. */
export function readQuestions(value) {
  if (!Array.isArray(value) || value.length < MIN_QUESTIONS || value.length > MAX_QUESTIONS) {
    throw new BadRequest(`A duel has ${MIN_QUESTIONS} to ${MAX_QUESTIONS} questions.`);
  }
  return value.map((q) => {
    const options = Array.isArray(q?.options) ? q.options.map((o) => text(o)) : [];
    if (options.length !== OPTIONS || new Set(options.map((o) => o.toLowerCase())).size !== OPTIONS) {
      throw new BadRequest('Each question needs 4 different choices.');
    }
    if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex >= OPTIONS) throw new BadRequest('Each question needs its right answer.');
    return { question: text(q.question), options, answerIndex: q.answerIndex };
  });
}

/** Answers (a choice index, or null when time ran out) for the questions, checked. */
export function readAnswers(value, count) {
  if (!Array.isArray(value) || value.length !== count) throw new BadRequest('Answer every question.');
  return value.map((a) => {
    if (a === null) return null;
    if (!Number.isInteger(a) || a < 0 || a >= OPTIONS) throw new BadRequest('An answer is not one of the choices.');
    return a;
  });
}

const readMs = (value) => (Number.isFinite(value) && value >= 0 ? Math.min(Math.round(value), 60 * 60_000) : 0);

export const scoreOf = (questions, answers) => questions.reduce((sum, q, i) => sum + (answers[i] === q.answerIndex ? 1 : 0), 0);

const iso = (v) => (v instanceof Date ? v.toISOString() : v);

/**
 * A duel as one of its two players sees it. The other player's answers, and the right answers, show
 * only once that player has answered too.
 */
export function duelView(row, userId, now = new Date()) {
  const mine = row.challenger_id === userId ? 'challenger' : 'opponent';
  const completed = row.opponent_score !== null && row.opponent_score !== undefined;
  const questions = JSON.parse(row.questions_json);
  const iAnswered = mine === 'challenger' || completed;
  const status = completed ? 'done' : Date.parse(iso(row.expires_at)) <= now.getTime() ? 'expired' : mine === 'challenger' ? 'waiting' : 'your-turn';
  const players = {
    challenger: { id: row.challenger_id, name: row.challenger_name, score: row.challenger_score, ms: row.challenger_ms },
    opponent: { id: row.opponent_id, name: row.opponent_name, score: completed ? row.opponent_score : null, ms: completed ? row.opponent_ms : null },
  };
  return {
    id: row.id,
    deckTitle: row.deck_title,
    status,
    role: mine,
    createdAt: iso(row.created_at),
    completedAt: iso(row.completed_at) ?? null,
    expiresAt: iso(row.expires_at),
    questionCount: questions.length,
    you: players[mine],
    them: mine === 'challenger' ? players.opponent : { ...players.challenger, score: iAnswered ? players.challenger.score : null, ms: iAnswered ? players.challenger.ms : null },
    // To play: the questions without the right answers. After playing: everything, for the results.
    questions: iAnswered
      ? questions.map((q, i) => ({
          ...q,
          yourAnswer: JSON.parse(mine === 'challenger' ? row.challenger_answers_json : row.opponent_answers_json)[i],
          theirAnswer: completed ? JSON.parse(mine === 'challenger' ? row.opponent_answers_json : row.challenger_answers_json)[i] : null,
        }))
      : questions.map(({ question, options }) => ({ question, options })),
  };
}

const DUEL_COLUMNS = `d.*, c.name AS challenger_name, o.name AS opponent_name
  FROM duels d JOIN users c ON c.id = d.challenger_id JOIN users o ON o.id = d.opponent_id`;

const areFriends = async (a, b) => !!(await db.one('SELECT 1 AS ok FROM friendships WHERE user_id = $1 AND friend_id = $2', [a, b]));

export async function handleDuelRoutes(req, res, pathname, body) {
  if (!pathname.startsWith('/api/duels')) return false;
  const user = await getAuthUser(req);
  if (!user) return send(res, 401, { error: 'Sign in to duel with friends.' });

  try {
    // Your duels from the past two weeks, newest first.
    if (pathname === '/api/duels' && req.method === 'GET') {
      const since = new Date(Date.now() - 2 * WEEK_MS).toISOString();
      const rows = await db.all(
        `SELECT ${DUEL_COLUMNS} WHERE (d.challenger_id = $1 OR d.opponent_id = $1) AND d.created_at > $2 ORDER BY d.created_at DESC LIMIT 50`,
        [user.id, since],
      );
      const now = new Date();
      return send(res, 200, { duels: rows.map((row) => duelView(row, user.id, now)) });
    }

    // Challenge a friend, with your own answers to the questions.
    if (pathname === '/api/duels' && req.method === 'POST') {
      if (!limiters.friends.take(clientIp(req))) return send(res, 429, { error: 'Too many challenges. Wait a few minutes.' });
      const friendId = body?.friendId;
      if (typeof friendId !== 'string' || !(await areFriends(user.id, friendId))) return send(res, 400, { error: 'You can only challenge your friends.' });
      const questions = readQuestions(body?.questions);
      const answers = readAnswers(body?.answers, questions.length);
      const deckTitle = text(body?.deckTitle, MAX_TITLE);
      const open = await db.one(
        'SELECT COUNT(*)::int AS n FROM duels WHERE challenger_id = $1 AND opponent_score IS NULL AND expires_at > $2',
        [user.id, new Date().toISOString()],
      );
      if (open.n >= MAX_OPEN_SENT) return send(res, 400, { error: `You have ${MAX_OPEN_SENT} challenges waiting. Wait for your friends to play some first.` });

      const id = `duel_${crypto.randomBytes(12).toString('base64url')}`;
      const now = new Date();
      await db.run(
        `INSERT INTO duels (id, challenger_id, opponent_id, deck_title, questions_json, challenger_answers_json, challenger_score, challenger_ms, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, user.id, friendId, deckTitle, JSON.stringify(questions), JSON.stringify(answers), scoreOf(questions, answers), readMs(body?.ms), now.toISOString(), new Date(now.getTime() + WEEK_MS).toISOString()],
      );
      const row = await db.one(`SELECT ${DUEL_COLUMNS} WHERE d.id = $1`, [id]);
      return send(res, 201, { duel: duelView(row, user.id) });
    }

    // Answer a duel you were challenged to.
    const play = pathname.match(/^\/api\/duels\/(duel_[\w-]{16})\/play$/);
    if (play && req.method === 'POST') {
      const row = await db.one(`SELECT ${DUEL_COLUMNS} WHERE d.id = $1`, [play[1]]);
      if (!row || row.opponent_id !== user.id) return send(res, 404, { error: 'That challenge is not for you.' });
      if (row.opponent_score !== null) return send(res, 409, { error: 'You already played this challenge.' });
      if (Date.parse(iso(row.expires_at)) <= Date.now()) return send(res, 410, { error: 'This challenge has expired.' });
      const questions = JSON.parse(row.questions_json);
      const answers = readAnswers(body?.answers, questions.length);
      const score = scoreOf(questions, answers);
      // Only the first answer counts, even if two arrive at once.
      const updated = await db.one(
        `UPDATE duels SET opponent_answers_json = $1, opponent_score = $2, opponent_ms = $3, completed_at = $4
         WHERE id = $5 AND opponent_score IS NULL RETURNING id`,
        [JSON.stringify(answers), score, readMs(body?.ms), new Date().toISOString(), row.id],
      );
      if (!updated) return send(res, 409, { error: 'You already played this challenge.' });
      const done = await db.one(`SELECT ${DUEL_COLUMNS} WHERE d.id = $1`, [row.id]);
      return send(res, 200, { duel: duelView(done, user.id) });
    }
  } catch (err) {
    if (err instanceof BadRequest) return send(res, 400, { error: err.message });
    throw err;
  }

  return send(res, 404, { error: `Route not found: ${req.method} ${pathname}` });
}
