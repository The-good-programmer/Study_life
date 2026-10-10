import type { RetrievalCard } from '../types';

/**
 * A starter-deck card written compactly. The card type follows from the fields:
 * {{blanks}} in q make a cloze card, options make a multiple-choice card, anything else is a plain card.
 */
export interface QuickCard {
  q: string;
  /** Not needed for cloze cards: the answer is read from the blanks. */
  a?: string;
  why?: string;
  hint?: string;
  options?: string[];
  /** Page of the deck's source notes the card comes from. */
  page: number;
}

const BLANK = /\{\{(.+?)\}\}/g;

export function quickCards(
  { conceptId, idPrefix, sourceName }: { conceptId: string; idPrefix: string; sourceName: string },
  cards: QuickCard[],
): RetrievalCard[] {
  return cards.map((card, idx) => {
    const blanks = [...card.q.matchAll(BLANK)].map((m) => m[1]);
    const isCloze = blanks.length > 0;
    const answer = isCloze ? blanks.join(' ... ') : card.a;
    if (!answer) throw new Error(`Starter card ${idPrefix}-${idx + 1} has no answer`);
    if (card.options && !card.options.includes(answer)) {
      throw new Error(`Starter card ${idPrefix}-${idx + 1}: the answer must be one of its options`);
    }
    return {
      id: `${idPrefix}-${idx + 1}`,
      conceptId,
      cardType: isCloze ? 'cloze' : card.options ? 'multiple-choice' : 'standard',
      question: card.q,
      ...(isCloze ? { clozeTemplate: card.q } : {}),
      answer,
      ...(card.options ? { options: card.options } : {}),
      ...(card.hint ? { hint: card.hint } : {}),
      ...(card.why ? { explanation: card.why } : {}),
      stability: 1,
      difficulty: 4,
      reps: 0,
      lapses: 0,
      sourceAnchor: { pageNumber: card.page, sourceName },
    };
  });
}
