import { beforeEach, describe, expect, it } from 'vitest';
import type { StudySession } from '../../types';
import { StorageService } from '../../services/storageService';
import { completionKey, estimatedMinutesOf, nextPass, ratedInPass } from './sessionPass';

const finished = (overrides: Partial<StudySession> = {}): StudySession => ({
  id: 'deck',
  title: 'Deck',
  category: 'Biology',
  description: '',
  concepts: [],
  currentConceptIndex: 4,
  currentPhase: 'summary',
  elapsedSeconds: 1500,
  createdAt: '2026-10-01T00:00:00.000Z',
  completedAt: '2026-10-08T10:00:00.000Z',
  ...overrides,
});

describe('nextPass', () => {
  it('starts again from the first concept with the clock at zero and nothing rated', () => {
    expect(nextPass(finished({ passRatedCardIds: ['a', 'b'] }))).toMatchObject({
      currentConceptIndex: 0,
      currentPhase: 'priming',
      elapsedSeconds: 0,
      passRatedCardIds: [],
    });
  });

  it('keeps flashcard decks on flashcards, and keeps when the last pass finished', () => {
    const pass = nextPass(finished({ casualFlashcardMode: true }));
    expect(pass.currentPhase).toBe('retrieval');
    expect(pass.completedAt).toBe('2026-10-08T10:00:00.000Z');
  });
});

const card = (id: string) => ({ id, conceptId: 'c', question: 'Q', answer: 'A', stability: 1, difficulty: 5, reps: 0, lapses: 0 });
const concept = (id: string, cardIds: string[], estimatedMinutes = 0) => ({
  id,
  order: 0,
  title: id,
  estimatedMinutes,
  mentalModel: '',
  coreTakeaways: [],
  keyTerms: [],
  feynmanPrompt: '',
  sampleMasteryExplanation: '',
  retrievalCards: cardIds.map(card),
});

describe('ratedInPass', () => {
  it('lists each card of the deck rated in this pass once, and nothing from elsewhere', () => {
    const deck = finished({
      concepts: [concept('c1', ['a', 'b']), concept('c2', ['c'])],
      passRatedCardIds: ['a', 'c', 'a', 'not-in-deck'],
    });
    expect(ratedInPass(deck)).toEqual(['a', 'c']);
  });

  it('is empty when nothing was rated', () => {
    expect(ratedInPass(finished({ concepts: [concept('c1', ['a'])] }))).toEqual([]);
  });
});

describe('estimatedMinutesOf', () => {
  it('adds up the concepts, counting five minutes for one without an estimate', () => {
    expect(estimatedMinutesOf(finished({ concepts: [concept('c1', [], 8), concept('c2', [])] }))).toBe(13);
  });
});

describe('completion claims', () => {
  beforeEach(() => {
    localStorage.clear();
    StorageService.setActiveUserId(null);
  });

  it('records and pays a finished pass once, and a later pass again', () => {
    const first = completionKey(finished());
    expect(StorageService.claimCompletion(first)).toBe(true);
    expect(StorageService.claimCompletion(first)).toBe(false);

    const later = completionKey(finished({ completedAt: '2026-10-09T08:00:00.000Z' }));
    expect(later).not.toBe(first);
    expect(StorageService.claimCompletion(later)).toBe(true);
  });
});
