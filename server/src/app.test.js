import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import crypto from 'node:crypto';

const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';
process.env.JWT_SECRET = 'x'.repeat(48);
process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
process.env.AI_DAILY_QUOTA = '2';

let server;
let baseUrl;
let auth;

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
