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
import { createApp, getAllowedOrigins, siteUrlFrom } from './app.js';
import { startReminderSchedule } from './reminders.js';
import { startDigestSchedule } from './digest.js';
import { createResendMailer } from './mailer.js';
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

// Study reminders, every few minutes while the server is up (the keep-alive workflow keeps it up).
// Push services want a contact for the sender: the site's address, or a mailto.
const site = siteUrlFrom(getAllowedOrigins());
const stopReminders = startReminderSchedule({ subject: site.startsWith('https://') ? site : 'mailto:reminders@studify.invalid' });
// The weekly progress email (Sunday evening for each student). The unsubscribe link points at this server:
// PUBLIC_API_URL, or the address Render gives the service.
const stopDigests = startDigestSchedule({
  mailer: createResendMailer(),
  siteUrl: site,
  apiUrl: (process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, ''),
});

// Render stops a service by sending SIGTERM before replacing it: finish open requests, then close the database.
let stopping = false;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  stopReminders();
  stopDigests();
  console.log(`[Server] ${signal} received, shutting down.`);
  server.close(async () => {
    await db.close().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
