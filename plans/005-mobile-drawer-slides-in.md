# 005 — Slide the phone menu in from the left edge

- **Status**: DONE
- **Commit**: d249d9e
- **Severity**: MEDIUM
- **Category**: Physicality & origin
- **Estimated scope**: 2 files, about 8 changed lines (`src/index.css`, `src/components/layout/Sidebar.tsx`)
- **Depends on**: plan 001, which adds `--motion-ease-drawer` to `src/index.css`. If 001 is not
  done, add `--motion-ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);` to `@layer base { :root {` in
  `src/index.css` first.

## Problem

On phones, the menu button opens the navigation drawer. The drawer is anchored to the left edge
but only fades in, so nothing shows where it came from or where it will go:

```tsx
// src/components/layout/Sidebar.tsx:486-490 — current
        <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onCloseMobile} />
          <aside className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col border-r border-line bg-canvas-raised px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-2xl animate-fadeIn">
            {renderNavContent(false, true)}
          </aside>
```

## Target

The drawer slides in from fully off-screen left, using `translateX(-100%)` (its own width, so no
hard-coded pixels), over 300ms with the iOS-style drawer curve. The backdrop keeps its fade.

```css
/* target — new token and keyframes in the @theme block of src/index.css, after --animate-answer-unfold */
  /* The phone navigation drawer slides in from the edge it is attached to. */
  --animate-drawer-in: drawer-in 300ms var(--motion-ease-drawer) backwards;

  @keyframes drawer-in {
    from { transform: translateX(-100%); }
    to { transform: none; }
  }
```

```tsx
// target — Sidebar.tsx:488: the <aside> ends with animate-drawer-in instead of animate-fadeIn
          <aside className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col border-r border-line bg-canvas-raised px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-2xl animate-drawer-in">
```

Fill mode is `backwards`, not `forwards`, so no transform remains after the slide. A lingering
transform would make the drawer the containing block for `position: fixed` children; see the
comment at `src/index.css:54-55`.

## Repo conventions to follow

- Animations are `--animate-*` tokens with their `@keyframes` inside `@theme { ... }` at the top of
  `src/index.css`, for example `--animate-card-deal` with `@keyframes card-deal`. Tailwind turns
  `--animate-drawer-in` into the `animate-drawer-in` class.

## Steps

1. In `src/index.css`, inside `@theme {`, add the `--animate-drawer-in` comment and line from
   Target directly after the `--animate-answer-unfold` line.
2. In the same `@theme` block, add `@keyframes drawer-in` from Target after the last existing
   `@keyframes` in that block (`@keyframes shake`), before the block's closing `}`.
3. In `src/components/layout/Sidebar.tsx:488`, replace `animate-fadeIn` at the end of the `<aside>`
   className with `animate-drawer-in`. Leave line 487 (the backdrop) unchanged.

## Boundaries

- Do NOT add a closing animation; the drawer still disappears instantly when closed. That is out of
  scope.
- Do NOT change the desktop sidebar or its collapse behavior (`Sidebar.tsx:470-478`).
- Do NOT change the backdrop, focus behavior or markup.
- If any quoted code does not match what you find, STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run lint` (no errors) and `npm run build` (succeeds). Then
  `grep -c "drawer-in" dist/assets/*.css` prints at least 2 for one CSS file.
- **Feel check**: `npm run dev`, then use Chrome DevTools device mode (for example iPhone 14) or a
  real phone:
  - Tap the menu button (top left). The drawer slides in from the left edge, fast at first and
    settling softly; the backdrop fades in behind it.
  - In the Animations panel at 10% playback, the drawer starts fully off-screen (no part of it
    visible at the first frame) and moves only horizontally, with no fade.
  - Tap a link in the drawer. It navigates and closes as before.
  - With `prefers-reduced-motion: reduce` emulated, the drawer appears instantly.
- **Done when**: the drawer visibly comes from the left edge, nothing else about the menu changed,
  and the mechanical checks pass.
