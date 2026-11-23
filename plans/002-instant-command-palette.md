# 002 — Open the search palette (⌘K) instantly

- **Status**: TODO
- **Commit**: d249d9e
- **Severity**: HIGH
- **Category**: Purpose & frequency
- **Estimated scope**: 2 files, about 15 changed lines (`src/components/common/Dialog.tsx`, `src/components/common/CommandPalette.tsx`)

## Problem

The search palette opens from a keyboard shortcut (⌘K / Ctrl+K) and from the search box in the
top bar. It is built on the shared `Dialog`, so it inherits two entrance animations: the backdrop
fades in over 240ms and the panel rises over 420ms.

```tsx
// src/components/common/Dialog.tsx:113-117 — current
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm animate-fadeIn sm:p-6',
        containerClassName,
      )}
```

```tsx
// src/components/common/Dialog.tsx:139-146 — current
/** The visible card of a dialog. Pair it with a scrolling body: `min-h-0 flex-1 overflow-y-auto`. */
export const DialogPanel: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...rest }) => (
  <div
    className={cn(
      'flex min-h-0 w-full flex-col overflow-hidden rounded-[22px] border border-line-strong bg-surface-solid text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.05),0_32px_80px_-28px_rgb(0_0_0/0.8)] animate-rise',
      className,
    )}
```

```tsx
// src/components/common/CommandPalette.tsx:225-226 — current
    <Dialog isOpen={isOpen} onClose={onClose} ariaLabel="Search" className="max-w-xl" containerClassName="items-start! pt-[12dvh]!">
      <DialogPanel className="max-h-[min(560px,76dvh)]">
```

A palette summoned by keyboard is used constantly and should be there the instant the keys are
pressed, as in Raycast or Linear. Fades on regular dialogs (deck details, settings) are fine and
stay.

`cn` (`src/utils/cn.ts`) only joins strings. It does not resolve Tailwind conflicts, so passing
`animate-none` in `className` would not reliably beat `animate-rise`. That is why this plan adds
explicit props.

## Target

`Dialog` and `DialogPanel` each take an optional `animated` prop, default `true`, so every existing
dialog is unchanged. The palette passes `animated={false}` to both.

```tsx
// target — Dialog.tsx container
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6',
        animated && 'animate-fadeIn',
        containerClassName,
      )}
```

```tsx
// target — DialogPanel
interface DialogPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Plays the rise-in entrance. Off for UI opened by a keyboard shortcut, which should appear instantly. */
  animated?: boolean;
}

export const DialogPanel: React.FC<DialogPanelProps> = ({ className, children, animated = true, ...rest }) => (
  <div
    className={cn(
      'flex min-h-0 w-full flex-col overflow-hidden rounded-[22px] border border-line-strong bg-surface-solid text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.05),0_32px_80px_-28px_rgb(0_0_0/0.8)]',
      animated && 'animate-rise',
      className,
    )}
```

```tsx
// target — CommandPalette.tsx
    <Dialog isOpen={isOpen} onClose={onClose} ariaLabel="Search" className="max-w-xl" containerClassName="items-start! pt-[12dvh]!" animated={false}>
      <DialogPanel className="max-h-[min(560px,76dvh)]" animated={false}>
```

## Repo conventions to follow

- Optional props are documented with a one-line JSDoc comment, as in `DialogProps` in
  `src/components/common/Dialog.tsx:13-21`.
- Conditional classes use `cn(...)` with `cond && 'class'`, as in
  `src/components/focus/FocusFullscreen.tsx:119`: `cn('...', hidden && 'opacity-0')`.

## Steps

1. In `src/components/common/Dialog.tsx`, add to `interface DialogProps`:
   ```ts
     /** Plays the fade-in entrance. Off for UI opened by a keyboard shortcut, which should appear instantly. */
     animated?: boolean;
   ```
2. In the `Dialog` component's destructured props, add `animated = true,` after
   `containerClassName = '',`.
3. Change the container `className` to the Target version: remove `animate-fadeIn` from the base
   string and add the line `animated && 'animate-fadeIn',` before `containerClassName`.
4. Replace the `DialogPanel` declaration with the Target version: add the `DialogPanelProps`
   interface, destructure `animated = true`, remove `animate-rise` from the base string and add
   `animated && 'animate-rise',` before `className`. Keep the existing JSDoc line above it and
   everything after the `className` argument unchanged.
5. In `src/components/common/CommandPalette.tsx:225-226`, add `animated={false}` to `<Dialog>` and
   to `<DialogPanel>` as in Target.

## Boundaries

- Do NOT change any other dialog or caller of `Dialog` or `DialogPanel`. The default stays animated.
- Do NOT change focus handling, Escape handling or the palette's search behavior.
- Do NOT add dependencies.
- If any quoted code does not match what you find, STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run lint` (no errors), `npm run build` (succeeds, no type errors),
  `npx vitest run src` (all pass).
- **Feel check**: `npm run dev`, then:
  - Press ⌘K (Mac) or Ctrl+K. The palette and its dim backdrop must be fully visible in the first
    frame, with no fade and no rise.
  - Open Settings (gear icon, bottom of sidebar). It must still fade and rise in as before.
  - In DevTools, open the Animations panel: opening the palette records no animation. Opening
    Settings records `fadeIn` and `rise`.
- **Done when**: the palette opens instantly, every other dialog animates exactly as before, and the
  mechanical checks pass.
