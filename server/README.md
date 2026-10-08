# Studify Backend & AI Gateway Server

A small Node server for **Studify**: sign-in, cloud sync, community decks and a protected Gemini proxy,
backed by PostgreSQL.

---

## What it provides

1. **AI gateway (`/api/ai/generate`, `/api/ai/stream`)**
   - Keeps your master `GEMINI_API_KEY` on the server, so students don't need their own keys.
   - Signed-in users only, with a burst limit and a per-user daily quota (atomic in the database).
   - Falls back across several Gemini models.

2. **Authentication (`/api/auth/*`)**
   - Password accounts (PBKDF2, hashed off the main thread) and Google sign-in (ID tokens verified server-side).
   - 7-day HMAC-SHA256 session tokens.
   - Limits on sign-ups and on guessing passwords, equal timing for unknown emails, and account deletion.
   - If someone signed up with an email and password, and the real owner later signs in with Google, the
     password is removed, so the earlier sign-up can't keep access to what the owner then earns.

3. **Cloud sync (`/api/sync/*`)**
   - Decks, stats and how the avatar looks. Tokens, level and XP are never taken from a client.

4. **Community decks (`/api/decks/*`)**
   - Public sharing with slugs, search and one like per user.

---

## Quickstart (local)

```bash
cp server/.env.example server/.env   # then fill in GEMINI_API_KEY, JWT_SECRET, GOOGLE_CLIENT_ID
npm run server
```

It starts on `http://localhost:3001`. With no `DATABASE_URL`, an embedded PostgreSQL (PGlite) is used and kept in
`server/data/pgdata`, so there is nothing to install. It is the same SQL dialect as production.

Tests (`npx vitest run server`) use the embedded database in memory.

## Database

PostgreSQL, through `DATABASE_URL`. The schema is built by numbered migrations in `src/migrations.js`, applied once
at startup (safe with several instances starting together). Never edit a released migration: add a new one.

Old local data in `server/data/studify.sqlite` (from the SQLite version) is not read any more.

## Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Status; `503` if the database is unreachable (use it as the health check) |
| `POST` | `/api/ai/generate`, `/api/ai/stream` | Gemini proxy (signed in) |
| `POST` | `/api/auth/register` | Create a password account |
| `POST` | `/api/auth/login` | Sign in with email and password |
| `POST` | `/api/auth/google` | Sign in with Google |
| `GET` | `/api/auth/me` | The signed-in account |
| `DELETE` | `/api/auth/me` | Delete the account: send `{"confirm":"DELETE"}` (and `password` for password accounts) |
| `POST` | `/api/sync/push` | Save decks, stats and avatar look |
| `GET` | `/api/sync/pull` | Fetch them |
| `GET` | `/api/decks/public` | Search community decks |
| `POST` | `/api/decks/share` | Publish a deck |
| `POST` | `/api/decks/:id/like` | Like a deck (once per user) |
| `GET` | `/api/decks/:id` | Fetch a deck by id or slug |

---

## Deploying to Render, with Supabase for the database

1. **Database:** create a Supabase project and copy its **pooler** connection string (Project Settings, Database,
   Connection string, "Transaction pooler" or "Session pooler"). Use the pooler, not the direct host: Render can only
   reach the pooler. Before real users arrive, use a paid Supabase plan (free projects pause when idle and don't
   promise backups).
2. **Service:** in Render, create a new **Web Service** from this repository (or use `render.yaml` as a Blueprint).
   Leave **Root Directory empty** (the server shares code with the website, which lives outside `server/`).
   Build command `npm install --prefix server`, start command `npm start --prefix server`, health check path
   `/api/health`.
3. **Environment variables** (Render, Environment tab; never put them in code):

   | Variable | Value |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | the Supabase pooler connection string |
   | `JWT_SECRET` | 32+ random characters: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
   | `GEMINI_API_KEY` | your Gemini key |
   | `GOOGLE_CLIENT_ID` | the same client ID the web app uses |
   | `ALLOWED_ORIGINS` | your website's address, e.g. `https://app.example.com` (comma-separated for several) |

4. Point the web app at it with `VITE_API_BASE_URL=https://<your-service>.onrender.com/api` when building the frontend.

A free Render service sleeps when idle, so its first request after a pause is slow. Use a paid instance for real use.

Other hosts work the same way: any Node 22+ host, with the variables above.
