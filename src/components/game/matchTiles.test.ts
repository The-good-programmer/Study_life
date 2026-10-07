import { describe, it, expect } from 'vitest';
import type { RetrievalCard, StudySession } from '../../types';
import { buildMatchTiles, isMatchingPair, MAX_PAIRS } from './matchTiles';

const card = (id: string, question: string, answer: string, extra: Partial<RetrievalCard> = {}): RetrievalCard =>
  ({ id, conceptId: 'k', question, answer, stability: 1, difficulty: 5, reps: 0, lapses: 0, ...extra }) as RetrievalCard;

const deck = (cards: RetrievalCard[]): StudySession => ({ id: 'd', title: 'Deck', concepts: [{ id: 'k', retrievalCards: cards }] }) as unknown as StudySession;

const random = () => 0.37;

describe('buildMatchTiles', () => {
  it('makes one question and one answer tile per card', () => {
    const tiles = buildMatchTiles(deck([card('a', 'Capital of France?', 'Paris'), card('b', 'Capital of Spain?', 'Madrid')]), random);
    expect(tiles).toHaveLength(4);
    expect(tiles.filter(t => t.type === 'question')).toHaveLength(2);
    expect(tiles.filter(t => t.cardId === 'a').map(t => t.type).sort()).toEqual(['answer', 'question']);
  });

  it('never shows the answer inside a fill-in-the-blank prompt', () => {
    const tiles = buildMatchTiles(deck([card('a', 'Water crosses membranes by {{osmosis}}.', 'osmosis', { cardType: 'cloze' })]), random);
    const prompt = tiles.find(t => t.type === 'question')!;
    expect(prompt.text).toBe('Water crosses membranes by _____.');
  });

  it('leaves out diagram cards and cards that repeat a question or answer', () => {
    const tiles = buildMatchTiles(
      deck([
        card('d1', 'Name the covered part.', 'Aorta', { cardType: 'image-occlusion', imageUrl: 'x.png', masks: [] }),
        card('a', 'Largest planet?', 'Jupiter'),
        card('b', 'Largest planet?', 'Saturn'),
        card('c', 'Gas giant with the Great Red Spot?', 'jupiter'),
      ]),
      random,
    );
    expect(tiles.some(t => t.cardId === 'd1')).toBe(false);
    const texts = (type: 'question' | 'answer') => tiles.filter(t => t.type === type).map(t => t.text.toLowerCase());
    expect(new Set(texts('question')).size).toBe(texts('question').length);
    expect(new Set(texts('answer')).size).toBe(texts('answer').length);
  });

  it(`uses at most ${MAX_PAIRS} pairs`, () => {
    const cards = Array.from({ length: 10 }, (_, i) => card(`c${i}`, `Question ${i}?`, `Answer ${i}`));
    expect(buildMatchTiles(deck(cards), random)).toHaveLength(MAX_PAIRS * 2);
  });
});

describe('isMatchingPair', () => {
  it('matches a question with its own answer only', () => {
    const [qa, aa, qb] = [
      { id: '1', cardId: 'a', text: 'Q', type: 'question' as const, isMatched: false },
      { id: '2', cardId: 'a', text: 'A', type: 'answer' as const, isMatched: false },
      { id: '3', cardId: 'b', text: 'Q2', type: 'question' as const, isMatched: false },
    ];
    expect(isMatchingPair(qa, aa)).toBe(true);
    expect(isMatchingPair(qa, qb)).toBe(false);
    expect(isMatchingPair(qa, qa)).toBe(false);
  });
});
