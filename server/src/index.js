/**
 * Studify Backend & AI Gateway Server
 *
 * Capabilities:
 * - PostgreSQL (DATABASE_URL), or an embedded Postgres for local development
 * - Authenticated JWT & PBKDF2 Password Identity Engine
 * - Google OAuth Integration (server-verified ID tokens)
 * - Secure Google Gemini AI Proxy (Streaming / Structured JSON), signed-in users only
 * - Cross-device Delta & Cloud Sync
 * - Community Deck Marketplace
 */

import './env.js'; // Must stay first: loads server/.env before other modules read process.env
import http from 'node:http';
import { createApp } from './app.js';
import { db } from './db.js';
import { isAiConfigured } from './ai.js';

const PORT = Number(process.env.PORT) || 3001;

const server = http.createServer(createApp());

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🎓 STUDIFY BACKEND & AI GATEWAY SERVER                      ║
║                                                               ║
║   Status:    ACTIVE & LISTENING                               ║
║   Port:      http://localhost:${PORT}                           ║
║   Health:    http://localhost:${PORT}/api/health                ║
║   Database:  ${db.driver === 'postgres' ? 'PostgreSQL' : 'embedded (set DATABASE_URL)'}
║   AI Proxy:  ${isAiConfigured() ? 'CONFIGURED (Active)' : 'WAITING FOR GEMINI_API_KEY in server/.env'}
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

// Render stops a service by sending SIGTERM before replacing it: finish open requests, then close the database.
let stopping = false;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`[Server] ${signal} received, shutting down.`);
  server.close(async () => {
    await db.close().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
