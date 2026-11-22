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
  await page.getByRole('button', { name: 'Library', exact: true }).first().click();
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
