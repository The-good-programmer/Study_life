# Design roadmap: making Claude a better designer for Studify

**Goal:** every session produces design that matches Studify's look and taste, and catches problems
before you see them, without re-learning the app each time.

**Where we are (November 2026):** four design skills are installed (`.claude/skills/`). The first
design review and the animation audit are fully fixed (PRs #42–#45; see `plans/README.md`).

**What still holds design quality back:**

1. **No memory between sessions.** Each new session re-reads the code to work out Studify's style,
   audience and past decisions. Impeccable looks for `PRODUCT.md` and `DESIGN.md`, but neither exists.
2. **Checks are manual.** The accessibility and contrast checks I ran exist only in temporary
   scripts. Nothing stops a future change from bringing the same problems back.
3. **Two skill references are broken, and some useful skills are missing.** `improve-animations`
   points to `review-animations` and `choreograph`, which aren't installed. Skills for phone feel
   and edge cases would help an installable student app.
4. **I don't know your taste yet.** Your likes and dislikes, and the apps you admire, are written
   down nowhere.
5. **Most screens have never been reviewed.** So far: Today, Library, Focus, Insights, sign-in and
   the delete dialogs.

The phases below fix these in order of value. Phase 1 makes every later phase better.

---

## Phase 1: Give Claude a memory of the design ✅ Done

| # | Deliverable | What it contains | Who |
|---|---|---|---|
| 1.1 ✅ | `PRODUCT.md` | Who Studify is for (age, school level, countries), what they're trying to do, the feeling the app should give (calm? playful? serious?), words to use and avoid. | **Done**: written from your answers. |
| 1.2 ✅ | `DESIGN.md` | The design system as it exists: color tokens and their contrast rules, type scale (Geist), spacing, radii, shadows, motion tokens (`--motion-ease-out`, durations), component primitives (`Button`, `Dialog`, `Badge`...), light and dark theme rules, and a **decisions log** (for example: "no animation on keyboard-driven actions", "hover effects only on mouse devices"). | Claude, from the code. |
| 1.3 ✅ | `CLAUDE.md` | Rules every session loads automatically: read `PRODUCT.md` and `DESIGN.md` before UI work; use tokens, never raw colors; check both themes, at 390px and desktop width; run the design checks before a PR; which skill to use for which job. | Claude. |

**The 6 questions for 1.1** (short answers are fine):

1. Who is the main user: age range, school level, and which countries?
2. Pick 3 words for how Studify should feel (for example: calm, focused, friendly, premium, playful).
3. Which 3–5 apps or websites do you love the look of, and what do you like about each?
4. Is anything in the current design you dislike, or want to keep no matter what?
5. Does the axolotl mascot set the tone (playful), or is it an accent in a mostly serious app?
6. Which matters more on phones: dense information, or big and simple screens?

## Phase 2: Automatic design checks on every pull request ✅ Done

CI already runs Playwright browser tests (`npm run e2e` in `.github/workflows/ci.yml`), so these slot
straight in.

| # | Deliverable | What it does |
|---|---|---|
| 2.1 ✅ | `e2e/design.spec.ts`: accessibility | Runs axe-core (`@axe-core/playwright`) on Today, Library, Focus, Insights, Planner, a review session (card revealed), sign-up and Settings. Covers both themes, at 390px and 1280px. **A pull request fails if it adds a contrast, label or structure problem.** |
| 2.2 ✅ | Token contrast test (Vitest), `src/designTokens.test.ts` | Reads the color tokens in `src/index.css` and checks every text and background pairing reaches 4.5:1 in both themes. A token edit that breaks readability fails before any screen is drawn. |
| 2.3 ✅ | Visual snapshots (on request, `npm run e2e:visual`; kept out of CI because screenshots vary between machines and CI gates deploys) | Playwright screenshots of key screens in both themes. An unintended visual change shows up as an image diff in the pull request, and Claude can look at the diff to judge it. |

## Phase 3: Add the right skills (and only those) ✅ Done

From [emilkowalski/skills](https://github.com/emilkowalski/skills), the same source as `improve-animations`:

| Skill | Why Studify needs it |
|---|---|
| `review-animations` | Checks each animation change in a pull request. `improve-animations` already points to it. |
| `choreograph` | Coordinates groups that move together: staggered lists, the session summary, multi-step onboarding. Also referenced by the audit rules. |
| `mobile-native` | Makes the installed app feel native: the 100vh bug, inputs that zoom the page, the status bar, long-press text selection. Studify ships as a PWA and through Capacitor. |
| `break-ui` | Feeds screens worst-case data: very long deck titles, 0 or 5,000 cards, non-Latin text, emoji. Students' own decks make this real. |
| `gestures` | Swipe ratings and the phone drawer: finger tracking, flicks, interruption. |
| `learn-taste` | Turns your design corrections into permanent rules in `DESIGN.md`. This is the engine of Phase 4. |

Already available, no install needed: the `dataviz` skill for Insights charts.

Deliberately skipped: `animate-expo` and `write-swift` (Studify isn't React Native or Swift), and
more general taste skills. Impeccable and frontend-design already cover visual direction, and
overlapping rules would conflict.

## Phase 4: Teach Claude your taste (ongoing)

1. **References.** Your answer to question 3 becomes a "References" section in `DESIGN.md`, with
   what to borrow from each app and what not to.
2. **Corrections become rules.** Whenever you say "I don't like this" or "more like that", Claude
   runs `learn-taste`, which writes the rule and the reason into `DESIGN.md`. Next session it's
   already known.
3. **Phone check after each deploy.** A 2-minute checklist in `DESIGN.md` covers the notch, swipe,
   drawer, search, both themes and one long deck title. Report anything that feels off; it becomes
   a fix and a rule.

## Phase 5: Review every screen, one at a time

Each screen gets three passes, then one pull request: **Impeccable critique** (hierarchy,
typography, layout, clarity), **web-design-guidelines** (accessibility and UX rules) and
**break-ui** (worst-case data). Suggested order, starting with what students use most:

1. ✅ Review session, in depth: every card type, hints, the tutor, the summary (PR after #47). Still open: the confetti `<canvas>` sits outside any landmark and should be `aria-hidden` (needs `confetti.create` with our own canvas); whether confetti belongs mid-session is an open question for the owner.
2. Planner and timetable.
3. Focus fullscreen and the timer.
4. Exam simulator.
5. Deck studio and image occlusion.
6. Onboarding: the first visit, the set-up assistant, Quick start.
7. Settings and account.
8. Public deck pages (the first thing a shared link shows).
9. The 3D world, if it's switched on.

As screens get reviewed, new screen-level rules go into `DESIGN.md` through `learn-taste`, so later
screens start from a higher bar.

---

## Execution order and effort

| Order | Work | Your part | Rough size |
|---|---|---|---|
| 1 ✅ | Phase 3: install skills | Merge the PR | small |
| 2 ✅ | Phase 1.2 + 1.3: `DESIGN.md` and `CLAUDE.md` | Merge the PR | medium |
| 3 ✅ | Phase 1.1: `PRODUCT.md` | Answer the 6 questions | small |
| 4 ✅ | Phase 2: automatic checks | Merge the PR | medium |
| 5 | Phase 5: screen reviews | Merge one PR per screen; phone check | 1 session per screen |
| — | Phase 4 | Say what you like and dislike, whenever | ongoing |

**Done when:** a new session can build a screen that fits Studify without asking how it should
look, every pull request is checked automatically for accessibility, contrast and visual changes,
and all 9 screens above have been reviewed.
