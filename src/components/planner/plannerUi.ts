import { BookOpen, ClipboardCheck, GraduationCap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PlannerItem, PlannerItemKind, SubjectFolder } from '../../types';
import { parseDayKey, type ExamPlan } from '../../services/plannerService';

/** Shared planner display helpers (kept out of the components so Fast Refresh works). */

export const KIND_STYLES: Record<PlannerItemKind, { icon: LucideIcon; dot: string; tile: string }> = {
  exam: { icon: GraduationCap, dot: 'bg-danger', tile: 'bg-danger-soft text-danger' },
  homework: { icon: ClipboardCheck, dot: 'bg-brand', tile: 'bg-brand-soft text-brand-text' },
  other: { icon: BookOpen, dot: 'bg-ink-subtle', tile: 'bg-surface-hover text-ink-muted' },
};

export const INPUT_CLASS =
  'h-10 w-full rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none';

/** "Thu 5 Nov" (with the year when it isn't this year). */
export const formatDay = (key: string, now: Date = new Date()): string => {
  const date = parseDayKey(key);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
};

/** "Thu 5 Nov, 09:00" or just the day. */
export const formatWhen = (item: PlannerItem, now?: Date): string => (item.time ? `${formatDay(item.date, now)}, ${item.time}` : formatDay(item.date, now));

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What one exam needs today, in a sentence. */
export function todayLine(plan: ExamPlan, subject?: SubjectFolder): string {
  if (plan.coveredBy) return `Same decks as ${plan.coveredBy.title}, so that plan covers today's work.`;
  switch (plan.phase) {
    case 'no-decks':
      return subject ? `Put decks in ${subject.name} to get a daily plan.` : 'Pick its subject to get a daily plan.';
    case 'exam-day':
      return plan.dueCards > 0 ? `Today. A last look at ${plural(plan.dueCards, 'due card')}, then good luck.` : 'Today. Good luck.';
    case 'review':
      if (plan.newCards > 0) return `${plural(plan.newCards, 'card')} not learned yet, and ${plural(plan.dueCards, 'review')}. Do what you can today.`;
      return plan.dueCards > 0 ? `Review only: ${plural(plan.dueCards, 'due card')}.` : 'Review only. Nothing due right now.';
    case 'learn':
      return `Learn ${plural(plan.newToday, 'new card')} today${plan.dueCards > 0 ? ` and review ${plan.dueCards}` : ''}.`;
  }
}
