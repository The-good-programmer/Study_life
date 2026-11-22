import { describe, expect, it } from 'vitest';
import type { RetrievalCard, StudySession } from '../types';
import { buildDuelQuestions, canDuelWith, duelOutcome, type Duel } from './duelService';

const card = (id: string, extra: Partial<RetrievalCard> = {}): RetrievalCard =>
  ({ id, conceptId: 'k', question: `Question ${id}?`, answer: `Answer ${id}`, stability: 0, difficulty: 5, reps: 0, lapses: 0, ...extra }) as RetrievalCard;
const deck = (cards: RetrievalCard[]): StudySession => ({ id: 'd', title: 'Cells', concepts: [{ id: 'k', title: 'Cells', keyTerms: [], retrievalCards: cards }] }) as unknown as StudySession;
const seeded = () => {
  let s = 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
};

describe('duels', () => {
  it('makes up to 10 four-choice questions, with the right answer marked', () => {
    const questions = buildDuelQuestions(deck(Array.from({ length: 14 }, (_, i) => card(`c${i}`))), seeded());
    expect(questions).toHaveLength(10);
    for (const q of questions) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options[q.answerIndex]).toBe(q.question.replace('Question ', 'Answer ').replace('?', ''));
    }
  });

  it("uses a card's own choices, hides cloze answers, and skips diagram and hidden cards", () => {
    const cards = [
      card('m', { cardType: 'multiple-choice', answer: 'Paris', options: ['Paris', 'Rome', 'Oslo', 'Bern'] }),
      card('z', { cardType: 'cloze', clozeTemplate: 'The {{nucleus}} holds DNA', answer: 'nucleus' }),
      card('img', { cardType: 'image-occlusion', imageUrl: 'x', masks: [] }),
      card('h', { hidden: true }),
      ...Array.from({ length: 4 }, (_, i) => card(`c${i}`)),
    ];
    const questions = buildDuelQuestions(deck(cards), seeded());
    expect(questions.map(q => q.question)).not.toContain('Question img?');
    expect(questions.map(q => q.question)).not.toContain('Question h?');
    const choice = questions.find(q => q.options.includes('Rome'))!;
    expect(choice.options[choice.answerIndex]).toBe('Paris');
    expect(questions.find(q => q.question.includes('holds DNA'))!.question).not.toContain('nucleus');
  });

  it('needs at least 4 questions', () => {
    expect(canDuelWith(deck([card('a'), card('b'), card('c')]))).toBe(false);
    expect(canDuelWith(deck(Array.from({ length: 5 }, (_, i) => card(`c${i}`))))).toBe(true);
  });

  it('decides the winner by score, then time', () => {
    const duel = (you: [number, number], them: [number, number]) =>
      ({ status: 'done', you: { score: you[0], ms: you[1] }, them: { score: them[0], ms: them[1] } }) as Duel;
    expect(duelOutcome(duel([8, 50_000], [6, 20_000]))).toBe('won');
    expect(duelOutcome(duel([6, 50_000], [8, 20_000]))).toBe('lost');
    expect(duelOutcome(duel([7, 30_000], [7, 40_000]))).toBe('won');
    expect(duelOutcome(duel([7, 30_000], [7, 30_000]))).toBe('draw');
    expect(duelOutcome({ ...duel([7, 1], [7, 1]), status: 'waiting' })).toBeNull();
  });
});
