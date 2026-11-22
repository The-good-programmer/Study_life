import { beforeEach, describe, expect, it } from 'vitest';
import type { StudySession } from '../../types';
import { StorageService } from '../../services/storageService';
import { markQuickStartSeen, shouldShowQuickStart } from './quickStart';

describe('the first-visit quick start', () => {
  beforeEach(() => localStorage.clear());

  it('greets a new visitor once, and never someone who already has decks', () => {
    expect(shouldShowQuickStart()).toBe(true);
    markQuickStartSeen();
    expect(shouldShowQuickStart()).toBe(false);

    localStorage.clear();
    StorageService.saveSession({ id: 'd', title: 'Mine', category: 'x', description: '', createdAt: '2026-11-01T00:00:00Z', currentConceptIndex: 0, currentPhase: 'priming', elapsedSeconds: 0, concepts: [] } as StudySession);
    expect(shouldShowQuickStart()).toBe(false);
  });
});
