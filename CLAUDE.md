# Studify

A study app for teenagers through university students: flashcards with spaced repetition, notes
and PDFs, a planner, focus sessions. React 19 + TypeScript + Vite + Tailwind v4 frontend (`src/`),
Node server (`server/`), shipped as a web app, a PWA and through Capacitor. The default branch is
`fix/audit-hardening` (there is no `main`).

## Before any UI work

1. Read `PRODUCT.md` (who it's for, how it should feel) and `DESIGN.md` (tokens, components, motion,
   and the owner's rules). They override general design habits.
2. Reuse what exists: semantic color tokens, `src/components/ui/primitives.tsx`, `Dialog` and
   `ConfirmDialog`, and the motion tokens and curves in `src/index.css`. Never raw hex colors,
   palette classes (`text-emerald-400`), `transition-all` or `window.confirm`.
3. Design for the phone first (390px wide), then desktop. Check **both themes** (dark and light
   "paper").

## Which skill for which job

| Job | Skill |
|---|---|
| Build or reshape a screen with a clear visual direction | `frontend-design`, `impeccable` |
| Critique or polish a screen (hierarchy, layout, typography, clarity) | `impeccable` |
| Accessibility and UX rule review | `web-design-guidelines` |
| Stress-test with worst-case data (long titles, empty, huge counts) | `break-ui` |
| Phone feel: notch, 100vh, zooming inputs, status bar | `mobile-native` |
| Drags, swipes, sheets | `gestures` |
| Review animation changes | `review-animations` |
| Audit all motion and plan fixes | `improve-animations` (plans go in `plans/`) |
| Several elements animating together | `choreograph` |
| The owner corrects a design choice | `learn-taste`: turn it into a rule in `DESIGN.md` |

## Before opening a PR with UI changes

- `npm run lint`, `npx tsc -b`, `npm test -- --exclude "server/**"`, `npm run build`.
- Run the app (`npm run dev`) and look at the changed screens at 390px and desktop width, in both
  themes. Check contrast and labels in the browser (axe-core), not only by reading code.
- Say in the PR what was checked in the browser and what still needs a real phone.

## Roadmap

Design work follows `plans/design-roadmap.md`. Update its status when a phase is done.
