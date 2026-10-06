/**
 * Studify Dedicated Production Backend & AI Gateway Server
 *
 * Capabilities:
 * - SQLite Database via node:sqlite (zero C++ dependencies)
 * - Authenticated JWT & PBKDF2 Password Identity Engine
 * - Google OAuth Integration (server-verified ID tokens)
 * - Secure Google Gemini AI Proxy (Streaming / Structured JSON), signed-in users only
 * - Cross-device Delta & Cloud Sync
 * - Community Deck Marketplace
 */

import './env.js'; // Must stay first: loads server/.env before other modules read process.env
import http from 'node:http';
import { createApp } from './app.js';
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
║   AI Proxy:  ${isAiConfigured() ? 'CONFIGURED (Active)' : 'WAITING FOR GEMINI_API_KEY in server/.env'} ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});
