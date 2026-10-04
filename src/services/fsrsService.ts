import type { FSRSRating, RetrievalCard } from '../types';

export interface SchedulingResult {
  updatedCard: RetrievalCard;
  nextIntervalDays: number;
  intervalLabel: string;
  retrievability: number;
}

export interface DecayPoint {
  day: number;
  retrievability: number;
}

export class FSRSService {
  /**
   * FSRS Power-Law constants:
   * R(t, S) = (1 + FACTOR * (t / S))^DECAY
   * Standard parameters: FACTOR = 19/81 (~0.234567), DECAY = -0.5
   * Notice that when elapsed days t == S:
   * R(S, S) = (1 + 19/81)^(-0.5) = (100/81)^(-0.5) = 9/10 = 0.90 (90%)
   * Stability S is rigorously defined as the duration in days for retrievability to reach 90%.
   */
  public static readonly FACTOR = 19 / 81;
  public static readonly DECAY = -0.5;

  /**
   * Calculates the exact mathematical retrievability R(t, S) for a card right now.
   * Returns percentage: 0 - 100%
   */
  public static calculateRetrievability(card: RetrievalCard, now: Date = new Date()): number {
    const stability = card.stability && card.stability > 0 ? card.stability : 1;
    if (!card.lastReviewDate) {
      return 100;
    }
    const last = new Date(card.lastReviewDate);
    const elapsedDays = Math.max(0, (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

    // R = (1 + (FACTOR * t / S))^DECAY
    const r = Math.pow(1 + (this.FACTOR * elapsedDays) / stability, this.DECAY);
    return Math.round(Math.max(0, Math.min(1, r)) * 1000) / 10;
  }

  /**
   * Computes optimal interval given stability S and target retention rate (default 0.90)
   * Formula: I = (S / FACTOR) * (R_target^(1 / DECAY) - 1)
   */
  public static calculateInterval(stability: number, targetRetention: number = 0.90): number {
    const r = Math.max(0.70, Math.min(0.98, targetRetention));
    // Since DECAY = -0.5, 1 / DECAY = -2. R^(-2) = (1 / R)^2
    const exponent = 1 / this.DECAY;
    const interval = (stability / this.FACTOR) * (Math.pow(r, exponent) - 1);
    return Math.max(1, Math.round(interval));
  }

  /**
   * Preview the intervals for all 4 ratings for UI buttons based on target retention
   */
  public static previewIntervals(card: RetrievalCard, targetRetention: number = 0.90): Record<FSRSRating, string> {
    const stability = card.stability && card.stability > 0 ? card.stability : 1;
    const currentR = this.calculateRetrievability(card) / 100;

    const hardStability = Math.max(1, stability * 1.2);
    const goodStability = Math.max(
      2,
      stability === 1
        ? 2.5
        : stability * (1.8 + Math.max(0.2, (11 - (card.difficulty || 5)) * 0.15) * Math.max(0.2, 1 - currentR))
    );
    const easyStability = Math.max(goodStability * 1.25, stability * 3.8);

    return {
      again: '<15 min',
      hard: this.formatInterval(this.calculateInterval(hardStability, targetRetention)),
      good: this.formatInterval(this.calculateInterval(goodStability, targetRetention)),
      easy: this.formatInterval(this.calculateInterval(easyStability, targetRetention)),
    };
  }

  /**
   * Schedules next review based on the student's rating and target retention
   */
  public static schedule(card: RetrievalCard, rating: FSRSRating, targetRetention: number = 0.90): SchedulingResult {
    const currentStability = card.stability && card.stability > 0 ? card.stability : 1;
    const currentDifficulty = card.difficulty && card.difficulty > 0 ? card.difficulty : 5;
    let reps = card.reps || 0;
    let lapses = card.lapses || 0;
    const currentR = this.calculateRetrievability(card) / 100;

    let newStability = currentStability;
    let newDifficulty = currentDifficulty;
    let intervalDays = 1;

    switch (rating) {
      case 'again':
        lapses += 1;
        reps = 0;
        // Forgetting stability resets
        newStability = Math.max(
          0.5,
          Math.min(
            currentStability * 0.4,
            0.7 * Math.pow(currentDifficulty, -0.3) * (Math.pow(currentStability + 1, 0.2) - 1) * Math.exp(0.5 * (1 - currentR))
          )
        );
        newDifficulty = Math.min(10, currentDifficulty + 1.2);
        intervalDays = 0.01; // ~15 minutes
        break;

      case 'hard':
        reps += 1;
        newStability = Math.max(1, currentStability * 1.2);
        newDifficulty = Math.min(10, currentDifficulty + 0.5);
        intervalDays = this.calculateInterval(newStability, targetRetention);
        break;

      case 'good': {
        reps += 1;
        const recallBonus = 1 + Math.max(0.5, (11 - currentDifficulty) * 0.15) * Math.max(0.2, 1 - currentR);
        newStability = Math.max(2, currentStability === 1 ? 2.5 : currentStability * (1.8 + recallBonus));
        newDifficulty = Math.max(1, currentDifficulty - 0.2);
        intervalDays = this.calculateInterval(newStability, targetRetention);
        break;
      }

      case 'easy':
        reps += 1;
        newStability = Math.max(4, currentStability === 1 ? 4.0 : currentStability * 3.8 * 1.25);
        newDifficulty = Math.max(1, currentDifficulty - 0.8);
        intervalDays = this.calculateInterval(newStability, targetRetention);
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
      retrievability: 100,
    };

    return {
      updatedCard,
      nextIntervalDays: intervalDays,
      intervalLabel: this.formatInterval(intervalDays),
      retrievability: 100,
    };
  }

  public static formatInterval(days: number): string {
    if (days < 0.1) return '15m';
    if (days < 1) return `${Math.round(days * 24)}h`;
    if (days === 1) return '1d';
    if (days < 30) return `${Math.round(days)}d`;
    return `${Math.round(days / 30)}mo`;
  }

  /**
   * Generates mathematical points along the FSRS power-law forgetting curve R(t)
   */
  public static generateDecayCurve(stability: number, totalDays: number = 30): DecayPoint[] {
    const s = Math.max(0.5, stability);
    const points: DecayPoint[] = [];
    const step = Math.max(1, Math.round(totalDays / 20));

    for (let day = 0; day <= totalDays; day += step) {
      const r = Math.pow(1 + (this.FACTOR * day) / s, this.DECAY);
      points.push({
        day,
        retrievability: Math.round(Math.max(0, Math.min(1, r)) * 100),
      });
    }
    return points;
  }

  /**
   * Identifies whether a card meets the algorithmic definition of a "Leech"
   */
  public static isLeech(card: RetrievalCard): boolean {
    return (card.lapses >= 3) || ((card.difficulty >= 8.0) && (card.stability < 2.5) && (card.reps >= 3));
  }

  /**
   * Filters and sorts leeches from highest synaptic instability to lowest
   */
  public static findLeeches(cards: RetrievalCard[]): RetrievalCard[] {
    return cards
      .filter(c => this.isLeech(c))
      .sort((a, b) => (b.lapses * 2 + b.difficulty) - (a.lapses * 2 + a.difficulty));
  }

  /**
   * Cures a leech by applying mnemonic rewiring and resetting stability
   */
  public static rewireCard(card: RetrievalCard, mnemonicHint: string): RetrievalCard {
    return {
      ...card,
      hint: mnemonicHint,
      lapses: Math.max(0, card.lapses - 2),
      difficulty: Math.max(3, card.difficulty - 2.5),
      stability: Math.max(2.5, card.stability * 1.8),
      retrievability: 95,
    };
  }
}
