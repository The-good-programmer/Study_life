import { describe, expect, it } from 'vitest';
import type { RetrievalCard } from '../types';
import { cardStatusOf, isCardDue, MASTERED_STABILITY_DAYS, withSavedProgress } from './cardProgress';

const card = (overrides: Partial<RetrievalCard> = {}): RetrievalCard => ({
  id: 'c1',
  conceptId: 'k',
  question: 'Q',
  answer: 'A',
  stability: 1,
  difficulty: 5,
  reps: 0,
  lapses: 0,
  ...overrides,
});

const NOW = new Date('2026-10-08T12:00:00.000Z');

describe('cardStatusOf', () => {
  it('calls a card new until its first review, whatever its starting stability', () => {
    expect(cardStatusOf(card({ stability: 40 }))).toBe('new');
  });

  it('calls a reviewed card mastered from three weeks of stability', () => {
    expect(cardStatusOf(card({ reps: 2, stability: MASTERED_STABILITY_DAYS - 0.5 }))).toBe('learning');
    expect(cardStatusOf(card({ reps: 2, stability: MASTERED_STABILITY_DAYS }))).toBe('mastered');
  });
});

describe('isCardDue', () => {
  it('is due once the next review date has passed', () => {
    expect(isCardDue(card({ reps: 1, nextReviewDate: '2026-10-08T11:59:00.000Z' }), NOW)).toBe(true);
    expect(isCardDue(card({ reps: 1, nextReviewDate: '2026-10-09T08:00:00.000Z' }), NOW)).toBe(false);
  });

  it('does not count new cards as due', () => {
    expect(isCardDue(card({ nextReviewDate: '2026-10-01T00:00:00.000Z' }), NOW)).toBe(false);
    expect(isCardDue(card({ reps: 1 }), NOW)).toBe(false);
  });
});

describe('withSavedProgress', () => {
  it('takes progress and stars from the saved card and content from the copy', () => {
    const merged = withSavedProgress(
      card({ question: 'Edited question' }),
      card({ question: 'Old question', reps: 4, lapses: 1, stability: 9, difficulty: 6, isStarred: true, nextReviewDate: '2026-10-12T00:00:00.000Z' }),
    );
    expect(merged).toMatchObject({ question: 'Edited question', reps: 4, lapses: 1, stability: 9, difficulty: 6, isStarred: true });
    expect(merged.nextReviewDate).toBe('2026-10-12T00:00:00.000Z');
  });

  it('returns the copy unchanged when nothing is saved for it', () => {
    const copy = card();
    expect(withSavedProgress(copy, undefined)).toBe(copy);
  });
});
