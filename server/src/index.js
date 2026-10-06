/**
 * Studify Dedicated Production Backend & AI Gateway Server
 * 
 * Capabilities:
 * - SQLite Database via node:sqlite (zero C++ dependencies)
 * - Authenticated JWT & PBKDF2 Password Identity Engine
 * - Google OAuth Integration
 * - Secure Google Gemini AI Proxy (Streaming / Structured JSON)
 * - Cross-device Delta & Cloud Sync
 * - Community Deck Marketplace
 */

import http from 'node:http';
import { URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './db.js'; // Initialize database tables
import { handleAuthRoutes } from './routes/authRoutes.js';
import { handleSyncRoutes } from './routes/syncRoutes.js';
import { handleDeckRoutes } from './routes/deckRoutes.js';
import { generateContent, generateContentStream, isAiConfigured, checkRateLimit } from './ai.js';

// Simple .env loader if .env file exists in server directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
    console.log('[Server] Loaded configuration from server/.env');
  } catch (err) {
    console.warn('[Server] Failed to read .env file:', err);
  }
}

const PORT = Number(process.env.PORT) || 3001;

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

const server = http.createServer(async (req, res) => {
  const startTime = Date.now();
  setCorsHeaders(req, res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;

  // Log incoming request
  const ip = req.socket.remoteAddress || 'unknown';

  // Read JSON body for POST / PUT / PATCH
  let body = null;
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    try {
      const chunks = [];
      let totalSize = 0;
      for await (const chunk of req) {
        totalSize += chunk.length;
        if (totalSize > 15 * 1024 * 1024) { // 15MB payload safety limit
          res.writeHead(413, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Payload too large (exceeds 15MB limit).' }));
        }
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.trim()) {
        body = JSON.parse(raw);
      }
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Malformed JSON payload.' }));
    }
  }

  // Response tracking logger
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] ${req.method} ${pathname} -> ${res.statusCode} (${duration}ms)`);
    return originalEnd.apply(this, args);
  };

  try {
    // 1. HEALTH CHECK
    if (pathname === '/api/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'ok',
        version: '1.0.0',
        uptime: Math.floor(process.uptime()),
        timestamp: Date.now(),
        db: 'connected',
        aiProxyAvailable: isAiConfigured(),
      }));
    }

    // 2. AI PROXY GATEWAYS (REST & SSE STREAMING)
    if (pathname === '/api/ai/generate' && req.method === 'POST') {
      if (!checkRateLimit(ip)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment before sending more AI requests.' }));
      }

      const { contents, responseMimeType, enableThinking, responseSchema } = body || {};
      if (!contents || (typeof contents !== 'string' && !Array.isArray(contents) && typeof contents !== 'object')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'contents prompt or payload is required.' }));
      }

      try {
        const text = await generateContent({ contents, responseMimeType, enableThinking, responseSchema });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, text }));
      } catch (aiErr) {
        console.error('[Server AI Proxy] Error:', aiErr);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: aiErr instanceof Error ? aiErr.message : 'AI generation failed' }));
      }
    }

    if (pathname === '/api/ai/stream' && req.method === 'POST') {
      if (!checkRateLimit(ip)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment.' }));
      }

      const { contents, responseMimeType, enableThinking } = body || {};
      if (!contents || (typeof contents !== 'string' && !Array.isArray(contents) && typeof contents !== 'object')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'contents prompt or payload is required.' }));
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      try {
        for await (const chunk of generateContentStream({ contents, responseMimeType, enableThinking })) {
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      } catch (streamErr) {
        console.error('[Server AI Stream] Error:', streamErr);
        res.write(`data: ${JSON.stringify({ error: streamErr instanceof Error ? streamErr.message : 'Streaming failed' })}\n\n`);
        res.end();
      }
      return;
    }

    // 3. AUTHENTICATION ROUTES
    if (handleAuthRoutes(req, res, pathname, body)) {
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

    // 404 NOT FOUND
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: `Route not found: ${req.method} ${pathname}` }));
  } catch (error) {
    console.error('[Server] Unhandled route error:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error.' }));
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🎓 STUDIFY BACKEND & AI GATEWAY SERVER                      ║
║                                                               ║
║   Status:    ACTIVE & LISTENING                               ║
║   Port:      http://localhost:${PORT}                           ║
║   Health:    http://localhost:${PORT}/api/health                ║
║   AI Proxy:  ${isAiConfigured() ? 'CONFIGURED (Active)' : 'WAITING FOR GEMINI_API_KEY in server/.env'} ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});
