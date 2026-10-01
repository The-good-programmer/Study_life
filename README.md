# Studify — Science-Backed Automated Study Pilot

> **"Just sit down and study. The website already has a proven by studies system to study."**

Studify eliminates study planning friction, decision fatigue, and ineffective passive habits (like re-reading notes or highlight bingeing). When you open Studify, you simply enter what you need to study, and the system automatically orchestrates a sequential, distraction-free study pilot.

---

## 🧠 Scientific Principles Built-In

Studify is engineered directly from empirical cognitive psychology and neuroscience:

1. **Phase 1: Priming & Dual Coding (Sweller / Paivio)**
   - Before reading granular text, Studify primes the brain with an intuitive visual mental model, 3 high-yield takeaways, and interactive terminology chips.

2. **Phase 2: The Feynman Technique / Elaborative Interrogation (Dunlosky et al., 2013)**
   - Forces active encoding: *"Explain this concept simply without reading notes or relying on jargon."*
   - Real-time Socratic AI evaluation analyzes your submission, highlighting points you mastered, nuances you missed, and giving constructive feedback.

3. **Phase 3: Active Retrieval Practice & FSRS Spaced Repetition (Roediger & Karpicke, 2006)**
   - Interactive flashcards force active recall (The Testing Effect).
   - 4-tier effort rating (*Again, Hard, Good, Easy*) dynamically schedules future reviews using the Free Spaced Repetition Scheduler (FSRS) to counteract the Ebbinghaus forgetting curve.

4. **Phase 4: Neuroscience Micro-Rest & Ultradian Reset (Kleitman / Huberman)**
   - Long-term memory consolidation (hippocampal replay) happens during offline rest.
   - 3-minute guided rest with interactive **4-4-4-4 Box Breathing visualizer**, 20-20-20 eye strain relaxation, and hydration prompts.

5. **Built-in Web Audio Focus Sound Engine**
   - Synthesizes real **40Hz Gamma Binaural Beats** (for cortical entrainment, working memory, and sustained attention).
   - Real-time Brownian Noise generator to mask distracting speech.
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

Studify is architected mobile-first and is ready to run as an app in two ways:

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
- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS v4 (Distraction-free dark study aesthetic)
- **Icons & UI:** Lucide React + Canvas Confetti
- **Audio Synthesis:** Native Web Audio API (Zero external audio downloads needed)
- **AI Intelligence:** Google Gemini (`@google/genai` with `gemini-2.5-flash`) + Intelligent local heuristic cognitive fallback
- **Storage:** Local-First (`localStorage` + `IndexedDB`) — Zero sign-up barrier to start studying immediately
