import { beforeEach, describe, expect, it } from 'vitest';
import type { StudySession } from '../../types';
import { StorageService } from '../../services/storageService';
import { completionKey, nextPass } from './sessionPass';

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
  it('starts again from the first concept with the clock at zero', () => {
    expect(nextPass(finished())).toMatchObject({ currentConceptIndex: 0, currentPhase: 'priming', elapsedSeconds: 0 });
  });

  it('keeps flashcard decks on flashcards, and keeps when the last pass finished', () => {
    const pass = nextPass(finished({ casualFlashcardMode: true }));
    expect(pass.currentPhase).toBe('retrieval');
    expect(pass.completedAt).toBe('2026-10-08T10:00:00.000Z');
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
