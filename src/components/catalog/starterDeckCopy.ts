import type { StarterDeckMetadata, StudySession } from '../../types';
import { StorageService } from '../../services/storageService';

/** A starter deck as a new deck of the student's own. */
export function createClonedSession(deck: StarterDeckMetadata): StudySession {
  return {
    ...deck.session,
    id: `${deck.id}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    elapsedSeconds: 0,
    currentConceptIndex: 0,
    currentPhase: 'priming',
  };
}

/** The saved copy of a starter deck, if the learner already added it. */
export const findSavedCopy = (deck: StarterDeckMetadata): StudySession | undefined =>
  StorageService.getSessions().find(
    s => s.id === deck.id || s.id.startsWith(`${deck.id}-`) || s.title === deck.session.title,
  );

/** Adds a starter deck to the library (once) and returns the student's copy. */
export function addStarterDeck(deck: StarterDeckMetadata): StudySession {
  const existing = findSavedCopy(deck);
  if (existing) return existing;
  const copy = createClonedSession(deck);
  StorageService.saveSession(copy);
  StorageService.saveCards(copy.concepts.flatMap(c => c.retrievalCards));
  return copy;
}
