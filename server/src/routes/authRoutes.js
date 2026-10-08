/**
 * Authentication Route Handlers
 */

import crypto from 'node:crypto';
import { db, isUniqueViolation } from '../db.js';
import { generateSalt, hashPassword, verifyPassword, createToken, getAuthUser, verifyGoogleIdToken, verifyGoogleAccessToken } from '../auth.js';
import { clientIp, limiters } from '../rateLimit.js';

const INVALID_LOGIN = 'Invalid email or password.';
const TOO_MANY = 'Too many attempts. Please wait a few minutes and try again.';

// Hashed for an unknown email, so a missing account takes as long to reject as a wrong password.
const DUMMY_SALT = generateSalt();

function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify(payload));
}

function tooManyAttempts(res) {
  res.setHeader('Retry-After', '600');
  return send(res, 429, { error: TOO_MANY });
}

const iso = (value) => (value instanceof Date ? value.toISOString() : value);

/** The account as sent to the app (never includes password data). */
function publicUser(row, lastLoginAt = row.last_login_at) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    provider: row.provider,
    pictureUrl: row.picture_url,
    age: row.age,
    country: row.country,
    grade: row.grade,
    avatar: row.avatar,
    institution: row.institution || undefined,
    createdAt: iso(row.created_at),
    lastLoginAt: iso(lastLoginAt),
  };
}

export async function handleAuthRoutes(req, res, pathname, body) {
  // 1. REGISTER
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    if (!limiters.register.take(clientIp(req))) return tooManyAttempts(res);

    const { name, email, password, age, country, grade, avatar, institution } = body || {};

    if (typeof name !== 'string' || name.trim().length < 2) {
      return send(res, 400, { error: 'Full name must be at least 2 characters long.' });
    }

    const cleanEmail = (typeof email === 'string' ? email : '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return send(res, 400, { error: 'Please enter a valid email address.' });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return send(res, 400, { error: 'Password must be at least 6 characters long.' });
    }
    if (password.length > 200) {
      return send(res, 400, { error: 'Password must be at most 200 characters long.' });
    }

    const alreadyRegistered = { error: 'An account with this email address already exists. Please log in.' };
    if (await db.one('SELECT id FROM users WHERE email = $1', [cleanEmail])) {
      return send(res, 400, alreadyRegistered);
    }

    const salt = generateSalt();
    const passHash = await hashPassword(password, salt);
    const userId = `usr_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    try {
      await db.run(
        `INSERT INTO users (id, name, email, provider, password_hash, password_salt, age, country, grade, avatar, institution, created_at, last_login_at)
         VALUES ($1, $2, $3, 'password', $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
        [
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
        ],
      );
    } catch (err) {
      // Two sign-ups with the same email at once: the second one loses.
      if (isUniqueViolation(err)) return send(res, 400, alreadyRegistered);
      throw err;
    }

    const user = publicUser(await db.one('SELECT * FROM users WHERE id = $1', [userId]));
    return send(res, 201, { success: true, user, token: createToken(user) });
  }

  // 2. LOGIN
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const { email, password } = body || {};
    const cleanEmail = (typeof email === 'string' ? email : '').trim().toLowerCase();

    if (!cleanEmail || typeof password !== 'string' || !password) {
      return send(res, 400, { error: 'Please provide both email and password.' });
    }

    const ip = clientIp(req);
    const emailKey = `${ip}|${cleanEmail}`;
    if (!limiters.login.take(ip) || !limiters.loginEmail.take(emailKey)) return tooManyAttempts(res);

    const userRow = await db.one('SELECT * FROM users WHERE email = $1', [cleanEmail]);

    // Same response, and the same work, for an unknown email, a Google-only account and a wrong
    // password, so the endpoint does not reveal which emails are registered.
    const valid = userRow ? await verifyPassword(password, userRow) : (await hashPassword(password, DUMMY_SALT), false);
    if (!valid) {
      return send(res, 401, { error: INVALID_LOGIN });
    }
    limiters.loginEmail.reset(emailKey);

    const now = new Date().toISOString();
    await db.run('UPDATE users SET last_login_at = $1 WHERE id = $2', [now, userRow.id]);

    const user = publicUser(userRow, now);
    return send(res, 200, { success: true, user, token: createToken(user) });
  }

  // 3. GOOGLE OAUTH
  if (pathname === '/api/auth/google' && req.method === 'POST') {
    if (!limiters.google.take(clientIp(req))) return tooManyAttempts(res);

    // Identity comes only from the Google-signed ID token, never from client-supplied fields.
    const { credential, accessToken, age, country, grade, avatar, institution } = body || {};

    if (!(process.env.GOOGLE_CLIENT_ID || '').trim()) {
      return send(res, 503, { error: 'Google sign-in is not configured on the server.' });
    }

    let identity = null;
    try {
      identity = credential
        ? await verifyGoogleIdToken(credential)
        : await verifyGoogleAccessToken(accessToken);
    } catch (err) {
      console.error('[Auth] Google ID token verification failed:', err);
      return send(res, 503, { error: 'Could not verify Google sign-in right now. Please try again.' });
    }

    if (!identity) {
      return send(res, 401, { error: 'Invalid or expired Google credential.' });
    }

    const { googleId, email: cleanEmail, name, pictureUrl } = identity;
    const find = () =>
      db.one('SELECT * FROM users WHERE email = $1 OR (google_id IS NOT NULL AND google_id = $2)', [cleanEmail, googleId || '']);

    let userRow = await find();
    const now = new Date().toISOString();

    if (userRow) {
      // Google has just proven who owns this email. An account made earlier with a password for that email
      // never proved it, so its password is dropped: whoever set it can't keep access to what the
      // real owner now earns here.
      const claimsUnverifiedAccount = !userRow.google_id && userRow.provider === 'password';
      await db.run(
        `UPDATE users SET
           last_login_at = $1,
           google_id = COALESCE(google_id, $2),
           picture_url = COALESCE(picture_url, $3),
           password_hash = CASE WHEN $4 THEN NULL ELSE password_hash END,
           password_salt = CASE WHEN $4 THEN NULL ELSE password_salt END,
           provider = CASE WHEN $4 THEN 'google' ELSE provider END
         WHERE id = $5`,
        [now, googleId || null, pictureUrl || null, claimsUnverifiedAccount, userRow.id],
      );
      userRow = await db.one('SELECT * FROM users WHERE id = $1', [userRow.id]);
    } else {
      const userId = `usr_g_${crypto.randomUUID()}`;
      try {
        await db.run(
          `INSERT INTO users (id, name, email, provider, google_id, picture_url, age, country, grade, avatar, institution, created_at, last_login_at)
           VALUES ($1, $2, $3, 'google', $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
          [
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
          ],
        );
        userRow = await db.one('SELECT * FROM users WHERE id = $1', [userId]);
      } catch (err) {
        // The same person signing in twice at once: the first insert won, so use that account.
        if (!isUniqueViolation(err)) throw err;
        userRow = await find();
      }
    }

    const user = publicUser(userRow, now);
    return send(res, 200, { success: true, user, token: createToken(user) });
  }

  // 4. ME (CURRENT USER PROFILE)
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const user = await getAuthUser(req);
    if (!user) {
      return send(res, 401, { error: 'Unauthorized. Invalid or missing authentication token.' });
    }
    return send(res, 200, { user: publicUser(user) });
  }

  // 5. DELETE MY ACCOUNT: removes the account and everything synced to it. Decks shared with the
  // community stay up, with the author's name removed.
  if (pathname === '/api/auth/me' && req.method === 'DELETE') {
    const user = await getAuthUser(req);
    if (!user) {
      return send(res, 401, { error: 'Unauthorized. Invalid or missing authentication token.' });
    }
    if (body?.confirm !== 'DELETE') {
      return send(res, 400, { error: 'Send {"confirm":"DELETE"} to confirm deleting your account.' });
    }
    if (user.password_hash) {
      // Password accounts also prove the password, so a stolen session token can't delete the account.
      if (typeof body.password !== 'string' || !(await verifyPassword(body.password, user))) {
        return send(res, 401, { error: 'Enter your password to delete your account.' });
      }
    }

    await db.tx(async (t) => {
      await t.run("UPDATE shared_decks SET author_name = 'Deleted user' WHERE author_id = $1", [user.id]);
      await t.run('DELETE FROM users WHERE id = $1', [user.id]);
    });
    return send(res, 200, { success: true });
  }

  return false;
}
