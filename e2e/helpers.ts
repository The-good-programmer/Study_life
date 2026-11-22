import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const PASSWORD = 'Correct-Horse-9-Battery';

/** Fails the test on any error the page throws or logs. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return errors;
}

export const expectNoErrors = (errors: string[]) => expect(errors, errors.join('\n')).toEqual([]);

let accounts = 0;
/** A new account made through the API, with its token. */
export async function newAccount(request: APIRequestContext, name: string) {
  const email = `${name.toLowerCase()}.${Date.now()}.${accounts++}@example.com`;
  const res = await request.post('/api/auth/register', { data: { name, email, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return { email, token: body.token as string, id: body.user.id as string, name };
}

/** Signs in through the sign-in dialog. */
export async function signIn(page: Page, email: string) {
  await page.getByRole('button', { name: 'Sign in or register' }).first().click();
  await page.locator('input[type=email]').first().fill(email);
  await page.locator('input[type=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForFunction(() => !!localStorage.getItem('studify_auth_token_v1'));
  await page.keyboard.press('Escape');
}

/** Stands in for the AI: every request gets `reply(body)` as its text. */
export async function standInForAi(page: Page, reply: (body: { contents: unknown }) => string) {
  const calls: { contents: unknown }[] = [];
  await page.route('**/api/health', route => route.fulfill({ json: { status: 'ok', db: 'connected', aiProxyAvailable: true } }));
  await page.route('**/api/ai/generate', async route => {
    const body = route.request().postDataJSON();
    calls.push(body);
    await route.fulfill({ json: { success: true, text: reply(body) } });
  });
  return calls;
}

/** A deck with `due` cards due now and the rest not due yet, saved in this browser before the app starts. */
export async function seedDeck(page: Page, { due = 3, later = 0, userId }: { due?: number; later?: number; userId?: string } = {}) {
  await page.addInitScript(
    ({ due, later, userId }) => {
      localStorage.setItem('axon_tour_seen', 'true');
      if (localStorage.getItem('e2e_seeded')) return;
      localStorage.setItem('e2e_seeded', '1');
      const now = Date.now();
      const day = 86_400_000;
      const card = (i: number, dueInDays: number) => ({
        id: `c${i}`,
        conceptId: 'k',
        question: `What is fact ${i}?`,
        answer: `Fact number ${i}`,
        stability: 4,
        difficulty: 5,
        reps: 2,
        lapses: 0,
        lastReviewDate: new Date(now - 5 * day).toISOString(),
        nextReviewDate: new Date(now + dueInDays * day).toISOString(),
      });
      const cards = [...Array.from({ length: due }, (_, i) => card(i, -(due - i))), ...Array.from({ length: later }, (_, i) => card(due + i, 3))];
      const deck = {
        id: 'deck-a',
        title: 'Cells',
        category: 'Biology',
        description: '',
        currentConceptIndex: 0,
        currentPhase: 'retrieval',
        elapsedSeconds: 0,
        createdAt: new Date(now - 10 * day).toISOString(),
        concepts: [{ id: 'k', order: 1, title: 'Cells', estimatedMinutes: 5, mentalModel: '', coreTakeaways: [], keyTerms: [], feynmanPrompt: '', sampleMasteryExplanation: '', retrievalCards: cards }],
      };
      localStorage.setItem(userId ? `studify_sessions_v1_${userId}` : 'studify_sessions_v1', JSON.stringify([deck]));
    },
    { due, later, userId },
  );
}

/** The question on the card being shown. */
export const shownQuestion = (page: Page) => page.locator('p, h2, h3').filter({ hasText: /^What is fact \d+\?|^Fixed:/ }).first();
