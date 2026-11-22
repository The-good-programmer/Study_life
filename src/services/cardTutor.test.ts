import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RetrievalCard } from '../types';
import { AIService } from './aiService';
import { askAboutCard, describeCard, tutorRequest, wrongAnswerPrompt } from './cardTutor';

const card = { id: 'c', question: 'What makes ATP?', answer: 'Mitochondria', explanation: 'Cellular respiration', stability: 0, difficulty: 5, reps: 0, lapses: 0 } as RetrievalCard;

describe('asking about a card', () => {
  afterEach(() => vi.restoreAllMocks());

  it('gives the AI the card, the chat so far and the new question', () => {
    const request = tutorRequest(card, [{ question: 'Simpler?', answer: 'Power plants of the cell.' }], 'An example?');
    expect(request[0].parts[0].text).toContain('Question: What makes ATP?');
    expect(request[0].parts[0].text).toContain('Answer: Mitochondria');
    expect(request.slice(2).map(m => [m.role, m.parts[0].text])).toEqual([
      ['user', 'Simpler?'],
      ['model', 'Power plants of the cell.'],
      ['user', 'An example?'],
    ]);
  });

  it('keeps long chats short, within what the server accepts', () => {
    const history = Array.from({ length: 20 }, (_, i) => ({ question: `q${i}`, answer: `a${i}` }));
    const parts = tutorRequest(card, history, 'last').reduce((n, m) => n + m.parts.length, 0);
    expect(parts).toBeLessThanOrEqual(16);
  });

  it('fills cloze blanks so the tutor sees the whole sentence', () => {
    expect(describeCard({ ...card, clozeTemplate: 'The {{mitochondria}} makes ATP' })).toContain('Question: The mitochondria makes ATP');
    expect(wrongAnswerPrompt('Ribosome')).toContain('"Ribosome"');
  });

  it('returns the answer, and fails on an empty one', async () => {
    vi.spyOn(AIService, 'generateText').mockResolvedValueOnce('  Like a power plant.  ').mockResolvedValueOnce(' ');
    await expect(askAboutCard(card, [], 'Simpler?')).resolves.toBe('Like a power plant.');
    await expect(askAboutCard(card, [], 'Simpler?')).rejects.toThrow();
  });
});
