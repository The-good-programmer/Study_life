# Studify — Learn Anything in 3 Minutes a Day

> **A spaced-repetition study app built on well-tested learning techniques: retrieval practice, spacing, and interleaving.**

Open Studify, pick a starter deck or turn your own notes or a lecture PDF into flashcards, and review for a few minutes a day. The scheduler decides what you should see next, so you don't have to plan.

---

## 🔁 The core study loop

1. **Add material** — pick a ready-made starter deck (ranked for your level), paste notes, import Anki/Quizlet/CSV, drop a PDF, or photograph a marked exam.
2. **Review** — active recall flashcards, rated *Again / Hard / Good / Easy*.
3. **Let the scheduler work** — reviews are spaced with the open-source FSRS algorithm (`ts-fsrs`), so cards come back just before you would forget them.
4. **See progress** — the retention dashboard shows what's due, what's sticking, and which cards keep failing.

## 🧠 What the techniques are (and the evidence behind them)

- **Retrieval practice** (Roediger & Karpicke, 2006): recalling an answer strengthens memory more than re-reading it. Every review is a recall attempt.
- **Spacing** (Cepeda et al., 2006): reviews spread over days beat cramming. FSRS schedules the gaps.
- **Interleaving** (Rohrer & Taylor, 2007): the *Mix Decks* arena mixes subjects so you practise telling problem types apart.
- **Explain it simply** (the Feynman technique / elaborative interrogation, Dunlosky et al., 2013): the guided mode asks you to explain a concept in your own words and checks it against the key ideas.
- **Short breaks**: an optional 3-minute rest with box breathing and eye-strain relief between study blocks.

## 🎯 Practice modes

- **Quick practice** — straight to your due cards.
- **Guided session** — priming → explain-it-simply → recall → rest.
- **Mock Exam** — timed test conditions with flagging and a post-exam breakdown.
- **Roast my exam** — photograph a marked paper from school. The AI finds where you lost marks, sorts each mistake (concept gap, careless slip, misread question…), roasts the mistakes (never you; always gentle under 13) and builds a deck that tests the idea behind each one. You check and correct what it read before the deck is made, and without AI you can type your mistakes in.
- **Mix Decks** — interleaved cards across subjects.
- **Speed Match** — fast term/definition matching, with keyboard shortcuts 1–9.
- **Image Occlusion** — hide labels on diagrams and recall them (Anki-style).
- **Leech Hunter** — finds cards you keep failing and helps split them into simpler ones.
- **Gamepad review** — flip and grade cards with a Bluetooth controller (HTML5 Gamepad API).

### Focus audio (optional)

Built-in background audio generated with the Web Audio API: brown noise, rain, and steady tones. Steady noise can mask distracting speech nearby. Claims that 40 Hz tones or binaural beats improve memory are not well established, so treat these as a comfort setting.

## ✨ Extras

Optional, non-study features live in the sidebar's collapsed **Extras** group: a customizable 3D student avatar and a home and room designer where you spend tokens earned by studying.

The avatar is a fully skinned, realistically proportioned character sculpted in code (about seven heads tall, with the face built on real facial thirds): body, face, hair (8 styles), clothing (6 tops, 5 bottoms, 4 shoes), hats, glasses and facial hair, with sculpted expressions, blinking eyelids and IK-driven poses (wave, cheer, reading a book). Skin colour detail (lips, cheeks, lids, stubble) is painted per vertex, and hair has strand shading with soft hairlines. Clothing is generated from the body itself, so it moves with it, and geometry is built in background Web Workers so the UI never stalls. To inspect it in development, open `http://localhost:5173/avatar-lab.html` (e.g. `?view=head3q&hairStyle=bob-cut&mood=happy`).

The avatar shown by default is the realistic, asset-based v2 (`src/components/character/three/v2/`): a skinned glTF human built from CC0 MakeHuman assets by a Blender pipeline (`tools/avatar-pipeline/`), dressed with one glTF per customizer item listed in `public/avatar/manifest.json`. Body shape is morph targets (with joints that follow gender), moods are ARKit blend-shape presets, hair has strand highlights, the scalp and beards are shaded into the skin, skin uses wrapped (subsurface-like) lighting with pore micro-normals, and the procedural animator is retargeted onto the imported skeleton. Glasses, hats, the hoodie and the lab coat are generated procedurally in the pipeline. The procedural avatar above remains available with `?avatar=v1` (or `localStorage.studify_avatar_renderer = 'v1'`) and is used automatically if v2's assets can't be loaded. Rendering quality follows the device tier (`v2/quality.ts`; override with `localStorage.studify_avatar_quality = 'high' | 'medium' | 'low'`). In the avatar lab, `?compare=1` shows v1 and v2 side by side and `?placeholder=1` runs v2 on a procedural stand-in mannequin.

---

## 🚀 Getting Started

### Frontend
```bash
npm install
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/). Everything works offline without the backend: decks and reviews are stored locally, and AI features use your own Gemini key (Settings) or a built-in offline fallback.

### Backend (optional: accounts, cloud sync, shared AI)
```bash
cp server/.env.example server/.env   # then fill it in
npm run server
```

| Variable | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | **Production** | Signs login tokens. At least 32 characters; the server refuses to start in production without it. In development a random secret is generated per run. |
| `GOOGLE_CLIENT_ID` | For Google sign-in | Must match the frontend's `VITE_GOOGLE_CLIENT_ID`. Used to verify Google tokens on the server. |
| `GEMINI_API_KEY` | For shared AI | Enables the AI proxy. Only signed-in users can use it. |
| `AI_DAILY_QUOTA` | No (default 200) | Shared AI requests per user per day. |
| `AI_IP_DAILY_QUOTA`, `AI_GLOBAL_DAILY_QUOTA` | No (400, 5000) | Shared AI requests per network and for the whole service per day, a ceiling on the Gemini bill. |
| `GEMINI_MODELS` | No | Comma-separated Gemini models to try in order. Defaults to `gemini-2.5-flash,gemini-2.5-flash-lite,gemini-3.6-flash`. |
| `DATABASE_URL` | **Production** | PostgreSQL connection string. Without it, development uses an embedded database in `server/data/pgdata`. |
| `ALLOWED_ORIGINS` | No | Comma-separated browser origins allowed to call the API. Defaults to the local dev and preview ports. |
| `PORT` | No | Server port (3001). |

### Tests, types and lint
```bash
npm test
npx tsc -b
npm run lint
```

### Build for production
```bash
npm run build
npm run check:build   # service worker stamped, avatar manifest points at real files
```

### Deploying the website

Both halves run on [Render](https://render.com), deployed from `fix/audit-hardening`:

| Service | Type | Build | Notes |
| :--- | :--- | :--- | :--- |
| `studify` | Static site | `npm ci && npm run build`, publish `dist` | the web app |
| `studify-api` | Web service (Node 22) | `npm install --prefix server`, start `npm start --prefix server` | health check `/api/health`; see `server/README.md` for its variables |

- **Frontend variables** (set on the static site, read at build time): `VITE_API_BASE_URL`
  (the API's URL including `/api`, e.g. `https://api.example.com/api`) and `VITE_GOOGLE_CLIENT_ID`
  (the same client ID as the API's `GOOGLE_CLIENT_ID`).
- **API variables:** `ALLOWED_ORIGINS` must list every address the site is served from
  (comma-separated, e.g. `https://example.com,https://www.example.com`).
- **Google sign-in:** add every site address to *Authorized JavaScript origins* for the client ID in
  Google Cloud Console.
- **CI gate:** `.github/workflows/ci.yml` runs lint, types, tests, the build and `check:build` on every
  PR and push. Set both Render services to *Auto-Deploy: After CI checks pass* so a failing build
  never ships.
- **Rollback:** in Render, open the service's *Events*, pick the last good deploy and choose
  *Rollback*.
- **Caching:** the service worker (`public/sw.js`, routing in `public/sw-routes.js`) never caches the
  API, loads pages network-first and gets a new build id every deploy, so users pick up new versions
  (an open tab offers a reload). Recommended static-site headers (Render, *Settings → Headers*):
  `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`, `/avatar/medium/*` and
  `/basis/*`; `Cache-Control: no-cache` for `/`, `/index.html`, `/sw.js`, `/sw-routes.js`,
  `/register-sw.js`, `/manifest.json` and `/avatar/manifest.json`; and `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin` and
  `Cross-Origin-Opener-Policy: same-origin-allow-popups` (keeps the Google sign-in popup working) on `/*`.
- **Avatar assets:** rebuilt with `tools/avatar-pipeline` (Blender + MPFB, then
  `npm run avatar:compress`); the models are named by content hash, so they can be cached forever.

---

## 📱 Mobile (PWA & Capacitor)

### PWA
- **iPhone / iPad:** open in Safari → **Share** → **Add to Home Screen**.
- **Android:** open in Chrome → ⋮ → **Install App**.

The app runs standalone and works offline.

### Native iOS & Android (Capacitor)
```bash
npx cap add ios
npx cap add android
npm run build
npx cap sync
npx cap open ios
npx cap open android
```

---

## 🛠️ Technology Stack
- **Frontend:** React 19 + TypeScript + Vite 8, Tailwind CSS v4, Lucide icons
- **Scheduling:** `ts-fsrs` (Free Spaced Repetition Scheduler)
- **AI:** Google Gemini via `@google/genai` (`gemini-2.5-flash` with fallbacks), plus an offline heuristic fallback
- **Storage:** local-first (`localStorage` + IndexedDB); optional Node + PostgreSQL backend for accounts and sync
- **3D (Extras only, lazy-loaded):** Three.js; procedural signed-distance-field sculpting meshed with surface nets, a real skeleton with two-bone IK, baked ambient occlusion, and GTAO post-processing in the home designer
- **Portability:** round-trip `.json`, `.md`, `.tsv` deck export and import
