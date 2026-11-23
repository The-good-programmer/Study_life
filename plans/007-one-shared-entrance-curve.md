# 007 — One shared entrance curve, a quicker page fade, and no dead hover CSS

- **Status**: DONE
- **Commit**: 918b5bf
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file, about 25 changed lines (`src/index.css`)
- **Depends on**: plan 001 (`--motion-ease-out` in `src/index.css`), which is done.

## Problem

Plan 001 introduced `--motion-ease-out: cubic-bezier(0.23, 1, 0.32, 1)`. The two most-used
entrance tokens still use other curves:

```css
/* src/index.css:56, 58 — current */
  --animate-fadeIn: fadeIn 0.24s ease-out;
  --animate-rise: rise 0.42s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
```

- `fadeIn` runs on every page switch (Today, Library, Focus, Insights, Planner and others) and
  dialog backdrop, 83 uses in all. Built-in `ease-out` is weak, and 240ms is long for something
  seen dozens of times a day.
- `rise` is the dialog panel entrance (`DialogPanel`) and appears in 11 places. 420ms with a
  different hand-typed curve.

There is also dead CSS: `.glass-panel-interactive` and its ungated `:hover` transform
(`src/index.css:251-264`) are not used anywhere (`grep -rn "glass-panel-interactive" src` finds only
`index.css`). It carries a third hand-typed curve.

```css
/* src/index.css:251-264 — current */
.glass-panel-interactive {
  background: rgb(20 20 27 / 0.72);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--line);
  box-shadow: inset 0 1px 0 0 rgb(255 255 255 / 0.04);
  transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.glass-panel-interactive:hover {
  background: rgb(26 26 35 / 0.86);
  border-color: oklch(0.625 0.195 276 / 0.35);
  transform: translateY(-1px);
}
```

Hover gating, the third leftover item from the audit, needs no change: Tailwind v4 already wraps
every `hover:` and `group-hover:` utility in `@media (hover: hover)` (confirmed in the built CSS).
This dead class was the only ungated hover motion.

## Target

```css
/* target */
  --animate-fadeIn: fadeIn 180ms var(--motion-ease-out);
  --animate-rise: rise 300ms var(--motion-ease-out) backwards;
```

- 180ms for the page and backdrop fade: still visible, no longer in the way.
- 300ms for the dialog rise: modals may run up to 500ms, but with the strong ease-out the motion is
  visually done by about 200ms. 300ms lets it settle without dragging.

Delete `.glass-panel-interactive` and `.glass-panel-interactive:hover` entirely.

Out of scope on purpose:
- `--animate-shake` keeps its own curve. It is a shake, not an entrance.
- The mascot and equalizer loops keep `ease-in-out`, which is right for constant oscillation.
- Tailwind `ease-out` utilities on progress bars keep the default curve, which suits a value
  changing on screen.

## Repo conventions to follow

- Animation tokens are `--animate-*` in the `@theme` block at the top of `src/index.css`; the shared
  curve is read with `var(--motion-ease-out)`, as in `--animate-card-deal`.

## Steps

1. In `src/index.css`, replace the `--animate-fadeIn` line (line 56) with the Target line.
2. Replace the `--animate-rise` line (line 58) with the Target line.
3. Delete `.glass-panel-interactive { ... }` and `.glass-panel-interactive:hover { ... }`
   (lines 251-264), plus the blank line after them.
4. In the `[data-theme="paper"]` selector list that starts with `[data-theme="paper"] .glass-panel,`, remove
   the `[data-theme="paper"] .glass-panel-interactive` entry, so the list ends at
   `[data-theme="paper"] .glass-panel-elevated {`.
5. Run `grep -rn "glass-panel-interactive" src`. It must print nothing.

## Boundaries

- Do NOT change the `fadeIn` or `rise` keyframes, only their tokens.
- Do NOT touch other `.glass-*` classes.
- Do NOT edit components.
- If any quoted code does not match what you find, STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run lint`, `npm run build`, `npx vitest run src`. All pass.
- **Feel check**: `npm run dev`.
  - Switch between Today, Library and Focus quickly. Each page fades in briefly and never feels
    like it is waiting.
  - Open Settings: the panel rises and settles quickly, with no slow drift at the end.
  - In the DevTools Animations panel, `fadeIn` is 180ms and `rise` is 300ms, both with
    `cubic-bezier(0.23, 1, 0.32, 1)`.
  - Under `prefers-reduced-motion: reduce`, page fades still run (200ms, from plan 003) and
    dialogs appear without rising.
- **Done when**: both tokens use `--motion-ease-out` and the dead class is gone.
