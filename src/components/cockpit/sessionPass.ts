import type { StudySession } from '../../types';

/**
 * A finished session, set up for its next pass: from the first concept, with the clock
 * at zero, so the next summary counts only that pass's time.
 */
export const nextPass = (session: StudySession): StudySession => ({
  ...session,
  currentConceptIndex: 0,
  currentPhase: session.casualFlashcardMode ? 'retrieval' : 'priming',
  elapsedSeconds: 0,
});

/** Names one finished pass of a session, so its summary records and pays it once. */
export const completionKey = (session: StudySession): string => `${session.id}@${session.completedAt ?? ''}`;
