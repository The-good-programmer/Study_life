import type { PlannerItem, PlannerItemKind, RetrievalCard, StudySession } from '../types';
import { StorageService } from './storageService';
import { cardStatusOf, isCardDue } from '../utils/cardProgress';

/** A local calendar day as YYYY-MM-DD. */
export const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Parses YYYY-MM-DD as local midnight. */
export const parseDayKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Whole calendar days from one day to another (negative when `to` is earlier). */
export const daysBetween = (from: string, to: string): number =>
  Math.round((parseDayKey(to).getTime() - parseDayKey(from).getTime()) / 86_400_000);

export const isDayKey = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dayKey(parseDayKey(value)) === value;

export const isTimeOfDay = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** New cards a day that still leave time for reviews; above it the plan is tight, above double it behind. */
export const COMFORTABLE_NEW_PER_DAY = 25;

export type ExamPhase = 'learn' | 'review' | 'exam-day' | 'no-decks';
export type ExamPace = 'on-track' | 'tight' | 'behind';

export interface ExamPlan {
  exam: PlannerItem;
  /** 0 on the day of the exam. */
  daysLeft: number;
  phase: ExamPhase;
  /** Decks in the exam's subject. */
  decks: StudySession[];
  totalCards: number;
  newCards: number;
  dueCards: number;
  /** New cards to learn today to finish them before the review days. */
  newToday: number;
  pace: ExamPace;
  /** Where to start today: the deck with most new cards while learning, most due cards after. */
  nextDeck?: StudySession;
  /** An earlier exam in the same subject: its plan already covers these decks, so this one adds no work today. */
  coveredBy?: PlannerItem;
}

export interface DayPlan {
  /** Upcoming exams, soonest first. */
  exams: ExamPlan[];
  /** Homework and other items due in the next week, soonest first. */
  dueSoon: PlannerItem[];
  /** Homework and other items whose day has passed but aren't marked done. */
  overdue: PlannerItem[];
}

/** The last days before an exam (the eve and the day before) are kept for review: no new cards. */
export const REVIEW_DAYS = 2;

const cardsOf = (deck: StudySession): RetrievalCard[] => (deck.concepts || []).flatMap(c => c.retrievalCards || []);

/**
 * What an exam needs today. Works back from the exam: new cards are spread over the days before
 * the review days, and the last day is for review. When the pace is more than a student can
 * comfortably learn, it says so rather than quietly dropping cards.
 */
export function planExam(exam: PlannerItem, decks: StudySession[], today: string, now: Date): ExamPlan {
  const daysLeft = daysBetween(today, exam.date);
  const subjectDecks = exam.folderId ? decks.filter(d => d.folderId === exam.folderId) : [];
  const perDeck = subjectDecks.map(deck => {
    const cards = cardsOf(deck);
    return {
      deck,
      total: cards.length,
      fresh: cards.filter(c => cardStatusOf(c) === 'new').length,
      due: cards.filter(c => isCardDue(c, now)).length,
    };
  });
  const totalCards = perDeck.reduce((sum, d) => sum + d.total, 0);
  const newCards = perDeck.reduce((sum, d) => sum + d.fresh, 0);
  const dueCards = perDeck.reduce((sum, d) => sum + d.due, 0);
  const learnDays = daysLeft - REVIEW_DAYS;

  let phase: ExamPhase;
  if (totalCards === 0) phase = 'no-decks';
  else if (daysLeft <= 0) phase = 'exam-day';
  else if (newCards > 0 && learnDays > 0) phase = 'learn';
  else phase = 'review';

  // New cards left in the review days are still worth a look, all at once, but the plan is behind.
  const newToday = phase === 'learn' ? Math.ceil(newCards / learnDays) : phase === 'review' ? newCards : 0;
  const pace: ExamPace =
    phase === 'review' && newCards > 0
      ? 'behind'
      : newToday > COMFORTABLE_NEW_PER_DAY * 2
        ? 'behind'
        : newToday > COMFORTABLE_NEW_PER_DAY
          ? 'tight'
          : 'on-track';

  const ranked = [...perDeck].sort((a, b) => (phase === 'learn' ? b.fresh - a.fresh : b.due - a.due));
  const nextDeck = ranked.find(d => (phase === 'learn' ? d.fresh : d.due + d.fresh) > 0)?.deck ?? ranked[0]?.deck;

  return { exam, daysLeft, phase, decks: subjectDecks, totalCards, newCards, dueCards, newToday, pace, nextDeck };
}

/** Today's plan from the planner and the decks (with their saved review progress). */
export function planDay(items: PlannerItem[], decks: StudySession[], now: Date = new Date()): DayPlan {
  const today = dayKey(now);
  const open = items.filter(item => !item.done);
  const byDate = (a: PlannerItem, b: PlannerItem) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '');
  // Exams in one subject study the same decks; the soonest one sets the pace for all of them.
  const firstBySubject = new Map<string, PlannerItem>();
  const exams = open
    .filter(item => item.kind === 'exam' && daysBetween(today, item.date) >= 0)
    .sort(byDate)
    .map(exam => {
      const plan = planExam(exam, decks, today, now);
      if (!exam.folderId || plan.phase === 'no-decks') return plan;
      const earlier = firstBySubject.get(exam.folderId);
      if (!earlier) firstBySubject.set(exam.folderId, exam);
      return earlier ? { ...plan, coveredBy: earlier } : plan;
    });
  const tasks = open.filter(item => item.kind !== 'exam').sort(byDate);
  return {
    exams,
    dueSoon: tasks.filter(item => {
      const days = daysBetween(today, item.date);
      return days >= 0 && days <= 7;
    }),
    overdue: tasks.filter(item => daysBetween(today, item.date) < 0),
  };
}

/** "today", "tomorrow", "in 5 days", "2 days ago". */
export const relativeDay = (days: number): string =>
  days === 0 ? 'today' : days === 1 ? 'tomorrow' : days === -1 ? 'yesterday' : days > 0 ? `in ${days} days` : `${-days} days ago`;

export const KIND_LABELS: Record<PlannerItemKind, string> = {
  exam: 'Exam',
  homework: 'Homework',
  other: 'Other',
};

export type PlannerDraft = Pick<PlannerItem, 'kind' | 'title' | 'date'> &
  Partial<Pick<PlannerItem, 'time' | 'folderId' | 'topics' | 'notes' | 'source'>>;

/** Trims a draft and drops what isn't valid, or returns an error to show. */
export function cleanDraft(draft: PlannerDraft): { item: PlannerDraft } | { error: string } {
  const title = draft.title.trim().slice(0, 120);
  if (!title) return { error: 'Give it a name.' };
  if (!isDayKey(draft.date)) return { error: 'Pick a date.' };
  const topics = (draft.topics || []).map(t => t.trim().slice(0, 80)).filter(Boolean).slice(0, 30);
  const notes = draft.notes?.trim().slice(0, 1000);
  return {
    item: {
      kind: draft.kind,
      title,
      date: draft.date,
      time: isTimeOfDay(draft.time) ? draft.time : undefined,
      folderId: draft.folderId || undefined,
      topics: topics.length > 0 ? topics : undefined,
      notes: notes || undefined,
      source: draft.source,
    },
  };
}

export const PlannerService = {
  getItems(): PlannerItem[] {
    return StorageService.getPlannerItems();
  },

  add(draft: PlannerDraft): PlannerItem {
    const cleaned = cleanDraft(draft);
    if ('error' in cleaned) throw new Error(cleaned.error);
    const now = new Date().toISOString();
    const item: PlannerItem = {
      ...cleaned.item,
      source: cleaned.item.source ?? 'manual',
      id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    StorageService.savePlannerItems([...StorageService.getPlannerItems(), item]);
    return item;
  },

  /** Adds several at once (from a syllabus), skipping any that aren't valid. */
  addMany(drafts: PlannerDraft[]): PlannerItem[] {
    const now = new Date().toISOString();
    const added: PlannerItem[] = [];
    drafts.forEach((draft, i) => {
      const cleaned = cleanDraft(draft);
      if ('error' in cleaned) return;
      added.push({
        ...cleaned.item,
        source: cleaned.item.source ?? 'manual',
        id: `plan-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: now,
        updatedAt: now,
      });
    });
    if (added.length > 0) StorageService.savePlannerItems([...StorageService.getPlannerItems(), ...added]);
    return added;
  },

  update(id: string, changes: Partial<PlannerDraft> & { done?: boolean }): PlannerItem | null {
    const items = StorageService.getPlannerItems();
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;
    const current = items[index];
    const { done, ...draftChanges } = changes;
    const cleaned = cleanDraft({ ...current, ...draftChanges });
    if ('error' in cleaned) throw new Error(cleaned.error);
    const updated: PlannerItem = {
      ...current,
      ...cleaned.item,
      done: done ?? current.done,
      updatedAt: new Date().toISOString(),
    };
    items[index] = updated;
    StorageService.savePlannerItems(items);
    return updated;
  },

  remove(id: string): void {
    StorageService.savePlannerItems(StorageService.getPlannerItems().filter(item => item.id !== id));
  },

  /** Today's plan from what is stored now. */
  today(now: Date = new Date()): DayPlan {
    return planDay(
      StorageService.getPlannerItems(),
      StorageService.getSessions().map(deck => StorageService.deckWithLatestProgress(deck)),
      now,
    );
  },

  /** Calls back on any change to stored study data, planner included. */
  subscribe(listener: () => void): () => void {
    return StorageService.addMutationListener(listener);
  },
};
