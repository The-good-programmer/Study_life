/**
 * Studify HTTP request handler.
 *
 * Kept separate from index.js (which only loads env and listens) so tests can
 * drive the handler directly with an in-memory database.
 */

import { URL } from 'node:url';
import './db.js'; // Initialize database tables
import { getAuthUser } from './auth.js';
import { handleAuthRoutes } from './routes/authRoutes.js';
import { handleSyncRoutes } from './routes/syncRoutes.js';
import { handleDeckRoutes } from './routes/deckRoutes.js';
import * as defaultAi from './ai.js';

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5MB

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://localhost:5175'];

function getAllowedOrigins() {
  const configured = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return new Set(configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS);
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

// Basic hardening for API responses. The browser app's own CSP lives in its HTML.
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
function authorizeAiRequest(req, res, ai) {
  const user = getAuthUser(req);
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
  if (!ai.consumeDailyQuota(user.id)) {
    sendJson(res, 429, { error: 'Daily AI limit reached. It resets at midnight UTC, or add your own Gemini API key in Settings.' });
    return null;
  }
  return user;
}

function isValidContents(contents) {
  return Boolean(contents) && (typeof contents === 'string' || Array.isArray(contents) || typeof contents === 'object');
}

export function createApp({ ai = defaultAi } = {}) {
  const allowedOrigins = getAllowedOrigins();

  return async function handleRequest(req, res) {
    const startTime = Date.now();
    setCorsHeaders(req, res, allowedOrigins);
    setSecurityHeaders(res);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const searchParams = parsedUrl.searchParams;

    // Read JSON body for POST / PUT / PATCH
    let body = null;
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
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
        return sendJson(res, 200, {
          status: 'ok',
          version: '1.0.0',
          uptime: Math.floor(process.uptime()),
          timestamp: Date.now(),
          db: 'connected',
          aiProxyAvailable: ai.isAiConfigured(),
        });
      }

      // 2. AI PROXY GATEWAYS (REST & SSE STREAMING) — signed-in users only
      if (pathname === '/api/ai/generate' && req.method === 'POST') {
        if (!authorizeAiRequest(req, res, ai)) return;

        const { contents, responseMimeType, enableThinking, responseSchema } = body || {};
        if (!isValidContents(contents)) {
          return sendJson(res, 400, { error: 'contents prompt or payload is required.' });
        }

        try {
          const text = await ai.generateContent({ contents, responseMimeType, enableThinking, responseSchema });
          return sendJson(res, 200, { success: true, text });
        } catch (aiErr) {
          console.error('[Server AI Proxy] Error:', aiErr);
          return sendJson(res, 502, { error: 'AI generation failed. Please try again.' });
        }
      }

      if (pathname === '/api/ai/stream' && req.method === 'POST') {
        if (!authorizeAiRequest(req, res, ai)) return;

        const { contents, responseMimeType, enableThinking } = body || {};
        if (!isValidContents(contents)) {
          return sendJson(res, 400, { error: 'contents prompt or payload is required.' });
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        try {
          for await (const chunk of ai.generateContentStream({ contents, responseMimeType, enableThinking })) {
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
      if (handleSyncRoutes(req, res, pathname, body)) {
        return;
      }

      // 5. COMMUNITY DECK ROUTES
      if (handleDeckRoutes(req, res, pathname, body, searchParams)) {
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
