/**
 * Studify Server Authentication & Token Engine
 * Zero-dependency cryptography using native node:crypto.
 */

import crypto from 'node:crypto';
import { db } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'studify_dev_jwt_secret_change_in_production_998877665544332211';

export function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

export function hashPassword(password, salt) {
  // PBKDF2 with 100,000 iterations to match client-side Web Crypto PBKDF2
  const derived = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  return 'pbkdf2$' + derived.toString('hex');
}

export function verifyPassword(password, user) {
  if (!user.password_hash || !user.password_salt) return false;

  if (user.password_hash.startsWith('pbkdf2$')) {
    const computed = hashPassword(password, user.password_salt);
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(user.password_hash));
  }

  // Legacy SHA-256 fallback
  const legacyHash = crypto.createHash('sha256').update(user.password_salt + password).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(legacyHash), Buffer.from(user.password_hash));
}

function base64UrlEncode(str) {
  return Buffer.from(str)
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
  return Buffer.from(base64, 'base64').toString('utf8');
}

export function createToken(user, expiresInSec = 60 * 60 * 24 * 30) { // 30 days
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSec,
  };

  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encHeader}.${encPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encHeader}.${encPayload}.${signature}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encHeader, encPayload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encHeader}.${encPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSig) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encPayload));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

export function getAuthUser(req) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7).trim();
  const payload = verifyToken(token);
  if (!payload || !payload.sub) return null;

  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const user = stmt.get(payload.sub);
  return user || null;
}
