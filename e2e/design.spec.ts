import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { expectNoErrors, seedDeck, watchErrors } from './helpers';

/**
 * Design checks (DESIGN.md): every main screen passes axe-core's WCAG 2.2 A/AA rules (contrast,
 * labels, names, structure) in both themes, at phone and desktop width. A pull request that adds a
 * contrast or labelling problem fails here.
 *
 * Reduced motion is on, and each check waits for running animations to finish, so axe never
 * measures a screen mid-fade or mid-theme-switch; colors and layout are unaffected.
 */
test.use({ reducedMotion: 'reduce' });

const THEMES = ['paper', 'dark'] as const;
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 900 },
] as const;

type Theme = (typeof THEMES)[number];

async function startIn(page: Page, theme: Theme, { withDeck }: { withDeck: boolean }) {
  await page.addInitScript(t => {
    localStorage.setItem('axon_theme', t);
    localStorage.setItem('axon_tour_seen', 'true');
  }, theme);
  if (withDeck) await seedDeck(page, { due: 3, later: 2 });
  await page.goto('/');
  await expect(page.locator('main#main')).toBeVisible();
}

/** Opens a screen from the sidebar, or from the phone's menu drawer when the sidebar is hidden. */
async function openScreen(page: Page, name: string) {
  const direct = page.getByRole('button', { name: new RegExp(`^${name}`) }).filter({ visible: true }).first();
  if (await direct.count()) {
    await direct.click();
  } else {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('dialog', { name: 'Navigation' }).getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
  }
}

/** Waits until every finite animation has finished, so axe never measures text mid-fade. */
async function settle(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
  );
}

/** Runs axe on the page and fails with a readable list of what broke, and where. */
async function expectAccessible(page: Page, where: string) {
  await settle(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const report = violations.flatMap(v =>
    v.nodes.slice(0, 3).map(n => `${where}: [${v.impact}] ${v.id} — ${v.help}\n    at ${n.target.join(' ')}\n    ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`),
  );
  // AXE_COLLECT=<file> records every finding instead of stopping at the first screen that fails,
  // for design reviews: AXE_COLLECT=axe.jsonl npx playwright test e2e/design.spec.ts
  if (process.env.AXE_COLLECT) {
    const { appendFileSync } = await import('node:fs');
    for (const v of violations) for (const n of v.nodes) appendFileSync(process.env.AXE_COLLECT, JSON.stringify({ where, id: v.id, target: n.target.join(' '), html: n.html.slice(0, 160), why: n.failureSummary?.split('\n')[1]?.trim() }) + '\n');
    return;
  }
  expect(report, report.join('\n')).toEqual([]);
}

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`${theme} theme, ${viewport.name}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test('main screens with a deck are accessible', async ({ page }) => {
        const errors = watchErrors(page);
        await startIn(page, theme, { withDeck: true });
        await expectAccessible(page, 'Today');

        for (const screen of ['Library', 'Focus', 'Insights', 'Planner']) {
          await openScreen(page, screen);
          await expect(page.locator('main#main h1').first()).toBeVisible();
          await expectAccessible(page, screen);
        }

        await openScreen(page, 'Settings');
        await expect(page.getByRole('dialog').first()).toBeVisible();
        await expectAccessible(page, 'Settings');
        expectNoErrors(errors);
      });

      test('a review session is accessible, before and after the answer shows', async ({ page }) => {
        const errors = watchErrors(page);
        await startIn(page, theme, { withDeck: true });
        await page.locator('section[aria-labelledby="today-session-title"]').getByRole('button', { name: 'Start review' }).click();
        await expect(page.getByRole('button', { name: 'Undo last rating' }).or(page.getByText(/What is fact \d+\?/).first())).toBeVisible();
        await expectAccessible(page, 'Review, question');
        await page.keyboard.press('Space');
        await expect(page.getByRole('group', { name: 'How well did you remember it?' })).toBeVisible();
        await expectAccessible(page, 'Review, answer shown');
        expectNoErrors(errors);
      });

      test('empty states and sign-up are accessible', async ({ page }) => {
        const errors = watchErrors(page);
        await startIn(page, theme, { withDeck: false });
        await expectAccessible(page, 'Today, no decks');
        await openScreen(page, 'Library');
        await expect(page.locator('main#main h1').first()).toBeVisible();
        await expectAccessible(page, 'Library, no decks');

        await openScreen(page, 'Guest');
        await page.getByRole('tab', { name: /Create account/ }).or(page.getByRole('button', { name: /^Create account$/ })).first().click();
        await expect(page.getByRole('dialog').first()).toBeVisible();
        await page.locator('input[type=password]').first().fill('abcd1234');
        await expectAccessible(page, 'Sign-up, strong password');
        expectNoErrors(errors);
      });
    });
  }
}
