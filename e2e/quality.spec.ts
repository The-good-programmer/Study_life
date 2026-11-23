import { expect, test } from '@playwright/test';
import { expectNoErrors, newAccount, signIn, watchErrors } from './helpers';

const generatedDeck = {
  title: 'Cells',
  category: 'Biology',
  description: 'How cells make energy',
  concepts: [
    {
      title: 'Mitochondria',
      mentalModel: 'A power plant.',
      coreTakeaways: ['They make ATP'],
      keyTerms: [],
      feynmanPrompt: 'Explain it to a friend.',
      sampleMasteryExplanation: '',
      retrievalCards: [
        { question: 'Which organelle makes ATP?', answer: 'Mitochondria', cardType: 'standard' },
        { question: 'What carries genetic instructions?', answer: 'Ribosome', cardType: 'standard' },
        { question: 'Which organelle makes ATP? ', answer: 'Mitochondria', cardType: 'standard' },
        { question: '', answer: 'An empty card', cardType: 'standard' },
      ],
    },
  ],
};

test('a new deck is cleaned up and checked by the AI before it is studied', async ({ page, request }) => {
  const errors = watchErrors(page);
  const me = await newAccount(request, 'Checker');
  await page.addInitScript(() => localStorage.setItem('axon_tour_seen', 'true'));
  await page.route('**/api/health', route => route.fulfill({ json: { status: 'ok', db: 'connected', aiProxyAvailable: true } }));
  let review: unknown = null;
  await page.route('**/api/ai/generate', async route => {
    const body = route.request().postDataJSON();
    if (JSON.stringify(body.responseSchema ?? {}).includes('verdict')) {
      review = body;
      const ids = [...String(body.contents).matchAll(/\[(rc-[^\]]+)\]/g)].map(m => m[1]);
      await new Promise(resolve => setTimeout(resolve, 800)); // long enough to see the step
      await route.fulfill({ json: { success: true, text: JSON.stringify({ cards: [{ id: ids[0], verdict: 'ok' }, { id: ids[1], verdict: 'fix', answer: 'DNA', reason: 'Ribosomes build proteins' }] }) } });
      return;
    }
    await route.fulfill({ json: { success: true, text: JSON.stringify(generatedDeck) } });
  });

  await page.goto('/');
  await signIn(page, me.email);
  await page.getByRole('button', { name: /^Library\b/ }).first().click();
  await page.getByLabel('Topic to study').fill('Cells');
  await page.getByLabel('Topic to study').press('Enter');
  await expect(page.getByText('Checking', { exact: false }).first()).toBeVisible();
  const savedDeck = () => page.evaluate(id => JSON.parse(localStorage.getItem(`studify_sessions_v1_${id}`) || '[]')[0] ?? null, me.id);
  await expect.poll(savedDeck, { timeout: 20_000 }).not.toBeNull();

  expect(review).not.toBeNull();
  const deck = await savedDeck();
  // The repeat and the empty card are gone, the wrong answer is fixed, and the check is recorded.
  expect(deck.concepts[0].retrievalCards.map((c: { question: string; answer: string }) => [c.question, c.answer])).toEqual([
    ['Which organelle makes ATP?', 'Mitochondria'],
    ['What carries genetic instructions?', 'DNA'],
  ]);
  expect(deck.quality).toEqual({ checked: 2, fixed: 1, removed: 0 });
  expectNoErrors(errors);
});

test('an error in the app is reported to the server', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('axon_tour_seen', 'true'));
  await page.goto('/');
  const report = page.waitForResponse(res => res.url().endsWith('/api/client-errors'));
  await page.evaluate(() => setTimeout(() => {
    throw new Error('e2e: something broke');
  }));
  const res = await report;
  expect(res.status()).toBe(204);
  expect(res.request().postDataJSON()).toMatchObject({ kind: 'error', message: 'Error: e2e: something broke', path: '/' });
});

test('a guest makes one free AI deck, is offered to keep it, and is asked to sign up for the next', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    localStorage.setItem('studify_guest_education_profile_v1', JSON.stringify({ age: 16, country: 'US', grade: '11th grade' })),
  );
  await page.route('**/api/health', route => route.fulfill({ json: { status: 'ok', db: 'connected', aiProxyAvailable: true } }));
  // This test server has no Gemini key, so the pass and the AI are stood in for (the server's side is unit-tested).
  let passes = 0;
  await page.route('**/api/ai/guest-pass', route => {
    passes += 1;
    return route.fulfill({ json: { pass: 'test-pass', expiresIn: 1800, requests: 4 } });
  });
  const aiCalls: { pass: string | undefined; signedIn: boolean; review: boolean }[] = [];
  await page.route('**/api/ai/generate', async route => {
    const body = route.request().postDataJSON();
    const headers = route.request().headers();
    const review = JSON.stringify(body.responseSchema ?? {}).includes('verdict');
    aiCalls.push({ pass: headers['x-guest-pass'], signedIn: Boolean(headers.authorization), review });
    const text = review ? JSON.stringify({ cards: [] }) : JSON.stringify(generatedDeck);
    await route.fulfill({ json: { success: true, text } });
  });

  await page.goto('/');
  const quickStart = page.getByRole('dialog', { name: 'What do you want to study?' });
  await expect(quickStart.getByText('your first deck is free')).toBeVisible();
  await quickStart.getByLabel(/Type a topic/).fill('Cells');
  await quickStart.getByRole('button', { name: 'Make my deck' }).click();
  await expect(page.getByRole('heading', { name: 'Mitochondria' })).toBeVisible({ timeout: 20_000 }); // the deck's session opens

  // Written and checked on the guest's pass, without an account.
  expect(passes).toBe(1);
  expect(aiCalls.map(c => [c.pass, c.signedIn, c.review])).toEqual([['test-pass', false, false], ['test-pass', false, true]]);

  // Back home: an offer to keep the deck.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Keep your deck' })).toBeVisible();

  // A second deck needs an account.
  await page.getByRole('button', { name: /^Library\b/ }).first().click();
  await page.getByLabel('Topic to study').fill('Atoms');
  await page.getByLabel('Topic to study').press('Enter');
  await expect(page.getByRole('dialog').first()).toBeVisible(); // sign-in, instead of making the deck
  expect(passes).toBe(1);
  expectNoErrors(errors);
});
