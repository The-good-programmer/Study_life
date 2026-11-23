# 004 — A swipe throws the card off in its direction, and quick flicks count

- **Status**: TODO
- **Commit**: d249d9e
- **Severity**: MEDIUM
- **Category**: Physicality & interruptibility
- **Estimated scope**: 1 file, about 60 changed lines (`src/components/cockpit/RetrievalPhase.tsx`)
- **Depends on**: plan 001, which adds `--motion-ease-out` to `src/index.css`. If 001 is not done,
  add `--motion-ease-out: cubic-bezier(0.23, 1, 0.32, 1);` to `@layer base { :root {` in
  `src/index.css` first.

## Problem

On a review card you can swipe to rate it: right = Good, left = Again, up = Easy, down = Hard. A
swipe before the answer is shown only reveals the answer. Two problems:

**1. A committed swipe springs back.** When the finger lifts, `touchOffset` becomes `null` and the
card animates back to the center with an overshooting curve, then the next card replaces it. The
card visibly moves opposite to the gesture that rated it.

```tsx
// src/components/cockpit/RetrievalPhase.tsx:839-845 — current
              style={{
                touchAction: 'pan-y',
                transform: touchOffset
                  ? `translate3d(${touchOffset.x}px, ${touchOffset.y * 0.4}px, 0) rotate(${touchOffset.x * 0.05}deg)`
                  : undefined,
                transition: touchOffset ? 'none' : 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275), border-color 0.2s ease',
              }}
```

**2. Only distance counts.** A swipe must travel more than 60px, so a quick, short flick is
ignored:

```tsx
// src/components/cockpit/RetrievalPhase.tsx:547-576 (inside handleTouchEnd) — current
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX > 60 && absX > absY) {
      // Horizontal swipe
      if (deltaX > 0) {
        setTouchFeedback('Swipe Right: Good');
        setTimeout(() => setTouchFeedback(null), 1000);
        if (isAnswerRevealed) handleRate('good');
        else handleRevealAnswer();
      } else {
        setTouchFeedback('Swipe Left: Again');
        setTimeout(() => setTouchFeedback(null), 1000);
        if (isAnswerRevealed) handleRate('again');
        else handleRevealAnswer();
      }
    } else if (absY > 60 && absY > absX) {
      // Vertical swipe
      if (deltaY < 0) {
        setTouchFeedback('Swipe Up: Easy');
        setTimeout(() => setTouchFeedback(null), 1000);
        if (isAnswerRevealed) handleRate('easy');
        else handleRevealAnswer();
      } else {
        setTouchFeedback('Swipe Down: Hard');
        setTimeout(() => setTouchFeedback(null), 1000);
        if (isAnswerRevealed) handleRate('hard');
        else handleRevealAnswer();
      }
    }
```

The mouse-drag version in `handleMouseUp` (the `if (touchOffset) { ... }` block, lines 607-627) repeats the same decision without the
feedback badge.

## Target

- **Commit rule.** Horizontal: travel more than 60px, **or** a flick of at least 24px faster than
  0.11 px/ms. Vertical: more than 60px only. The card has `touch-action: pan-y`, so fast vertical
  movement is often the page scrolling; counting vertical flicks would rate cards by accident.
- **Rating swipe:** the card animates off-screen in the swipe direction over 200ms with
  `var(--motion-ease-out)` while fading out, then the rating is applied and the next card deals in.
- **Reveal swipe** (answer not shown yet): no throw. The card returns to center over 300ms with
  `var(--motion-ease-out)`, with no overshoot.
- **Reduced motion:** rate immediately, no throw.
- **Race safety:** if the card changes during the 200ms throw (keyboard or controller rated it
  first), the delayed rating is skipped.
- Feedback badges ("Swipe Right: Good", etc.) behave exactly as now: shown for touch, not for mouse.

## Repo conventions to follow

- Gesture state uses `useRef` for start positions and `useState` for what renders
  (`RetrievalPhase.tsx:104-110`).
- Ratings use the `FSRSRating` type already imported in this file (see
  `handleRate = useCallback((rating: FSRSRating) =>` at line 208).

## Steps

1. After `const isMouseDown = useRef<boolean>(false);` (line 110), add:
   ```tsx
     const swipeStartTime = useRef(0);
     const [flyOut, setFlyOut] = useState<{ x: number; y: number } | null>(null);
     // The card on screen, read by the delayed rating of a swipe throw.
     const currentCardIdRef = useRef<string | undefined>(undefined);
   ```
   Then, directly after `const currentCard = queue[currentIndex];` (line 157), add:
   ```tsx
     useEffect(() => {
       currentCardIdRef.current = currentCard?.id;
     });
   ```
   `useEffect`, `useRef` and `useState` are already imported (line 1).

2. In `handleTouchStart`, after `touchStartY.current = e.touches[0].clientY;`, add
   `swipeStartTime.current = performance.now();`.

3. In `handleMouseDown`, after `mouseStartY.current = e.clientY;`, add
   `swipeStartTime.current = performance.now();`.

4. Directly above `handleTouchStart` (after the comment
   `// Live Tactile Gestures (Swipe Left: Again, Right: Good, Up: Easy, Down: Hard)`), add:
   ```tsx
     // A horizontal swipe counts past 60px or as a quick flick (24px+ faster than 0.11px/ms).
     // Vertical swipes need 60px, since fast vertical movement is usually the page scrolling.
     // A rating throws the card off in the swipe's direction, then rates it.
     const finishSwipe = (deltaX: number, deltaY: number, showFeedback: boolean) => {
       if (flyOut) return;
       const absX = Math.abs(deltaX);
       const absY = Math.abs(deltaY);
       const horizontal = absX > absY;
       const elapsed = Math.max(1, performance.now() - swipeStartTime.current);
       const isSwipe = horizontal ? absX > 60 || (absX >= 24 && absX / elapsed > 0.11) : absY > 60;
       if (!isSwipe) return;

       const rating: FSRSRating = horizontal ? (deltaX > 0 ? 'good' : 'again') : deltaY < 0 ? 'easy' : 'hard';
       if (showFeedback) {
         const label = { good: 'Swipe Right: Good', again: 'Swipe Left: Again', easy: 'Swipe Up: Easy', hard: 'Swipe Down: Hard' }[rating];
         setTouchFeedback(label);
         setTimeout(() => setTouchFeedback(null), 1000);
       }

       if (!isAnswerRevealed) {
         handleRevealAnswer();
         return;
       }
       if (!currentCard || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
         handleRate(rating);
         return;
       }
       const ratedCardId = currentCard.id;
       setFlyOut(
         horizontal
           ? { x: Math.sign(deltaX) * window.innerWidth, y: deltaY }
           : { x: deltaX, y: Math.sign(deltaY) * window.innerHeight },
       );
       setTimeout(() => {
         if (currentCardIdRef.current === ratedCardId) handleRate(rating);
         setFlyOut(null);
       }, 200);
     };
   ```
   `FSRSRating` is `'again' | 'hard' | 'good' | 'easy'` (`src/types/index.ts:283`) and is already imported (line 19).

5. In `handleTouchEnd`, replace everything from `const absX = Math.abs(deltaX);` through the closing
   `}` of the `else if (absY > 60 && absY > absX) { ... }` block (the code quoted in Problem 2) with:
   ```tsx
       finishSwipe(deltaX, deltaY, true);
   ```
   Keep the `deltaX`/`deltaY` lines above it and the four reset lines below it
   (`touchStartX.current = null;` … `setIsSwipingActive(false);`).

6. In `handleMouseUp`, replace the whole `if (touchOffset) { ... }` block with:
   ```tsx
       if (touchOffset) finishSwipe(touchOffset.x, touchOffset.y, false);
   ```
   Keep the first line (`if (!isMouseDown.current) return;`) and the reset lines after the block.

7. Replace the card's `style` object (lines 839-845, quoted in Problem 1) with:
   ```tsx
               style={{
                 touchAction: 'pan-y',
                 transform: flyOut
                   ? `translate3d(${flyOut.x}px, ${flyOut.y}px, 0) rotate(${Math.max(-12, Math.min(12, flyOut.x * 0.03))}deg)`
                   : touchOffset
                     ? `translate3d(${touchOffset.x}px, ${touchOffset.y * 0.4}px, 0) rotate(${touchOffset.x * 0.05}deg)`
                     : undefined,
                 opacity: flyOut ? 0 : undefined,
                 transition:
                   touchOffset && !flyOut
                     ? 'none'
                     : `transform ${flyOut ? 200 : 300}ms var(--motion-ease-out), opacity 200ms var(--motion-ease-out), border-color 0.2s ease`,
               }}
   ```

## Boundaries

- Do NOT change keyboard, controller or button rating paths, or `handleRate` / `handleRevealAnswer`.
- Do NOT change the drag-follow transform while the finger is down (`touchOffset * 0.4`,
  `* 0.05deg`).
- Do NOT change the swipe direction → rating mapping or the feedback badge texts.
- Do NOT touch `card-deal` or other CSS. Plan 001 owns those.
- If any quoted code does not match what you find, STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run lint` (no errors), `npm run build` (succeeds, no type errors),
  `npx vitest run src` (all pass).
- **Feel check**: on a real phone if possible (`npm run dev -- --host`, then open the printed
  network URL), otherwise Chrome DevTools device mode with touch. Open a ready-made deck:
  - Before revealing: swipe right. The answer shows and the card glides back to center with no
    bounce past center.
  - After revealing: swipe right past the screen edge. The card flies off to the right and fades;
    the next card then deals in. Nothing moves back toward the center.
  - After revealing: do a short, fast flick left (about 3cm). It must count as "Again".
  - Slowly drag 2cm left and release. Nothing is rated; the card returns to center.
  - Scroll the page by swiping vertically on the card. No card gets rated unless the vertical
    drag is longer than 60px.
  - Swipe to rate and press `3` on the keyboard straight after. Exactly one card gets rated per
    action. Check the session progress counter.
  - With `prefers-reduced-motion: reduce` emulated, a rating swipe rates instantly with no throw.
  - Desktop: drag the card with the mouse past 60px. It throws and rates with no feedback badge,
    as before.
- **Done when**: committed swipes always leave in their direction, flicks count horizontally,
  no double ratings occur, and the mechanical checks pass.
