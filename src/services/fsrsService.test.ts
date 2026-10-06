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

  it('calculates optimal intervals scaling with stability and target retention', () => {
    // At default 0.90 retention, interval should equal stability
    expect(FSRSService.calculateInterval(10, 0.90)).toBe(10);
    expect(FSRSService.calculateInterval(30, 0.90)).toBe(30);

    // Higher retention target (0.95) requires shorter review intervals
    const strictInterval = FSRSService.calculateInterval(30, 0.95);
    expect(strictInterval).toBeLessThan(30);
    expect(strictInterval).toBeGreaterThan(5);

    // Lower retention target (0.80) allows longer review intervals
    const relaxedInterval = FSRSService.calculateInterval(30, 0.80);
    expect(relaxedInterval).toBeGreaterThan(30);
  });

  it('determines dynamic concept pedagogical strictness correctly', () => {
    // 1. Empty cards defaults to dialectic
    const emptyState = FSRSService.getConceptPedagogicalState([]);
    expect(emptyState.mode).toBe('dialectic');
    expect(emptyState.retrievability).toBe(85);

    // 2. High lapse or decayed cards trigger scaffolding
    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const strugglingCards = [
      createMockCard({ lapses: 3, stability: 1, lastReviewDate: pastDate }),
      createMockCard({ lapses: 1, stability: 2, lastReviewDate: pastDate }),
    ];
    const scaffoldState = FSRSService.getConceptPedagogicalState(strugglingCards);
    expect(scaffoldState.mode).toBe('scaffolding');
    expect(scaffoldState.guidanceDirective).toContain('Socratic Scaffolding Mode');

    // 3. High stability with 0 lapses triggers adversarial mode
    const masteredCards = [
      createMockCard({ reps: 5, stability: 25, lapses: 0, lastReviewDate: new Date().toISOString() }),
      createMockCard({ reps: 6, stability: 30, lapses: 0, lastReviewDate: new Date().toISOString() }),
    ];
    const advState = FSRSService.getConceptPedagogicalState(masteredCards);
    expect(advState.mode).toBe('adversarial');
    expect(advState.guidanceDirective).toContain('Adversarial Inoculation Mode');
  });
});
