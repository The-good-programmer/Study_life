# 🚀 Studify Backend & AI Gateway Server

A lightweight, zero-dependency, production-ready backend engineered specifically for **Studify**.

---

## ⚡ What This Server Provides

1. **Secure AI Gateway & Proxy (`/api/ai/generate`):**
   - Keeps your master `GEMINI_API_KEY` safe on the server.
   - Eliminates the friction of asking students to configure their own developer API keys.
   - Automatically handles fallback across `gemini-2.5-flash`, `gemini-2.5-flash-lite`, and `gemini-2.0-flash`.
   - Built-in rate limiting (40 req/min per IP) to prevent token abuse.

2. **Centralized Authentication (`/api/auth/*`):**
   - True cross-device sign-in: students can study on mobile and resume on their laptop.
   - Secure PBKDF2 (100,000 iterations) password hashing.
   - Google OAuth / Identity token verification.
   - 30-day HMAC-SHA256 JWT session tokens.

3. **Cloud Delta Sync (`/api/sync/*`):**
   - Synchronizes decks, FSRS repetition review logs, 3D character customizations, and axolotl habitat states.
   - Stores data durably in SQLite with Write-Ahead Logging (WAL).

4. **Community Deck Marketplace (`/api/decks/*`):**
   - Public deck sharing with unique slugs (`studify.app/d/mcat-biochemistry`).
   - Search and discover community-published decks by keyword or subject.

---

## 🛠️ Quickstart

### 1. Configure Environment
Copy the example environment file:
```bash
cp server/.env.example server/.env
```
Open `server/.env` and add your **Gemini API Key**:
```env
PORT=3001
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET=any_random_32_character_string
```

### 2. Start the Server
From the root directory:
```bash
npm run server
```
Or directly:
```bash
node server/src/index.js
```

The server will start on `http://localhost:3001`.

---

## 📡 API Endpoint Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Server status, database connection, and AI proxy status |
| `POST` | `/api/ai/generate` | Proxied Google Gemini AI content generation |
| `POST` | `/api/auth/register` | Register new student account (PBKDF2) |
| `POST` | `/api/auth/login` | Authenticate student with email and password |
| `POST` | `/api/auth/google` | Sign in or auto-provision with Google |
| `GET` | `/api/auth/me` | Get active user profile via Bearer token |
| `POST` | `/api/sync/push` | Persist local decks, FSRS reviews, and avatar states |
| `GET` | `/api/sync/pull` | Retrieve user's synced data |
| `GET` | `/api/decks/public` | Search and list public community decks |
| `POST` | `/api/decks/share` | Publish a deck to the community marketplace |
| `GET` | `/api/decks/:id` | Fetch community deck by ID or slug |

---

## 🌐 Deploying to Production

### Option A: Railway (Recommended)
1. Push this repository to GitHub.
2. In Railway, click **New Project** $\rightarrow$ **Deploy from GitHub repo**.
3. Set the Root Directory to `/` (or `/server`).
4. Set the Start Command to `node server/src/index.js`.
5. Add `GEMINI_API_KEY` and `JWT_SECRET` in Railway Variables.

### Option B: Render
1. Create a **New Web Service** pointing to your repository.
2. Build Command: `echo "No build step required"`
3. Start Command: `node server/src/index.js`
4. Add environment variables in the Render dashboard.

### Option C: Fly.io / Docker
A standard Node 24 alpine image works immediately with zero compilation steps.
