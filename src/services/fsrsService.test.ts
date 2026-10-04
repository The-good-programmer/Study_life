import { describe, it, expect } from 'vitest';
import { FSRSService } from './fsrsService';
import type { RetrievalCard } from '../types';

const createMockCard = (overrides: Partial<RetrievalCard> = {}): RetrievalCard => ({
  id: 'card-test-1',
  conceptId: 'concept-1',
  question: 'What is active recall?',
  answer: 'Retrieving information from memory rather than passively reviewing.',
  retrievability: 100,
  stability: 1,
  difficulty: 5,
  reps: 0,
  lapses: 0,
  nextReviewDate: new Date().toISOString(),
  ...overrides,
});

describe('FSRSService', () => {
  it('schedules review correctly for "good" rating', () => {
    const card = createMockCard();
    const result = FSRSService.schedule(card, 'good');

    expect(result.updatedCard.reps).toBe(1);
    expect(result.updatedCard.stability).toBeGreaterThan(0);
    expect(result.updatedCard.difficulty).toBeGreaterThan(0);
    expect(result.updatedCard.lastReviewDate).toBeDefined();
    expect(result.updatedCard.nextReviewDate).toBeDefined();
    expect(result.nextIntervalDays).toBeGreaterThan(0);
  });

  it('records lapses and stability adjustment for "again" rating', () => {
    const card = createMockCard({ reps: 3, stability: 12 });
    const result = FSRSService.schedule(card, 'again');

    expect(result.updatedCard.lapses).toBe(1);
    expect(result.updatedCard.stability).toBeLessThan(12);
  });

  it('calculates retrievability on forgetting curve', () => {
    const card = createMockCard({
      lastReviewDate: new Date().toISOString(),
      stability: 10,
    });

    const immediateR = FSRSService.calculateRetrievability(card, new Date());
    expect(immediateR).toBeGreaterThanOrEqual(95);
    expect(immediateR).toBeLessThanOrEqual(100);

    const futureDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const decayedR = FSRSService.calculateRetrievability(card, futureDate);
    expect(decayedR).toBeLessThan(immediateR);
    expect(decayedR).toBeGreaterThanOrEqual(0);
  });

  it('previews intervals for all 4 ratings', () => {
    const card = createMockCard();
    const previews = FSRSService.previewIntervals(card);

    expect(previews.again).toBeDefined();
    expect(previews.hard).toBeDefined();
    expect(previews.good).toBeDefined();
    expect(previews.easy).toBeDefined();
    expect(typeof previews.good).toBe('string');
  });

  it('formats intervals accurately for human display', () => {
    expect(FSRSService.formatInterval(0.01)).toBe('15m');
    expect(FSRSService.formatInterval(0.5)).toBe('12h');
    expect(FSRSService.formatInterval(1.2)).toBe('1d');
    expect(FSRSService.formatInterval(7)).toBe('7d');
    expect(FSRSService.formatInterval(65)).toBe('2mo');
  });
});
