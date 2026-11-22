# Studify — Learn Anything in 3 Minutes a Day

> **A spaced-repetition study app built on well-tested learning techniques: retrieval practice, spacing, and interleaving.**

Open Studify, pick a starter deck or turn your own notes or a lecture PDF into flashcards, and review for a few minutes a day. The scheduler decides what you should see next, so you don't have to plan.

---

## 🔁 The core study loop

1. **Add material** — pick a ready-made starter deck (ranked for your level), paste notes, take photos of them, record a lecture or upload its audio (written out in 3-minute parts, up to two hours), paste a YouTube link (notes from the video's first hour), import Anki/Quizlet/CSV, or drop a PDF. The AI's text lands in the notes box for you to check first. A first visit opens *What do you want to study?* instead of a tour. A guest's first AI deck (from a topic, notes or a PDF) is free with no account; after that, the home page offers a free account to keep it and make more.
2. **Review** — active recall flashcards, rated *Again / Hard / Good / Easy*.
3. **Let the scheduler work** — reviews are spaced with the open-source FSRS algorithm (`ts-fsrs`), so cards come back just before you would forget them. **Start review** opens today's review across all decks: every card due now (most overdue first), then new cards up to a daily limit (10 by default, Settings → Study). Missed cards come back a few cards later, and the last rating can be undone (Z). A wrong or unclear card can be fixed on the spot or hidden from reviews (E); the latest edit wins on every device. **Ask about this card** opens a short chat with the AI about the card on screen.
4. **See progress** — the retention dashboard shows what's due, what's sticking, and which cards keep failing. Friends (added by code or invite link) see each other's streak and whether they studied today, rank by this week's XP, and challenge each other to duels: the same multiple-choice questions from a deck, graded on the server. An optional weekly email sums up the week.

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
- **Mix Decks** — interleaved cards across subjects.
- **Speed Match** — fast term/definition matching, with keyboard shortcuts 1–9.
- **Image Occlusion** — hide labels on diagrams and recall them (Anki-style).
- **Leech Hunter** — finds cards you keep failing and helps split them into simpler ones.
- **Gamepad review** — flip and grade cards with a Bluetooth controller (HTML5 Gamepad API).

### Timetable and after-class notes

Add your weekly lessons in the Planner (school or university: any day, any times, a room if you like; *Save and add
another* fills a day quickly). On days with lessons, **After class** on Today lists them: when one ends, *Log it* asks
what you covered (a few seconds). Homework goes into the planner, due at that subject's next lesson by default, and the
topic (with any notes) can become flashcards, checked like any AI deck, added as one topic to that subject's
**class notes** deck, so they come up in tonight's review. The timetable and logs sync with your account.

- **From a photo:** *From a photo* reads a picture (or pasted text) of the timetable with the AI; you tick the lessons to
  add, and ones already there are left out.
- **After-class notifications:** with reminders on (Settings → Reminders), the server sends a notification when each
  lesson ends ("Biology just finished"), from the synced timetable in your time zone: once per lesson, within 20
  minutes of its end, and never for a lesson you've already noted. Tapping it opens the note (`/?log=<lessonId>`). It can
  be turned off under *After each lesson*.

### Focus workspace

A Pomodoro timer (25-minute focus sessions, short breaks, a long break after every fourth; one-tap 25/5, 50/10 and 90/20 presets, or your own lengths) with the session's tasks, a notes pad, background sound and today's focus time. Tap a task to work on it, drag to reorder, and press F for a full-screen timer. Homework due soon in the Planner is offered as a task, and ticking it off marks it done in the Planner too. The timer keeps running on other pages (the time left shows in the top bar and the tab title), chimes when a phase ends and can send a notification. Finished focus sessions (or ones finished early with "Finish now") count toward the daily goal and streak; time spent reviewing cards during a session is counted once, not twice. Alerts ring on time in background tabs, and the screen stays on while the timer runs (where the browser supports it).

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
| `AI_GUEST_DAILY_QUOTA` | No (600) | Shared AI requests per day for all guests' free decks together (one free deck per guest: two requests, up to four with a retry; three free decks per network a day). |
| `GEMINI_MODELS` | No | Comma-separated Gemini models to try in order. Defaults to `gemini-2.5-flash,gemini-2.5-flash-lite,gemini-3.6-flash`. |
| `DATABASE_URL` | **Production** | PostgreSQL connection string. Without it, development uses an embedded database in `server/data/pgdata`. |
| `ALLOWED_ORIGINS` | No | Comma-separated browser origins allowed to call the API. Defaults to the local dev and preview ports. |
| `RESEND_API_KEY` | For password reset | Sends "Forgot password?" emails through [Resend](https://resend.com). Without it, reset is off and the app says so. |
| `MAIL_FROM` | No | Sender for those emails, e.g. `Studify <hello@yourdomain.com>` (a domain verified in Resend). Defaults to Resend's test sender, which only delivers to the Resend account's own address. |
| `PORT` | No | Server port (3001). |

### Tests, types and lint
```bash
npm test
npx tsc -b
npm run lint
```
Browser smoke tests (the built app and the API with an in-memory database; the AI is stood in for):
```bash
npm run build && npm run e2e
```
CI runs all of these, plus `check:build`, which also fails if a first visit downloads more than 200 KB of
JavaScript (compressed). Errors students run into are sent to the API and logged as `[ClientError]` lines.

### Build for production
```bash
npm run build
npm run check:build   # service worker stamped, avatar manifest points at real files
```

### Public pages (found on Google)

The build also writes plain-HTML pages that search engines and link previews can read
(`src/publicPages/buildPublicPages.ts`, run by the `publicPages` plugin in `vite.config.ts`):

- `/decks/`: what Studify is, how it works, and every starter deck by subject.
- `/decks/<deck id>/`: one deck with all its text cards (cloze gaps blanked), flashcard markup for Google
  (`Quiz` / `Question`), and *Study these cards free*, which opens `/?deck=<id>` straight into its flashcards.
- `sitemap.xml` and `robots.txt` (with the sitemap's address).

Addresses use `SITE_URL` (set it on the static site when it moves to its own domain), or else `og:url` in
`index.html`.

### Sharing decks

Signed-in students share a deck from its details (**Share**); classmates open the link (`/?shared=<slug>`) straight
into its cards, with no account, and anyone can browse shared decks in Library → Community.

- **What is shared:** the cards and their explanations only (`src/services/deckSharing.ts`): never review history,
  hidden cards, sketches, notes, PDFs or the education profile. A copy someone adds gets new ids and starts fresh.
- **Who is named:** first name and initial ("Ada L."), and students under 16 never ("a Studify student"). Only that is
  stored; profile edits are sent to the server (`PATCH /api/auth/me`) so it stays current.
- **Checks:** the sharer confirms the cards are theirs to share; the AI checks each deck when it is shared and refuses
  unsafe ones (when the AI isn't available the deck is shared and marked unchecked); three reports hide a deck.
- **Public pages:** a shared deck gets a page at `/decks/c/<slug>/` (listed on `/decks/` and in the sitemap) once the
  AI check passed, it has 10+ cards and a description, was shared 3+ days ago and was never reported. The build reads
  them from the API (`GET /api/decks/public-pages`, using `VITE_API_BASE_URL`; none when it can't be reached). Each page
  asks the API whether its deck is still up (`/api/decks/<slug>/visible`) and, if it was unshared or hidden, says
  "This deck was removed" and asks search engines to drop it, without waiting for a rebuild. *Report this deck* opens
  `/?report=<slug>`. A scheduled task rebuilds the site daily so new decks get pages.

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
- **Study reminders:** signed-in students get push notifications at their chosen time on days they haven't studied,
  even with Studify closed. The API sends them every few minutes (kept awake by the keep-alive workflow) and makes its own
  Web Push keys on first use (stored in `app_secrets`), so there is nothing to configure.
- **Weekly progress email:** students who turn it on (Settings → Reminders) get a summary every Sunday from 17:00
  in their time zone, sent through Resend (`RESEND_API_KEY`, `MAIL_FROM`). The unsubscribe link points at the API's own
  address (`RENDER_EXTERNAL_URL`, or set `PUBLIC_API_URL`). Until a domain is verified in Resend and `MAIL_FROM` uses it,
  Resend only delivers to the Resend account's own address.
- **Keeping it awake:** `.github/workflows/keep-alive.yml` calls the API's `/api/health` every 14 minutes, so the
  free Render API is usually awake and the free Supabase database never pauses for inactivity. GitHub pauses scheduled
  workflows after 60 days without commits; if that happens, re-enable it under *Actions → Keep alive*. The site also
  wakes the API as soon as it opens.
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
- **Account sync:** signed-in students' decks (with review progress), subjects, planner, Focus tasks, notes and history,
  stats and avatar look sync through `/api/sync/pull` and `/api/sync/push` a few seconds after each change and when the
  app comes back into view. Edits merge item by item (newer wins) and deletions are remembered, so nothing deleted comes
  back (`src/services/cloudSyncService.ts`, `src/services/syncMerge.ts`). Tokens and the campus home stay on each device.
- **3D (Extras only, lazy-loaded):** Three.js; procedural signed-distance-field sculpting meshed with surface nets, a real skeleton with two-bone IK, baked ambient occlusion, and GTAO post-processing in the home designer
- **Portability:** round-trip `.json`, `.md`, `.tsv` deck export and import
