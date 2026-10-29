/**
 * Studify HTTP request handler.
 *
 * Kept separate from index.js (which only loads env and listens) so tests can
 * drive the handler directly with an in-memory database.
 */

import { URL } from 'node:url';
import { db } from './db.js'; // Importing it connects and migrates the database first
import { getAuthUser } from './auth.js';
import { handleAuthRoutes } from './routes/authRoutes.js';
import { handleSyncRoutes } from './routes/syncRoutes.js';
import { handleDeckRoutes } from './routes/deckRoutes.js';
import { handleCalendarRoutes } from './routes/calendarRoutes.js';
import * as defaultAi from './ai.js';
import { checkAiRequest } from './aiGuard.js';
import { clientIp } from './rateLimit.js';

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5MB

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://localhost:5175'];

function getAllowedOrigins() {
  const configured = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  if (configured.length > 0) return new Set(configured);
  if (process.env.NODE_ENV === 'production') {
    console.warn('[Server] ALLOWED_ORIGINS is not set: no website can call this API from a browser. Set it to your site, e.g. https://app.example.com');
    return new Set();
  }
  return new Set(DEFAULT_ALLOWED_ORIGINS);
}

function setCorsHeaders(req, res, allowedOrigins) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  }
}

/**
 * Headers for every API response: the browser must not sniff types or frame
 * it, it sends no referrer onwards, and nothing in between may store it
 * (responses carry accounts, sync data and session tokens).
 */
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify(payload));
}

/**
 * Guards the shared Gemini proxy: signed-in users only, burst rate limit,
 * and a persistent daily quota. Returns the user, or null after responding.
 */
async function authorizeAiRequest(req, res, ai) {
  const user = await getAuthUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'Sign in to use the shared AI service, or add your own Gemini API key in Settings.' });
    return null;
  }
  if (!ai.isAiConfigured()) {
    sendJson(res, 503, { error: 'Server AI Gateway is not configured with GEMINI_API_KEY.' });
    return null;
  }
  if (!ai.checkRateLimit(user.id)) {
    sendJson(res, 429, { error: 'Rate limit exceeded. Please wait a moment before sending more AI requests.' });
    return null;
  }
  const spent = await ai.consumeDailyQuota(user.id, clientIp(req));
  if (spent) {
    sendJson(res, 429, { error: `${QUOTA_MESSAGES[spent]} It resets at midnight UTC, or add your own Gemini API key in Settings.` });
    return null;
  }
  return user;
}

const QUOTA_MESSAGES = {
  user: 'Daily AI limit reached.',
  ip: 'Daily AI limit reached for this network.',
  all: 'The shared AI service has reached its daily limit.',
};

export function createApp({ ai = defaultAi } = {}) {
  const allowedOrigins = getAllowedOrigins();

  return async function handleRequest(req, res) {
    const startTime = Date.now();
    setSecurityHeaders(res);
    setCorsHeaders(req, res, allowedOrigins);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const searchParams = parsedUrl.searchParams;

    // Read JSON body for POST / PUT / PATCH / DELETE
    let body = null;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      try {
        const chunks = [];
        let totalSize = 0;
        for await (const chunk of req) {
          totalSize += chunk.length;
          if (totalSize > MAX_BODY_BYTES) {
            return sendJson(res, 413, { error: 'Payload too large (exceeds 5MB limit).' });
          }
          chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks).toString('utf8');
        if (raw.trim()) {
          body = JSON.parse(raw);
        }
      } catch {
        return sendJson(res, 400, { error: 'Malformed JSON payload.' });
      }
    }

    // Response tracking logger
    const originalEnd = res.end;
    res.end = function (...args) {
      const duration = Date.now() - startTime;
      if (process.env.NODE_ENV !== 'test') {
        console.log(`[${new Date().toISOString()}] ${req.method} ${pathname} -> ${res.statusCode} (${duration}ms)`);
      }
      return originalEnd.apply(this, args);
    };

    try {
      // 1. HEALTH CHECK
      if (pathname === '/api/health' && req.method === 'GET') {
        let dbOk = true;
        try {
          await db.one('SELECT 1 AS ok');
        } catch (err) {
          dbOk = false;
          console.error('[Server] Health check: database unreachable:', err.message);
        }
        return sendJson(res, dbOk ? 200 : 503, {
          status: dbOk ? 'ok' : 'degraded',
          version: '1.0.0',
          uptime: Math.floor(process.uptime()),
          timestamp: Date.now(),
          db: dbOk ? 'connected' : 'unreachable',
          aiProxyAvailable: ai.isAiConfigured(),
        });
      }

      // 2. AI PROXY GATEWAYS (REST & SSE STREAMING) — signed-in users only
      if (pathname === '/api/ai/generate' && req.method === 'POST') {
        // Checked before the quota, so a malformed request doesn't use one up.
        const { request, error } = checkAiRequest(body);
        if (error) return sendJson(res, 400, { error });
        if (!(await authorizeAiRequest(req, res, ai))) return;

        try {
          const text = await ai.generateContent(request);
          return sendJson(res, 200, { success: true, text });
        } catch (aiErr) {
          console.error('[Server AI Proxy] Error:', aiErr);
          return sendJson(res, 502, { error: 'AI generation failed. Please try again.' });
        }
      }

      if (pathname === '/api/ai/stream' && req.method === 'POST') {
        const { request, error } = checkAiRequest(body, { stream: true });
        if (error) return sendJson(res, 400, { error });
        if (!(await authorizeAiRequest(req, res, ai))) return;

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        try {
          for await (const chunk of ai.generateContentStream(request)) {
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
          }
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        } catch (streamErr) {
          console.error('[Server AI Stream] Error:', streamErr);
          res.write(`data: ${JSON.stringify({ error: 'Streaming failed. Please try again.' })}\n\n`);
        }
        return res.end();
      }

      // 3. AUTHENTICATION ROUTES
      if (await handleAuthRoutes(req, res, pathname, body)) {
        return;
      }

      // 4. CLOUD SYNC ROUTES
      if (await handleSyncRoutes(req, res, pathname, body)) {
        return;
      }

      // 5. COMMUNITY DECK ROUTES
      if (await handleDeckRoutes(req, res, pathname, body, searchParams)) {
        return;
      }

      // 6. CALENDAR FEED ROUTES
      if (await handleCalendarRoutes(req, res, pathname, body, searchParams)) {
        return;
      }

      return sendJson(res, 404, { error: `Route not found: ${req.method} ${pathname}` });
    } catch (error) {
      console.error('[Server] Unhandled route error:', error);
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'Internal server error.' });
      }
    }
  };
}
