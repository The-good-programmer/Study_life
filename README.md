# Studify — Learn Anything in 3 Minutes a Day

> **A spaced-repetition study app built on well-tested learning techniques: retrieval practice, spacing, and interleaving.**

Open Studify, pick a starter deck or turn your own notes or a lecture PDF into flashcards, and review for a few minutes a day. The scheduler decides what you should see next, so you don't have to plan.

---

## 🔁 The core study loop

1. **Add material** — pick a ready-made starter deck (ranked for your level), paste notes, import Anki/Quizlet/CSV, or drop a PDF.
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
```

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
