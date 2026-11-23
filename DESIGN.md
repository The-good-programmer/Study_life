# Studify design system

Read before building or changing UI, together with `PRODUCT.md` (who it's for and how it should
feel). This file has two parts:

- **System:** what exists in the code. Reuse it; don't invent parallel values.
- **Rules:** decisions the owner made, with the reason. Each rule records the date and the owner's
  words. New rules are added with the `learn-taste` skill, and only from the owner's own
  corrections or decisions.

---

# System

## Themes

- **Two themes**, switched at runtime by `data-theme` on `<html>`:
  - **Dark** is the `:root` default.
  - **Light ("paper")** is `[data-theme="paper"]`.
- First visit gets **paper**; returning users keep their choice (`index.html`, key `axon_theme`).
- Every screen must work in **both**. Never hard-code a color that only suits one theme.

## Color tokens

All defined in `src/index.css`, redefined per theme, and exposed as Tailwind colors
(`bg-surface`, `text-ink-muted`, `border-line`...). **Always use these, never raw hex or palette
classes** (`text-emerald-400` and similar are theme-blind and failed contrast before).

| Role | Tokens |
|---|---|
| Backgrounds | `canvas` (page), `canvas-raised` (bars, drawers), `surface` / `surface-hover` (cards on canvas), `surface-solid` (dialogs) |
| Lines | `line` (default), `line-strong` (inputs, emphasis) |
| Text | `ink` (primary), `ink-muted` (secondary), `ink-subtle` (hints; still 4.5:1 on every background) |
| Brand | `brand` (fills), `brand-hover`, `brand-soft` (tinted backgrounds), `brand-ink` (text on `brand`), `brand-text` (brand-colored text) |
| Status | `success`, `danger`, `gold` (streaks, rewards), `due` (cards due), each with `-soft`; `success-ink` and `danger-ink` for text on solid fills |

Contrast: text tokens are tuned to **at least 4.5:1** (WCAG AA) on their intended backgrounds in
both themes. `src/designTokens.test.ts` checks every pairing the components use, in both themes, on
every test run. When a component puts text on a new token pairing, add that pairing there.

## Typography

- **Geist** for UI and headings, **Geist Mono** for numbers and code (`--font-sans`,
  `--font-display`, `--font-mono`).
- Common sizes: body and controls `text-[13px]` to `text-[15px]`, small labels `text-xs` and
  `text-[11px]`, page titles `text-[26px]` to `text-[30px]`.
- Headings `h1`–`h4`: `letter-spacing: -0.02em` and `text-wrap: balance` (global).
- Numbers that change or line up: `tabular-nums`.
- Text: `…` not `...`; curly quotes.

## Spacing & layout

- Page container: `mx-auto w-full max-w-6xl space-y-6` (dashboards), narrower `max-w-2xl` to
  `max-w-3xl` for focused flows.
- Radii: `rounded-xl` (controls, small cards), `rounded-2xl` (cards), `rounded-3xl` (hero cards,
  the review card), `rounded-[22px]` (dialogs), `rounded-full` (pills, avatars).
- Phone: content must work at **390px**. Bars pinned to the bottom pad
  `env(safe-area-inset-bottom)`; the top bar and drawer pad `env(safe-area-inset-top)`.
- Touch targets: at least 24px, 44px for primary actions on phones.

## Components

Shared building blocks. Use these before writing new markup:

| Component | File | Notes |
|---|---|---|
| `Button` | `src/components/ui/primitives.tsx` | Variants `primary`, `secondary` (default), `ghost`, `gold`, `danger`; sizes `sm` (32px), `md` (40px), `lg` (48px). Has a pressed state. |
| `IconButton` | same | Square icon button. `label` is required and becomes `aria-label`. |
| `IconMedallion` | same | Icon in a soft tinted tile (`brand` or `success`, `md` or `lg`). Used where an illustration would go: empty states, finished moments. |
| `Card`, `Badge`, `ProgressBar`, `ProgressRing`, `SectionHeader`, `Kbd`, `Toggle` | same | `Badge` tones: `neutral`, `brand`, `gold`, `success`, `danger`, `due`. |
| `Dialog`, `DialogPanel`, `DialogHeader`, `DialogFooter` | `src/components/common/Dialog.tsx` | Focus trap, Escape, stacking. `animated={false}` for UI opened by keyboard shortcut. |
| `ConfirmDialog` | `src/components/common/ConfirmDialog.tsx` | For every destructive or data-changing confirmation. Never `window.confirm`. |
| `ActionMenu` | `src/components/ui/ActionMenu.tsx` | Overflow menus on cards. |

## Motion

Full reasoning in `plans/` (001–007).

- **Curves** (`src/index.css`, `:root`): `--motion-ease-out: cubic-bezier(0.23, 1, 0.32, 1)` for
  anything entering or moving; `--motion-ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` for drawers.
- **Entrance tokens** (`@theme`):
  - `animate-fadeIn` 180ms: pages and backdrops, opacity only.
  - `animate-rise` 300ms: dialog panels.
  - `animate-card-deal` 180ms and `animate-answer-unfold` 200ms: the review card.
  - `animate-drawer-in` 300ms: the phone drawer.
  - `animate-shake`: errors.
- **Fill mode `backwards` only, never `forwards`.** A lingering transform turns the element into
  the containing block for `position: fixed` children and misplaces modals.
- Animate `transform` and `opacity` only. Never `transition-all`; list properties
  (`transition-colors`, `transition-[transform,opacity]`).
- **Reduced motion** (global rule at the end of `src/index.css`): movement is removed, opacity fades
  stay (200ms), and `animate-spin` spinners pulse instead of freezing.
- Hover effects: Tailwind v4 already limits `hover:` to devices that can hover.

## Interaction

- Keyboard: Space reveals, 1–4 rate in reviews; ⌘K / Ctrl+K opens search. Keyboard-triggered UI
  appears instantly, without animation.
- Swipe on review cards: horizontal past 60px, or a quick flick (24px or more, faster than
  0.11px/ms); vertical past 60px only, because vertical movement is usually scrolling.
- Visible focus: a global `:focus-visible` outline in `--brand`. An input that removes it must show
  focus another way (border color).
- Every icon-only button has an `aria-label`; decorative icons are `aria-hidden`.

## Automatic checks

| Check | File | Runs |
|---|---|---|
| Token contrast: every text/background pairing reaches 4.5:1, and the focus ring 3:1, in both themes | `src/designTokens.test.ts` | `npm test`, and CI on every PR |
| Accessibility: axe-core WCAG 2.2 A/AA on Today, Library, Focus, Insights, Planner, Settings, a review (question and answer), empty Today and Library, and sign-up, in both themes at 390px and 1280px | `e2e/design.spec.ts` | `npm run e2e`, and CI on every PR |
| Visual snapshots of key screens | `e2e/visual.spec.ts` | On request: `npm run e2e:visual` (not in CI; screenshots vary slightly between machines) |

- To see every accessibility finding at once instead of the first failure:
  `AXE_COLLECT=axe.jsonl npx playwright test e2e/design.spec.ts`.
- After an intended visual change: `npm run e2e:visual -- --update-snapshots`, look at the new
  images, and commit them.
- Buttons with visible text take their name from that text. Use `aria-label` only when there is no
  visible text (icon-only, or the collapsed sidebar), so voice control users can say what they see
  (WCAG 2.5.3).

---

# Rules

Owner decisions, newest last. Format: the rule, why, and a dated comment with the owner's words.

## Feel

- **Studify feels calm, focused and premium; Duolingo- and Gizmo-style warmth and delight go only
  where they're earned: progress, rewards, streaks, empty states and first-time moments.**
  Why: the owner wants calm, focused and premium, and named Gizmo and Duolingo as references.
  Concentrating the energy keeps both true. *(Reconciliation proposed by Claude, confirmed by the
  owner.)*
  <!-- 2026-11-23: "calm, focused, premium" · references "Gizmo, duolingo, and similar" · confirmed: "Yes" -->

- **Never leave a screen or state feeling bare: empty states, plain lists and screens with no sense
  of progress get content, visible progress, an `IconMedallion` or illustration, and a clear next
  step. Not extra decoration or chrome.**
  Why: the owner finds some parts "empty and boring".
  <!-- 2026-11-23: "I feel like some parts are empty and boring" -->

## Spacing & layout

- **On phones, choose big and simple over dense: one main action per screen as a large button
  (44px or taller, `Button size="lg"`), fewer items per row, secondary information below or behind
  a tap.**
  Why: the owner prefers big and simple screens on phones.
  <!-- 2026-11-23: Q "dense information, or big and simple screens?" → "Big and simple" -->

## Surfaces

- **No mascot or character art. Where Axo the axolotl used to be (empty states, the session
  summary, the set-up assistant), use `IconMedallion`. Don't add a new mascot.**
  Why: the owner had the axolotl removed. A cartoon character also pulls against *calm* and
  *premium*. *(Second half proposed by Claude, confirmed by the owner.)*
  <!-- 2026-11-23: options remove / keep as accent / replace → "remove it" · no new mascot, confirmed: "Yes" -->
