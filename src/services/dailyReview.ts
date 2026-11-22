import type { RetrievalCard, StudySession } from '../types';
import { isCardDue, withSavedProgress } from '../utils/cardProgress';

/**
 * Today's review: the cards to study now across every deck. That is every card already learned
 * that has come due (the most overdue first), then a limited number of new cards, so new decks
 * don't pile up more reviews than a student can keep up with. Pure functions only.
 */

export const DEFAULT_NEW_CARDS_PER_DAY = 10;
export const NEW_CARDS_PER_DAY_OPTIONS = [5, 10, 20, 30] as const;

export const DAILY_REVIEW_ID = 'daily-review';

export interface DailyQueue {
  cards: RetrievalCard[];
  /** Learned cards due now. */
  dueCount: number;
  /** New cards in today's queue. */
  newCount: number;
}

interface QueueOptions {
  now: Date;
  newPerDay: number;
  /** New cards already started today (they count against the daily limit). */
  newStartedToday: number;
}

const timeOf = (iso?: string) => {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? t : 0;
};

/** Lists taken in turns (a, b, c, a, b, c, …), so one deck doesn't fill the whole review. */
const roundRobin = <T>(lists: T[][]): T[] => {
  const out: T[] = [];
  const longest = Math.max(0, ...lists.map(l => l.length));
  for (let i = 0; i < longest; i++) for (const list of lists) if (i < list.length) out.push(list[i]);
  return out;
};

/** Today's queue from the decks, with each card's saved progress. */
export function buildDailyQueue(
  decks: readonly StudySession[],
  savedCards: ReadonlyMap<string, RetrievalCard>,
  { now, newPerDay, newStartedToday }: QueueOptions,
): DailyQueue {
  const seen = new Set<string>();
  const due: RetrievalCard[] = [];
  const newByDeck: RetrievalCard[][] = [];

  for (const deck of decks) {
    const fresh: RetrievalCard[] = [];
    for (const concept of deck.concepts ?? []) {
      for (const raw of concept.retrievalCards ?? []) {
        if (!raw || seen.has(raw.id)) continue;
        seen.add(raw.id);
        const card = withSavedProgress(raw, savedCards.get(raw.id));
        if (isCardDue(card, now)) due.push(card);
        else if (!card.reps) fresh.push(card);
      }
    }
    newByDeck.push(fresh);
  }

  due.sort((a, b) => timeOf(a.nextReviewDate) - timeOf(b.nextReviewDate));
  const room = Math.max(0, newPerDay - newStartedToday);
  const fresh = roundRobin(newByDeck).slice(0, room);
  return { cards: [...due, ...fresh], dueCount: due.length, newCount: fresh.length };
}

/** An in-memory session holding today's queue, for the review screen. It is never saved as a deck. */
export function buildDailyReviewSession(queue: DailyQueue, now: Date = new Date()): StudySession {
  const minutes = Math.max(1, Math.round(queue.cards.length * 0.4));
  return {
    id: DAILY_REVIEW_ID,
    title: "Today's review",
    category: 'Review',
    description: `${queue.dueCount} to review, ${queue.newCount} new`,
    createdAt: now.toISOString(),
    currentConceptIndex: 0,
    currentPhase: 'retrieval',
    elapsedSeconds: 0,
    casualFlashcardMode: true,
    ephemeral: true,
    concepts: [
      {
        id: `${DAILY_REVIEW_ID}-cards`,
        order: 0,
        title: "Today's review",
        estimatedMinutes: minutes,
        mentalModel: '',
        coreTakeaways: [],
        keyTerms: [],
        feynmanPrompt: '',
        sampleMasteryExplanation: '',
        retrievalCards: queue.cards,
      },
    ],
  };
}
