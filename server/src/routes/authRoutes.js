/**
 * Authentication Route Handlers
 */

import crypto from 'node:crypto';
import { db } from '../db.js';
import { generateSalt, hashPassword, verifyPassword, createToken, getAuthUser, verifyGoogleIdToken, verifyGoogleAccessToken } from '../auth.js';

const INVALID_LOGIN = 'Invalid email or password.';

export async function handleAuthRoutes(req, res, pathname, body) {
  // 1. REGISTER
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    const { name, email, password, age, country, grade, avatar, institution } = body || {};

    if (!name || name.trim().length < 2) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Full name must be at least 2 characters long.' }));
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Please enter a valid email address.' }));
    }

    if (!password || password.length < 6) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Password must be at least 6 characters long.' }));
    }

    const checkStmt = db.prepare('SELECT id FROM users WHERE email = ?');
    const existing = checkStmt.get(cleanEmail);
    if (existing) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'An account with this email address already exists. Please log in.' }));
    }

    const salt = generateSalt();
    const passHash = hashPassword(password, salt);
    const userId = `usr_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const insertStmt = db.prepare(`
      INSERT INTO users (id, name, email, provider, password_hash, password_salt, age, country, grade, avatar, institution, created_at, last_login_at)
      VALUES (?, ?, ?, 'password', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      userId,
      name.trim(),
      cleanEmail,
      passHash,
      salt,
      Number(age) || 15,
      (country || 'United States').trim(),
      (grade || '9th Grade').trim(),
      avatar || '🧠',
      institution?.trim() || null,
      now,
      now
    );

    const user = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      provider: 'password',
      age: Number(age) || 15,
      country: (country || 'United States').trim(),
      grade: (grade || '9th Grade').trim(),
      avatar: avatar || '🧠',
      institution: institution?.trim() || undefined,
      createdAt: now,
      lastLoginAt: now,
    };

    const token = createToken(user);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, user, token }));
  }

  // 2. LOGIN
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const { email, password } = body || {};
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Please provide both email and password.' }));
    }

    const findStmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const userRow = findStmt.get(cleanEmail);

    // Same response for unknown email, Google-only account and wrong password,
    // so the endpoint does not reveal which emails are registered.
    if (!userRow || !verifyPassword(password, userRow)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: INVALID_LOGIN }));
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, userRow.id);

    const user = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      provider: userRow.provider,
      pictureUrl: userRow.picture_url,
      age: userRow.age,
      country: userRow.country,
      grade: userRow.grade,
      avatar: userRow.avatar,
      institution: userRow.institution || undefined,
      createdAt: userRow.created_at,
      lastLoginAt: now,
    };

    const token = createToken(user);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, user, token }));
  }

  // 3. GOOGLE OAUTH
  if (pathname === '/api/auth/google' && req.method === 'POST') {
    // Identity comes only from the Google-signed ID token, never from client-supplied fields.
    const { credential, accessToken, age, country, grade, avatar, institution } = body || {};

    if (!(process.env.GOOGLE_CLIENT_ID || '').trim()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Google sign-in is not configured on the server.' }));
    }

    let identity = null;
    try {
      identity = credential
        ? await verifyGoogleIdToken(credential)
        : await verifyGoogleAccessToken(accessToken);
    } catch (err) {
      console.error('[Auth] Google ID token verification failed:', err);
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Could not verify Google sign-in right now. Please try again.' }));
    }

    if (!identity) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid or expired Google credential.' }));
    }

    const { googleId, email: cleanEmail, name, pictureUrl } = identity;

    const findStmt = db.prepare('SELECT * FROM users WHERE email = ? OR (google_id IS NOT NULL AND google_id = ?)');
    let userRow = findStmt.get(cleanEmail, googleId || '');

    const now = new Date().toISOString();

    if (userRow) {
      db.prepare(`
        UPDATE users SET
          last_login_at = ?,
          google_id = COALESCE(google_id, ?),
          picture_url = COALESCE(picture_url, ?)
        WHERE id = ?
      `).run(now, googleId || null, pictureUrl || null, userRow.id);

      userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userRow.id);
    } else {
      const userId = `usr_g_${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO users (id, name, email, provider, google_id, picture_url, age, country, grade, avatar, institution, created_at, last_login_at)
        VALUES (?, ?, ?, 'google', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        (name || cleanEmail.split('@')[0]).trim(),
        cleanEmail,
        googleId || null,
        pictureUrl || null,
        Number(age) || 15,
        (country || 'United States').trim(),
        (grade || '9th Grade').trim(),
        avatar || '🌐',
        institution?.trim() || null,
        now,
        now
      );

      userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    }

    const user = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      provider: userRow.provider,
      pictureUrl: userRow.picture_url,
      age: userRow.age,
      country: userRow.country,
      grade: userRow.grade,
      avatar: userRow.avatar,
      institution: userRow.institution || undefined,
      createdAt: userRow.created_at,
      lastLoginAt: now,
    };

    const token = createToken(user);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, user, token }));
  }

  // 4. ME (CURRENT USER PROFILE)
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized. Invalid or missing authentication token.' }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        provider: user.provider,
        pictureUrl: user.picture_url,
        age: user.age,
        country: user.country,
        grade: user.grade,
        avatar: user.avatar,
        institution: user.institution || undefined,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      }
    }));
  }

  return false;
}
