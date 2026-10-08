import type { RetrievalCard, StudySession } from '../types';

/** A card counts as mastered once it is expected to stay remembered for three weeks. */
export const MASTERED_STABILITY_DAYS = 21;

export type CardStatus = 'mastered' | 'learning' | 'new';

export const cardStatusOf = (card: RetrievalCard): CardStatus =>
  card.reps === 0 ? 'new' : card.stability >= MASTERED_STABILITY_DAYS ? 'mastered' : 'learning';

/** Whether a reviewed card is due again. Cards that were never reviewed count as new, not due. */
export const isCardDue = (card: RetrievalCard, now: Date): boolean =>
  card.reps > 0 && !!card.nextReviewDate && new Date(card.nextReviewDate) <= now;

/**
 * Reviews and stars are saved per card, and a deck's own copy of a card can be older
 * (a deck held in memory during a study session, say). Takes progress from the saved
 * card and content from the deck's copy.
 */
export const withSavedProgress = (card: RetrievalCard, saved: RetrievalCard | undefined): RetrievalCard => {
  if (!saved) return card;
  return {
    ...card,
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
