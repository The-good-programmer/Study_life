import type { FSRSRating, RetrievalCard } from '../types';

export interface SchedulingResult {
  updatedCard: RetrievalCard;
  nextIntervalDays: number;
  intervalLabel: string;
}

export class FSRSService {
  /**
   * Preview the intervals for all 4 ratings for UI buttons
   */
  public static previewIntervals(card: RetrievalCard): Record<FSRSRating, string> {
    return {
      again: '<15 min',
      hard: this.formatInterval(Math.max(1, Math.round(card.stability * 1.2))),
      good: this.formatInterval(Math.max(2, Math.round(card.stability * 2.5))),
      easy: this.formatInterval(Math.max(4, Math.round(card.stability * 3.8))),
    };
  }

  /**
   * Schedules next review based on the student's rating
   */
  public static schedule(card: RetrievalCard, rating: FSRSRating): SchedulingResult {
    let newStability = card.stability || 1;
    let newDifficulty = card.difficulty || 5;
    let reps = card.reps || 0;
    let lapses = card.lapses || 0;

    let intervalDays = 1;

    switch (rating) {
      case 'again':
        lapses += 1;
        reps = 0;
        newStability = Math.max(0.5, newStability * 0.4);
        newDifficulty = Math.min(10, newDifficulty + 1.2);
        intervalDays = 0.01; // ~15 minutes
        break;

      case 'hard':
        reps += 1;
        newStability = Math.max(1, newStability * 1.2);
        newDifficulty = Math.min(10, newDifficulty + 0.5);
        intervalDays = Math.round(newStability);
        break;

      case 'good':
        reps += 1;
        newStability = Math.max(2, (newStability === 1 ? 2.5 : newStability * 2.5));
        newDifficulty = Math.max(1, newDifficulty - 0.2);
        intervalDays = Math.round(newStability);
        break;

      case 'easy':
        reps += 1;
        newStability = Math.max(4, (newStability === 1 ? 4.0 : newStability * 3.8));
        newDifficulty = Math.max(1, newDifficulty - 0.8);
        intervalDays = Math.round(newStability * 1.2);
        break;
    }

    const now = new Date();
    const nextDate = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

    const updatedCard: RetrievalCard = {
      ...card,
      stability: Math.round(newStability * 10) / 10,
      difficulty: Math.round(newDifficulty * 10) / 10,
      reps,
      lapses,
      lastReviewDate: now.toISOString(),
      nextReviewDate: nextDate.toISOString(),
    };

    return {
      updatedCard,
      nextIntervalDays: intervalDays,
      intervalLabel: this.formatInterval(intervalDays),
    };
  }

  private static formatInterval(days: number): string {
    if (days < 0.1) return '15m';
    if (days < 1) return `${Math.round(days * 24)}h`;
    if (days === 1) return '1d';
    if (days < 30) return `${Math.round(days)}d`;
    return `${Math.round(days / 30)}mo`;
  }
}
