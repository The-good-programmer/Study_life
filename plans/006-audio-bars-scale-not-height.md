# 006 — Animate the audio bars with scale, not height

- **Status**: DONE
- **Commit**: 918b5bf
- **Severity**: LOW
- **Category**: Performance
- **Estimated scope**: 2 files, about 25 changed lines (`src/index.css`, `src/components/cockpit/AudioWaveformVisualizer.tsx`)

## Problem

Two sets of small bars animate `height`, which makes the browser recalculate layout on every frame
for as long as they run.

**1. The equalizer while audio plays** (`src/components/audio/AudioBriefingBar.tsx:96-101`): four
2px bars in a `flex h-4 items-end` row loop forever:

```css
/* src/index.css:293-317 — current */
/* Equalizer animations for Audio Engine */
@keyframes eq-jump-1 {
  0%, 100% { height: 3px; }
  50% { height: 14px; }
}

@keyframes eq-jump-2 {
  0%, 100% { height: 14px; }
  50% { height: 4px; }
}

@keyframes eq-jump-3 {
  0%, 100% { height: 6px; }
  50% { height: 16px; }
}

@keyframes eq-jump-4 {
  0%, 100% { height: 12px; }
  50% { height: 3px; }
}

.animate-eq-1 { animation: eq-jump-1 0.75s ease-in-out infinite; }
.animate-eq-2 { animation: eq-jump-2 0.55s ease-in-out 0.15s infinite; }
.animate-eq-3 { animation: eq-jump-3 0.85s ease-in-out 0.3s infinite; }
.animate-eq-4 { animation: eq-jump-4 0.65s ease-in-out 0.05s infinite; }
```

**2. The speech visualizer** while listening or reading aloud. The bars sit in a
`flex h-5 items-center` row, and each audio level change transitions `height`:

```tsx
// src/components/cockpit/AudioWaveformVisualizer.tsx:46-51 — current
        {(isActive ? heights : Array<number>(barCount).fill(12)).map((h, idx) => (
          <span
            key={idx}
            className={cn('w-0.5 rounded-full transition-[height] duration-100 ease-out', barColor)}
            style={{ height: `${isActive ? h : 12}%`, opacity: isActive ? 0.35 + (h / 100) * 0.65 : 0.3 }}
          />
```

## Target

Each bar is full height and is shrunk with `transform: scaleY()`, which the compositor handles
without layout. The shapes are the same: each old pixel height divided by the 16px row height
(`h-4`) gives the scale.

```css
/* target — replaces src/index.css:293-317 */
/* Equalizer animations for Audio Engine. Each bar is full height and scales, so the loop never
   triggers layout: scale = old pixel height / 16px row. */
@keyframes eq-jump-1 {
  0%, 100% { transform: scaleY(0.1875); }
  50% { transform: scaleY(0.875); }
}

@keyframes eq-jump-2 {
  0%, 100% { transform: scaleY(0.875); }
  50% { transform: scaleY(0.25); }
}

@keyframes eq-jump-3 {
  0%, 100% { transform: scaleY(0.375); }
  50% { transform: scaleY(1); }
}

@keyframes eq-jump-4 {
  0%, 100% { transform: scaleY(0.75); }
  50% { transform: scaleY(0.1875); }
}

.animate-eq-1,
.animate-eq-2,
.animate-eq-3,
.animate-eq-4 {
  height: 100%;
  transform-origin: bottom;
}

.animate-eq-1 { animation: eq-jump-1 0.75s ease-in-out infinite backwards; }
.animate-eq-2 { animation: eq-jump-2 0.55s ease-in-out 0.15s infinite backwards; }
.animate-eq-3 { animation: eq-jump-3 0.85s ease-in-out 0.3s infinite backwards; }
.animate-eq-4 { animation: eq-jump-4 0.65s ease-in-out 0.05s infinite backwards; }
```

```tsx
// target — AudioWaveformVisualizer.tsx. The row is items-center, so the default (center) origin
// keeps the same symmetric growth as before.
          <span
            key={idx}
            className={cn('h-full w-0.5 rounded-full transition-transform duration-100 ease-out', barColor)}
            style={{ transform: `scaleY(${(isActive ? h : 12) / 100})`, opacity: isActive ? 0.35 + (h / 100) * 0.65 : 0.3 }}
          />
```

`backwards` fill makes each bar sit at its first frame during its start delay; without it, a
delayed bar would show at full height until it starts. `ease-in-out` stays on the equalizer: a constant back-and-forth oscillation is on-screen movement,
which is what ease-in-out is for.

## Repo conventions to follow

- Standalone animation classes outside `@theme` live together in `src/index.css`, next to these
  keyframes (`.animate-pulse-subtle`, `.animate-slideUp`).

## Steps

1. Replace `src/index.css:293-317` with the Target CSS block.
2. In `src/components/cockpit/AudioWaveformVisualizer.tsx:49-50`, replace the bar's `className` and
   `style` with the Target versions.

## Boundaries

- Do NOT change `AudioBriefingBar.tsx`: its markup works as is.
- Do NOT change bar counts, colors, timings, delays or the opacity formula.
- If any quoted code does not match what you find, STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run lint` (no errors), `npm run build` (succeeds),
  `grep -n "height:" src/index.css | grep -i eq` (no keyframe sets `height`).
- **Feel check**: `npm run dev`.
  - Start an audio briefing (Focus page, or the audio bar after opening a deck). The four bars
    bounce from the bottom edge exactly as before.
  - Use "Speak" on an answer, or have an answer read aloud. The visualizer bars grow and shrink
    from their middle as before.
  - In DevTools, open the Performance panel and record 3 seconds while the equalizer runs: no
    purple "Layout" entries repeat every frame.
- **Done when**: both sets of bars look the same as before and no longer animate `height`.
