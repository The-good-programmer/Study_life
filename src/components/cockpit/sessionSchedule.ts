import type { RetrievalCard } from '../../types';

export interface ReviewGroup {
  /** Whole days from today (0 = later today). */
  days: number;
  label: string;
  count: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const labelFor = (days: number): string => {
  if (days <= 0) return 'Later today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `In ${days} days`;
  if (days < 14) return 'In about a week';
  if (days < 30) return `In about ${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30);
  return months <= 1 ? 'In about a month' : `In about ${months} months`;
};

/**
 * Groups cards by when spaced repetition will bring them back, in calendar days
 * from `now`. Cards without a scheduled review are left out.
 */
export const groupNextReviews = (cards: RetrievalCard[], now: Date = new Date()): ReviewGroup[] => {
  const today = startOfDay(now);
  const byLabel = new Map<string, ReviewGroup>();

  for (const card of cards) {
    if (!card.nextReviewDate) continue;
    const due = new Date(card.nextReviewDate);
    if (Number.isNaN(due.getTime())) continue;
    const days = Math.max(0, Math.round((startOfDay(due) - today) / DAY_MS));
    const label = labelFor(days);
    const group = byLabel.get(label);
    if (group) {
      group.count += 1;
      group.days = Math.min(group.days, days);
    } else {
      byLabel.set(label, { days, label, count: 1 });
    }
  }

  return [...byLabel.values()].sort((a, b) => a.days - b.days);
};
