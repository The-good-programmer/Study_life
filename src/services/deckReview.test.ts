import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RetrievalCard, StudySession } from '../types';
import { AIService } from './aiService';
import { applyReview, reviewGeneratedDeck, reviewPrompt } from './deckReview';

const card = (id: string, extra: Partial<RetrievalCard> = {}): RetrievalCard =>
  ({ id, conceptId: 'k', cardType: 'standard', question: `Q ${id}?`, answer: `A ${id}`, explanation: 'Because.', stability: 1, difficulty: 5, reps: 0, lapses: 0, ...extra }) as RetrievalCard;
const deck = (...concepts: RetrievalCard[][]): StudySession =>
  ({ id: 's', title: 'Cells', concepts: concepts.map((cards, i) => ({ id: `k${i}`, title: `C${i}`, retrievalCards: cards })) }) as unknown as StudySession;

describe("the AI's second check of a new deck", () => {
  afterEach(() => vi.restoreAllMocks());

  it('applies fixes and removals, and records what it did', () => {
    const result = applyReview(deck([card('a'), card('b'), card('c')]), [
      { id: 'a', verdict: 'ok' },
      { id: 'b', verdict: 'fix', answer: 'The right answer', reason: 'Wrong fact' },
      { id: 'c', verdict: 'remove', reason: 'Repeat' },
    ]);
    expect(result.concepts[0].retrievalCards.map(c => [c.id, c.answer])).toEqual([['a', 'A a'], ['b', 'The right answer']]);
    // The old explanation no longer fits the new answer.
    expect(result.concepts[0].retrievalCards[1].explanation).toBeUndefined();
    expect(result.quality).toEqual({ checked: 3, fixed: 1, removed: 1 });
  });

  it('fixes a fill-in-the-blank sentence and multiple-choice options through the same checks', () => {
    const result = applyReview(deck([card('z', { cardType: 'cloze', clozeTemplate: 'The {{ribosome}} makes ATP', question: 'The {{ribosome}} makes ATP', answer: 'ribosome' }), card('m', { cardType: 'multiple-choice', options: ['A m', 'x', 'y', 'z'] })]), [
      { id: 'z', verdict: 'fix', question: 'The {{mitochondria}} makes ATP' },
      { id: 'm', verdict: 'fix', options: ['A m', 'B', 'C', 'D'] },
    ]);
    expect(result.concepts[0].retrievalCards[0]).toMatchObject({ clozeTemplate: 'The {{mitochondria}} makes ATP', answer: 'mitochondria' });
    expect(result.concepts[0].retrievalCards[1].options).toEqual(['A m', 'B', 'C', 'D']);
  });

  it('never empties a concept, and ignores a fix that would break the card', () => {
    const result = applyReview(deck([card('only')], [card('x'), card('y')]), [
      { id: 'only', verdict: 'remove' },
      { id: 'x', verdict: 'fix', question: '   ' },
    ]);
    expect(result.concepts[0].retrievalCards.map(c => c.id)).toEqual(['only']);
    expect(result.concepts[1].retrievalCards.map(c => c.question)).toEqual(['Q x?', 'Q y?']);
  });

  it('checks against the material when there is some', () => {
    expect(reviewPrompt(deck([card('a')]), 'Mitochondria make ATP.')).toContain('MATERIAL:');
    expect(reviewPrompt(deck([card('a')]))).toContain('well-established knowledge');
    expect(reviewPrompt(deck([card('a')]))).toContain('[a] (standard)');
  });

  it('keeps the deck as it is when the check fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const original = deck([card('a')]);
    vi.spyOn(AIService, 'generateText').mockRejectedValue(new Error('Daily AI limit reached.'));
    await expect(reviewGeneratedDeck(original)).resolves.toBe(original);
    vi.spyOn(AIService, 'generateText').mockResolvedValue('not json');
    await expect(reviewGeneratedDeck(original)).resolves.toBe(original);
  });
});
