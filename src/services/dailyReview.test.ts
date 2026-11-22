import { describe, expect, it } from 'vitest';
import type { RetrievalCard, StudySession } from '../types';
import { buildDailyQueue, buildDailyReviewSession } from './dailyReview';

const NOW = new Date('2026-11-22T10:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const card = (id: string, progress: Partial<RetrievalCard> = {}): RetrievalCard =>
  ({ id, question: id, answer: id, stability: 0, difficulty: 5, reps: 0, lapses: 0, ...progress }) as RetrievalCard;
const learned = (id: string, dueDaysAgo: number) =>
  card(id, { reps: 3, stability: 5, lastReviewDate: daysAgo(dueDaysAgo + 3), nextReviewDate: daysAgo(dueDaysAgo) });
const deck = (id: string, cards: RetrievalCard[]): StudySession =>
  ({ id, title: id, concepts: [{ id: `${id}-c`, retrievalCards: cards }] }) as unknown as StudySession;

const options = { now: NOW, newPerDay: 10, newStartedToday: 0 };

describe('buildDailyQueue', () => {
  it('takes due cards from every deck, most overdue first, and leaves out cards not due', () => {
    const decks = [deck('bio', [learned('b1', 1), learned('b2', -3)]), deck('chem', [learned('c1', 5)])];
    const queue = buildDailyQueue(decks, new Map(), options);
    expect(queue.cards.map(c => c.id)).toEqual(['c1', 'b1']);
    expect(queue).toMatchObject({ dueCount: 2, newCount: 0 });
  });

  it('adds new cards up to the daily limit, taking turns between decks', () => {
    const bio = deck('bio', Array.from({ length: 8 }, (_, i) => card(`b${i}`)));
    const chem = deck('chem', Array.from({ length: 8 }, (_, i) => card(`c${i}`)));
    const queue = buildDailyQueue([bio, chem], new Map(), { ...options, newPerDay: 5 });
    expect(queue.cards.map(c => c.id)).toEqual(['b0', 'c0', 'b1', 'c1', 'b2']);
    expect(queue.newCount).toBe(5);
  });

  it('counts new cards already started today against the limit', () => {
    const bio = deck('bio', Array.from({ length: 20 }, (_, i) => card(`b${i}`)));
    expect(buildDailyQueue([bio], new Map(), { ...options, newStartedToday: 7 }).newCount).toBe(3);
    expect(buildDailyQueue([bio], new Map(), { ...options, newStartedToday: 12 }).newCount).toBe(0);
  });

  it('uses saved progress over the copy in the deck, and lists a shared card once', () => {
    const shared = card('s1');
    const saved = new Map([['s1', learned('s1', 2)]]);
    const queue = buildDailyQueue([deck('a', [shared]), deck('b', [shared])], saved, options);
    expect(queue.cards.map(c => c.id)).toEqual(['s1']);
    expect(queue.dueCount).toBe(1);
  });

  it('is empty when nothing is due and there are no new cards', () => {
    expect(buildDailyQueue([deck('bio', [learned('b1', -2)])], new Map(), options)).toEqual({ cards: [], dueCount: 0, newCount: 0 });
  });
});

describe('buildDailyReviewSession', () => {
  it('holds the queue in one flashcard session that is never saved', () => {
    const queue = buildDailyQueue([deck('bio', [learned('b1', 1), card('b2')])], new Map(), options);
    const session = buildDailyReviewSession(queue, NOW);
    expect(session).toMatchObject({ id: 'daily-review', ephemeral: true, casualFlashcardMode: true, currentPhase: 'retrieval' });
    expect(session.concepts[0].retrievalCards.map(c => c.id)).toEqual(['b1', 'b2']);
  });
});
