import type { StarterDeckMetadata, StudySession } from '../../types';
import { CURATED_STARTER_DECKS, rankStarterDecksForGrade } from '../../data/curatedStarterCatalog';
import { addStarterDeck } from '../catalog/starterDeckCopy';

const GENTLENESS: Record<StarterDeckMetadata['difficulty'], number> = {
  Foundational: 0,
  Intermediate: 1,
  'High-Yield Board Review': 2,
};

/**
 * Ready-made decks to offer a student with no decks: ranked for their level, then the gentlest
 * first, because a first deck should feel doable.
 */
export function gentleStarterDecks(count: number, grade?: string | null): StarterDeckMetadata[] {
  const ranked = rankStarterDecksForGrade(CURATED_STARTER_DECKS, grade);
  return [...ranked].sort((a, b) => GENTLENESS[a.difficulty] - GENTLENESS[b.difficulty]).slice(0, count);
}

/** Saves a copy of a ready-made deck and returns it set to open straight on its flashcards. */
export function readyMadeSession(deck: StarterDeckMetadata): StudySession {
  const saved = addStarterDeck(deck);
  return { ...saved, casualFlashcardMode: true, currentPhase: 'retrieval', currentConceptIndex: 0 };
}
