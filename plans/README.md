# Animation plans

Written by the `improve-animations` skill from an audit of the app's motion at commit `d249d9e`.
Each plan stands alone: it quotes the current code, gives exact target values, and says how to
check the result by eye. Any agent can execute one without other context.

| # | Plan | Severity | Status |
|---|---|---|---|
| 001 | [Make the review-card motion quick enough for keyboard reviewing](001-quicker-review-card-motion.md) | HIGH | TODO |
| 002 | [Open the search palette (⌘K) instantly](002-instant-command-palette.md) | HIGH | TODO |
| 003 | [Keep spinners and fades working when "reduce motion" is on](003-reduced-motion-keeps-feedback.md) | MEDIUM | TODO |
| 004 | [A swipe throws the card off in its direction, and quick flicks count](004-swipe-throws-the-card.md) | MEDIUM | TODO |
| 005 | [Slide the phone menu in from the left edge](005-mobile-drawer-slides-in.md) | MEDIUM | TODO |

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

## Audit findings not planned

Lower-value findings from the same audit, kept here so they are not lost:

- LOW: the audio equalizer bars (`src/index.css`, `@keyframes eq-jump-1` to `eq-jump-4`) animate
  `height` nonstop while audio plays. `transform: scaleY()` with `transform-origin: bottom` would
  avoid layout work on every frame.
- LOW: four near-identical hand-typed curves (`cubic-bezier(0.2, 0.8, 0.2, 1)`,
  `(0.16, 1, 0.3, 1)`, `(0.3, 0.7, 0.3, 1)` and the built-in `ease-out` on `fadeIn`) could all use
  `--motion-ease-out`. The page-switch `fadeIn` could also drop from 240ms to about 180ms.
- LOW: 11 hover scale or shift effects (for example `DailyMissionHome.tsx:878`,
  `UserAvatarBadge.tsx:57`) are not limited to mouse devices, so they can stick after a tap on
  phones. Wrap them with Tailwind's `[@media(hover:hover)_and_(pointer:fine)]:` variant.
