import { expect, test } from '@playwright/test';
import { expectNoErrors, newAccount, seedDeck, shownQuestion, signIn, standInForAi, watchErrors } from './helpers';

test('a first visit starts with "What do you want to study?" and a ready-made deck opens its flashcards', async ({ page }) => {
  const errors = watchErrors(page);
  const loaded: string[] = [];
  page.on('request', r => loaded.push(r.url()));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const quickStart = page.getByRole('dialog', { name: 'What do you want to study?' });
  await expect(quickStart).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByText('Exam')).toHaveCount(0);
  // Only what a first visit needs: no AI library and no Google sign-in script.
  expect(loaded.filter(url => /vendor-genai|accounts\.google\.com/.test(url))).toEqual([]);
  await quickStart.getByRole('button', { name: /AP Biology/ }).click();
  await expect(page.getByRole('button', { name: /Show answer/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'What do you want to study?' })).toHaveCount(0);
  expectNoErrors(errors);
});

test("today's review: a missed card comes back, and Undo puts it back", async ({ page }) => {
  const errors = watchErrors(page);
  await seedDeck(page, { due: 4 });
  await page.goto('/');
  await page.locator('section[aria-labelledby="today-session-title"]').getByRole('button', { name: 'Start review' }).click();
  await expect(shownQuestion(page)).toBeVisible();
  const first = await shownQuestion(page).textContent();
  await page.keyboard.press('Space');
  await page.keyboard.press('1'); // Again
  await expect(page.getByText(/^1\s*\/\s*5$/).or(page.getByText('2 / 5'))).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo last rating' })).toBeVisible();
  await page.keyboard.press('z');
  await expect(shownQuestion(page)).toHaveText(first!);
  const lapses = await page.evaluate(() => JSON.parse(localStorage.getItem('studify_cards_v1') || '[]').find((c: { id: string }) => c.id === 'c0')?.lapses ?? 0);
  expect(lapses).toBe(0);
  expectNoErrors(errors);
});

test('a card can be fixed and hidden during a review, and Undo brings it back', async ({ page }) => {
  const errors = watchErrors(page);
  await seedDeck(page, { due: 3 });
  await page.goto('/');
  await page.locator('section[aria-labelledby="today-session-title"]').getByRole('button', { name: 'Start review' }).click();
  await expect(shownQuestion(page)).toHaveText('What is fact 0?');
  await page.keyboard.press('e');
  await page.getByLabel('Question').fill('Fixed: what is fact 0?');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(shownQuestion(page)).toHaveText('Fixed: what is fact 0?');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('studify_sessions_v1')!)[0].concepts[0].retrievalCards[0].question);
  expect(stored).toBe('Fixed: what is fact 0?');

  await page.getByRole('button', { name: 'Edit or hide this card (E)' }).click();
  await page.getByRole('button', { name: 'Hide this card', exact: true }).click();
  await expect(shownQuestion(page)).toHaveText('What is fact 1?');
  await page.keyboard.press('z');
  await expect(shownQuestion(page)).toHaveText('Fixed: what is fact 0?');
  expectNoErrors(errors);
});

test('photos of notes are written out into the notes box', async ({ page, request }) => {
  const errors = watchErrors(page);
  const me = await newAccount(request, 'Photo');
  await page.addInitScript(() => localStorage.setItem('axon_tour_seen', 'true'));
  const calls = await standInForAi(page, () => 'Cell membrane\n- Made of a lipid bilayer');
  await page.goto('/');
  await signIn(page, me.email);
  await page.getByRole('button', { name: 'Library', exact: true }).first().click();
  await page.getByRole('tab', { name: 'Notes' }).click();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAAEklEQVR4nGP4z8CAB+GTG8HSALfKY52fTcuYAAAAAElFTkSuQmCC', 'base64');
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'notes.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByLabel('Your notes')).toHaveValue(/lipid bilayer/);
  expect(JSON.stringify(calls[0])).toContain('image/jpeg');
  expectNoErrors(errors);
});

test('friends: an invite link makes two students friends, and a duel is played by both', async ({ browser, request }) => {
  const ana = await newAccount(request, 'Ana');
  const ben = await newAccount(request, 'Ben');

  // Ana shares her invite link; Ben opens it signed out, signs in, and adds her.
  const anaContext = await browser.newContext();
  const anaPage = await anaContext.newPage();
  const anaErrors = watchErrors(anaPage);
  await seedDeck(anaPage, { due: 2, later: 4, userId: ana.id });
  await anaPage.goto('/');
  await signIn(anaPage, ana.email);
  const { code } = await (await request.get('/api/friends', { headers: { Authorization: `Bearer ${ana.token}` } })).json();

  const benContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const benPage = await benContext.newPage();
  const benErrors = watchErrors(benPage);
  await benPage.addInitScript(() => localStorage.setItem('axon_tour_seen', 'true'));
  await benPage.goto(`/?friend=${code}`);
  await benPage.getByText('Already have an account? Log in').click();
  await benPage.locator('input[type=email]').first().fill(ben.email);
  await benPage.locator('input[type=password]').first().fill('Correct-Horse-9-Battery');
  await benPage.locator('form button[type=submit]').first().click();
  const friends = benPage.getByRole('dialog', { name: 'Friends' });
  await expect(friends.locator('input')).toHaveValue(code);
  await friends.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(benPage.getByText(/are now friends/)).toBeVisible();
  await benPage.keyboard.press('Escape');

  // Ana challenges Ben on her deck.
  await anaPage.reload();
  await anaPage.getByRole('heading', { name: 'Friends this week' }).scrollIntoViewIfNeeded();
  await anaPage.getByRole('button', { name: 'Challenge', exact: true }).click();
  await anaPage.getByRole('dialog', { name: 'Challenge a friend' }).getByRole('button', { name: /Ben/ }).click();
  await anaPage.getByRole('button', { name: /Cells/ }).click();
  for (let i = 0; i < 6; i++) {
    await anaPage.locator('div[role=dialog] button').filter({ hasText: /^\d/ }).first().click();
    await anaPage.waitForTimeout(400);
  }
  await expect(anaPage.getByText('Sent to Ben')).toBeVisible();

  // Ben plays it from Today.
  await benPage.reload();
  await benPage.getByRole('button', { name: 'Play' }).click();
  await benPage.getByRole('dialog').getByRole('button', { name: 'Start', exact: true }).click();
  for (let i = 0; i < 6; i++) {
    await benPage.locator('div[role=dialog] button').filter({ hasText: /^\d/ }).first().click();
    await benPage.waitForTimeout(400);
  }
  await expect(benPage.getByText(/You won!|Ana won|A draw/)).toBeVisible();
  expectNoErrors(anaErrors);
  expectNoErrors(benErrors);
  await anaContext.close();
  await benContext.close();
});

test('a public deck page shows its cards and opens them in the app with one tap', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/decks/');
  await expect(page.getByRole('heading', { name: 'Learn anything in 3 minutes a day' })).toBeVisible();
  await page.getByRole('link', { name: /How Memory Works/ }).first().click();
  await expect(page).toHaveURL(/\/decks\/demo-memory-neuroscience\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('How Memory Works');
  expect(await page.locator('ol.cards li').count()).toBeGreaterThan(10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.getByRole('link', { name: 'Study these cards free' }).click();
  // Straight into the deck's flashcards: no first-visit dialog, and the link's ?deck= is gone.
  await expect(page.getByRole('button', { name: /Show answer/ })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'What do you want to study?' })).toHaveCount(0);
  expect(new URL(page.url()).search).toBe('');
  expectNoErrors(errors);
});
