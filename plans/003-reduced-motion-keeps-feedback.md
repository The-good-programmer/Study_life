# 003 — Keep spinners and fades working when "reduce motion" is on

- **Status**: DONE
- **Commit**: d249d9e
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file, about 15 added lines (`src/index.css`)

## Problem

The reduced-motion rule ends every animation after 0.01ms:

```css
/* src/index.css:619-629 — current */
/* Accessibility: Prefers reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Two consequences:

1. **Loading indicators freeze.** The app has 17 `animate-spin` spinners, for example the lazy-load
   fallback (`src/App.tsx:56`) and `Loader2` icons in the AI and import dialogs
   (`src/components/setup/SetupAssistant.tsx:384`,
   `src/components/timetable/TimetableImportDialog.tsx:134`). Under reduced motion each one stops
   after one frame. A frozen spinner looks like the app has hung, which is worse for exactly the
   people who turned this setting on.
2. **Harmless fades vanish.** `animate-fadeIn` (opacity only, used 83 times: pages, dialogs,
   panels) also becomes instant. Reduced motion means fewer and gentler animations, not zero. An
   opacity fade involves no movement and helps people see that something changed.

## Target

Keep the global rule; it correctly removes movement. Add two narrower overrides inside the same
media query, plus one keyframe for the replacement spinner.

```css
/* target — replaces src/index.css:619-629 */
/* Accessibility: Prefers reduced motion. Movement goes; fades and loading feedback stay. */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  /* Opacity-only fades involve no movement and show that something changed. */
  .animate-fadeIn {
    animation-duration: 0.2s !important;
  }

  /* A spinner that stops looks like a hang, so loading indicators pulse instead of rotating. */
  .animate-spin {
    animation: reduced-motion-pulse 1.6s ease-in-out infinite !important;
  }
}

@keyframes reduced-motion-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

Why this wins the cascade: the overrides sit in the same unlayered `@media` block as the `*` rule
and are also `!important`, and a class selector outranks `*`. Tailwind's `animate-spin` and
`animate-fadeIn` utilities are not `!important`, so they lose to both.

## Repo conventions to follow

- Global accessibility CSS lives at the end of `src/index.css`, next to the focus-ring rule
  (`src/index.css:609-616`) and this media query.
- Standalone keyframes outside `@theme` sit at top level, like `@keyframes shimmer-sweep`
  (`src/index.css:415`).

## Steps

1. In `src/index.css`, replace the reduced-motion block (lines 619-629, quoted above) with the
   Target block, including the new `@keyframes reduced-motion-pulse` after it.

## Boundaries

- Do NOT edit any component. CSS only.
- Do NOT remove or weaken the `*` rule.
- Do NOT add exceptions for anything other than `.animate-fadeIn` and `.animate-spin`.
- If the quoted block does not match what you find, STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run lint` (no errors) and `npm run build` (succeeds). Then
  `grep -c "reduced-motion-pulse" dist/assets/*.css` prints at least 2 for one CSS file (the
  keyframe and its use).
- **Feel check**: `npm run dev`. In Chrome DevTools, open the Rendering panel and set "Emulate CSS
  media feature prefers-reduced-motion" to `reduce`. Then:
  - Throttle the network to "Slow 4G" and switch to Insights in the sidebar. The loading spinner
    must gently pulse in opacity and must not rotate or freeze.
  - Switch between Today, Library and Focus. Pages fade in briefly (about 0.2s) with no movement.
  - Open a deck and rate a card. Cards appear without any rise or slide.
  - Set the emulation back to `no-preference`. Spinners rotate again and every animation is as
    before.
- **Done when**: under reduced motion no spinner ever looks frozen, fades remain, nothing moves
  position, and the mechanical checks pass.
