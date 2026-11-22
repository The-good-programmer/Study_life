import { beforeEach, describe, expect, it } from 'vitest';
import { StorageService } from '../../services/storageService';
import { gentleStarterDecks, readyMadeSession } from './readyMadeDecks';

describe('ready-made decks for a student with no decks', () => {
  beforeEach(() => localStorage.clear());

  it('offers the gentlest decks first, and board-exam decks last outside higher education', () => {
    const decks = gentleStarterDecks(3);
    expect(decks).toHaveLength(3);
    const order = { Foundational: 0, Intermediate: 1, 'High-Yield Board Review': 2 };
    const ranks = decks.map(d => order[d.difficulty]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(decks.some(d => d.tags.some(t => /USMLE/i.test(t)))).toBe(false);
  });

  it('saves a copy that opens straight on its flashcards', () => {
    const [deck] = gentleStarterDecks(1);
    const session = readyMadeSession(deck);
    expect(session.currentPhase).toBe('retrieval');
    expect(session.casualFlashcardMode).toBe(true);
    expect(StorageService.getSessions().map(s => s.id)).toContain(session.id);
  });
});
