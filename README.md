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
| `ALLOWED_ORIGINS` | No | Comma-separated browser origins allowed to call the API. Defaults to the local dev and preview ports. |
| `PORT`, `DATABASE_PATH` | No | Server port (3001) and SQLite file location. |

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
- **Storage:** local-first (`localStorage` + IndexedDB); optional Node + SQLite backend (`node:sqlite`) for accounts and sync
- **3D (Extras only, lazy-loaded):** Three.js
- **Portability:** round-trip `.json`, `.md`, `.tsv` deck export and import
