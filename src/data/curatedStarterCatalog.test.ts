import { describe, it, expect } from 'vitest';
import { CURATED_STARTER_DECKS, isBoardExamDeck, rankStarterDecksForGrade } from './curatedStarterCatalog';

describe('starter catalog', () => {
  it('lists each deck once', () => {
    const ids = CURATED_STARTER_DECKS.map(deck => deck.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('shows the counts of what is actually studied', () => {
    for (const deck of CURATED_STARTER_DECKS) {
      const cards = deck.session.concepts.reduce((sum, concept) => sum + concept.retrievalCards.length, 0);
      expect(deck.conceptCount, deck.id).toBe(deck.session.concepts.length);
      expect(deck.cardCount, deck.id).toBe(cards);
      expect(cards, deck.id).toBeGreaterThan(0);
    }
  });

  it('puts board-exam decks last for school students', () => {
    const ranked = rankStarterDecksForGrade(CURATED_STARTER_DECKS, 'high-school');
    const firstBoardExam = ranked.findIndex(deck => isBoardExamDeck(deck));
    expect(firstBoardExam).toBeGreaterThan(0);
    expect(ranked.slice(firstBoardExam).every(deck => isBoardExamDeck(deck))).toBe(true);
  });

  it('keeps the catalog order for university students', () => {
    const ranked = rankStarterDecksForGrade(CURATED_STARTER_DECKS, 'college');
    expect(ranked.map(deck => deck.id)).toEqual(CURATED_STARTER_DECKS.map(deck => deck.id));
  });
});
