import { describe, expect, it } from 'vitest';
import { CURATED_STARTER_DECKS } from '../data/curatedStarterCatalog';
import { buildPublicPages, deckPage, sitemap } from './buildPublicPages';

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
