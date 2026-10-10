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

  it('gives every card a unique id and a usable answer', () => {
    const ids = new Set<string>();
    for (const deck of CURATED_STARTER_DECKS) {
      for (const card of deck.session.concepts.flatMap(concept => concept.retrievalCards)) {
        expect(ids.has(card.id), card.id).toBe(false);
        ids.add(card.id);
        expect(card.answer.trim(), card.id).not.toBe('');
        if (card.options) expect(card.options, card.id).toContain(card.answer);
        if (card.sourceAnchor) expect(card.sourceAnchor.pageNumber, card.id).toBeLessThanOrEqual(deck.session.sourceDocument?.pages?.length ?? 0);
      }
    }
  });

  it('keeps diagram masks on the diagram, with the answer under the active one', () => {
    for (const deck of CURATED_STARTER_DECKS) {
      for (const card of deck.session.concepts.flatMap(concept => concept.retrievalCards)) {
        if (card.cardType !== 'image-occlusion') continue;
        const active = card.masks?.find(mask => mask.id === card.activeMaskId);
        expect(active?.label, card.id).toBe(card.answer);
        for (const mask of card.masks ?? []) {
          expect(mask.x, card.id).toBeGreaterThanOrEqual(0);
          expect(mask.y, card.id).toBeGreaterThanOrEqual(0);
          expect(mask.x + mask.width, card.id).toBeLessThanOrEqual(100);
          expect(mask.y + mask.height, card.id).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('is a deck worth studying, not a sample', () => {
    for (const deck of CURATED_STARTER_DECKS) {
      expect(deck.cardCount, deck.id).toBeGreaterThanOrEqual(25);
      expect(deck.hasImageOcclusion, deck.id).toBe(
        deck.session.concepts.some(concept => concept.retrievalCards.some(card => card.cardType === 'image-occlusion')),
      );
    }
  });

  it('does not present its notes as published books or claim outside endorsement', () => {
    for (const deck of CURATED_STARTER_DECKS) {
      const text = JSON.stringify(deck);
      expect(text, deck.id).not.toMatch(/\.pdf/i);
      expect(text, deck.id).not.toMatch(/verified|endorsed|accredited/i);
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
