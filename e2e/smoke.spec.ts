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
  await page.getByRole('button', { name: /^Library\b/ }).first().click();
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

test('a student shares a deck, and a classmate opens the link straight into its cards', async ({ browser, request }) => {
  const ana = await newAccount(request, 'Sharer');
  const anaContext = await browser.newContext();
  const anaPage = await anaContext.newPage();
  const anaErrors = watchErrors(anaPage);
  await seedDeck(anaPage, { due: 3, userId: ana.id });
  await anaPage.goto('/');
  await signIn(anaPage, ana.email);

  await anaPage.getByRole('button', { name: 'Details', exact: true }).first().click();
  await anaPage.getByRole('button', { name: 'Share deck' }).first().click();
  const share = anaPage.getByRole('dialog', { name: 'Share this deck' });
  await expect(share.getByText('a Studify student')).toBeVisible(); // ages default to 15: never named
  await share.getByLabel('What is it for?').fill('Cell biology facts for the unit test on Friday.');
  await share.getByRole('checkbox').check();
  await share.getByRole('button', { name: 'Share deck' }).click();
  const link = anaPage.getByLabel('Share link');
  await expect(link).toHaveValue(/\?shared=cells-/);
  const shareUrl = new URL(await link.inputValue());

  // A classmate without an account opens the link: the deck is added and its cards open.
  const benContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const benPage = await benContext.newPage();
  const benErrors = watchErrors(benPage);
  await benPage.goto(shareUrl.pathname + shareUrl.search);
  await expect(benPage.getByRole('button', { name: /Show answer/ })).toBeVisible();
  await expect(shownQuestion(benPage)).toHaveText(/What is fact \d\?/);
  // Ana's review history stayed with her: every card is new to Ben.
  const benReps = await benPage.evaluate(() =>
    (JSON.parse(localStorage.getItem('studify_sessions_v1') || '[]') as { concepts: { retrievalCards: { reps: number }[] }[] }[])
      .flatMap(deck => deck.concepts.flatMap(c => c.retrievalCards.map(card => card.reps))),
  );
  expect(benReps.length).toBeGreaterThan(0);
  expect(benReps.every(reps => reps === 0)).toBe(true);

  expectNoErrors(anaErrors);
  expectNoErrors(benErrors);
  await anaContext.close();
  await benContext.close();
});

test('a lesson in the timetable is logged after class: homework goes in the planner, the topic becomes cards', async ({ page, request }) => {
  const errors = watchErrors(page);
  const me = await newAccount(request, 'Pupil');
  await page.addInitScript(() => localStorage.setItem('axon_tour_seen', 'true'));
  const deckJson = JSON.stringify({
    title: 'Calvin cycle',
    category: 'Biology',
    description: 'Lesson cards',
    concepts: [
      {
        title: 'Calvin cycle',
        mentalModel: 'A sugar factory.',
        coreTakeaways: ['It runs in the stroma'],
        keyTerms: [],
        feynmanPrompt: 'Explain it.',
        sampleMasteryExplanation: '',
        retrievalCards: [
          { question: 'Where does the Calvin cycle run?', answer: 'In the stroma', cardType: 'standard' },
          { question: 'Which enzyme fixes CO2?', answer: 'RuBisCO', cardType: 'standard' },
        ],
      },
    ],
  });
  await standInForAi(page, body => (JSON.stringify(body).includes('verdict') ? JSON.stringify({ cards: [] }) : deckJson));
  await page.goto('/');
  await signIn(page, me.email);

  // A Biology lesson today that has already started.
  const today = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][(new Date().getDay() + 6) % 7];
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Planner' }).click();
  await page.getByRole('button', { name: 'Add lesson' }).first().click();
  const add = page.getByRole('dialog', { name: 'Add a lesson' });
  await add.getByLabel('Subject').fill('Biology');
  await add.getByRole('radio', { name: today }).click();
  await add.getByLabel('Starts').fill('00:00');
  await add.getByLabel('Ends').fill('00:01');
  await add.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Edit Biology/ }).first()).toBeVisible();

  // Today: log it.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /Today/ }).click();
  const afterClass = page.getByRole('region', { name: 'After class' });
  await afterClass.getByRole('button', { name: 'Log it' }).click();
  const log = page.getByRole('dialog', { name: 'What did you cover?' });
  await log.getByLabel('Topic').fill('The Calvin cycle');
  await log.getByLabel(/Homework/).fill('Worksheet 4');
  await log.getByRole('button', { name: 'Save and make cards' }).click();
  await expect(page.getByText(/2 cards added to Biology: class notes/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(afterClass.getByText(/The Calvin cycle · 2 cards/)).toBeVisible();

  // The homework is in the planner, and the cards are in the subject's class notes.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Planner' }).click();
  await expect(page.getByText('Biology: Worksheet 4').first()).toBeVisible();
  const deck = await page.evaluate(id => (JSON.parse(localStorage.getItem(`studify_sessions_v1_${id}`) || '[]') as { title: string; concepts: { retrievalCards: unknown[] }[] }[]).find(d => d.title === 'Biology: class notes'), me.id);
  expect(deck?.concepts[0].retrievalCards).toHaveLength(2);
  expectNoErrors(errors);
});

test('a pasted timetable is read into lessons, and an after-class notification opens that lesson', async ({ page, request }) => {
  const errors = watchErrors(page);
  const me = await newAccount(request, 'Reader');
  await page.addInitScript(() => localStorage.setItem('axon_tour_seen', 'true'));
  await standInForAi(page, () =>
    JSON.stringify({
      lessons: [
        { subject: 'Biology', weekday: 1, start: '08:30', end: '09:15', room: 'Lab 2' },
        { subject: 'Maths', weekday: 2, start: '09:20', end: '10:05' },
      ],
    }),
  );
  await page.goto('/');
  await signIn(page, me.email);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Planner' }).click();
  await page.getByRole('button', { name: 'From a photo' }).click();
  const read = page.getByRole('dialog', { name: 'Add your timetable from a photo' });
  await read.getByLabel('Or paste it').fill('Monday 08:30-09:15 Biology (Lab 2); Tuesday 09:20-10:05 Maths');
  await read.getByRole('button', { name: 'Read it' }).click();
  const check = page.getByRole('dialog', { name: 'Check your lessons' });
  await expect(check.getByText('Biology')).toBeVisible();
  await check.getByRole('button', { name: 'Add 2 lessons' }).click();
  await expect(page.getByRole('button', { name: /^Edit Biology, Monday 08:30/ })).toBeVisible();

  // The notification's link: /?log=<lessonId> opens the note for that lesson.
  const lessonId = await page.evaluate(id => (JSON.parse(localStorage.getItem(`studify_timetable_v1_${id}`) || '[]') as { id: string; subject: string }[]).find(l => l.subject === 'Maths')!.id, me.id);
  await page.goto(`/?log=${lessonId}`);
  await expect(page.getByRole('dialog', { name: 'What did you cover?' })).toContainText('Maths');
  expect(new URL(page.url()).search).toBe('');
  expectNoErrors(errors);
});

test('the set-up assistant reads a timetable and exam dates, then makes the subjects and a starter deck', async ({ page, request }) => {
  const errors = watchErrors(page);
  const me = await newAccount(request, 'Starter');
  await page.addInitScript(() => localStorage.setItem('axon_tour_seen', 'true'));
  const nextYear = new Date().getFullYear() + 1;
  const deckJson = JSON.stringify({
    title: 'Biology basics',
    category: 'Biology',
    description: 'Starter deck',
    concepts: [
      {
        title: 'Cells',
        mentalModel: 'Tiny rooms.',
        coreTakeaways: ['Cells have membranes'],
        keyTerms: [],
        feynmanPrompt: 'Explain cells.',
        sampleMasteryExplanation: '',
        retrievalCards: [{ question: 'What surrounds a cell?', answer: 'A membrane', cardType: 'standard' }],
      },
    ],
  });
  const calls = await standInForAi(page, body => {
    const asked = JSON.stringify(body);
    if (asked.includes('verdict')) return JSON.stringify({ cards: [] });
    if (asked.includes('weekly lesson')) return JSON.stringify({ lessons: [{ subject: 'Biology', weekday: 1, start: '08:30', end: '09:15' }, { subject: 'Maths', weekday: 2, start: '09:20', end: '10:05' }] });
    if (asked.includes('dated deadline')) return JSON.stringify({ items: [{ kind: 'exam', title: 'Cells test', date: `${nextYear}-01-15`, subject: 'Biology', topics: ['Cells', 'DNA'] }] });
    return deckJson;
  });
  await page.goto('/');
  await signIn(page, me.email);

  // Offered on the home page to a student with no timetable.
  await page.getByRole('region', { name: 'Set up your school year with AI' }).getByRole('button', { name: 'Set up' }).click();
  const assistant = page.getByRole('dialog', { name: 'Set up your school year' });
  await assistant.getByRole('button', { name: 'Start' }).click();

  await page.getByRole('dialog', { name: 'Your timetable' }).getByLabel('Or paste it').fill('Mon 08:30 Biology, Tue 09:20 Maths');
  await page.getByRole('button', { name: 'Read it' }).click();
  const lessons = page.getByRole('dialog', { name: 'Check your lessons' });
  await expect(lessons.getByText('Maths')).toBeVisible();
  await lessons.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('dialog', { name: 'Exams and deadlines' }).getByLabel('Or paste it').fill('Biology cells test 15 January');
  await page.getByRole('button', { name: 'Read it' }).click();
  const exams = page.getByRole('dialog', { name: 'Check your exams and deadlines' });
  await expect(exams.getByText('Cells test')).toBeVisible();
  await exams.getByRole('button', { name: 'Next' }).click();

  // Biology (an exam) and Maths, each offered a starter deck; only Biology's is kept.
  const subjects = page.getByRole('dialog', { name: 'Your subjects' });
  await expect(subjects.getByText('1 lesson a week · 1 exam')).toBeVisible();
  await subjects.getByRole('checkbox', { name: 'Starter deck' }).nth(1).uncheck();
  await subjects.getByRole('button', { name: 'Finish and make 1 deck' }).click();

  const done = page.getByRole('dialog', { name: "You're set up" });
  await expect(done.getByText('2 lessons in your timetable')).toBeVisible({ timeout: 20_000 });
  await expect(done.getByText('1 exam or deadline in the Planner')).toBeVisible();
  await expect(done.getByText('Biology basics')).toBeVisible();
  // The starter deck was aimed at what the syllabus covers.
  expect(calls.some(call => JSON.stringify(call).includes('Biology: Cells; DNA'))).toBe(true);

  const saved = await page.evaluate(id => {
    const read = (key: string) => JSON.parse(localStorage.getItem(`${key}_${id}`) || '[]');
    return { folders: read('studify_folders_v1'), lessons: read('studify_timetable_v1'), decks: read('studify_sessions_v1') };
  }, me.id);
  const biology = (saved.folders as { id: string; name: string }[]).find(f => f.name === 'Biology');
  expect(biology).toBeTruthy();
  expect((saved.lessons as { subject: string; folderId: string }[]).find(l => l.subject === 'Biology')?.folderId).toBe(biology!.id);
  expect((saved.decks as { title: string; folderId: string }[]).find(d => d.title === 'Biology basics')?.folderId).toBe(biology!.id);

  await done.getByRole('button', { name: 'See the Planner' }).click();
  await expect(page.getByRole('button', { name: /^Edit Maths, Tuesday 09:20/ })).toBeVisible();
  // Finished: not offered again.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /Today/ }).click();
  await expect(page.getByRole('region', { name: 'After class' }).or(page.getByRole('heading', { level: 1 })).first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Set up your school year with AI' })).toHaveCount(0);
  expectNoErrors(errors);
});

test('a mock exam is not lost by a stray tap on the navigation', async ({ page }) => {
  const errors = watchErrors(page);
  await seedDeck(page, { due: 3, later: 3 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Practice' }).click();
  await page.getByRole('button', { name: /Mock exam/ }).first().click();
  await page.getByRole('button', { name: 'Start exam' }).click();
  await expect(page.getByText(/^Question 1 of/)).toBeVisible();

  // Leaving through the sidebar asks first; "Keep going" stays in the exam.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^Library/ }).click();
  const leave = page.getByRole('dialog', { name: 'Leave this exam?' });
  await expect(leave).toBeVisible();
  await leave.getByRole('button', { name: 'Keep going' }).click();
  await expect(page.getByText(/^Question 1 of/)).toBeVisible();

  // Confirming leaves.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^Library/ }).click();
  await page.getByRole('dialog', { name: 'Leave this exam?' }).getByRole('button', { name: 'Leave exam' }).click();
  await expect(page.getByText(/^Question 1 of/)).toHaveCount(0);
  expectNoErrors(errors);
});
