/**
 * Loads server/.env into process.env.
 *
 * Must be the first import of the entry point: ES module imports are hoisted,
 * so modules that read process.env at load time (auth.js, ai.js, db.js) only
 * see these values if this module has already been evaluated.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
