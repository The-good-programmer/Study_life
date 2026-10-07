import { describe, it, expect } from 'vitest';
import type { RetrievalCard } from '../../types';
import { groupNextReviews } from './sessionSchedule';

const NOW = new Date(2026, 2, 4, 15, 30); // 4 March, mid-afternoon

const cardDue = (id: string, due?: Date): RetrievalCard =>
  ({
    id,
    conceptId: 'k',
    question: 'q',
    answer: 'a',
    stability: 1,
    difficulty: 5,
    reps: 1,
    lapses: 0,
    nextReviewDate: due?.toISOString(),
  }) as RetrievalCard;

const at = (dayOffset: number, hour = 9) => new Date(2026, 2, 4 + dayOffset, hour, 0);

describe('groupNextReviews', () => {
  it('groups cards by calendar day, soonest first', () => {
    const groups = groupNextReviews(
      [cardDue('a', at(1)), cardDue('b', at(1, 22)), cardDue('c', at(4)), cardDue('d', at(0, 18))],
      NOW,
    );
    expect(groups).toEqual([
      { days: 0, label: 'Later today', count: 1 },
      { days: 1, label: 'Tomorrow', count: 2 },
      { days: 4, label: 'In 4 days', count: 1 },
    ]);
  });

  it('uses calendar days, so a card due early tomorrow counts as tomorrow', () => {
    expect(groupNextReviews([cardDue('a', at(1, 0))], NOW)[0].label).toBe('Tomorrow');
  });

  it('treats overdue cards as due later today', () => {
    expect(groupNextReviews([cardDue('a', at(-3))], NOW)[0]).toMatchObject({ days: 0, label: 'Later today' });
  });

  it('rounds long intervals into weeks and months', () => {
    const labels = groupNextReviews([cardDue('a', at(9)), cardDue('b', at(21)), cardDue('c', at(40)), cardDue('d', at(95))], NOW).map(
      g => g.label,
    );
    expect(labels).toEqual(['In about a week', 'In about 3 weeks', 'In about a month', 'In about 3 months']);
  });

  it('skips cards that are not scheduled or have a bad date', () => {
    const bad = { ...cardDue('x'), nextReviewDate: 'not a date' } as RetrievalCard;
    expect(groupNextReviews([cardDue('a'), bad], NOW)).toEqual([]);
  });
});
