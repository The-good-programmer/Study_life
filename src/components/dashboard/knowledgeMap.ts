import type { ConceptCheckpoint, DiagnosticProbe, RetrievalCard, StudySession } from '../../types';
import { FSRSService } from '../../services/fsrsService';
import { cardStatusOf, isCardDue, withSavedProgress } from '../../utils/cardProgress';

/** Where a concept stands, from the review history of its cards. */
export type ConceptStatus = 'new' | 'due' | 'learning' | 'mastered';

export interface ConceptProgress {
  concept: ConceptCheckpoint;
  /** Position in the deck, from 0. */
  index: number;
  status: ConceptStatus;
  /** The concept's cards, with their saved progress. */
  cards: RetrievalCard[];
  reviewedCount: number;
  masteredCount: number;
  dueCount: number;
  /** Cards that keep being forgotten (see FSRSService.isLeech). */
  hardCount: number;
  /** Average chance of recalling the reviewed cards right now, 0 to 100; null before any review. */
  recallChance: number | null;
  /** The warm-up question about this concept, asked before it was studied. */
  warmup?: DiagnosticProbe;
}

export interface DeckProgress {
  session: StudySession;
  concepts: ConceptProgress[];
  /** How many concepts are in each status. */
  counts: Record<ConceptStatus, number>;
  cardCount: number;
  /** The first concept, in teaching order, that has cards and has not been started; null once all have. */
  nextIndex: number | null;
}

/**
 * New until one of its cards is reviewed. After that, due while any reviewed card is due,
 * mastered once every card is, and learning in between.
 */
const statusOf = (cardCount: number, reviewed: number, due: number, mastered: number): ConceptStatus => {
  if (reviewed === 0) return 'new';
  if (due > 0) return 'due';
  if (mastered === cardCount) return 'mastered';
  return 'learning';
};

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const warmupFor = (concept: ConceptCheckpoint, probes: DiagnosticProbe[] = []): DiagnosticProbe | undefined =>
  probes.find(probe => probe.conceptId === concept.id) ?? probes.find(probe => sameTitle(probe.conceptTitle, concept.title));

export const buildConceptProgress = (
  concept: ConceptCheckpoint,
  index: number,
  saved: ReadonlyMap<string, RetrievalCard>,
  now: Date,
  probes?: DiagnosticProbe[],
): ConceptProgress => {
  const cards = (concept.retrievalCards || []).map(card => withSavedProgress(card, saved.get(card.id)));
  const reviewed = cards.filter(card => card.reps > 0);
  const masteredCount = reviewed.filter(card => cardStatusOf(card) === 'mastered').length;
  const dueCount = reviewed.filter(card => isCardDue(card, now)).length;
  const recallChance = reviewed.length
    ? Math.round(reviewed.reduce((sum, card) => sum + FSRSService.calculateRetrievability(card, now), 0) / reviewed.length)
    : null;

  return {
    concept,
    index,
    status: statusOf(cards.length, reviewed.length, dueCount, masteredCount),
    cards,
    reviewedCount: reviewed.length,
    masteredCount,
    dueCount,
    hardCount: reviewed.filter(card => FSRSService.isLeech(card)).length,
    recallChance,
    warmup: warmupFor(concept, probes),
  };
};

export const buildDeckProgress = (session: StudySession, saved: ReadonlyMap<string, RetrievalCard>, now: Date): DeckProgress => {
  const concepts = (session.concepts || []).map((concept, index) =>
    buildConceptProgress(concept, index, saved, now, session.diagnosticReport?.probes),
  );
  const counts: Record<ConceptStatus, number> = { new: 0, due: 0, learning: 0, mastered: 0 };
  concepts.forEach(progress => {
    counts[progress.status] += 1;
  });
  const next = concepts.find(progress => progress.status === 'new' && progress.cards.length > 0);

  return {
    session,
    concepts,
    counts,
    cardCount: concepts.reduce((sum, progress) => sum + progress.cards.length, 0),
    nextIndex: next ? next.index : null,
  };
};

/** The deck, set to start a guided session at one concept. */
export const sessionFromConcept = (session: StudySession, index: number): StudySession => ({
  ...session,
  currentConceptIndex: index,
  currentPhase: 'priming',
  casualFlashcardMode: false,
});
