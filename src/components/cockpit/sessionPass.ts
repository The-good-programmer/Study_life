import type { StudySession } from '../../types';

/**
 * A finished session, set up for its next pass: from the first concept, with the clock
 * at zero and no cards rated, so the next summary counts (and pays) only that pass.
 */
export const nextPass = (session: StudySession): StudySession => ({
  ...session,
  currentConceptIndex: 0,
  currentPhase: session.casualFlashcardMode ? 'retrieval' : 'priming',
  elapsedSeconds: 0,
  passRatedCardIds: [],
});

/** The cards of the deck rated in this pass, each once. */
export const ratedInPass = (session: StudySession): string[] => {
  const inDeck = new Set(session.concepts.flatMap(concept => concept.retrievalCards.map(card => card.id)));
  return [...new Set(session.passRatedCardIds ?? [])].filter(id => inDeck.has(id));
};

/** The deck's estimated minutes, which bound how much of a session's time is paid. */
export const estimatedMinutesOf = (session: StudySession): number =>
  session.concepts.reduce((sum, concept) => sum + (concept.estimatedMinutes || 5), 0);

/** Names one finished pass of a session, so its summary records and pays it once. */
export const completionKey = (session: StudySession): string => `${session.id}@${session.completedAt ?? ''}`;
