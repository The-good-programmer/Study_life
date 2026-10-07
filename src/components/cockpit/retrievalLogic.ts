import type { CardType, ConceptCheckpoint, RetrievalCard } from '../../types';

/** Pure study-loop rules for the Active Retrieval phase, kept out of the component so they can be tested. */

/** Small deterministic string hash (FNV-1a) so interleaving is stable per card and concept. */
const hashString = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

export interface InterleavedDeck {
  cards: RetrievalCard[];
  /** Card id -> title of the earlier concept it was borrowed from. */
  interleaveMap: Map<string, string>;
}

/**
 * Blends 1-2 cards from earlier concepts into the current concept's cards
 * (interleaving, Rohrer & Taylor 2007). Picks are spread across different earlier
 * concepts where possible, so one old topic does not dominate, and are stable for
 * a given card and concept.
 */
export const blendInterleavedCards = (
  concept: ConceptCheckpoint,
  allConcepts: ConceptCheckpoint[] | undefined,
  conceptIndex: number | undefined,
  enabled: boolean,
): InterleavedDeck => {
  const currentCards = concept.retrievalCards || [];
  const none: InterleavedDeck = { cards: currentCards, interleaveMap: new Map() };
  if (!allConcepts || !enabled || conceptIndex === undefined || conceptIndex <= 0) return none;

  const candidates: { card: RetrievalCard; originTitle: string; originId: string; rank: number }[] = [];
  allConcepts.slice(0, conceptIndex).forEach(prior => {
    (prior.retrievalCards || []).forEach(card => {
      candidates.push({
        card,
        originTitle: prior.title,
        originId: prior.id,
        rank: hashString(`${card.id}:${concept.id}`),
      });
    });
  });
  if (candidates.length === 0) return none;

  const countToPick = Math.min(2, Math.max(1, Math.round(currentCards.length * 0.4)));
  const ranked = [...candidates].sort((a, b) => a.rank - b.rank);
  const picked: typeof candidates = [];
  const usedOrigins = new Set<string>();
  for (const candidate of ranked) {
    if (picked.length === countToPick) break;
    if (usedOrigins.has(candidate.originId)) continue;
    usedOrigins.add(candidate.originId);
    picked.push(candidate);
  }
  // Fewer earlier concepts than picks: fill from the remaining best-ranked cards.
  for (const candidate of ranked) {
    if (picked.length === countToPick) break;
    if (!picked.includes(candidate)) picked.push(candidate);
  }

  const interleaveMap = new Map<string, string>();
  const cards = [...currentCards];
  picked.forEach((p, idx) => {
    interleaveMap.set(p.card.id, p.originTitle);
    cards.splice(Math.min(cards.length, 1 + idx * 2), 0, p.card);
  });
  return { cards, interleaveMap };
};

const stripChoiceLabel = (text: string): string =>
  text.replace(/^[a-d1-4][).\s-]+\s*/i, '').trim().toLowerCase();

/** Whether a chosen option matches the card answer, tolerating "A) ...", "1. ..." labels and case. */
export const isOptionCorrect = (option: string, answer: string): boolean => {
  const rawOption = option.trim().toLowerCase();
  const rawAnswer = answer.trim().toLowerCase();
  const cleanOption = stripChoiceLabel(option);
  const cleanAnswer = stripChoiceLabel(answer);
  return (
    rawOption === rawAnswer ||
    cleanOption === cleanAnswer ||
    cleanOption === rawAnswer ||
    rawOption === cleanAnswer
  );
};

/** The interaction style for a card when it does not declare a type itself. */
export const getEffectiveCardType = (card: RetrievalCard | undefined): CardType => {
  if (!card) return 'standard';
  if (card.cardType) return card.cardType;
  if (card.imageUrl && card.masks && card.masks.length > 0) return 'image-occlusion';
  if (card.clozeTemplate || card.question.includes('{{')) return 'cloze';
  if (card.options && card.options.length > 0) return 'multiple-choice';
  return 'standard';
};

/** What the learner should be able to recall unaided: key terms, else takeaways, else card answers. */
export const getBlurtingTargets = (concept: ConceptCheckpoint): string[] => {
  if (concept.keyTerms && concept.keyTerms.length > 0) return concept.keyTerms.map(k => k.term);
  if (concept.coreTakeaways && concept.coreTakeaways.length > 0) return concept.coreTakeaways;
  return (concept.retrievalCards || []).map(c => c.answer);
};

/** Splits targets into those the free-recall text mentions and those it missed. */
export const evaluateBlurting = (
  text: string,
  targets: string[],
): { recalled: string[]; missed: string[] } => {
  const lower = text.toLowerCase();
  const hit = (term: string) => lower.includes(term.toLowerCase());
  return { recalled: targets.filter(hit), missed: targets.filter(term => !hit(term)) };
};
