import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import crypto from 'node:crypto';

const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'x'.repeat(48);
process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
process.env.AI_DAILY_QUOTA = '2';

let server;
let baseUrl;
let auth;
let db;
let rateLimit;

// RSA key pair standing in for Google's signing key.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'test-kid';

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signGoogleToken(claims, { key = privateKey, kid = KID } = {}) {
  const header = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: 'google-sub-123',
    email: 'alice@example.com',
    email_verified: true,
    name: 'Alice',
    iat: now,
    exp: now + 3600,
    ...claims,
  }));
  const signature = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), key);
  return `${header}.${payload}.${b64url(signature)}`;
}

/** Stands in for the email service: keeps what would have been sent. */
const sentMail = [];
const fakeMailer = { send: async (mail) => void sentMail.push(mail) };
const linkIn = (mail) => mail.text.match(/\?reset=([\w-]+)/)?.[1];

async function api(path, { method = 'GET', token, body, headers: extraHeaders } = {}) {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

async function register(email) {
  const res = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'Test User', email, password: 'correct-horse' },
  });
  expect(res.status).toBe(201);
  return res.data;
}

/** The smallest deck the server will share. */
const SHAREABLE_DECK = { concepts: [{ title: 'Cells', retrievalCards: [{ question: 'What makes ATP?', answer: 'Mitochondria' }] }] };

const fakeAi = {
  isAiConfigured: () => true,
  checkRateLimit: () => true,
  consumeDailyQuota: undefined, // filled in beforeAll with the real DB-backed quota
  consumeGuestQuota: undefined, // likewise
  generateContent: async () => 'generated',
  generateContentStream: async function* () { yield 'chunk'; },
};

beforeAll(async () => {
  auth = await import('./auth.js');
  ({ db } = await import('./db.js'));
  rateLimit = await import('./rateLimit.js');
  const ai = await import('./ai.js');
  const { createApp } = await import('./app.js');

  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' };
  auth.setGoogleKeyFetcher(async () => [jwk]);
  auth.setGoogleAccessTokenFetchers({
    tokenInfo: async (token) => ({
      'good-access-token': { aud: CLIENT_ID, azp: CLIENT_ID, sub: 'g-2', email: 'carol@example.com', email_verified: 'true' },
      'other-app-token': { aud: 'another-app', azp: 'another-app', sub: 'g-3', email: 'dave@example.com', email_verified: 'true' },
    })[token] || null,
    userInfo: async () => ({ name: 'Carol' }),
  });
  fakeAi.consumeDailyQuota = ai.consumeDailyQuota;
  fakeAi.consumeGuestQuota = ai.consumeGuestQuota;

  server = http.createServer(createApp({ ai: fakeAi, mailer: fakeMailer }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}, 60_000); // Starting the embedded database can take a while when the whole suite runs in parallel.

afterAll(async () => {
  auth?.setGoogleKeyFetcher(null);
  auth?.setGoogleAccessTokenFetchers(null);
  if (server) await new Promise((resolve) => server.close(resolve));
});

describe('Google sign-in', () => {
  it('rejects a client-supplied email without a credential', async () => {
    const res = await api('/api/auth/google', { method: 'POST', body: { email: 'victim@example.com' } });
    expect(res.status).toBe(401);
    expect(res.data.token).toBeUndefined();
  });

  it('accepts a valid Google ID token and takes identity from it, not the body', async () => {
    const res = await api('/api/auth/google', {
      method: 'POST',
      body: { credential: signGoogleToken({}), email: 'victim@example.com', grade: '11th Grade' },
    });
    expect(res.status).toBe(200);
    expect(res.data.user.email).toBe('alice@example.com');
    expect(res.data.user.grade).toBe('11th Grade');
    expect(typeof res.data.token).toBe('string');
  });

  it.each([
    ['wrong audience', { aud: 'someone-else' }],
    ['expired token', { exp: Math.floor(Date.now() / 1000) - 10 }],
    ['wrong issuer', { iss: 'https://evil.example.com' }],
    ['unverified email', { email_verified: false }],
  ])('rejects a token with %s', async (_label, claims) => {
    const res = await api('/api/auth/google', { method: 'POST', body: { credential: signGoogleToken(claims) } });
    expect(res.status).toBe(401);
  });

  it('accepts a popup access token issued to this app, and rejects one issued to another app', async () => {
    const ok = await api('/api/auth/google', { method: 'POST', body: { accessToken: 'good-access-token' } });
    expect(ok.status).toBe(200);
    expect(ok.data.user.email).toBe('carol@example.com');

    const foreign = await api('/api/auth/google', { method: 'POST', body: { accessToken: 'other-app-token' } });
    expect(foreign.status).toBe(401);

    const bogus = await api('/api/auth/google', { method: 'POST', body: { accessToken: 'made-up' } });
    expect(bogus.status).toBe(401);
  });

  it('rejects a token signed with a different key', async () => {
    const { privateKey: otherKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const res = await api('/api/auth/google', {
      method: 'POST',
      body: { credential: signGoogleToken({}, { key: otherKey }) },
    });
    expect(res.status).toBe(401);
  });
});

describe('login tokens', () => {
  it('rejects forged tokens', async () => {
    const header = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const payload = b64url(JSON.stringify({ sub: 'usr_x', exp: Math.floor(Date.now() / 1000) + 3600 }));
    const forgedNone = `${header}.${payload}.`;

    const oldSecret = 'studify_dev_jwt_secret_change_in_production_998877665544332211';
    const hsHeader = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const sig = b64url(crypto.createHmac('sha256', oldSecret).update(`${hsHeader}.${payload}`).digest());
    const forgedOldSecret = `${hsHeader}.${payload}.${sig}`;

    for (const token of [forgedNone, forgedOldSecret, 'not.a.token']) {
      const res = await api('/api/auth/me', { token });
      expect(res.status).toBe(401);
    }
  });

  it('uses one generic error for unknown email and wrong password', async () => {
    await register('bob@example.com');
    const unknown = await api('/api/auth/login', { method: 'POST', body: { email: 'nobody@example.com', password: 'x' } });
    const wrong = await api('/api/auth/login', { method: 'POST', body: { email: 'bob@example.com', password: 'wrong' } });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.data.error).toBe(wrong.data.error);
  });
});

describe('cloud sync', () => {
  it('rejects unauthenticated pushes, including a client-supplied userId', async () => {
    const res = await api('/api/sync/push', { method: 'POST', body: { userId: 'usr_someone', stats: { xp: 1 } } });
    expect(res.status).toBe(401);
  });

  it("does not let one user overwrite another user's session", async () => {
    const owner = await register('owner@example.com');
    const attacker = await register('attacker@example.com');
    const session = { id: 'sess_shared', title: 'Original', subject: 'Bio' };

    await api('/api/sync/push', { method: 'POST', token: owner.token, body: { sessions: [session] } });
    await api('/api/sync/push', {
      method: 'POST',
      token: attacker.token,
      body: { sessions: [{ ...session, title: 'Hijacked' }] },
    });

    const pulled = await api('/api/sync/pull', { token: owner.token });
    expect(pulled.status).toBe(200);
    expect(pulled.data.sessions[0].title).toBe('Original');
  });

  it('stores documents for each account and sends them back', async () => {
    const a = await register('docs-a@example.com');
    const b = await register('docs-b@example.com');
    const planner = { items: [{ id: 'plan-1', title: 'Biology midterm' }] };
    const push = await api('/api/sync/push', { method: 'POST', token: a.token, body: { documents: { planner, focus_notes: { text: 'hi', updatedAt: 1 } } } });
    expect(push.status).toBe(200);

    const mine = await api('/api/sync/pull', { token: a.token });
    expect(mine.data.documents).toEqual({ planner, focus_notes: { text: 'hi', updatedAt: 1 } });
    expect(typeof mine.data.serverTime).toBe('number');
    // Another account sees none of it.
    const theirs = await api('/api/sync/pull', { token: b.token });
    expect(theirs.data.documents).toEqual({});

    // A later push replaces the document.
    await api('/api/sync/push', { method: 'POST', token: a.token, body: { documents: { planner: { items: [] } } } });
    expect((await api('/api/sync/pull', { token: a.token })).data.documents.planner).toEqual({ items: [] });
  });

  it('refuses unknown document kinds and oversized documents', async () => {
    const a = await register('docs-bad@example.com');
    const unknown = await api('/api/sync/push', { method: 'POST', token: a.token, body: { documents: { wallet: { coins: 1e9 } } } });
    expect(unknown.status).toBe(400);
    const big = await api('/api/sync/push', { method: 'POST', token: a.token, body: { documents: { focus_log: { entries: 'x'.repeat(2.1 * 1024 * 1024) } } } });
    expect(big.status).toBe(400);
  });

  it('deletes decks the app deleted, and only that account\'s', async () => {
    const a = await register('del-a@example.com');
    const b = await register('del-b@example.com');
    await api('/api/sync/push', { method: 'POST', token: a.token, body: { sessions: [{ id: 'deck-a1', title: 'A1' }, { id: 'deck-a2', title: 'A2' }] } });
    await api('/api/sync/push', { method: 'POST', token: b.token, body: { sessions: [{ id: 'deck-b1', title: 'B1' }] } });

    await api('/api/sync/push', { method: 'POST', token: a.token, body: { deletedSessionIds: ['deck-a1'] } });
    await api('/api/sync/push', { method: 'POST', token: a.token, body: { deletedSessionIds: ['deck-b1'] } });

    expect((await api('/api/sync/pull', { token: a.token })).data.sessions.map((s) => s.id)).toEqual(['deck-a2']);
    expect((await api('/api/sync/pull', { token: b.token })).data.sessions.map((s) => s.id)).toEqual(['deck-b1']);
  });

  it('sends only decks saved since the last pull', async () => {
    const a = await register('since@example.com');
    await api('/api/sync/push', { method: 'POST', token: a.token, body: { sessions: [{ id: 'old-deck', title: 'Old' }] } });
    const first = await api('/api/sync/pull', { token: a.token });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await api('/api/sync/push', { method: 'POST', token: a.token, body: { sessions: [{ id: 'new-deck', title: 'New' }] } });

    const next = await api(`/api/sync/pull?since=${first.data.serverTime}`, { token: a.token });
    expect(next.data.sessions.map((s) => s.id)).toEqual(['new-deck']);
  });
});

describe('forgot password', () => {
  it('emails a one-time link that sets a new password and signs in', async () => {
    await register('forgetful@example.com');
    sentMail.length = 0;
    const asked = await api('/api/auth/forgot', { method: 'POST', body: { email: 'Forgetful@Example.com' } });
    expect(asked.status).toBe(200);
    expect(sentMail).toHaveLength(1);
    expect(sentMail[0].to).toBe('forgetful@example.com');
    const token = linkIn(sentMail[0]);
    expect(token).toBeTruthy();

    // Only a hash of the token is stored.
    const stored = await db.all('SELECT token_hash FROM password_resets');
    expect(stored.some((row) => row.token_hash === token)).toBe(false);

    const weak = await api('/api/auth/reset', { method: 'POST', body: { token, password: '123' } });
    expect(weak.status).toBe(400);
    const reset = await api('/api/auth/reset', { method: 'POST', body: { token, password: 'brand-new-pass' } });
    expect(reset.status).toBe(200);
    expect(reset.data.token).toBeTruthy();
    expect(reset.data.user.email).toBe('forgetful@example.com');

    // The new password works, the old one doesn't, and the link can't be used twice.
    expect((await api('/api/auth/login', { method: 'POST', body: { email: 'forgetful@example.com', password: 'brand-new-pass' } })).status).toBe(200);
    expect((await api('/api/auth/login', { method: 'POST', body: { email: 'forgetful@example.com', password: 'correct-horse' } })).status).toBe(401);
    expect((await api('/api/auth/reset', { method: 'POST', body: { token, password: 'another-pass' } })).status).toBe(400);
  });

  it("answers the same for an unknown email, and sends nothing", async () => {
    sentMail.length = 0;
    const res = await api('/api/auth/forgot', { method: 'POST', body: { email: 'nobody-here@example.com' } });
    expect(res.status).toBe(200);
    expect(res.data.message).toMatch(/If that email has a Studify password/);
    expect(sentMail).toHaveLength(0);
  });

  it('refuses an expired link', async () => {
    await register('slow@example.com');
    sentMail.length = 0;
    await api('/api/auth/forgot', { method: 'POST', body: { email: 'slow@example.com' } });
    const token = linkIn(sentMail[0]);
    await db.run("UPDATE password_resets SET expires_at = '2000-01-01T00:00:00Z'");
    expect((await api('/api/auth/reset', { method: 'POST', body: { token, password: 'brand-new-pass' } })).status).toBe(400);
  });

  it('says so when email is not set up', async () => {
    const { createApp } = await import('./app.js');
    const instance = http.createServer(createApp({ ai: fakeAi, mailer: null }));
    await new Promise((resolve) => instance.listen(0, '127.0.0.1', resolve));
    try {
      const res = await fetch(`http://127.0.0.1:${instance.address().port}/api/auth/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'someone@example.com' }),
      });
      expect(res.status).toBe(503);
    } finally {
      await new Promise((resolve) => instance.close(resolve));
    }
  });
});

describe('study reminders', () => {
  const subscription = (n) => ({ endpoint: `https://push.example.com/send/${n}`, keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } });

  it('gives out a push key, and needs sign-in and valid details to subscribe', async () => {
    const key = await api('/api/reminders/key');
    expect(key.status).toBe(200);
    expect(key.data.publicKey.length).toBeGreaterThan(40);
    // The same key every time.
    expect((await api('/api/reminders/key')).data.publicKey).toBe(key.data.publicKey);

    const body = { subscription: subscription(1), timeZone: 'Europe/Sofia', remindAt: '19:00' };
    expect((await api('/api/reminders/subscribe', { method: 'POST', body })).status).toBe(401);
    const me = await register('remind-me@example.com');
    expect((await api('/api/reminders/subscribe', { method: 'POST', token: me.token, body: { ...body, timeZone: 'Mars/Base' } })).status).toBe(400);
    expect((await api('/api/reminders/subscribe', { method: 'POST', token: me.token, body: { ...body, remindAt: '7pm' } })).status).toBe(400);
    expect((await api('/api/reminders/subscribe', { method: 'POST', token: me.token, body })).status).toBe(200);
    expect((await api('/api/reminders/unsubscribe', { method: 'POST', token: me.token, body: { endpoint: body.subscription.endpoint } })).status).toBe(200);
    expect(await db.one('SELECT endpoint FROM push_subscriptions WHERE endpoint = $1', [body.subscription.endpoint])).toBeNull();
  });

  it('sends once a day at the local time, to students who have not studied yet', async () => {
    const { runReminders } = await import('./reminders.js');
    const lazy = await register('lazy@example.com');
    const keen = await register('keen@example.com');
    await db.run('DELETE FROM push_subscriptions');
    for (const [account, n] of [[lazy, 10], [keen, 11]]) {
      await api('/api/reminders/subscribe', { method: 'POST', token: account.token, body: { subscription: subscription(n), timeZone: 'Asia/Tokyo', remindAt: '19:00' } });
    }
    // Lazy has a due card and a 3-day streak; keen studied today.
    const yesterday = '2026-11-20T09:00:00.000Z';
    await api('/api/sync/push', {
      method: 'POST',
      token: lazy.token,
      body: {
        stats: { currentStreak: 3, lastActiveDate: '2026-11-20', lastStudiedAt: '2026-11-20T12:00:00.000Z' },
        sessions: [{ id: 'lazy-deck', title: 'Bio', concepts: [{ retrievalCards: [{ id: 'c1', reps: 2, nextReviewDate: yesterday }, { id: 'c2', reps: 0 }] }] }],
      },
    });
    // Keen studied at 08:00 in Tokyo today (23:00 UTC the day before).
    await api('/api/sync/push', { method: 'POST', token: keen.token, body: { stats: { currentStreak: 9, lastActiveDate: '2026-11-20', lastStudiedAt: '2026-11-20T23:00:00.000Z' } } });

    const sent = [];
    const send = async (sub, message) => void sent.push({ endpoint: sub.endpoint, message });
    // 18:59 in Tokyo (09:59 UTC): too early.
    await runReminders({ now: new Date('2026-11-21T09:59:00Z'), send });
    expect(sent).toHaveLength(0);
    // 19:05 in Tokyo: lazy gets one, keen doesn't.
    await runReminders({ now: new Date('2026-11-21T10:05:00Z'), send });
    expect(sent.map((s) => s.endpoint)).toEqual([subscription(10).endpoint]);
    expect(sent[0].message.title).toBe('Your 3-day streak ends at midnight');
    expect(sent[0].message.body).toMatch(/^1 card is due/);
    // Not again the same day.
    await runReminders({ now: new Date('2026-11-21T12:00:00Z'), send });
    expect(sent).toHaveLength(1);
  });

  it('drops a subscription the browser has given up', async () => {
    const { runReminders } = await import('./reminders.js');
    const gone = await register('push-gone@example.com');
    await db.run('DELETE FROM push_subscriptions');
    await api('/api/reminders/subscribe', { method: 'POST', token: gone.token, body: { subscription: subscription(20), timeZone: 'UTC', remindAt: '00:00' } });
    await runReminders({ now: new Date(), send: async () => { throw Object.assign(new Error('Gone'), { statusCode: 410 }); } });
    expect(await db.one('SELECT endpoint FROM push_subscriptions WHERE endpoint = $1', [subscription(20).endpoint])).toBeNull();
  });
});

describe('friends', () => {
  it('needs sign-in', async () => {
    expect((await api('/api/friends')).status).toBe(401);
    expect((await api('/api/friends/add', { method: 'POST', body: { code: 'ABCDEFGH' } })).status).toBe(401);
  });

  it('gives each student one code, and adding it makes friends both ways', async () => {
    const ana = await register('friend-ana@example.com');
    const ben = await register('friend-ben@example.com');
    const first = await api('/api/friends', { token: ana.token });
    expect(first.status).toBe(200);
    expect(first.data.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect((await api('/api/friends', { token: ana.token })).data.code).toBe(first.data.code);

    // Typed with a dash and in lower case.
    const typed = `${first.data.code.slice(0, 4)}-${first.data.code.slice(4)}`.toLowerCase();
    const added = await api('/api/friends/add', { method: 'POST', token: ben.token, body: { code: typed } });
    expect(added.status).toBe(200);
    expect(added.data).toMatchObject({ alreadyFriends: false, friend: { id: ana.user.id, name: 'Test User' } });

    expect((await api('/api/friends', { token: ana.token })).data.friends.map((f) => f.id)).toEqual([ben.user.id]);
    expect((await api('/api/friends', { token: ben.token })).data.friends.map((f) => f.id)).toEqual([ana.user.id]);

    const again = await api('/api/friends/add', { method: 'POST', token: ben.token, body: { code: first.data.code } });
    expect(again.data.alreadyFriends).toBe(true);

    // Removing works both ways.
    expect((await api('/api/friends/remove', { method: 'POST', token: ana.token, body: { friendId: ben.user.id } })).status).toBe(200);
    expect((await api('/api/friends', { token: ana.token })).data.friends).toEqual([]);
    expect((await api('/api/friends', { token: ben.token })).data.friends).toEqual([]);
  });

  it('refuses your own code, unknown codes and malformed ones', async () => {
    const cy = await register('friend-cy@example.com');
    const { code } = (await api('/api/friends', { token: cy.token })).data;
    expect((await api('/api/friends/add', { method: 'POST', token: cy.token, body: { code } })).data.error).toMatch(/your own code/);
    expect((await api('/api/friends/add', { method: 'POST', token: cy.token, body: { code: 'O0O0O0O0' } })).status).toBe(400);
    const unknown = code === 'ZZZZZZZZ' ? 'YYYYYYYY' : 'ZZZZZZZZ';
    expect((await api('/api/friends/add', { method: 'POST', token: cy.token, body: { code: unknown } })).status).toBe(404);
  });

  it('shows friends only a name, avatar, streak, last study and today\'s minutes', async () => {
    const dee = await register('friend-dee@example.com');
    const eli = await register('friend-eli@example.com');
    const now = Date.now();
    await api('/api/sync/push', {
      method: 'POST',
      token: dee.token,
      body: {
        stats: { currentStreak: 6, todayMinutes: 25, xp: 900, lastActiveDate: '2026-11-21', lastStudiedAt: new Date(now - 3_600_000).toISOString() },
        sessions: [{ id: 'dee-deck', title: 'Secret deck', concepts: [] }],
      },
    });
    const { code } = (await api('/api/friends', { token: dee.token })).data;
    await api('/api/friends/add', { method: 'POST', token: eli.token, body: { code } });
    const [friend] = (await api('/api/friends', { token: eli.token })).data.friends;
    expect(Object.keys(friend).sort()).toEqual(['avatar', 'friendsSince', 'id', 'lastStudiedAt', 'name', 'pictureUrl', 'streak', 'todayMinutes', 'weekXp']);
    expect(friend).toMatchObject({ streak: 6, todayMinutes: 25 });

    // A streak whose last study was days ago has ended, whatever is stored.
    const { friendView } = await import('./routes/friendRoutes.js');
    const stale = friendView({ id: 'x', name: 'X', stats_json: JSON.stringify({ currentStreak: 6, todayMinutes: 25, lastStudiedAt: '2026-11-18T10:00:00Z' }) }, new Date('2026-11-22T10:00:00Z'));
    expect(stale).toMatchObject({ streak: 0, todayMinutes: 0, lastStudiedAt: '2026-11-18T10:00:00.000Z' });
  });

  it('stops at 50 friends', async () => {
    const { MAX_FRIENDS } = await import('./routes/friendRoutes.js');
    const popular = await register('friend-popular@example.com');
    const now = new Date().toISOString();
    for (let i = 0; i < MAX_FRIENDS; i++) {
      await db.run(
        `INSERT INTO users (id, name, email, provider, created_at, last_login_at) VALUES ($1, 'Fan', $2, 'password', $3, $3)`,
        [`fan-${i}`, `fan-${i}@example.com`, now],
      );
      await db.run('INSERT INTO friendships (user_id, friend_id, created_at) VALUES ($1, $2, $3)', [popular.user.id, `fan-${i}`, now]);
    }
    const newcomer = await register('friend-newcomer@example.com');
    const { code } = (await api('/api/friends', { token: newcomer.token })).data;
    const res = await api('/api/friends/add', { method: 'POST', token: popular.token, body: { code } });
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/already have 50 friends/);
  });
});

describe('duels between friends', () => {
  const questions = Array.from({ length: 5 }, (_, i) => ({ question: `Q${i}?`, options: [`A${i}`, `B${i}`, `C${i}`, `D${i}`], answerIndex: i % 4 }));
  const befriend = async (a, b) => {
    const { code } = (await api('/api/friends', { token: b.token })).data;
    await api('/api/friends/add', { method: 'POST', token: a.token, body: { code } });
  };

  it('grades both players on the same questions, and shows the answers only after playing', async () => {
    const ivy = await register('duel-ivy@example.com');
    const jo = await register('duel-jo@example.com');
    const stranger = await register('duel-stranger@example.com');
    await befriend(ivy, jo);

    const body = { friendId: jo.user.id, deckTitle: 'Cells', questions, answers: [0, 1, 2, 0, null], ms: 31_000 };
    expect((await api('/api/duels', { method: 'POST', token: ivy.token, body: { ...body, friendId: stranger.user.id } })).status).toBe(400);
    expect((await api('/api/duels', { method: 'POST', token: ivy.token, body: { ...body, questions: questions.slice(0, 3), answers: [0, 1, 2] } })).status).toBe(400);
    const sameChoices = questions.map((q) => ({ ...q, options: ['x', 'X', 'y', 'z'] }));
    expect((await api('/api/duels', { method: 'POST', token: ivy.token, body: { ...body, questions: sameChoices } })).status).toBe(400);

    const created = await api('/api/duels', { method: 'POST', token: ivy.token, body });
    expect(created.status).toBe(201);
    expect(created.data.duel).toMatchObject({ status: 'waiting', you: { score: 3 }, them: { score: null }, deckTitle: 'Cells' });

    // Jo sees the questions without the right answers, and not Ivy's score.
    const [incoming] = (await api('/api/duels', { token: jo.token })).data.duels;
    expect(incoming).toMatchObject({ status: 'your-turn', them: { name: 'Test User', score: null } });
    expect(incoming.questions[0]).toEqual({ question: 'Q0?', options: ['A0', 'B0', 'C0', 'D0'] });

    expect((await api(`/api/duels/${incoming.id}/play`, { method: 'POST', token: stranger.token, body: { answers: [0, 1, 2, 3, 0] } })).status).toBe(404);
    expect((await api(`/api/duels/${incoming.id}/play`, { method: 'POST', token: jo.token, body: { answers: [0, 1] } })).status).toBe(400);
    const played = await api(`/api/duels/${incoming.id}/play`, { method: 'POST', token: jo.token, body: { answers: [0, 1, 2, 3, 0], ms: 25_000 } });
    expect(played.status).toBe(200);
    expect(played.data.duel).toMatchObject({ status: 'done', you: { score: 5 }, them: { score: 3 } });
    expect(played.data.duel.questions[4]).toMatchObject({ answerIndex: 0, yourAnswer: 0, theirAnswer: null });

    // Once only.
    expect((await api(`/api/duels/${incoming.id}/play`, { method: 'POST', token: jo.token, body: { answers: [0, 0, 0, 0, 0] } })).status).toBe(409);
    const [result] = (await api('/api/duels', { token: ivy.token })).data.duels;
    expect(result).toMatchObject({ status: 'done', you: { score: 3 }, them: { score: 5 } });
  });

  it('expires a challenge after a week', async () => {
    const kim = await register('duel-kim@example.com');
    const lu = await register('duel-lu@example.com');
    await befriend(kim, lu);
    const created = await api('/api/duels', { method: 'POST', token: kim.token, body: { friendId: lu.user.id, deckTitle: 'Old', questions, answers: [0, 0, 0, 0, 0] } });
    await db.run("UPDATE duels SET expires_at = '2020-01-01T00:00:00Z' WHERE id = $1", [created.data.duel.id]);
    const [old] = (await api('/api/duels', { token: lu.token })).data.duels;
    expect(old.status).toBe('expired');
    expect((await api(`/api/duels/${old.id}/play`, { method: 'POST', token: lu.token, body: { answers: [0, 0, 0, 0, 0] } })).status).toBe(410);
  });

  it("shows a friend's XP for this week only", async () => {
    const { friendView, weekStartOf } = await import('./routes/friendRoutes.js');
    const now = new Date('2026-11-22T10:00:00Z'); // a Sunday: the week started Monday 16 November
    expect(weekStartOf(now)).toBe('2026-11-16');
    const row = (stats) => ({ id: 'x', name: 'X', stats_json: JSON.stringify(stats) });
    expect(friendView(row({ weekXp: 240, weekXpWeek: '2026-11-16' }), now).weekXp).toBe(240);
    expect(friendView(row({ weekXp: 240, weekXpWeek: '2026-11-09' }), now).weekXp).toBe(0);
  });
});

describe('weekly progress email', () => {
  it('turns on and off for a signed-in student, with a checked time zone', async () => {
    expect((await api('/api/digest')).status).toBe(401);
    const me = await register('digest-me@example.com');
    expect((await api('/api/digest', { token: me.token })).data).toMatchObject({ enabled: false, email: 'digest-me@example.com', available: true });
    expect((await api('/api/digest', { method: 'POST', token: me.token, body: { enabled: true, timeZone: 'Mars/Base' } })).status).toBe(400);
    expect((await api('/api/digest', { method: 'POST', token: me.token, body: { enabled: true, timeZone: 'Europe/Sofia' } })).status).toBe(200);
    expect((await api('/api/digest', { token: me.token })).data).toMatchObject({ enabled: true, timeZone: 'Europe/Sofia' });
    expect((await api('/api/digest', { method: 'POST', token: me.token, body: { enabled: false } })).status).toBe(200);
    expect((await api('/api/digest', { token: me.token })).data.enabled).toBe(false);
  });

  it('sends on Sunday evening where the student is, once a week, with their week in it', async () => {
    const { runDigests } = await import('./digest.js');
    await db.run('DELETE FROM digest_subscriptions');
    const me = await register('digest-week@example.com');
    await api('/api/digest', { method: 'POST', token: me.token, body: { enabled: true, timeZone: 'Asia/Tokyo' } });
    await api('/api/sync/push', {
      method: 'POST',
      token: me.token,
      body: {
        stats: { currentStreak: 4, lastStudiedAt: '2026-11-22T01:00:00.000Z' },
        sessions: [{
          id: 'digest-deck',
          title: 'Bio',
          concepts: [{ retrievalCards: [
            { id: 'd1', reps: 2, lastReviewDate: '2026-11-20T10:00:00.000Z', nextReviewDate: '2026-11-21T10:00:00.000Z' },
            { id: 'd2', reps: 1, lastReviewDate: '2026-11-21T10:00:00.000Z', nextReviewDate: '2026-12-01T10:00:00.000Z' },
            { id: 'd3', reps: 1, lastReviewDate: '2026-11-01T10:00:00.000Z', nextReviewDate: '2026-11-03T10:00:00.000Z', hidden: true },
          ] }],
        }],
        documents: {
          focus_log: { items: [{ id: 'f1', day: '2026-11-21', endedAt: '2026-11-21T09:00:00.000Z', minutes: 50 }, { id: 'f0', day: '2026-11-01', endedAt: '2026-11-01T09:00:00.000Z', minutes: 90 }] },
          planner: { items: [{ id: 'p1', kind: 'exam', title: 'Biology <final>', date: '2026-11-26' }, { id: 'p2', kind: 'homework', title: 'Done already', date: '2026-11-24', done: true }] },
        },
      },
    });

    const mailbox = [];
    const mailer = { send: async (mail) => void mailbox.push(mail) };
    // Saturday 20:00 in Tokyo, then Sunday 16:30: not yet.
    await runDigests({ now: new Date('2026-11-21T11:00:00Z'), mailer, siteUrl: 'https://app.example', apiUrl: 'https://api.example' });
    await runDigests({ now: new Date('2026-11-22T07:30:00Z'), mailer, siteUrl: 'https://app.example', apiUrl: 'https://api.example' });
    expect(mailbox).toHaveLength(0);
    // Sunday 17:05 in Tokyo.
    await runDigests({ now: new Date('2026-11-22T08:05:00Z'), mailer, siteUrl: 'https://app.example', apiUrl: 'https://api.example' });
    expect(mailbox).toHaveLength(1);
    const [mail] = mailbox;
    expect(mail.to).toBe('digest-week@example.com');
    expect(mail.subject).toBe('Your week: 2 cards reviewed, 50 min focused');
    expect(mail.text).toContain('Cards reviewed: 2');
    expect(mail.text).toContain('Focus time: 50 min');
    expect(mail.text).toContain('Streak: 4 days');
    expect(mail.text).toContain('Exam: Biology <final>, Thu 26 Nov (in 4 days)');
    expect(mail.text).not.toContain('Done already');
    expect(mail.text).toContain('1 card is due now.');
    expect(mail.text).toContain('https://app.example/?launch=quick_sprint');
    expect(mail.html).toContain('Biology &lt;final&gt;');
    expect(mail.headers['List-Unsubscribe']).toMatch(/^<https:\/\/api\.example\/api\/digest\/unsubscribe\?t=[\w-]+>$/);

    // Not twice in one week.
    await runDigests({ now: new Date('2026-11-22T12:00:00Z'), mailer, siteUrl: 'https://app.example', apiUrl: 'https://api.example' });
    expect(mailbox).toHaveLength(1);

    // The email's link turns it off without signing in.
    const link = mail.text.match(/https:\/\/api\.example(\/api\/digest\/unsubscribe\?t=[\w-]+)/)[1];
    const res = await fetch(`${baseUrl}${link}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("You won't get weekly emails any more");
    expect((await api('/api/digest', { token: me.token })).data.enabled).toBe(false);
  });

  it('writes a gentle email for a week without study, and leaves hidden cards out of reminders', async () => {
    const { digestEmail, weekSummary, isoWeekOf } = await import('./digest.js');
    const summary = weekSummary({ now: new Date('2026-11-22T10:00:00Z'), today: '2026-11-22' });
    const mail = digestEmail({ name: 'Sam Lee', summary, reviewUrl: 'https://app.example/?launch=quick_sprint', unsubscribeUrl: '', settingsUrl: 'https://app.example' });
    expect(mail.subject).toBe('Your Studify week');
    expect(mail.text).toMatch(/^Hi Sam,/);
    expect(mail.text).toContain('Turn these emails off in Settings');
    expect(isoWeekOf('2026-11-22')).toBe('2026-W47');
    expect(isoWeekOf('2027-01-01')).toBe('2026-W53');

    const { countDueCards } = await import('./reminders.js');
    const hider = await register('digest-hider@example.com');
    await api('/api/sync/push', {
      method: 'POST',
      token: hider.token,
      body: { sessions: [{ id: 'hider-deck', title: 'Bio', concepts: [{ retrievalCards: [{ id: 'h1', reps: 2, nextReviewDate: '2026-11-01T00:00:00Z', hidden: true }, { id: 'h2', reps: 2, nextReviewDate: '2026-11-01T00:00:00Z' }] }] }] },
    });
    expect(await countDueCards(hider.user.id, new Date('2026-11-22T00:00:00Z'))).toBe(1);
  });
});

describe('AI proxy', () => {
  it('requires sign-in', async () => {
    const res = await api('/api/ai/generate', { method: 'POST', body: { contents: 'hi' } });
    expect(res.status).toBe(401);
  });

  it('enforces the per-user daily quota', async () => {
    const user = await register('quota@example.com');
    const call = () => api('/api/ai/generate', { method: 'POST', token: user.token, body: { contents: 'hi' } });
    expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(429);
  });
});

describe('a guest\'s free AI deck', () => {
  let schemas;
  beforeAll(async () => { schemas = await import('./aiSchemas.js'); });

  const getPass = async () => {
    const res = await api('/api/ai/guest-pass', { method: 'POST' });
    expect(res.status).toBe(200);
    return res.data.pass;
  };
  const deckRequest = (pass, schema = schemas.STUDY_SESSION_GENERATION_SCHEMA) =>
    api('/api/ai/generate', {
      method: 'POST',
      headers: { 'X-Guest-Pass': pass },
      body: { contents: 'Photosynthesis', responseMimeType: 'application/json', responseSchema: schema },
    });

  it('writes and checks one deck without an account', async () => {
    const pass = await getPass();
    expect((await deckRequest(pass)).status).toBe(200);
    expect((await deckRequest(pass, schemas.DECK_REVIEW_SCHEMA)).status).toBe(200);
  });

  it('serves only deck requests, and only a few of them', async () => {
    const pass = await getPass();
    const chat = await api('/api/ai/generate', { method: 'POST', headers: { 'X-Guest-Pass': pass }, body: { contents: 'hi' } });
    expect(chat.status).toBe(403);
    const stream = await api('/api/ai/stream', { method: 'POST', headers: { 'X-Guest-Pass': pass }, body: { contents: 'hi' } });
    expect(stream.status).toBe(403);
    for (let i = 0; i < 4; i++) expect((await deckRequest(pass)).status).toBe(200);
    expect((await deckRequest(pass)).status).toBe(429);
  });

  it('is not a login, and a login is not a pass', async () => {
    const pass = await getPass();
    expect((await api('/api/sync/pull', { token: pass })).status).toBe(401);
    expect((await api('/api/ai/generate', { method: 'POST', token: pass, body: { contents: 'hi' } })).status).toBe(401);
    const user = await register('not-a-pass@example.com');
    expect((await deckRequest(user.token)).status).toBe(401);
    expect((await deckRequest('forged.pass.value')).status).toBe(401);
  });

  it('gives a network only a few passes a day', async () => {
    rateLimit.configureLimits({ guestPass: { max: 1, windowMs: 60_000 } });
    try {
      expect((await api('/api/ai/guest-pass', { method: 'POST' })).status).toBe(200);
      expect((await api('/api/ai/guest-pass', { method: 'POST' })).status).toBe(429);
    } finally {
      rateLimit.configureLimits();
    }
  });
});

describe('community decks', () => {
  it('gives a shared deck a public page only once it passed the check, is 3 days old and unreported', async () => {
    const author = await register('pages@example.com');
    const reader = await register('pages-reader@example.com');
    const bigDeck = { concepts: [{ title: 'Atoms', retrievalCards: Array.from({ length: 12 }, (_, i) => ({ question: `Atom fact ${i}?`, answer: `Answer ${i}` })) }] };
    const original = fakeAi.generateContent;
    fakeAi.generateContent = async () => JSON.stringify({ verdict: 'ok' });
    const share = (title, extra = {}) =>
      api('/api/decks/share', { method: 'POST', token: author.token, body: { title, description: 'Twelve facts about atoms for the chemistry quiz.', session: bigDeck, rightsConfirmed: true, ...extra } });
    let good, reported, fresh, small;
    try {
      good = (await share('Page deck')).data;
      reported = (await share('Reported deck')).data;
      fresh = (await share('Fresh deck')).data;
      small = (await share('Small deck', { session: SHAREABLE_DECK })).data;
    } finally {
      fakeAi.generateContent = original;
    }
    const unchecked = (await share('Unchecked deck')).data; // the AI's answer wasn't a verdict
    const old = new Date(Date.now() - 4 * 86_400_000).toISOString();
    for (const deck of [good, reported, small, unchecked]) await db.run('UPDATE shared_decks SET created_at = $1 WHERE slug = $2', [old, deck.slug]);
    await api(`/api/decks/${reported.slug}/report`, { method: 'POST', token: reader.token, body: { reason: 'Wrong answers' } });

    const pages = (await api('/api/decks/public-pages')).data.decks;
    const slugs = pages.map((deck) => deck.slug);
    expect(slugs).toContain(good.slug);
    for (const deck of [reported, fresh, small, unchecked]) expect(slugs).not.toContain(deck.slug);
    const page = pages.find((deck) => deck.slug === good.slug);
    expect(page.concepts[0].cards).toHaveLength(12);
    expect(page.author).toBe('a Studify student');
    expect(JSON.stringify(page)).not.toContain('reps');

    expect((await api(`/api/decks/${good.slug}/visible`)).status).toBe(200);
    await api(`/api/decks/${good.slug}`, { method: 'DELETE', token: author.token });
    expect((await api(`/api/decks/${good.slug}/visible`)).status).toBe(404);
  });

  it('shows the author by first name and initial, and nobody under 16 by name', async () => {
    const adult = await register('ada@example.com');
    await api('/api/auth/me', { method: 'PATCH', token: adult.token, body: { name: 'Ada Lovelace', age: 19 } });
    const teen = await register('teen@example.com'); // ages default to 15
    const share = (user, title) => api('/api/decks/share', { method: 'POST', token: user.token, body: { title, session: SHAREABLE_DECK, rightsConfirmed: true } });

    const byAdult = await share(adult, 'Named deck');
    expect(byAdult.status).toBe(201);
    expect(byAdult.data.shareUrl).toBe(`/?shared=${byAdult.data.slug}`);
    expect((await share(teen, 'Unnamed deck')).status).toBe(201);

    const list = (await api('/api/decks/public?q=deck')).data.decks;
    const authorOf = (title) => list.find((deck) => deck.title === title)?.author_name;
    expect(authorOf('Named deck')).toBe('Ada L.');
    expect(authorOf('Unnamed deck')).toBe('a Studify student');
    expect(JSON.stringify(list)).not.toContain('Lovelace');
  });

  it('needs the rights confirmed and real cards, and lists your shared decks', async () => {
    const user = await register('sharer@example.com');
    const share = (body) => api('/api/decks/share', { method: 'POST', token: user.token, body: { title: 'Mine', session: SHAREABLE_DECK, ...body } });
    expect((await share({ rightsConfirmed: false })).status).toBe(400);
    expect((await share({ rightsConfirmed: true, session: { concepts: [] } })).status).toBe(400);
    const ok = await share({ rightsConfirmed: true });
    expect(ok.status).toBe(201);
    const mine = await api('/api/decks/mine', { token: user.token });
    expect(mine.data.decks.map((deck) => deck.slug)).toEqual([ok.data.slug]);
    expect((await api('/api/decks/mine')).status).toBe(401);
  });

  it('refuses a deck the content check finds unsafe', async () => {
    const user = await register('unsafe@example.com');
    const original = fakeAi.generateContent;
    fakeAi.generateContent = async () => JSON.stringify({ verdict: 'unsafe', reason: 'It lists a classmate\'s phone number.' });
    try {
      const res = await api('/api/decks/share', { method: 'POST', token: user.token, body: { title: 'Bad', session: SHAREABLE_DECK, rightsConfirmed: true } });
      expect(res.status).toBe(422);
      expect(res.data.error).toContain("classmate's phone number");
    } finally {
      fakeAi.generateContent = original;
    }
  });

  it('requires sign-in to publish, and counts one like per user', async () => {
    const anon = await api('/api/decks/share', { method: 'POST', body: { title: 'T', session: {} } });
    expect(anon.status).toBe(401);

    const author = await register('author@example.com');
    const fan = await register('fan@example.com');
    const shared = await api('/api/decks/share', {
      method: 'POST',
      token: author.token,
      body: { title: 'Cell Biology', session: SHAREABLE_DECK, rightsConfirmed: true },
    });
    expect(shared.status).toBe(201);

    const like = () => api(`/api/decks/${shared.data.deckId}/like`, { method: 'POST', token: fan.token });
    expect((await like()).data.likes).toBe(1);
    expect((await like()).data.likes).toBe(1);

    // Viewing a deck no longer inflates its like count.
    const viewed = await api(`/api/decks/${shared.data.slug}`);
    expect(viewed.data.deck.likes).toBe(1);

    const anonLike = await api(`/api/decks/${shared.data.deckId}/like`, { method: 'POST' });
    expect(anonLike.status).toBe(401);
  });
});

describe('CORS', () => {
  it('does not reflect untrusted origins', async () => {
    const res = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'https://evil.example.com' } });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();

    const ok = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'http://localhost:5173' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });
});

describe('error reports from the app', () => {
  it('writes a checked report to the log as one line, and refuses anything else', async () => {
    const lines = [];
    const warn = console.warn;
    console.warn = (...args) => lines.push(args.join(' '));
    try {
      const report = { kind: 'error', message: 'TypeError: x is undefined', stack: 'TypeError: x is undefined\n    at render (index-abc.js:1:2)', path: '/', build: 'abc123' };
      expect((await api('/api/client-errors', { method: 'POST', body: report })).status).toBe(204);
      expect(lines.at(-1)).toBe('[ClientError] error build=abc123 path=/ TypeError: x is undefined | TypeError: x is undefined | at render (index-abc.js:1:2)');
      expect((await api('/api/client-errors', { method: 'POST', body: { ...report, kind: 'other' } })).status).toBe(400);
      expect((await api('/api/client-errors', { method: 'POST', body: { ...report, message: 'x'.repeat(600) } })).status).toBe(400);
    } finally {
      console.warn = warn;
    }
  });
});

describe('compression', () => {
  const rawGet = (path, headers) =>
    new Promise((resolve, reject) => {
      http.get(`${baseUrl}${path}`, { headers }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ headers: res.headers, body: Buffer.concat(chunks) }));
      }).on('error', reject);
    });

  it('gzips large JSON answers when the browser accepts it, and only then', async () => {
    const zlib = await import('node:zlib');
    const me = await register('gzip-me@example.com');
    const deck = { id: 'gzip-deck', title: 'Big', concepts: [{ retrievalCards: Array.from({ length: 200 }, (_, i) => ({ id: `g${i}`, question: `Question ${i}?`, answer: `Answer ${i}` })) }] };
    await api('/api/sync/push', { method: 'POST', token: me.token, body: { sessions: [deck] } });

    const zipped = await rawGet('/api/sync/pull', { Authorization: `Bearer ${me.token}`, 'Accept-Encoding': 'gzip' });
    expect(zipped.headers['content-encoding']).toBe('gzip');
    expect(zipped.headers.vary).toMatch(/Accept-Encoding/);
    const pulled = JSON.parse(zlib.gunzipSync(zipped.body).toString());
    expect(pulled.sessions[0].concepts[0].retrievalCards).toHaveLength(200);

    const plain = await rawGet('/api/sync/pull', { Authorization: `Bearer ${me.token}` });
    expect(plain.headers['content-encoding']).toBeUndefined();
    expect(JSON.parse(plain.body.toString()).sessions).toHaveLength(1);
    expect(plain.body.length).toBeGreaterThan(zipped.body.length * 3);

    // Small answers aren't worth it.
    const health = await rawGet('/api/health', { 'Accept-Encoding': 'gzip' });
    expect(health.headers['content-encoding']).toBeUndefined();
  });
});

describe('security headers', () => {
  it('are on every response, including errors and preflights', async () => {
    for (const res of [
      await fetch(`${baseUrl}/api/health`),
      await fetch(`${baseUrl}/api/auth/me`),
      await fetch(`${baseUrl}/api/nope`),
      await fetch(`${baseUrl}/api/health`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } }),
    ]) {
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
  });
});

describe('database', () => {
  it('applies its migrations once and reports healthy', async () => {
    const applied = await db.all('SELECT id FROM schema_migrations');
    expect(applied.map((row) => row.id)).toEqual(['001_initial', '002_lock_down_tables', '003_ai_pools_and_deck_reports', '004_calendar_feeds', '005_user_documents', '006_resets_and_reminders', '007_friends_and_digest', '008_duels', '009_deck_sharing_privacy']);

    const health = await api('/api/health');
    expect(health.status).toBe(200);
    expect(health.data).toMatchObject({ status: 'ok', db: 'connected' });
  });

  it('locks every table against the Supabase public web API', async () => {
    const open = await db.all(
      "SELECT relname FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND NOT relrowsecurity",
    );
    expect(open).toEqual([]);
  });

  it('rolls a transaction back when it fails part-way', async () => {
    await expect(
      db.tx(async (t) => {
        await t.run("INSERT INTO ai_usage (user_id, day, count) VALUES ('nobody', '2026-01-01', 1)");
      }),
    ).rejects.toThrow(); // no such user: the foreign key refuses it
    const owner = await register('rollback@example.com');
    await expect(
      db.tx(async (t) => {
        await t.run("INSERT INTO ai_usage (user_id, day, count) VALUES ($1, '2026-01-01', 1)", [owner.user.id]);
        throw new Error('stop');
      }),
    ).rejects.toThrow('stop');
    expect(await db.one('SELECT * FROM ai_usage WHERE user_id = $1', [owner.user.id])).toBeNull();
  });
});

describe('sign-up and login limits', () => {
  it('limits sign-ups from one address', async () => {
    rateLimit.configureLimits({ register: { max: 2, windowMs: 60_000 } });
    try {
      const attempt = (n) =>
        api('/api/auth/register', { method: 'POST', body: { name: 'Limit Test', email: `limit${n}@example.com`, password: 'correct-horse' } });
      expect((await attempt(1)).status).toBe(201);
      expect((await attempt(2)).status).toBe(201);
      expect((await attempt(3)).status).toBe(429);
    } finally {
      rateLimit.configureLimits();
    }
  });

  it('stops password guessing on one account, but not other accounts, and a success clears the count', async () => {
    await register('guessme@example.com');
    await register('innocent@example.com');
    rateLimit.configureLimits({ loginEmail: { max: 3, windowMs: 60_000 } });
    try {
      const login = (email, password) => api('/api/auth/login', { method: 'POST', body: { email, password } });
      for (let i = 0; i < 3; i++) expect((await login('guessme@example.com', 'wrong')).status).toBe(401);
      // Even the right password is refused for now, so a guesser can't keep trying.
      expect((await login('guessme@example.com', 'correct-horse')).status).toBe(429);
      expect((await login('innocent@example.com', 'correct-horse')).status).toBe(200);

      rateLimit.configureLimits({ loginEmail: { max: 3, windowMs: 60_000 } });
      await login('guessme@example.com', 'wrong');
      await login('guessme@example.com', 'wrong');
      expect((await login('guessme@example.com', 'correct-horse')).status).toBe(200);
      // The successful sign-in cleared the count, so two more wrong guesses are still answered normally.
      expect((await login('guessme@example.com', 'wrong')).status).toBe(401);
      expect((await login('guessme@example.com', 'wrong')).status).toBe(401);
    } finally {
      rateLimit.configureLimits();
    }
  });

  it('lets only one of several simultaneous sign-ups with the same email through', async () => {
    const attempt = () =>
      api('/api/auth/register', { method: 'POST', body: { name: 'Twin', email: 'twin@example.com', password: 'correct-horse' } });
    const statuses = (await Promise.all([attempt(), attempt(), attempt()])).map((res) => res.status).sort();
    expect(statuses).toEqual([201, 400, 400]);
  });
});

describe('client address', () => {
  const request = (forwarded, remote = '10.0.0.9') => ({ headers: { 'x-forwarded-for': forwarded }, socket: { remoteAddress: remote } });

  it('trusts only the entry added by our own proxy, not what the client put in front', () => {
    expect(rateLimit.clientIp(request('6.6.6.6, 203.0.113.7'))).toBe('203.0.113.7');
    expect(rateLimit.clientIp(request('203.0.113.7'))).toBe('203.0.113.7');
  });

  it('falls back to the socket when there is no header', () => {
    expect(rateLimit.clientIp({ headers: {}, socket: { remoteAddress: '10.0.0.9' } })).toBe('10.0.0.9');
  });
});

describe('Google sign-in onto a password account', () => {
  it('drops the password of an account made for an email the signer-in now proves they own', async () => {
    await register('pat@example.com'); // someone signed up with Pat's email and a password
    const google = await api('/api/auth/google', { method: 'POST', body: { credential: signGoogleToken({ sub: 'pat-sub', email: 'pat@example.com' }) } });
    expect(google.status).toBe(200);
    expect(google.data.user.provider).toBe('google');

    const old = await api('/api/auth/login', { method: 'POST', body: { email: 'pat@example.com', password: 'correct-horse' } });
    expect(old.status).toBe(401);
  });

  it('keeps one account for a person who signs in with Google twice at once', async () => {
    const token = () => signGoogleToken({ sub: 'zed-sub', email: 'zed@example.com' });
    const [a, b] = await Promise.all([
      api('/api/auth/google', { method: 'POST', body: { credential: token() } }),
      api('/api/auth/google', { method: 'POST', body: { credential: token() } }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.data.user.id).toBe(b.data.user.id);
  });
});

describe('deleting an account', () => {
  it('needs the confirmation word and, for a password account, the password', async () => {
    const user = await register('leaving@example.com');
    const del = (body, token = user.token) => api('/api/auth/me', { method: 'DELETE', token, body });

    expect((await del({}, null)).status).toBe(401);
    expect((await del({})).status).toBe(400);
    expect((await del({ confirm: 'DELETE' })).status).toBe(401);
    expect((await del({ confirm: 'DELETE', password: 'wrong' })).status).toBe(401);
    expect((await api('/api/auth/me', { token: user.token })).status).toBe(200);
  });

  it('removes the account and its synced data, and keeps shared decks without the name', async () => {
    const user = await register('gone@example.com');
    await api('/api/sync/push', { method: 'POST', token: user.token, body: { sessions: [{ id: 'sess_gone', title: 'Mine' }], stats: { xp: 5 } } });
    const shared = await api('/api/decks/share', { method: 'POST', token: user.token, body: { title: 'Orphan Deck', session: SHAREABLE_DECK, rightsConfirmed: true } });

    const del = await api('/api/auth/me', { method: 'DELETE', token: user.token, body: { confirm: 'DELETE', password: 'correct-horse' } });
    expect(del.status).toBe(200);

    expect((await api('/api/auth/me', { token: user.token })).status).toBe(401);
    expect((await api('/api/auth/login', { method: 'POST', body: { email: 'gone@example.com', password: 'correct-horse' } })).status).toBe(401);
    expect(await db.one("SELECT 1 FROM study_sessions WHERE id = 'sess_gone'")).toBeNull();
    expect(await db.one('SELECT 1 FROM user_stats WHERE user_id = $1', [user.user.id])).toBeNull();

    const deck = await api(`/api/decks/${shared.data.slug}`);
    expect(deck.data.deck.authorName).toBe('Deleted user');
  });
});

describe('sync keeps tokens out of the server', () => {
  it('stores how the avatar looks and nothing else', async () => {
    const user = await register('look@example.com');
    await api('/api/sync/push', {
      method: 'POST',
      token: user.token,
      body: {
        stats: { xp: 1 },
        characterState: {
          name: 'Ada',
          hairColor: '#123456',
          hairStyle: '<script>',
          coins: 999999,
          level: 99,
          unlockedItems: ['crown'],
        },
      },
    });
    const pulled = await api('/api/sync/pull', { token: user.token });
    expect(pulled.data.characterState).toEqual({ name: 'Ada', hairColor: '#123456' });
    expect(pulled.data).not.toHaveProperty('axolotlState');
  });

  it("doesn't fail on a session with a made-up date", async () => {
    const user = await register('baddate@example.com');
    const pushed = await api('/api/sync/push', { method: 'POST', token: user.token, body: { sessions: [{ id: 'sess_date', createdAt: 'not a date' }] } });
    expect(pushed.status).toBe(200);
  });
});

describe('daily AI quota', () => {
  it('holds when requests arrive at the same moment', async () => {
    const user = await register('burst@example.com');
    const call = () => api('/api/ai/generate', { method: 'POST', token: user.token, body: { contents: 'hi' } });
    const statuses = (await Promise.all([call(), call(), call(), call(), call()])).map((res) => res.status).sort();
    expect(statuses).toEqual([200, 200, 429, 429, 429]);
  });
});

describe('community deck search', () => {
  it('treats % and _ as plain characters, and refuses a malformed address', async () => {
    const author = await register('search@example.com');
    await api('/api/decks/share', { method: 'POST', token: author.token, body: { title: '100% Chemistry', session: SHAREABLE_DECK, rightsConfirmed: true } });
    await api('/api/decks/share', { method: 'POST', token: author.token, body: { title: 'Plain Physics', session: SHAREABLE_DECK, rightsConfirmed: true } });

    const percent = await api('/api/decks/public?q=%25');
    expect(percent.data.decks.map((deck) => deck.title)).toEqual(['100% Chemistry']);
    const found = await api('/api/decks/public?q=physics');
    expect(found.data.decks.map((deck) => deck.title)).toEqual(['Plain Physics']);

    expect((await api('/api/decks/%E0%A4%A')).status).toBe(400);
  });
});

describe('CORS in production', () => {
  it('allows no website until ALLOWED_ORIGINS is set', async () => {
    const { createApp } = await import('./app.js');
    const previous = { env: process.env.NODE_ENV, origins: process.env.ALLOWED_ORIGINS };
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOWED_ORIGINS;
    const unset = http.createServer(createApp({ ai: fakeAi }));
    process.env.ALLOWED_ORIGINS = 'https://app.example.com/';
    const configured = http.createServer(createApp({ ai: fakeAi }));
    process.env.NODE_ENV = previous.env;
    if (previous.origins === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = previous.origins;

    const allowedOrigin = async (instance, origin) => {
      await new Promise((resolve) => instance.listen(0, '127.0.0.1', resolve));
      try {
        const res = await fetch(`http://127.0.0.1:${instance.address().port}/api/health`, { headers: { Origin: origin } });
        return res.headers.get('access-control-allow-origin');
      } finally {
        await new Promise((resolve) => instance.close(resolve));
      }
    };

    expect(await allowedOrigin(unset, 'http://localhost:5173')).toBeNull();
    expect(await allowedOrigin(configured, 'https://app.example.com')).toBe('https://app.example.com');
  });
});

describe('AI proxy request checks', () => {
  it("takes only the app's own schemas, text and images, and refusals don't use up the quota", async () => {
    const { STUDY_SESSION_GENERATION_SCHEMA } = await import('./aiSchemas.js');
    const user = await register('guard@example.com');
    const call = (body) => api('/api/ai/generate', { method: 'POST', token: user.token, body });

    expect((await call({ contents: 'hi', responseSchema: { type: 'OBJECT', properties: { anything: { type: 'STRING' } } } })).status).toBe(400);
    expect((await call({ contents: 'x'.repeat(200_001) })).status).toBe(400);
    expect((await call({ contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'application/pdf', data: 'AAAA' } }] }] })).status).toBe(400);
    expect((await call({ contents: [{ role: 'user', parts: [{ fileData: { fileUri: 'gs://bucket/file' } }] }] })).status).toBe(400);
    expect((await call({ contents: 'hi', responseMimeType: 'text/x-python' })).status).toBe(400);

    // The quota is 2 in these tests, so both of these going through shows the refusals above were free.
    expect((await call({ contents: 'Make a deck', responseMimeType: 'application/json', responseSchema: STUDY_SESSION_GENERATION_SCHEMA })).status).toBe(200);
    expect((await call({ contents: [{ role: 'user', parts: [{ text: 'Grade this' }, { inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgo=' } }] }] })).status).toBe(200);
  });

  it('takes short WAV clips and one public YouTube link, and nothing else of the kind', async () => {
    const { checkAiRequest } = await import('./aiGuard.js');
    const { hasVideo } = await import('./ai.js');
    const parts = (...p) => ({ contents: [{ role: 'user', parts: [{ text: 'Write out the lecture' }, ...p] }] });
    const video = { fileData: { fileUri: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, videoMetadata: { endOffset: '3600s' } };

    expect(checkAiRequest(parts({ inlineData: { mimeType: 'audio/wav', data: 'UklGRg==' } })).request).toBeDefined();
    expect(checkAiRequest(parts(video)).request).toBeDefined();
    expect(hasVideo(parts(video).contents)).toBe(true);
    expect(hasVideo(parts({ text: 'x' }).contents)).toBe(false);

    expect(checkAiRequest(parts({ inlineData: { mimeType: 'audio/webm', data: 'AAAA' } })).error).toBeDefined();
    expect(checkAiRequest(parts({ inlineData: { mimeType: 'audio/wav', data: 'A'.repeat(6_000_000) } })).error).toMatch(/under 4 MB/);
    expect(checkAiRequest(parts({ fileData: { fileUri: 'https://evil.example/watch?v=dQw4w9WgXcQ' } })).error).toBeDefined();
    expect(checkAiRequest(parts({ fileData: { fileUri: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', mimeType: 'video/mp4' } })).error).toBeDefined();
    expect(checkAiRequest(parts({ ...video, videoMetadata: { fps: 30 } })).error).toBeDefined();
    expect(checkAiRequest(parts(video, video)).error).toMatch(/One video/);
  });

  it('takes no response schema on the stream', async () => {
    const { FEYNMAN_EVALUATION_SCHEMA } = await import('./aiSchemas.js');
    const user = await register('stream-guard@example.com');
    const res = await api('/api/ai/stream', { method: 'POST', token: user.token, body: { contents: 'hi', responseSchema: FEYNMAN_EVALUATION_SCHEMA } });
    expect(res.status).toBe(400);
  });
});

describe('shared AI limits beyond one account', () => {
  const withEnv = async (vars, fn) => {
    const previous = Object.fromEntries(Object.keys(vars).map((key) => [key, process.env[key]]));
    Object.assign(process.env, vars);
    try {
      await fn();
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  };
  const ask = (user, ip) =>
    api('/api/ai/generate', { method: 'POST', token: user.token, body: { contents: 'hi' }, headers: { 'X-Forwarded-For': ip } });

  it('shares one daily limit between accounts on the same network', async () => {
    await withEnv({ AI_IP_DAILY_QUOTA: '3' }, async () => {
      const first = await register('net-a@example.com');
      const second = await register('net-b@example.com');
      expect((await ask(first, '203.0.113.7')).status).toBe(200);
      expect((await ask(first, '203.0.113.7')).status).toBe(200);
      expect((await ask(second, '203.0.113.7')).status).toBe(200);
      const blocked = await ask(second, '203.0.113.7');
      expect(blocked.status).toBe(429);
      expect(blocked.data.error).toMatch(/this network/);
      // Another network is unaffected, and the refused request did not count against the account.
      expect((await ask(second, '198.51.100.4')).status).toBe(200);
    });
  });

  it('stops at the service-wide daily limit', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const used = (await db.one("SELECT count FROM ai_usage_pools WHERE pool = 'all' AND day = $1", [day]))?.count ?? 0;
    await withEnv({ AI_GLOBAL_DAILY_QUOTA: String(used + 1) }, async () => {
      const user = await register('global@example.com');
      expect((await ask(user, '192.0.2.1')).status).toBe(200);
      const blocked = await ask(user, '192.0.2.1');
      expect(blocked.status).toBe(429);
      expect(blocked.data.error).toMatch(/shared AI service/);
    });
  });
});

describe('cloud sync limits', () => {
  it('refuses a push that would take an account past its deck limit, and saves none of it', async () => {
    const user = await register('hoarder@example.com');
    const sessions = Array.from({ length: 2001 }, (_, i) => ({ id: `hoard-${i}`, title: 'T' }));
    const refused = await api('/api/sync/push', { method: 'POST', token: user.token, body: { sessions } });
    expect(refused.status).toBe(413);
    expect((await api('/api/sync/pull', { token: user.token })).data.sessions).toEqual([]);

    const saved = await api('/api/sync/push', { method: 'POST', token: user.token, body: { sessions: sessions.slice(0, 10) } });
    expect(saved.status).toBe(200);
  });
});

describe('community deck moderation', () => {
  const publish = (user, title = 'A deck') =>
    api('/api/decks/share', { method: 'POST', token: user.token, body: { title, session: SHAREABLE_DECK, rightsConfirmed: true } });

  it('hides a deck once three different people report it', async () => {
    const author = await register('mod-author@example.com');
    const shared = await publish(author, 'Spam deck');
    const readers = [await register('r1@example.com'), await register('r2@example.com'), await register('r3@example.com')];
    const report = (user, reason = 'Spam') =>
      api(`/api/decks/${shared.data.deckId}/report`, { method: 'POST', token: user.token, body: { reason } });

    expect((await api(`/api/decks/${shared.data.deckId}/report`, { method: 'POST', body: { reason: 'Spam' } })).status).toBe(401);
    expect((await report(author)).status).toBe(400);
    expect((await report(readers[0], '')).status).toBe(400);
    expect((await report(readers[0])).status).toBe(200);
    expect((await report(readers[0])).status).toBe(200); // the same person twice still counts once
    expect((await report(readers[1])).status).toBe(200);
    expect((await api(`/api/decks/${shared.data.slug}`)).status).toBe(200);

    expect((await report(readers[2])).status).toBe(200);
    expect((await api(`/api/decks/${shared.data.slug}`)).status).toBe(404);
    expect((await api('/api/decks/public?q=Spam%20deck')).data.decks).toEqual([]);
    expect((await api(`/api/decks/${shared.data.deckId}/like`, { method: 'POST', token: readers[0].token })).status).toBe(404);
  });

  it('lets only the author delete a deck', async () => {
    const author = await register('deck-owner@example.com');
    const other = await register('deck-stranger@example.com');
    const shared = await publish(author);
    const remove = (token) => api(`/api/decks/${shared.data.deckId}`, { method: 'DELETE', token });

    expect((await remove(undefined)).status).toBe(401);
    expect((await remove(other.token)).status).toBe(404);
    expect((await remove(author.token)).status).toBe(200);
    expect((await api(`/api/decks/${shared.data.slug}`)).status).toBe(404);
  });

  it('limits deck size and how many decks one account publishes a day', async () => {
    const author = await register('prolific@example.com');
    expect((await publish(author, 'x'.repeat(121))).status).toBe(400);
    const big = await api('/api/decks/share', {
      method: 'POST',
      token: author.token,
      body: { title: 'Huge', session: { ...SHAREABLE_DECK, notes: 'x'.repeat(2 * 1024 * 1024) }, rightsConfirmed: true },
    });
    expect(big.status).toBe(413);

    for (let i = 0; i < 20; i++) expect((await publish(author, `Deck ${i}`)).status).toBe(201);
    expect((await publish(author, 'One too many')).status).toBe(429);
  });
});

describe('calendar feed', () => {
  const ICS = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Studify//Planner//EN\r\nEND:VCALENDAR\r\n';
  const feedUrl = (token) => `${baseUrl}/api/calendar/feed.ics?token=${encodeURIComponent(token)}`;

  it('serves the latest planner at a private link until it is reset or turned off', async () => {
    const student = await register('planner@example.com');
    expect((await api('/api/calendar/feed', { token: student.token })).data.token).toBeNull();

    const first = await api('/api/calendar/feed', { method: 'PUT', token: student.token, body: { ics: ICS } });
    expect(first.status).toBe(200);
    const token = first.data.token;
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);

    const updated = ICS.replace('END:VCALENDAR', 'X-WR-CALNAME:Updated\r\nEND:VCALENDAR');
    const second = await api('/api/calendar/feed', { method: 'PUT', token: student.token, body: { ics: updated } });
    expect(second.data.token).toBe(token);

    const feed = await fetch(feedUrl(token));
    expect(feed.status).toBe(200);
    expect(feed.headers.get('content-type')).toBe('text/calendar; charset=utf-8');
    expect(await feed.text()).toBe(updated);

    const reset = await api('/api/calendar/feed/reset', { method: 'POST', token: student.token });
    expect(reset.data.token).not.toBe(token);
    expect((await fetch(feedUrl(token))).status).toBe(404);
    expect((await fetch(feedUrl(reset.data.token))).status).toBe(200);

    expect((await api('/api/calendar/feed', { method: 'DELETE', token: student.token })).status).toBe(200);
    expect((await fetch(feedUrl(reset.data.token))).status).toBe(404);
  });

  it('needs an account to change the feed, and takes only a calendar file', async () => {
    expect((await api('/api/calendar/feed', { method: 'PUT', body: { ics: ICS } })).status).toBe(401);
    const student = await register('planner-checks@example.com');
    const put = (ics) => api('/api/calendar/feed', { method: 'PUT', token: student.token, body: { ics } });
    expect((await put('<html>hi</html>')).status).toBe(400);
    expect((await put(ICS.replace('VERSION', 'X'.repeat(600 * 1024)))).status).toBe(400);
    expect((await fetch(feedUrl(''))).status).toBe(404);
    expect((await fetch(feedUrl('not-a-token'))).status).toBe(404);
  });

  it('goes with the account', async () => {
    const student = await register('planner-leaving@example.com');
    const { data } = await api('/api/calendar/feed', { method: 'PUT', token: student.token, body: { ics: ICS } });
    expect((await api('/api/auth/me', { method: 'DELETE', token: student.token, body: { confirm: 'DELETE', password: 'correct-horse' } })).status).toBe(200);
    expect((await fetch(feedUrl(data.token))).status).toBe(404);
  });
});
