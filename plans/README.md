# Animation plans

Written by the `improve-animations` skill from an audit of the app's motion at commit `d249d9e`.
Each plan stands alone: it quotes the current code, gives exact target values, and says how to
check the result by eye. Any agent can execute one without other context.

| # | Plan | Severity | Status |
|---|---|---|---|
| 001 | [Make the review-card motion quick enough for keyboard reviewing](001-quicker-review-card-motion.md) | HIGH | DONE |
| 002 | [Open the search palette (⌘K) instantly](002-instant-command-palette.md) | HIGH | DONE |
| 003 | [Keep spinners and fades working when "reduce motion" is on](003-reduced-motion-keeps-feedback.md) | MEDIUM | DONE |
| 004 | [A swipe throws the card off in its direction, and quick flicks count](004-swipe-throws-the-card.md) | MEDIUM | DONE |
| 005 | [Slide the phone menu in from the left edge](005-mobile-drawer-slides-in.md) | MEDIUM | DONE |
| 006 | [Animate the audio bars with scale, not height](006-audio-bars-scale-not-height.md) | LOW | DONE |
| 007 | [One shared entrance curve, a quicker page fade, and no dead hover CSS](007-one-shared-entrance-curve.md) | LOW | DONE |

## Execution order

1. **001** first. It adds the shared curves `--motion-ease-out` and `--motion-ease-drawer` to
   `src/index.css`, which 004 and 005 use.
2. **002** and **003** in any order. They are independent of everything else.
3. **004**, after 001. It edits `RetrievalPhase.tsx` near the line 001 changes, so do them one
   after the other, not in parallel.
4. **005**, after 001.

## Dependencies

- 004 → 001 (uses `--motion-ease-out`; also edits the same card element)
- 005 → 001 (uses `--motion-ease-drawer`)

## Remaining audit findings

All three lower-value findings are handled:

- Audio equalizer animating `height`: plan 006, which also covers the speech visualizer bars.
- Near-identical hand-typed curves and the slow page fade: plan 007.
- Hover motion on touch screens: no change needed. Tailwind v4 already wraps every `hover:` and
  `group-hover:` utility in `@media (hover: hover)`, as checked in the built CSS. The only ungated
  hover motion was the unused `.glass-panel-interactive` class, which plan 007 removes.
