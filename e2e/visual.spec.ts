import { expect, test, type Page } from '@playwright/test';
import { seedDeck } from './helpers';

/**
 * Visual snapshots of key screens (DESIGN.md), for design work: run `npm run e2e:visual` after a UI
 * change and look at the image diffs in the report (`npx playwright show-report`). When a change is
 * intended, accept it with `npm run e2e:visual -- --update-snapshots` and commit the new images.
 *
 * Tagged @visual and left out of `npm run e2e` (and so of CI): screenshots differ slightly between
 * machines and browser builds, and CI gates production deploys. The baselines were made in the
 * Linux cloud environment Claude Code sessions run in.
 */

const FIXED_NOW = new Date('2026-11-23T10:00:00');

test.use({ reducedMotion: 'reduce' });

async function start(page: Page, theme: 'paper' | 'dark') {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.addInitScript(t => {
    localStorage.setItem('axon_theme', t);
    localStorage.setItem('axon_tour_seen', 'true');
  }, theme);
  await seedDeck(page, { due: 3, later: 2 });
  await page.goto('/');
  await expect(page.locator('main#main')).toBeVisible();
}

async function snap(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() =>
    document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
  );
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, maxDiffPixelRatio: 0.01 });
}

async function open(page: Page, name: string) {
  const direct = page.getByRole('button', { name: new RegExp(`^${name}`) }).filter({ visible: true }).first();
  if (await direct.count()) await direct.click();
  else {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('dialog', { name: 'Navigation' }).getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
  }
}

for (const theme of ['paper', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test(`phone screens @visual`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await start(page, theme);
      await snap(page, `${theme}-phone-today`);
      for (const screen of ['Library', 'Insights']) {
        await open(page, screen);
        await expect(page.locator('main#main h1').first()).toBeVisible();
        await snap(page, `${theme}-phone-${screen.toLowerCase()}`);
      }
      await open(page, 'Today');
      await page.locator('section[aria-labelledby="today-session-title"]').getByRole('button', { name: 'Start review' }).click();
      await expect(page.getByText(/What is fact \d+\?/).first()).toBeVisible();
      await page.keyboard.press('Space');
      await expect(page.getByRole('group', { name: 'How well did you remember it?' })).toBeVisible();
      await snap(page, `${theme}-phone-review-answer`);
    });

    test(`desktop today @visual`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await start(page, theme);
      await snap(page, `${theme}-desktop-today`);
    });
  });
}
