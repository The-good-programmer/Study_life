# Studify — Learn Anything in 3 Minutes a Day

> **The delightfully habit-forming spaced recall platform powered by cognitive neuroscience and customizable 3D Student Avatars.**

Studify eliminates study planning friction, decision fatigue, and ineffective passive habits (like re-reading notes or highlight bingeing). When you open Studify, you can jump straight into a 3-minute tactile practice sprint or drop a lecture PDF for instant micro-mastery.

### 🎓 Fully Customizable 3D Student Avatar
Instead of generic cartoon mascots, **Studify puts you at the center with a real-time Three.js 3D character**:
* **Complete Customization:** Customize hairstyle & hair color, gender/sex & body build, skin tone, eye color, wardrobe (hoodies, varsity jackets, oxford shirts, knit sweaters, lab coats, jeans, pleated skirts, chinos, joggers), footwear, and accessories (eyewear, headphones with LED glow, graduation caps, beanies, halos, crowns).
* **3D Study Campus:** Your customized 3D character inhabits your 3D study estate, animates with idle, wave, study, and cheer poses, and reacts to your focus streaks.
* **Persistent & Offline:** Instant local persistence with zero asset-loading latency via procedural Three.js PBR geometry.

---

## 🧠 Scientific Principles Built-In

Lotti is engineered directly from empirical cognitive psychology and neuroscience:

1. **Phase 1: Priming & Dual Coding (Sweller / Paivio)**
   - Before reading granular text, Lotti primes the brain with an intuitive visual mental model, 3 high-yield takeaways, and interactive terminology chips.
   - Dual-coding concept graph visualizes conceptual relations and hierarchies.

2. **Phase 2: The Feynman Technique / Elaborative Interrogation (Dunlosky et al., 2013)**
   - Forces active encoding: *"Explain this concept simply without reading notes or relying on jargon."*
   - Honest Socratic evaluation analyzes your submission against core takeaways (or offline self-assessment when offline), highlighting points you mastered, nuances you missed, and giving constructive feedback.
   - Optional speech-to-text oral defense with natural vocal pacing.

3. **Phase 3: Active Retrieval Practice & FSRS Spaced Repetition (Roediger & Karpicke, 2006)**
   - Interactive flashcards force active recall (The Testing Effect).
   - 4-tier effort rating (*Again, Hard, Good, Easy*) dynamically schedules future reviews using the official Free Spaced Repetition Scheduler (`ts-fsrs`) to counteract the Ebbinghaus forgetting curve.
   - Leech Hunter Lab detects cards with repeated lapses and helps decompose them into atomic, high-retention concepts.

4. **Phase 4: Neuroscience Micro-Rest & Ultradian Reset (Kleitman)**
   - Long-term memory consolidation happens during offline rest.
   - 3-minute guided rest with interactive **4-4-4-4 Box Breathing visualizer**, 20-20-20 eye strain relaxation, and hydration prompts.

5. **Study Arenas & Multi-Modal Cognition**
   - **Interleaving Arena:** Mixes flashcards across multiple diverse subjects to counter the illusion of mastery from blocked practice.
   - **Exam Simulator:** Simulates real test conditions with strict timers, flagging, and detailed post-exam analytics.
   - **Match Arena:** Rapid-fire prompt-and-target matching with combo multipliers and keyboard hotkeys (keys 1–9) for reflex-level indexing.
   - **Image Occlusion Studio:** Draw visual occlusion masks over anatomical, architectural, or technical diagrams (Anki-style).
   - **Dual-Coding Canvas:** Freehand sketching whiteboard for visual thinking, offloaded to IndexedDB.
   - **Bluetooth Gamepad Review:** Ergonomic one-handed card flipping and grading using 8BitDo Zero 2, 8BitDo Micro, Nintendo Switch Joy-Cons, Xbox, or PlayStation controllers via the HTML5 Gamepad API.

6. **Built-in Web Audio Focus Sound Engine**
   - Synthesizes **40Hz Gamma Beats & Alpha Soundscapes** (for acoustic masking, working memory buffer support, and sustained attention).
   - Real-time Brownian Noise generator to mask distracting ambient speech.
   - Gentle Rain and Lo-Fi meditative drones.

---

## 🚀 Getting Started

### 1. Run Development Server
```bash
npm install
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) in your browser.

### 2. Build for Production
```bash
npm run build
```

---

## 📱 Mobile App Readiness (iOS & Android)

Lotti is architected mobile-first and is ready to run as an app in two ways:

### A. Instant PWA (Progressive Web App)
- **iPhone / iPad:** Open in Safari, tap the **Share** button $\rightarrow$ **Add to Home Screen**.
- **Android:** Open in Chrome, tap the three dots $\rightarrow$ **Install App**.
- The app runs in standalone mode with full offline capability, app icon, and no browser address bar.

### B. Native iOS & Android Build (via Capacitor)
The project includes pre-configured `capacitor.config.ts`. To export to native iOS and Android projects:
```bash
# Add platforms
npx cap add ios
npx cap add android

# Build and sync web assets
npm run build
npx cap sync

# Open in Xcode or Android Studio
npx cap open ios
npx cap open android
```

---

## 🛠️ Technology Stack
- **Frontend:** React 19 + TypeScript + Vite 8
- **Styling:** Tailwind CSS v4 (Distraction-free dark study aesthetic)
- **Icons & UI:** Lucide React + Canvas Confetti
- **Audio Synthesis:** Native Web Audio API (Zero external audio downloads needed)
- **AI Intelligence:** Google Gemini (`@google/genai` with `gemini-3.5-flash` cascade) + Intelligent local heuristic cognitive fallback
- **Storage:** Local-First (`localStorage` + `IndexedDB`) — Zero sign-up barrier to start studying immediately
- **Portability:** Full round-trip `.json`, `.md`, `.tsv` deck export and import
