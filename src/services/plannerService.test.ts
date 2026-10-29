import { describe, it, expect } from 'vitest';
import type { PlannerItem, RetrievalCard, StudySession } from '../types';
import { cleanDraft, daysBetween, dayKey, isDayKey, planDay, planExam } from './plannerService';

const NOW = new Date(2026, 9, 29, 10, 0); // 29 Oct 2026, 10:00 local
const TODAY = dayKey(NOW);

const inDays = (n: number): string => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};

const item = (overrides: Partial<PlannerItem>): PlannerItem => ({
  id: overrides.id ?? `i-${Math.random()}`,
  kind: 'exam',
  title: 'Biology midterm',
  date: inDays(10),
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
  ...overrides,
});

const card = (id: string, progress: Partial<RetrievalCard> = {}): RetrievalCard =>
  ({ id, front: id, back: id, stability: 0, difficulty: 5, reps: 0, lapses: 0, ...progress }) as RetrievalCard;

const deck = (id: string, folderId: string | undefined, cards: RetrievalCard[]): StudySession =>
  ({
    id,
    title: id,
    category: 'Biology',
    folderId,
    description: '',
    currentConceptIndex: 0,
    concepts: [{ id: `${id}-c`, title: id, retrievalCards: cards }],
  }) as unknown as StudySession;

const freshCards = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => card(`${prefix}${i}`));

describe('day helpers', () => {
  it('counts calendar days', () => {
    expect(daysBetween('2026-10-29', '2026-11-08')).toBe(10);
    expect(daysBetween('2026-10-29', '2026-10-28')).toBe(-1);
    // Across the end of daylight saving time, still whole days.
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('accepts real dates only', () => {
    expect(isDayKey('2026-02-28')).toBe(true);
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('26-2-1')).toBe(false);
  });
});

describe('planExam', () => {
  const decks = [deck('cells', 'bio', freshCards('a', 40)), deck('genetics', 'bio', freshCards('b', 20)), deck('maths', 'math', freshCards('m', 50))];

  it('spreads the new cards over the days before the last two', () => {
    const plan = planExam(item({ folderId: 'bio', date: inDays(10) }), decks, TODAY, NOW);
    expect(plan.phase).toBe('learn');
    expect(plan.newCards).toBe(60);
    expect(plan.totalCards).toBe(60);
    expect(plan.newToday).toBe(Math.ceil(60 / 8));
    expect(plan.pace).toBe('on-track');
    expect(plan.nextDeck?.id).toBe('cells');
  });

  it('only studies decks in the exam subject', () => {
    const plan = planExam(item({ folderId: 'math' }), decks, TODAY, NOW);
    expect(plan.decks.map(d => d.id)).toEqual(['maths']);
  });

  it('asks for a subject or decks when there is nothing to study', () => {
    expect(planExam(item({ folderId: undefined }), decks, TODAY, NOW).phase).toBe('no-decks');
    expect(planExam(item({ folderId: 'history' }), decks, TODAY, NOW).phase).toBe('no-decks');
  });

  it('says when the pace is more than a student can comfortably learn', () => {
    const big = [deck('big', 'bio', freshCards('x', 300))];
    expect(planExam(item({ folderId: 'bio', date: inDays(12) }), big, TODAY, NOW).pace).toBe('tight'); // 30 a day
    expect(planExam(item({ folderId: 'bio', date: inDays(5) }), big, TODAY, NOW).pace).toBe('behind'); // 100 a day
  });

  it('keeps the last two days for review, and is behind if new cards are left then', () => {
    const learned = [deck('d', 'bio', [card('r1', { reps: 3, stability: 4, nextReviewDate: inDays(-1) }), card('r2', { reps: 2, stability: 30 })])];
    const done = planExam(item({ folderId: 'bio', date: inDays(2) }), learned, TODAY, NOW);
    expect(done.phase).toBe('review');
    expect(done.dueCards).toBe(1);
    expect(done.pace).toBe('on-track');

    const late = planExam(item({ folderId: 'bio', date: inDays(1) }), decks, TODAY, NOW);
    expect(late.phase).toBe('review');
    expect(late.newToday).toBe(60);
    expect(late.pace).toBe('behind');
  });

  it('marks the exam day', () => {
    expect(planExam(item({ folderId: 'bio', date: TODAY }), decks, TODAY, NOW).phase).toBe('exam-day');
  });
});

describe('planDay', () => {
  it('lists upcoming exams, homework due this week and what is overdue', () => {
    const items = [
      item({ id: 'later', date: inDays(20) }),
      item({ id: 'soon', date: inDays(3) }),
      item({ id: 'past-exam', date: inDays(-2) }),
      item({ id: 'hw-week', kind: 'homework', date: inDays(6) }),
      item({ id: 'hw-month', kind: 'homework', date: inDays(30) }),
      item({ id: 'hw-late', kind: 'homework', date: inDays(-1) }),
      item({ id: 'hw-done', kind: 'homework', date: inDays(-1), done: true }),
    ];
    const plan = planDay(items, [], NOW);
    expect(plan.exams.map(e => e.exam.id)).toEqual(['soon', 'later']);
    expect(plan.dueSoon.map(i => i.id)).toEqual(['hw-week']);
    expect(plan.overdue.map(i => i.id)).toEqual(['hw-late']);
  });
});

describe('exams sharing a subject', () => {
  it('lets the soonest set the pace, so the same cards are not counted twice', () => {
    const decks = [deck('cells', 'bio', freshCards('a', 60))];
    const plan = planDay(
      [item({ id: 'final', folderId: 'bio', date: inDays(20) }), item({ id: 'mid', folderId: 'bio', date: inDays(10) }), item({ id: 'other', folderId: 'chem', date: inDays(12) })],
      decks,
      NOW,
    );
    expect(plan.exams.map(e => [e.exam.id, e.coveredBy?.id])).toEqual([['mid', undefined], ['other', undefined], ['final', 'mid']]);
  });
});

describe('cleanDraft', () => {
  it('trims and drops invalid fields', () => {
    const result = cleanDraft({ kind: 'homework', title: '  Essay  ', date: '2026-11-02', time: '25:00', topics: [' a ', ''], notes: ' ' });
    expect(result).toEqual({ item: { kind: 'homework', title: 'Essay', date: '2026-11-02', time: undefined, folderId: undefined, topics: ['a'], notes: undefined, source: undefined } });
  });

  it('needs a name and a real date', () => {
    expect(cleanDraft({ kind: 'exam', title: ' ', date: '2026-11-02' })).toEqual({ error: 'Give it a name.' });
    expect(cleanDraft({ kind: 'exam', title: 'Final', date: '' })).toEqual({ error: 'Pick a date.' });
  });
});
