/**
 * Studify database layer: PostgreSQL.
 *
 * - Production: set DATABASE_URL (Supabase's *pooler* connection string works from Render; the direct
 *   host is IPv6-only).
 * - Local development and tests: with no DATABASE_URL, an in-process Postgres (PGlite) is used, kept in
 *   server/data/pgdata (or in memory when NODE_ENV=test). It is the same SQL dialect, so nothing needs installing.
 *
 * Importing this module resolves once the schema is migrated, so callers can query straight away.
 *
 * Helpers (all async, parameters as $1, $2, ...):
 *   db.all(sql, params)  -> rows
 *   db.one(sql, params)  -> first row or null
 *   db.run(sql, params)  -> number of rows changed
 *   db.tx(async (t) => {})  -> runs t.all / t.one / t.run in one transaction (rolled back if it throws)
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MIGRATIONS } from './migrations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Wraps a "run a query" function with the row helpers. */
function helpers(execute) {
  return {
    async all(sql, params = []) {
      return (await execute(sql, params)).rows;
    },
    async one(sql, params = []) {
      return (await execute(sql, params)).rows[0] ?? null;
    },
    async run(sql, params = []) {
      return (await execute(sql, params)).rowCount;
    },
  };
}

function isLocalHost(connectionString) {
  try {
    const { hostname } = new URL(connectionString);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

async function connectPostgres(connectionString) {
  const { default: pg } = await import('pg');

  // TLS is on for any remote database. The certificate chain is not verified unless DATABASE_CA is set
  // (Supabase's pooler uses its own CA); traffic is still encrypted.
  let url = connectionString;
  let ssl = false;
  if (!isLocalHost(connectionString)) {
    const parsed = new URL(connectionString);
    parsed.searchParams.delete('sslmode'); // we set ssl explicitly below
    url = parsed.toString();
    ssl = process.env.DATABASE_CA
      ? { ca: process.env.DATABASE_CA, rejectUnauthorized: true }
      : { rejectUnauthorized: false };
  }

  const pool = new pg.Pool({
    connectionString: url,
    ssl,
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  // An idle client dropping must not crash the process.
  pool.on('error', (err) => console.error('[Database] Idle client error:', err.message));

  const execute = (sql, params) => pool.query(sql, params);
  return {
    driver: 'postgres',
    ...helpers(execute),
    execute,
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(helpers((sql, params) => client.query(sql, params)));
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

async function connectEmbedded() {
  const { PGlite } = await import('@electric-sql/pglite');
  let location = 'memory://';
  if (process.env.NODE_ENV !== 'test') {
    const dataDir = process.env.PGLITE_DIR || path.resolve(__dirname, '../data/pgdata');
    fs.mkdirSync(path.dirname(dataDir), { recursive: true });
    location = dataDir;
  }
  const pglite = new PGlite(location);
  await pglite.waitReady;

  // Statements without parameters may hold several commands (migrations), which PGlite only runs through exec().
  const executeOn = (client) => async (sql, params) => {
    if (params.length === 0) {
      const results = await client.exec(sql);
      const last = results[results.length - 1] ?? { rows: [] };
      return { rows: last.rows, rowCount: last.affectedRows ?? last.rows.length };
    }
    const result = await client.query(sql, params);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  };
  const execute = executeOn(pglite);
  return {
    driver: 'pglite',
    ...helpers(execute),
    execute,
    tx: (fn) => pglite.transaction((t) => fn(helpers(executeOn(t)))),
    close: () => pglite.close(),
  };
}

/** Applies each migration once, in order. Safe to run from several instances at the same time. */
async function migrate(db) {
  await db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  for (const migration of MIGRATIONS) {
    await db.tx(async (t) => {
      await t.run('SELECT pg_advisory_xact_lock(727274)');
      if (await t.one('SELECT id FROM schema_migrations WHERE id = $1', [migration.id])) return;
      await t.run(migration.sql);
      await t.run('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
      console.log(`[Database] Applied migration ${migration.id}`);
    });
  }
}

const connectionString = (process.env.DATABASE_URL || '').trim();
export const db = connectionString ? await connectPostgres(connectionString) : await connectEmbedded();
await migrate(db);

console.log(
  db.driver === 'postgres'
    ? '[Database] Connected to PostgreSQL.'
    : `[Database] Using embedded PostgreSQL (PGlite). Set DATABASE_URL to use a real database.`,
);

/** Unique-constraint violation (a duplicate email, say), the same code from either driver. */
export const isUniqueViolation = (err) => err?.code === '23505';
