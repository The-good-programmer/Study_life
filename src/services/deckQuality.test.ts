import { describe, expect, it } from 'vitest';
import type { RetrievalCard, StudySession } from '../types';
import { UnusableDeckError, cleanCard, cleanGeneratedDeck } from './deckQuality';

const card = (extra: Partial<RetrievalCard>): RetrievalCard =>
  ({ id: 'c', conceptId: 'k', question: 'What makes ATP?', answer: 'Mitochondria', stability: 1, difficulty: 5, reps: 0, lapses: 0, ...extra }) as RetrievalCard;
const deck = (...concepts: RetrievalCard[][]): StudySession =>
  ({ id: 's', title: 'Cells', concepts: concepts.map((cards, i) => ({ id: `k${i}`, order: i + 1, title: `C${i}`, retrievalCards: cards })) }) as unknown as StudySession;

describe('checking an AI deck', () => {
  it('drops cards with no question or answer instead of inventing text', () => {
    expect(cleanCard(card({ answer: '' }))).toBeNull();
    expect(cleanCard(card({ question: '  ' }))).toBeNull();
  });

  it('makes a card multiple choice only with three different wrong choices, and adds the answer', () => {
    expect(cleanCard(card({ cardType: 'multiple-choice', options: [] }))).toMatchObject({ cardType: 'standard', options: undefined });
    expect(cleanCard(card({ cardType: 'multiple-choice', options: ['Ribosome', 'ribosome ', 'Mitochondria'] }))?.cardType).toBe('standard');
    expect(cleanCard(card({ options: ['Ribosome', 'Nucleus', 'Golgi body', 'Lysosome'] }))).toMatchObject({
      cardType: 'multiple-choice',
      options: ['Mitochondria', 'Ribosome', 'Nucleus', 'Golgi body'],
    });
  });

  it('makes a card fill-in-the-blank only when it has a blank', () => {
    expect(cleanCard(card({ cardType: 'cloze' }))?.cardType).toBe('standard');
    expect(cleanCard(card({ question: 'The {{mitochondria}} makes ATP', answer: '' }))).toMatchObject({
      cardType: 'cloze',
      clozeTemplate: 'The {{mitochondria}} makes ATP',
      answer: 'mitochondria',
    });
  });

  it('keeps a question once per deck and drops concepts left empty', () => {
    const cleaned = cleanGeneratedDeck(deck([card({ id: 'a' }), card({ id: 'b', question: 'what makes ATP ' })], [card({ id: 'c', question: 'what makes atp?' })], [card({ id: 'd', question: 'Where is DNA?', answer: 'Nucleus' })]));
    expect(cleaned.concepts.map(c => c.retrievalCards.map(r => r.id))).toEqual([['a'], ['d']]);
    expect(cleaned.concepts.map(c => c.order)).toEqual([1, 2]);
  });

  it('fails clearly when nothing usable is left', () => {
    expect(() => cleanGeneratedDeck(deck([card({ answer: '' })]))).toThrow(UnusableDeckError);
  });
});
