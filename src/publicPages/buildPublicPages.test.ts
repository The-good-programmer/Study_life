import { afterEach, describe, expect, it, vi } from 'vitest';
import { CURATED_STARTER_DECKS } from '../data/curatedStarterCatalog';
import { buildPublicPages, communityPage, deckPage, loadCommunityDecks, sitemap, type CommunityDeck } from './buildPublicPages';

const SITE = 'https://studify.example/';
const jsonLdOf = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));

describe('public deck pages', () => {
  const pages = buildPublicPages(SITE);

  it('writes the deck hub, a page per starter deck, a sitemap and robots.txt', () => {
    const files = pages.map(p => p.file);
    expect(files).toContain('decks/index.html');
    for (const deck of CURATED_STARTER_DECKS) expect(files).toContain(`decks/${deck.id}/index.html`);
    expect(files).toEqual(expect.arrayContaining(['sitemap.xml', 'robots.txt']));
    expect(pages.find(p => p.file === 'robots.txt')!.content).toContain(`Sitemap: ${SITE}sitemap.xml`);
  });

  it('shows every text card, with cloze gaps blanked, and a link that opens the deck in the app', () => {
    const deck = CURATED_STARTER_DECKS.find(d => d.session.concepts.some(c => c.retrievalCards.some(card => card.cardType === 'cloze')))!;
    const html = deckPage(deck, SITE, CURATED_STARTER_DECKS);
    expect(html).toContain(`href="/?deck=${deck.id}"`);
    expect(html).toContain(`<link rel="canonical" href="${SITE}decks/${deck.id}/">`);
    expect(html).not.toMatch(/\{\{/); // cloze answers are not given away in the question
    expect(html).toContain('____');
    const quiz = jsonLdOf(html).find(data => data['@type'] === 'Quiz');
    const textCards = deck.session.concepts.flatMap(c => c.retrievalCards).filter(card => card.cardType !== 'image-occlusion');
    expect(quiz.hasPart).toHaveLength(textCards.length);
    expect(quiz.hasPart[0]).toMatchObject({ '@type': 'Question', eduQuestionType: 'Flashcard' });
  });

  it('escapes deck text, so a card can never inject markup', () => {
    const base = CURATED_STARTER_DECKS[0];
    const evil = {
      ...base,
      title: 'Tags <script>alert(1)</script>',
      session: {
        ...base.session,
        concepts: [{ ...base.session.concepts[0], retrievalCards: [{ ...base.session.concepts[0].retrievalCards[0], cardType: 'standard' as const, question: '</script><img src=x onerror=alert(1)>', answer: 'a & b' }] }],
      },
    };
    const html = deckPage(evil, SITE, [evil]);
    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('a &amp; b');
    expect(() => jsonLdOf(html)).not.toThrow();
    expect(html).not.toMatch(/ld\+json">[^<]*<\/script><img/);
  });

  it('lists the home page, the hub and every deck in the sitemap', () => {
    const xml = sitemap(SITE, CURATED_STARTER_DECKS);
    expect(xml.match(/<loc>/g)).toHaveLength(CURATED_STARTER_DECKS.length + 2);
    expect(xml).toContain(`<loc>${SITE}decks/</loc>`);
  });
});

const shared: CommunityDeck = {
  slug: 'atoms-a1b2c3',
  author: 'Ada L.',
  title: 'Atoms <b>for</b> the quiz',
  subject: 'Chemistry',
  description: 'Twelve facts about atoms for the chemistry quiz.',
  likes: 3,
  created_at: '2026-11-01T00:00:00Z',
  concepts: [{ title: 'Atoms', cards: Array.from({ length: 12 }, (_, i) => ({ question: `Atom fact ${i}?`, answer: `Answer ${i}` })) }],
};

describe('pages for decks students shared', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('writes a page per shared deck, lists them on the hub and in the sitemap', () => {
    const pages = buildPublicPages(SITE, CURATED_STARTER_DECKS, [shared, { ...shared, slug: '../escape' }], 'https://api.example/api');
    const files = pages.map(p => p.file);
    expect(files).toContain('decks/c/atoms-a1b2c3/index.html');
    expect(files.some(f => f.includes('escape'))).toBe(false); // only server-made slugs become paths
    expect(pages.find(p => p.file === 'decks/index.html')!.content).toContain('/decks/c/atoms-a1b2c3/');
    expect(pages.find(p => p.file === 'sitemap.xml')!.content).toContain(`${SITE}decks/c/atoms-a1b2c3/`);
  });

  it('opens the deck in the app, offers a report link, names the author as shared, and escapes their text', () => {
    const html = communityPage(shared, SITE, 'https://api.example/api', [shared]);
    expect(html).toContain('href="/?shared=atoms-a1b2c3"');
    expect(html).toContain('href="/?report=atoms-a1b2c3"');
    expect(html).toContain('Shared by Ada L.');
    expect(html).not.toContain('<b>for</b>');
    expect(html).toContain('Atoms &lt;b&gt;for&lt;/b&gt; the quiz');
  });

  it('checks on the page whether the deck is still up, so a removed deck disappears without a rebuild', () => {
    const html = communityPage(shared, SITE, 'https://api.example/api', [shared]);
    expect(html).toContain('"https://api.example/api"');
    expect(html).toContain("/visible')");
    expect(html).toContain('This deck was removed');
    expect(communityPage(shared, SITE, null, [shared])).not.toContain('/visible');
  });

  it('loads qualifying decks from the API, and builds without them when it can\'t be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ decks: [shared, { ...shared, slug: 'Bad Slug!' }] }))));
    expect((await loadCommunityDecks('https://api.example/api')).map(d => d.slug)).toEqual(['atoms-a1b2c3']);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('asleep'); }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await loadCommunityDecks('https://api.example/api', 10)).toEqual([]);
    expect(await loadCommunityDecks(null)).toEqual([]);
  });
});
