# Studify: product brief

Read before any UI work. It says who Studify is for and how it should feel. How it looks in detail
(tokens, components, motion) lives in `DESIGN.md`. Written from the owner's answers, November 2026.

## Who it's for

**Teenagers through university students** (roughly 13–25): secondary school, sixth form or high
school, and university. They study for exams with flashcards, their own notes and PDFs, a planner,
and focus sessions. Many use Studify on a phone, often as the installed app.

Design consequences:
- Speak to a capable young adult. Not childish, not corporate.
- Assume short sessions on a phone, often between other things. The next action must be obvious
  at a glance.
- Content is the student's own: deck titles, notes and names can be long, short, empty or in any
  language.

## How it should feel

**Calm · Focused · Premium**

| Word | Means | Does not mean |
|---|---|---|
| Calm | Quiet colors, generous space, no visual noise, motion that settles softly. Nothing competes for attention while studying. | Empty, grey, lifeless. |
| Focused | One clear primary action per screen. Studying (the review session, the focus timer) gets the whole screen. | Hiding useful things behind menus. |
| Premium | Precise alignment, consistent tokens, crafted details (press states, transitions, typography), nothing that looks unfinished. | Expensive-looking decoration, glossy effects. |

## References

The owner named **Gizmo** and **Duolingo** "and similar": study apps that make learning feel like a
game. Claude's reading of what to borrow (correct it if wrong):

- **Borrow:** energy at reward moments (finishing a session, keeping a streak, mastering a deck);
  progress that is always visible and satisfying; friendly, encouraging copy; illustrations and
  color that make screens feel alive; one big, obvious button for the next step.
- **Don't borrow:** constant noise, nagging, or loud color everywhere. These would break *calm*
  and *focused*.

**Reconciling the two:** a calm, focused base where studying happens, with Duolingo-style warmth
and delight concentrated in moments that deserve it: progress, rewards, empty states and first-time
experiences.

## What to fix

- **"Some parts feel empty and boring"** (owner's words). The top priority for screen reviews: find
  screens and states that feel bare (empty states, plain lists, screens with no sense of progress)
  and give them life through content, progress, illustration and moments of delight. Not through
  more chrome or decoration.

## Phones: big and simple

On phones, prefer **big and simple** over dense:
- One main action per screen, as a large tap target near the thumb.
- Fewer items per row; larger type for what matters most.
- Push secondary information down or behind a tap rather than shrinking everything.

## Open decisions

- **Axo, the 2D axolotl mascot**, still appears in 5 places: Today (`DailyMissionHome.tsx`), the
  empty Library (`IngestionHub.tsx`), the session summary (`SessionSummary.tsx`), community decks
  (`CommunityDecksPanel.tsx`) and the set-up assistant (`SetupAssistant.tsx`). The 3D axolotl world
  is already off (`VITE_ENABLE_3D_WORLD`). The owner thought the axolotl had been removed: decide
  whether Axo stays, is replaced, or goes.
