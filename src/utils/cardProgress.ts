import type { RetrievalCard, StudySession } from '../types';

/** The ids of every card in a deck. */
export const deckCardIds = (session: StudySession): string[] =>
  (session.concepts || []).flatMap(concept => (concept.retrievalCards || []).map(card => card.id));

/** A card counts as mastered once it is expected to stay remembered for three weeks. */
export const MASTERED_STABILITY_DAYS = 21;

export type CardStatus = 'mastered' | 'learning' | 'new';

export const cardStatusOf = (card: RetrievalCard): CardStatus =>
  card.reps === 0 ? 'new' : card.stability >= MASTERED_STABILITY_DAYS ? 'mastered' : 'learning';

/** Whether a reviewed card is due again. Cards that were never reviewed count as new, not due; hidden cards never come due. */
export const isCardDue = (card: RetrievalCard, now: Date): boolean =>
  !card.hidden && card.reps > 0 && !!card.nextReviewDate && new Date(card.nextReviewDate) <= now;

/** The cards to study: every card except those the student hid. */
export const studyableCards = <T extends RetrievalCard>(cards: readonly T[] | undefined): T[] => (cards ?? []).filter(card => !card.hidden);

/** When a card's content was last edited (0 for never). */
const editedAt = (card: RetrievalCard | undefined): number => {
  const t = Date.parse(card?.updatedAt ?? '');
  return Number.isFinite(t) ? t : 0;
};

/**
 * The card with the other copy's content (question, answer, hint, cloze text, hidden) when that copy
 * was edited later. A card fixed during a review is edited in the saved cards while the deck held in
 * memory still has the old text; the later edit wins wherever the two copies meet.
 */
export const withNewerContent = (card: RetrievalCard, other: RetrievalCard | undefined): RetrievalCard => {
  if (!other || editedAt(other) <= editedAt(card)) return card;
  return {
    ...card,
    question: other.question,
    answer: other.answer,
    hint: other.hint,
    clozeTemplate: other.clozeTemplate,
    options: other.options,
    hidden: other.hidden,
    updatedAt: other.updatedAt,
  };
};

/** What the review screen can change on a card. */
export type CardContentPatch = Partial<Pick<RetrievalCard, 'question' | 'answer' | 'hint' | 'clozeTemplate' | 'options' | 'hidden'>>;

/**
 * Reviews and stars are saved per card, and a deck's own copy of a card can be older
 * (a deck held in memory during a study session, say). Takes progress from the saved
 * card, and content from the deck's copy unless the saved card was edited later.
 */
export const withSavedProgress = (card: RetrievalCard, saved: RetrievalCard | undefined): RetrievalCard => {
  if (!saved) return card;
  return {
    ...withNewerContent(card, saved),
    stability: saved.stability ?? card.stability,
    difficulty: saved.difficulty ?? card.difficulty,
    reps: saved.reps ?? card.reps,
    lapses: saved.lapses ?? card.lapses,
    lastReviewDate: saved.lastReviewDate ?? card.lastReviewDate,
    nextReviewDate: saved.nextReviewDate ?? card.nextReviewDate,
    isStarred: saved.isStarred ?? card.isStarred,
  };
};

/** The deck with each card's saved progress. */
export const deckWithSavedProgress = (session: StudySession, saved: ReadonlyMap<string, RetrievalCard>): StudySession => ({
  ...session,
  concepts: session.concepts?.map(concept => ({
    ...concept,
    retrievalCards: (concept.retrievalCards || []).map(card => withSavedProgress(card, saved.get(card.id))),
  })),
});
