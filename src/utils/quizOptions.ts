import type { RetrievalCard } from '../types';

/** Distractors far longer or shorter than the answer give it away. */
const MAX_LENGTH_RATIO = 3;
const DISTRACTOR_COUNT = 3;

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function isComparableLength(candidate: string, answer: string): boolean {
  const a = Math.max(answer.length, 1);
  const c = Math.max(candidate.length, 1);
  return c / a <= MAX_LENGTH_RATIO && a / c <= MAX_LENGTH_RATIO;
}

/**
 * Deterministic PRNG seeded from the card id, so options stay stable across renders.
 * FNV-1a spreads similar ids (card-1, card-2) far apart; mulberry32 then mixes well.
 */
function seededRandom(seedText: string): () => number {
  let seed = 0x811c9dc5;
  for (let i = 0; i < seedText.length; i++) {
    seed ^= seedText.charCodeAt(i);
    seed = Math.imul(seed, 0x01000193);
  }
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Builds 4-choice quiz options for a standard flashcard. Distractors come from
 * the same concept first (its other answers, then its key terms) and only then
 * from the rest of the deck, skipping candidates whose length gives the answer
 * away. Returns [] when fewer than three plausible distractors exist, so the
 * caller falls back to a plain flip card.
 */
export function buildQuizOptions(
  card: Pick<RetrievalCard, 'id' | 'conceptId' | 'answer'>,
  deckCards: Pick<RetrievalCard, 'id' | 'conceptId' | 'answer'>[],
  keyTerms: string[] = []
): string[] {
  const answer = card.answer.trim();
  if (!answer) return [];

  const random = seededRandom(card.id);
  const seen = new Set<string>([normalize(answer)]);

  const take = (candidates: string[]): string[] => {
    const picked: string[] = [];
    for (const raw of candidates) {
      const text = raw.trim();
      const key = normalize(text);
      if (!text || seen.has(key) || !isComparableLength(text, answer)) continue;
      seen.add(key);
      picked.push(text);
    }
    return shuffle(picked, random);
  };

  const others = deckCards.filter(c => c.id !== card.id && c.answer);
  const tiers = [
    take(others.filter(c => c.conceptId === card.conceptId).map(c => c.answer)),
    take(keyTerms),
    take(others.filter(c => c.conceptId !== card.conceptId).map(c => c.answer)),
  ];

  const distractors = tiers.flat().slice(0, DISTRACTOR_COUNT);
  if (distractors.length < DISTRACTOR_COUNT) return [];

  return shuffle([answer, ...distractors], random);
}

/**
 * The order to show a card's own choices in. Cards often store the right answer
 * first, so showing them as stored would make "always pick A" work. The order is
 * seeded by the card id: varied across cards, stable across renders and screens.
 */
export function orderOptionsForCard(options: string[], cardId: string): string[] {
  return shuffle(options, seededRandom(`order:${cardId}`));
}
