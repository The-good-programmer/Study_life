/**
 * Studify Server Authentication & Token Engine
 * Zero-dependency cryptography using native node:crypto.
 */

import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db.js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const MIN_SECRET_LENGTH = 32;
const TOKEN_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

function resolveJwtSecret() {
  const configured = (process.env.JWT_SECRET || '').trim();
  if (configured.length >= MIN_SECRET_LENGTH) {
    return configured;
  }

  if (IS_PRODUCTION) {
    console.error(
      `[Auth] FATAL: JWT_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters in production.\n` +
      `       Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
    process.exit(1);
  }

  console.warn(
    '[Auth] JWT_SECRET is not set (or too short). Using a random per-process secret for development; ' +
    'all login tokens will be invalidated when the server restarts.'
  );
  return crypto.randomBytes(48).toString('hex');
}

const JWT_SECRET = resolveJwtSecret();

export function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

const pbkdf2 = promisify(crypto.pbkdf2);

/** PBKDF2 with 100,000 iterations (to match client-side Web Crypto PBKDF2), off the main thread. */
export async function hashPassword(password, salt) {
  const derived = await pbkdf2(password, salt, 100000, 32, 'sha256');
  return 'pbkdf2$' + derived.toString('hex');
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function verifyPassword(password, user) {
  if (!user.password_hash || !user.password_salt) return false;

  if (user.password_hash.startsWith('pbkdf2$')) {
    return safeEqual(await hashPassword(password, user.password_salt), user.password_hash);
  }

  // Legacy SHA-256 fallback
  const legacyHash = crypto.createHash('sha256').update(user.password_salt + password).digest('hex');
  return safeEqual(legacyHash, user.password_hash);
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

function signHs256(data) {
  return base64UrlEncode(crypto.createHmac('sha256', JWT_SECRET).update(data).digest());
}

export function createToken(user, expiresInSec = TOKEN_TTL_SEC) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    iat: now,
    exp: now + expiresInSec,
  };

  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encHeader}.${encPayload}.${signHs256(`${encHeader}.${encPayload}`)}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encHeader, encPayload, signature] = parts;

  try {
    const header = JSON.parse(base64UrlDecode(encHeader).toString('utf8'));
    if (!header || header.alg !== 'HS256') return null;
  } catch {
    return null;
  }

  if (!safeEqual(signature, signHs256(`${encHeader}.${encPayload}`))) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encPayload).toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Missing or expired
    }
    return payload;
  } catch {
    return null;
  }
}

export async function getAuthUser(req) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7).trim();
  const payload = verifyToken(token);
  if (!payload || !payload.sub) return null;

  return db.one('SELECT * FROM users WHERE id = $1', [payload.sub]);
}

// ─── Google ID token verification ────────────────────────────────────────────

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

let googleKeyCache = { keys: null, expiresAt: 0 };

async function fetchGoogleKeysFromNetwork() {
  const now = Date.now();
  if (googleKeyCache.keys && now < googleKeyCache.expiresAt) {
    return googleKeyCache.keys;
  }

  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Google signing keys (${res.status})`);
  }
  const { keys } = await res.json();
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1]) || 3600;
  googleKeyCache = { keys, expiresAt: now + maxAge * 1000 };
  return keys;
}

let fetchGoogleKeys = fetchGoogleKeysFromNetwork;

/** Test hook: replace the JWKS source (pass null to restore the network fetcher). */
export function setGoogleKeyFetcher(fn) {
  fetchGoogleKeys = fn || fetchGoogleKeysFromNetwork;
  googleKeyCache = { keys: null, expiresAt: 0 };
}

async function fetchTokenInfoFromNetwork(accessToken) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
  if (res.status === 400) return null; // invalid or expired token
  if (!res.ok) throw new Error(`Google tokeninfo failed (${res.status})`);
  return res.json();
}

async function fetchUserInfoFromNetwork(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.ok ? res.json() : {};
}

let fetchTokenInfo = fetchTokenInfoFromNetwork;
let fetchUserInfo = fetchUserInfoFromNetwork;

/** Test hook: replace the access-token lookups (pass null to restore network fetchers). */
export function setGoogleAccessTokenFetchers(fns) {
  fetchTokenInfo = fns?.tokenInfo || fetchTokenInfoFromNetwork;
  fetchUserInfo = fns?.userInfo || fetchUserInfoFromNetwork;
}

/**
 * Verifies an OAuth access token from the Google sign-in popup. The token must
 * have been issued to this app's client ID (so tokens minted for other apps
 * are rejected). Returns the trusted claims, or null.
 */
export async function verifyGoogleAccessToken(accessToken) {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  if (!clientId || !accessToken || typeof accessToken !== 'string') return null;

  const info = await fetchTokenInfo(accessToken);
  if (!info) return null;
  if (info.aud !== clientId && info.azp !== clientId) return null;
  if (info.email_verified !== true && info.email_verified !== 'true') return null;
  if (!info.email || !info.sub) return null;
  if (Number(info.exp) && Number(info.exp) < Math.floor(Date.now() / 1000)) return null;

  const profile = await fetchUserInfo(accessToken);
  return {
    googleId: String(info.sub),
    email: String(info.email).trim().toLowerCase(),
    name: profile?.name ? String(profile.name) : undefined,
    pictureUrl: profile?.picture ? String(profile.picture) : undefined,
  };
}

/**
 * Verifies a Google Identity Services ID token (the `credential` returned by
 * One Tap / the Sign-In button). Returns the trusted claims, or null.
 */
export async function verifyGoogleIdToken(credential) {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  if (!clientId || !credential || typeof credential !== 'string') return null;

  const parts = credential.split('.');
  if (parts.length !== 3) return null;
  const [encHeader, encPayload, encSignature] = parts;

  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlDecode(encHeader).toString('utf8'));
    payload = JSON.parse(base64UrlDecode(encPayload).toString('utf8'));
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || !header.kid) return null;

  const keys = await fetchGoogleKeys();
  const jwk = (keys || []).find((k) => k.kid === header.kid);
  if (!jwk) return null;

  let valid = false;
  try {
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    valid = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${encHeader}.${encPayload}`),
      publicKey,
      base64UrlDecode(encSignature)
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  const now = Math.floor(Date.now() / 1000);
  if (!GOOGLE_ISSUERS.has(payload.iss)) return null;
  if (payload.aud !== clientId) return null;
  if (!payload.exp || payload.exp < now) return null;
  if (payload.email_verified !== true && payload.email_verified !== 'true') return null;
  if (!payload.email || !payload.sub) return null;

  return {
    googleId: String(payload.sub),
    email: String(payload.email).trim().toLowerCase(),
    name: payload.name ? String(payload.name) : undefined,
    pictureUrl: payload.picture ? String(payload.picture) : undefined,
  };
}
