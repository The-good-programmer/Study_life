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

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
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

const fakeAi = {
  isAiConfigured: () => true,
  checkRateLimit: () => true,
  consumeDailyQuota: undefined, // filled in beforeAll with the real DB-backed quota
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

  server = http.createServer(createApp({ ai: fakeAi }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  auth.setGoogleKeyFetcher(null);
  auth.setGoogleAccessTokenFetchers(null);
  await new Promise((resolve) => server.close(resolve));
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

describe('community decks', () => {
  it('requires sign-in to publish, and counts one like per user', async () => {
    const anon = await api('/api/decks/share', { method: 'POST', body: { title: 'T', session: {} } });
    expect(anon.status).toBe(401);

    const author = await register('author@example.com');
    const fan = await register('fan@example.com');
    const shared = await api('/api/decks/share', {
      method: 'POST',
      token: author.token,
      body: { title: 'Cell Biology', session: { concepts: [] } },
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

describe('database', () => {
  it('applies its migrations once and reports healthy', async () => {
    const applied = await db.all('SELECT id FROM schema_migrations');
    expect(applied.map((row) => row.id)).toEqual(['001_initial', '002_lock_down_tables']);

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
    const shared = await api('/api/decks/share', { method: 'POST', token: user.token, body: { title: 'Orphan Deck', session: { concepts: [] } } });

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
    await api('/api/decks/share', { method: 'POST', token: author.token, body: { title: '100% Chemistry', session: { concepts: [] } } });
    await api('/api/decks/share', { method: 'POST', token: author.token, body: { title: 'Plain Physics', session: { concepts: [] } } });

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
