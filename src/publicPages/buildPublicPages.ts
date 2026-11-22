/**
 * Public pages, written into the build as plain HTML (no app code, readable by search engines and
 * link previews): /decks/ (what Studify is, and every starter deck) and /decks/<id>/ (one deck with
 * all its cards, and a button that opens it in the app). Plus sitemap.xml and robots.txt.
 *
 * Run at build time by the `publicPages` plugin in vite.config.ts. Pure functions of the deck data,
 * so they are unit-tested (buildPublicPages.test.ts).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RetrievalCard, StarterDeckMetadata } from '../types';
import { CURATED_STARTER_DECKS } from '../data/curatedStarterCatalog';
import { Mascot } from '../components/mascot/Mascot';

export interface PublicPage {
  /** Path inside the build folder, e.g. "decks/index.html". */
  file: string;
  content: string;
}

const esc = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A cloze card's text with its gaps shown as blanks: "carried by {{L-type Ca2+}} channels" → "carried by ____ channels". */
const blanked = (text: string): string => text.replace(/\{\{[^}]*\}\}/g, '____');

/** The cards a page can show as text: picture cards (image occlusion) need the app. */
const textCards = (deck: StarterDeckMetadata): { concept: string; cards: RetrievalCard[] }[] =>
  deck.session.concepts
    .map(concept => ({
      concept: concept.title,
      cards: concept.retrievalCards.filter(card => card.cardType !== 'image-occlusion' && card.question.trim() && card.answer.trim()),
    }))
    .filter(group => group.cards.length > 0);

export const deckPath = (deck: Pick<StarterDeckMetadata, 'id'>): string => `/decks/${deck.id}/`;
/** Opens the deck's flashcards in the app (App.tsx reads ?deck=). */
export const studyLink = (deck: Pick<StarterDeckMetadata, 'id'>): string => `/?deck=${encodeURIComponent(deck.id)}`;

const shortTitle = (title: string): string => title.replace(/\s*\([^)]*\)\s*$/, '');

const STYLE = `
:root{--bg:#f6f6f3;--card:#fff;--line:rgb(20 20 30/.1);--ink:#15161c;--muted:#4a4d59;--subtle:#676a76;--brand:oklch(.53 .2 276);--brand-soft:oklch(.53 .2 276/.1);--brand-text:oklch(.5 .2 276);--success:oklch(.5 .13 162)}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 Geist,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--brand-text)}
.wrap{max-width:780px;margin:0 auto;padding:0 16px}
header.top{border-bottom:1px solid var(--line);background:rgb(255 255 255/.7)}
header.top .wrap{display:flex;align-items:center;justify-content:space-between;height:60px}
.logo{display:flex;align-items:center;gap:10px;font-weight:650;color:var(--ink);text-decoration:none}
.logo span.mark{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--brand);color:#fff;font-weight:700}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 20px;border-radius:12px;background:var(--brand);color:#fff;font-weight:600;text-decoration:none;box-shadow:0 10px 24px -14px var(--brand)}
.btn.small{min-height:36px;padding:0 14px;font-size:14px}
.btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line);box-shadow:none}
.crumbs{margin:28px 0 0;font-size:14px;color:var(--subtle)}.crumbs a{color:var(--subtle)}
h1{font-size:clamp(28px,5vw,40px);line-height:1.15;letter-spacing:-.02em;margin:10px 0 12px}
h2{font-size:20px;letter-spacing:-.01em;margin:40px 0 12px}
.lead{font-size:18px;color:var(--muted);margin:0 0 16px}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 22px;padding:0;list-style:none}
.meta li{font-size:13px;color:var(--muted);background:var(--card);border:1px solid var(--line);border-radius:999px;padding:3px 10px}
.cta{display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;margin:0 0 8px}.cta small{color:var(--subtle);font-size:14px}
ol.cards{list-style:none;margin:0;padding:0;display:grid;gap:10px}
ol.cards li{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 18px}
.q{font-weight:600;margin:0}.a{margin:6px 0 0;color:var(--muted)}.a b{color:var(--success);font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin-right:6px}
.panel{margin:44px 0;background:var(--card);border:1px solid var(--line);border-radius:22px;padding:24px;display:flex;flex-wrap:wrap;gap:16px 24px;align-items:center;justify-content:space-between}
.panel p{margin:4px 0 0;color:var(--muted)}
.hero{display:grid;gap:8px 32px;align-items:center;padding:40px 0 8px}@media(min-width:720px){.hero{grid-template-columns:1fr 200px}}
.hero svg{width:200px;height:170px;justify-self:center}
.steps{display:grid;gap:10px;margin:0;padding:0;list-style:none}@media(min-width:640px){.steps{grid-template-columns:repeat(3,1fr)}}
.steps li{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px}.steps b{display:block}.steps span{color:var(--muted);font-size:14px}
.decks{display:grid;gap:10px;margin:0;padding:0;list-style:none}@media(min-width:640px){.decks{grid-template-columns:repeat(2,1fr)}}
.decks a{display:block;height:100%;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;color:var(--ink);text-decoration:none}
.decks a:hover{border-color:var(--brand)}.decks b{display:block;line-height:1.35}.decks span{display:block;margin-top:6px;font-size:14px;color:var(--subtle)}
footer{margin:56px 0 0;border-top:1px solid var(--line);padding:24px 0 40px;font-size:14px;color:var(--subtle)}
`;

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Geist:wght@400..700&display=swap" rel="stylesheet">`;

const page = (o: { title: string; description: string; url: string; body: string; jsonLd: object[] }): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${esc(o.url)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="theme-color" content="#f6f6f3">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Studify">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${esc(o.url)}">
<meta property="og:image" content="${esc(new URL('/og-image.png', o.url).href)}">
<meta name="twitter:card" content="summary_large_image">
${FONTS}
<style>${STYLE}</style>
${o.jsonLd.map(data => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body>
<header class="top"><div class="wrap">
<a class="logo" href="/decks/"><span class="mark">S</span>Studify</a>
<a class="btn small ghost" href="/">Open the app</a>
</div></header>
<main class="wrap">
${o.body}
</main>
<footer><div class="wrap">Studify: spaced-repetition flashcards built on retrieval practice, spacing and interleaving. <a href="/decks/">All decks</a> · <a href="/">Open the app</a></div></footer>
</body>
</html>
`;

export function deckPage(deck: StarterDeckMetadata, siteUrl: string, allDecks: StarterDeckMetadata[]): string {
  const url = new URL(deckPath(deck), siteUrl).href;
  const groups = textCards(deck);
  const cardCount = groups.reduce((sum, group) => sum + group.cards.length, 0);
  const title = `${shortTitle(deck.title)} flashcards (${cardCount} cards) | Studify`;
  const description = `${cardCount} free flashcards on ${shortTitle(deck.title)}. ${deck.summary}`.slice(0, 300);
  const others = allDecks.filter(other => other.id !== deck.id);

  const body = `
<p class="crumbs"><a href="/decks/">Flashcard decks</a> › ${esc(deck.category)}</p>
<h1>${esc(deck.title)}</h1>
<p class="lead">${esc(deck.summary)}</p>
<ul class="meta"><li>${cardCount} cards</li><li>${esc(deck.difficulty)}</li><li>${deck.conceptCount} topics</li><li>For: ${esc(deck.targetAudience)}</li></ul>
<div class="cta"><a class="btn" href="${studyLink(deck)}">Study these cards free</a><small>No account needed. Each card comes back just before you would forget it.</small></div>
${groups
  .map(
    group => `<h2>${esc(group.concept)}</h2>
<ol class="cards">
${group.cards
  .map(card => `<li><p class="q">${esc(blanked(card.question))}</p><p class="a"><b>Answer</b>${esc(card.answer)}</p></li>`)
  .join('\n')}
</ol>`,
  )
  .join('\n')}
<section class="panel"><div><b>Remember these for good</b><p>Reading cards is not the same as recalling them. Studify quizzes you and spaces each card out.</p></div><a class="btn" href="${studyLink(deck)}">Start studying</a></section>
${others.length ? `<h2>More free decks</h2><ul class="decks">${others.map(deckLink).join('')}</ul>` : ''}`;

  // Google's flashcard markup (Quiz with Question parts): https://developers.google.com/search/docs/appearance/structured-data/education-qa
  const quiz = {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    name: deck.title,
    about: { '@type': 'Thing', name: deck.category },
    educationalLevel: deck.difficulty,
    hasPart: groups.flatMap(group =>
      group.cards.map(card => ({
        '@type': 'Question',
        eduQuestionType: 'Flashcard',
        text: blanked(card.question),
        acceptedAnswer: { '@type': 'Answer', text: card.answer },
      })),
    ),
  };
  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Flashcard decks', item: new URL('/decks/', siteUrl).href },
      { '@type': 'ListItem', position: 2, name: deck.title, item: url },
    ],
  };
  return page({ title, description, url, body, jsonLd: [quiz, crumbs] });
}

const deckLink = (deck: StarterDeckMetadata): string =>
  `<li><a href="${deckPath(deck)}"><b>${esc(deck.title)}</b><span>${textCards(deck).reduce((n, g) => n + g.cards.length, 0)} cards · ${esc(deck.difficulty)}</span></a></li>`;

const GENTLENESS: Record<StarterDeckMetadata['difficulty'], number> = { Foundational: 0, Intermediate: 1, 'High-Yield Board Review': 2 };

export function hubPage(allDecks: StarterDeckMetadata[], siteUrl: string): string {
  // Gentlest first, as in the app: a board-exam deck shouldn't be the first thing a school student sees.
  const decks = [...allDecks].sort((a, b) => GENTLENESS[a.difficulty] - GENTLENESS[b.difficulty]);
  const url = new URL('/decks/', siteUrl).href;
  const mascot = renderToStaticMarkup(createElement(Mascot, { mood: 'wave', bob: false }));
  const categories = [...new Set(decks.map(deck => deck.category))];
  const body = `
<section class="hero">
<div>
<h1>Learn anything in 3 minutes a day</h1>
<p class="lead">Free flashcards that quiz you and bring each card back just before you would forget it. Pick a deck below, or type any topic and get your own deck in a minute.</p>
<div class="cta"><a class="btn" href="/">Start studying free</a><small>No account needed for your first deck.</small></div>
</div>
${mascot}
</section>
<h2>How it works</h2>
<ol class="steps">
<li><b>1. Pick or make a deck</b><span>A ready-made deck, your notes, a PDF, a photo or a lecture.</span></li>
<li><b>2. Recall, then reveal</b><span>Answer in your head first, then rate how well you knew it.</span></li>
<li><b>3. A few minutes a day</b><span>Each card comes back just before you would forget it.</span></li>
</ol>
${categories
  .map(category => `<h2>${esc(category)}</h2><ul class="decks">${decks.filter(d => d.category === category).map(deckLink).join('')}</ul>`)
  .join('\n')}
<section class="panel"><div><b>Studying something else?</b><p>Type a topic or paste your notes, and Studify writes the cards for your level.</p></div><a class="btn" href="/">Make my own deck</a></section>`;
  const list = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: decks.map((deck, i) => ({ '@type': 'ListItem', position: i + 1, url: new URL(deckPath(deck), siteUrl).href, name: deck.title })),
  };
  return page({
    title: 'Free flashcard decks with spaced repetition | Studify',
    description: 'Free flashcard decks for biology, medicine, computer science, languages and more. Study with spaced repetition in a few minutes a day.',
    url,
    body,
    jsonLd: [list],
  });
}

export function sitemap(siteUrl: string, decks: StarterDeckMetadata[]): string {
  const urls = ['/', '/decks/', ...decks.map(deckPath)].map(path => new URL(path, siteUrl).href);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(loc => `  <url><loc>${esc(loc)}</loc></url>`).join('\n')}
</urlset>
`;
}

export function robots(siteUrl: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', siteUrl).href}\n`;
}

/** Every public file, for the build to write. */
export function buildPublicPages(siteUrl: string, decks: StarterDeckMetadata[] = CURATED_STARTER_DECKS): PublicPage[] {
  return [
    { file: 'decks/index.html', content: hubPage(decks, siteUrl) },
    ...decks.map(deck => ({ file: `decks/${deck.id}/index.html`, content: deckPage(deck, siteUrl, decks) })),
    { file: 'sitemap.xml', content: sitemap(siteUrl, decks) },
    { file: 'robots.txt', content: robots(siteUrl) },
  ];
}
