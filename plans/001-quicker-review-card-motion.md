# 001 — Make the review-card motion quick enough for keyboard reviewing

- **Status**: TODO
- **Commit**: d249d9e
- **Severity**: HIGH
- **Category**: Purpose & frequency (with Easing & duration)
- **Estimated scope**: 2 files, about 30 changed lines (`src/index.css`, `src/components/cockpit/RetrievalPhase.tsx`)

## Problem

Reviewing cards is the most frequent thing a Studify user does. A session is dozens of cards, mostly
driven by keyboard: Space reveals, 1–4 rates (`RetrievalPhase.tsx:397-450`). Every card currently
plays four animations in a row, about 1.4s of motion per card:

```css
/* src/index.css:59-62, 65 — current */
  /* Review cards: each one is dealt in from the stack, turns when its answer shows, and the answer
     folds open. "backwards" fill only, for the same reason as fadeIn below. */
  --animate-card-deal: card-deal 0.38s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
  --animate-card-turn: card-turn 0.42s cubic-bezier(0.3, 0.7, 0.3, 1);
  ...
  --animate-answer-unfold: answer-unfold 0.36s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
```

```css
/* src/index.css:87-101 — current */
  @keyframes card-deal {
    from { opacity: 0; transform: translateY(14px) rotate(1deg) scale(0.97); } /* no sideways shift: a phone would scroll */
    to { opacity: 1; transform: none; }
  }

  @keyframes card-turn {
    0% { transform: perspective(1200px) rotateY(0); }
    45% { transform: perspective(1200px) rotateY(-7deg) scale(1.01); }
    100% { transform: perspective(1200px) rotateY(0); }
  }

  @keyframes answer-unfold {
    from { opacity: 0; transform: perspective(900px) rotateX(-14deg) translateY(-6px); transform-origin: top; }
    to { opacity: 1; transform: none; }
  }
```

```css
/* src/index.css:420-433 — current (used only by the rating bar and the multiple-choice result bar) */
@keyframes slideUp {
  0% {
    transform: translateY(100%);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

.animate-slideUp {
  animation: slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```

```tsx
// src/components/cockpit/RetrievalPhase.tsx:846-848 — current
              className={`relative flex min-h-[360px] select-none flex-col rounded-3xl border bg-surface-solid p-6 ... sm:p-8 ${
                isAnswerRevealed ? 'border-line-strong animate-card-turn' : 'border-line'
              } ...`}
```

Why it matters: the card is keyed by `currentCard.id` (`RetrievalPhase.tsx:824`), so each rating
remounts it and restarts `card-deal` from opacity 0. A student pressing `3` every half second is
always reading a card that is still fading in. The 420ms `card-turn` wobble plays on every single
reveal: decoration on the app's most repeated action. The rating bar slides its full height on
every reveal.

## Target

Keep a brief, quick entrance so cards still feel like they arrive, at ≤200ms with a strong
ease-out. Remove the reveal wobble entirely.

```css
/* target — in the @layer base :root block (src/index.css:141), after --canvas-raised */
    /* Motion: a strong ease-out for things entering, and an iOS-like curve for drawers. */
    --motion-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --motion-ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

```css
/* target — @theme tokens */
  /* Review cards: each one is dealt in from the stack and the answer folds open, kept short because
     students rate dozens of cards a session, mostly from the keyboard. "backwards" fill only, for
     the same reason as fadeIn below. */
  --animate-card-deal: card-deal 180ms var(--motion-ease-out) backwards;
  --animate-answer-unfold: answer-unfold 200ms var(--motion-ease-out) backwards;

  @keyframes card-deal {
    from { opacity: 0; transform: translateY(6px) scale(0.99); } /* no sideways shift: a phone would scroll */
    to { opacity: 1; transform: none; }
  }

  @keyframes answer-unfold {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: none; }
  }
```

```css
/* target — slideUp */
@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}

.animate-slideUp {
  animation: slideUp 180ms var(--motion-ease-out) backwards;
}
```

```tsx
// target — RetrievalPhase.tsx:847
                isAnswerRevealed ? 'border-line-strong' : 'border-line'
```

## Repo conventions to follow

- Animations are Tailwind v4 `--animate-*` tokens plus `@keyframes` inside the `@theme { ... }`
  block at the top of `src/index.css` (lines 56-112). Used as classes such as `animate-card-deal`.
- Theme-independent custom properties live in `@layer base { :root { ... } }` (`src/index.css:140`).
  Name the new curves `--motion-*`. Do **not** name them `--ease-out`: that is Tailwind's own
  theme variable behind the `ease-out` utility, and overriding it would change unrelated elements.
- Fill mode stays `backwards`, never `forwards`. The comment at `src/index.css:54-55` explains why:
  a transform that keeps filling makes the element the containing block for `position: fixed`
  children.

## Steps

1. In `src/index.css`, inside `@layer base { :root {` (line 141), add the two `--motion-*` lines
   from Target directly after `--canvas-raised: #0e0e14;`.
2. In the `@theme` block, replace the comment and the `--animate-card-deal` line (lines 59-61)
   with the comment and `--animate-card-deal` line from Target.
3. Delete the `--animate-card-turn` line (line 62).
4. Replace the `--animate-answer-unfold` line (line 65) with the one from Target.
5. Replace `@keyframes card-deal` (lines 87-90) with the Target version.
6. Delete `@keyframes card-turn` entirely (lines 92-96).
7. Replace `@keyframes answer-unfold` (lines 98-101) with the Target version.
8. Replace `@keyframes slideUp` and `.animate-slideUp` (lines 420-433) with the Target version.
9. In `src/components/cockpit/RetrievalPhase.tsx:847`, change
   `isAnswerRevealed ? 'border-line-strong animate-card-turn' : 'border-line'` to
   `isAnswerRevealed ? 'border-line-strong' : 'border-line'`.
10. Run `grep -rn "card-turn" src`. It must print nothing.

## Boundaries

- Do NOT touch `--animate-fadeIn`, `--animate-rise`, `--animate-shake`, the mascot animations or
  any other token.
- Do NOT change the swipe transform or transition on the card (`RetrievalPhase.tsx:839-845`).
  Plan 004 owns those.
- Do NOT change markup, keys or behavior. Motion values only, plus removing the one class in step 9.
- Do NOT add dependencies.
- If any quoted code does not match what you find, STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run lint` (no errors), `npm run build` (succeeds), `npx vitest run src`
  (all pass), and `grep -rn "card-turn" src` (no output).
- **Feel check**: `npm run dev`, open a ready-made deck from the Today page, then:
  - Press Space and then `3` repeatedly, about two presses a second. Each new card must be fully
    readable almost immediately. No card should still be visibly fading when you look at it.
  - Revealing an answer must not tilt or wobble the card. The answer text fades down into place in
    about 0.2s.
  - The rating bar at the bottom rises a few pixels and fades in. It must not slide up its full
    height.
  - In Chrome DevTools, open the Animations panel, set playback to 10%, and confirm card-deal is a
    small rise with a slight grow (no rotation) and nothing exceeds 200ms at 100% speed.
  - Toggle `prefers-reduced-motion: reduce` (DevTools, Rendering panel): cards and bars appear
    instantly.
- **Done when**: all mechanical checks pass, no `card-turn` remains, and the four feel checks hold.
