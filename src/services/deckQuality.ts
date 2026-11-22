import type { ConceptCheckpoint, RetrievalCard, StudySession } from '../types';
import { hasCloze } from '../utils/cloze';
import { clozeAnswer } from '../components/studio/deckDraft';

/**
 * Checks on a deck the AI wrote, before a student sees it. A card with no question or answer is
 * dropped rather than filled with made-up text; each card's type comes from what it contains
 * (fill-in-the-blank only with {{ }}, multiple choice only with four different choices that
 * include the answer); and the same question twice in a deck is kept once. Pure functions only.
 */

/** Wrong answers a multiple-choice card shows next to the right one. */
const WRONG_CHOICES = 3;

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').replace(/[\s?.!:;,]+$/, '').trim();

export class UnusableDeckError extends Error {
  constructor() {
    super('The AI reply had no usable cards in it.');
    this.name = 'UnusableDeckError';
  }
}

/** The card made sound, or null when there is nothing to study on it. */
export function cleanCard(card: RetrievalCard): RetrievalCard | null {
  // Diagram cards are made by the student, not the AI; they're kept as they are.
  if (card.cardType === 'image-occlusion') return card.imageUrl && card.masks?.length ? card : null;

  const question = (card.question ?? '').trim();
  const answer = (card.answer ?? '').trim();
  const template = (card.clozeTemplate ?? '').trim() || (hasCloze(question) ? question : '');

  if (template && hasCloze(template)) {
    return {
      ...card,
      cardType: 'cloze',
      question: template,
      clozeTemplate: template,
      answer: clozeAnswer(template) || answer,
      options: undefined,
    };
  }
  if (!question || !answer) return null;

  const base: RetrievalCard = { ...card, question, answer, clozeTemplate: undefined };
  const wrong: string[] = [];
  const seen = new Set([normalize(answer)]);
  for (const option of card.options ?? []) {
    const text = typeof option === 'string' ? option.trim() : '';
    if (!text || seen.has(normalize(text))) continue;
    seen.add(normalize(text));
    wrong.push(text);
  }
  if (wrong.length >= WRONG_CHOICES) {
    // The answer first; the review screen shows the choices in a per-card order.
    return { ...base, cardType: 'multiple-choice', options: [answer, ...wrong.slice(0, WRONG_CHOICES)] };
  }
  return { ...base, cardType: 'standard', options: undefined };
}

/** The deck with every card checked, repeats removed and empty concepts dropped. */
export function cleanGeneratedDeck(session: StudySession): StudySession {
  const seenQuestions = new Set<string>();
  const concepts: ConceptCheckpoint[] = [];
  for (const concept of session.concepts ?? []) {
    const cards: RetrievalCard[] = [];
    for (const raw of concept.retrievalCards ?? []) {
      const card = cleanCard(raw);
      if (!card) continue;
      const key = normalize(card.question);
      if (seenQuestions.has(key)) continue;
      seenQuestions.add(key);
      cards.push(card);
    }
    if (cards.length > 0) concepts.push({ ...concept, order: concepts.length + 1, retrievalCards: cards });
  }
  if (concepts.length === 0) throw new UnusableDeckError();
  return { ...session, concepts };
}
