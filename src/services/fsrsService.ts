import {
  fsrs,
  generatorParameters,
  Rating,
  State,
  createEmptyCard,
  forgetting_curve,
  type Card as FSRSCard,
  type Grade,
  type RecordLogItem,
} from 'ts-fsrs';
import type { FSRSRating, RetrievalCard, ConceptPedagogicalState, AdaptivePedagogyMode } from '../types';

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
  public static readonly DECAY = 0.5;

  private static getScheduler(targetRetention: number = 0.90) {
    const clampedRetention = Math.max(0.70, Math.min(0.97, targetRetention));
    return fsrs(
      generatorParameters({
        request_retention: clampedRetention,
        enable_fuzz: false,
      })
    );
  }

  private static toFSRSCard(card: RetrievalCard, now: Date = new Date()): FSRSCard {
    const base = createEmptyCard(now);
    const lastReview = card.lastReviewDate ? new Date(card.lastReviewDate) : undefined;
    const due = card.nextReviewDate ? new Date(card.nextReviewDate) : now;
    const reps = card.reps || 0;
    const lapses = card.lapses || 0;
    const stability = card.stability && card.stability > 0 ? card.stability : 1;
    const difficulty = card.difficulty && card.difficulty > 0 ? card.difficulty : 5;

    let elapsedDays = 0;
    if (lastReview) {
      elapsedDays = Math.max(0, (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      ...base,
      due,
      stability: reps > 0 ? stability : 0,
      difficulty: reps > 0 ? difficulty : 0,
      elapsed_days: elapsedDays,
      scheduled_days: reps > 0 ? Math.max(1, Math.round(stability)) : 0,
      reps,
      lapses,
      state: reps > 0 ? State.Review : State.New,
      last_review: lastReview,
    };
  }

  private static ratingToFSRS(rating: FSRSRating): Grade {
    switch (rating) {
      case 'again':
        return Rating.Again;
      case 'hard':
        return Rating.Hard;
      case 'good':
        return Rating.Good;
      case 'easy':
        return Rating.Easy;
    }
  }

  /**
   * Calculates the mathematical retrievability R(t, S) using official FSRS power-law formula.
   * Returns percentage: 0 - 100%
   */
  public static calculateRetrievability(card: RetrievalCard, now: Date = new Date()): number {
    const stability = card.stability && card.stability > 0 ? card.stability : 1;
    if (!card.lastReviewDate) {
      return 100;
    }
    const last = new Date(card.lastReviewDate);
    const elapsedDays = Math.max(0, (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

    try {
      const r = forgetting_curve(this.DECAY, elapsedDays, stability);
      return Math.round(Math.max(0, Math.min(1, r)) * 1000) / 10;
    } catch {
      return 90;
    }
  }

  /**
   * Computes optimal interval given stability S and target retention rate
   */
  public static calculateInterval(stability: number, targetRetention: number = 0.90): number {
    const s = Math.max(0.5, stability);
    const r = Math.max(0.70, Math.min(0.97, targetRetention));
    const factor = Math.exp((-1 / this.DECAY) * Math.log(0.9)) - 1;
    const interval = (s / factor) * (Math.pow(r, -1 / this.DECAY) - 1);
    return Math.max(1, Math.round(interval));
  }

  /**
   * Previews intervals for all 4 ratings using ts-fsrs scheduling engine
   */
  public static previewIntervals(card: RetrievalCard, targetRetention: number = 0.90): Record<FSRSRating, string> {
    const now = new Date();
    const scheduler = this.getScheduler(targetRetention);
    const fsrsCard = this.toFSRSCard(card, now);
    const results = scheduler.repeat(fsrsCard, now);

    const getDays = (item: RecordLogItem): number => {
      const ms = item.card.due.getTime() - now.getTime();
      return Math.max(0.01, ms / (1000 * 60 * 60 * 24));
    };

    return {
      again: this.formatInterval(getDays(results[Rating.Again])),
      hard: this.formatInterval(getDays(results[Rating.Hard])),
      good: this.formatInterval(getDays(results[Rating.Good])),
      easy: this.formatInterval(getDays(results[Rating.Easy])),
    };
  }

  /**
   * Schedules next review using ts-fsrs
   */
  public static schedule(card: RetrievalCard, rating: FSRSRating, targetRetention: number = 0.90): SchedulingResult {
    const now = new Date();
    const scheduler = this.getScheduler(targetRetention);
    const fsrsCard = this.toFSRSCard(card, now);
    const fsrsRating = this.ratingToFSRS(rating);
    const results = scheduler.repeat(fsrsCard, now);
    const scheduled = results[fsrsRating];

    const nextDue = scheduled.card.due;
    const intervalDays = Math.max(0.01, (nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const updatedCard: RetrievalCard = {
      ...card,
      stability: Math.round(scheduled.card.stability * 10) / 10,
      difficulty: Math.round(scheduled.card.difficulty * 10) / 10,
      reps: scheduled.card.reps,
      lapses: scheduled.card.lapses,
      lastReviewDate: now.toISOString(),
      nextReviewDate: nextDue.toISOString(),
      retrievability: 100,
    };

    return {
      updatedCard,
      nextIntervalDays: Math.round(intervalDays * 100) / 100,
      intervalLabel: this.formatInterval(intervalDays),
      retrievability: 100,
    };
  }

  public static formatInterval(days: number): string {
    if (days < 0.05) return '15m';
    if (days < 1) return `${Math.max(1, Math.round(days * 24))}h`;
    if (days < 1.5) return '1d';
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
      try {
        const r = forgetting_curve(this.DECAY, day, s);
        points.push({
          day,
          retrievability: Math.round(Math.max(0, Math.min(1, r)) * 100),
        });
      } catch {
        points.push({ day, retrievability: 90 });
      }
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
   * Filters and sorts leeches from highest lapse rate to lowest
   */
  public static findLeeches(cards: RetrievalCard[]): RetrievalCard[] {
    return cards
      .filter(c => this.isLeech(c))
      .sort((a, b) => (b.lapses * 2 + b.difficulty) - (a.lapses * 2 + a.difficulty));
  }

  /**
   * Helps a student rewire a leech by attaching a mnemonic hint and scheduling an immediate review
   */
  public static rewireCard(card: RetrievalCard, mnemonicHint: string): RetrievalCard {
    const now = new Date();
    return {
      ...card,
      hint: mnemonicHint,
      lapses: Math.max(0, card.lapses - 1),
      difficulty: Math.max(3, (card.difficulty || 5) - 1.0),
      stability: Math.max(1.0, card.stability || 1.0),
      nextReviewDate: now.toISOString(),
      retrievability: 100,
    };
  }

  /**
   * Dynamically calculates the pedagogical learning state and strictness mode for a concept
   * based on mathematical FSRS retrievability R(t), stability, and lapse count.
   */
  public static getConceptPedagogicalState(cards: RetrievalCard[] = [], now: Date = new Date()): ConceptPedagogicalState {
    if (!cards || cards.length === 0) {
      return {
        retrievability: 85,
        averageStabilityDays: 1,
        totalCards: 0,
        lapseCount: 0,
        mode: 'dialectic',
        guidanceDirective: 'Standard Socratic examination: Probe cause-and-effect mechanisms and examine candidate intuition.',
      };
    }

    let sumRetrievability = 0;
    let sumStability = 0;
    let totalLapses = 0;
    let hasLeech = false;

    cards.forEach(c => {
      const r = this.calculateRetrievability(c, now);
      sumRetrievability += r;
      sumStability += (c.stability && c.stability > 0 ? c.stability : 1);
      totalLapses += (c.lapses || 0);
      if (this.isLeech(c)) hasLeech = true;
    });

    const count = cards.length;
    const avgR = Math.round((sumRetrievability / count) * 10) / 10;
    const avgStability = Math.round((sumStability / count) * 10) / 10;

    let mode: AdaptivePedagogyMode = 'dialectic';
    let guidanceDirective = '';

    if (avgR < 70 || totalLapses >= 2 || hasLeech) {
      mode = 'scaffolding';
      guidanceDirective = `Socratic Scaffolding Mode: The student demonstrates fragile memory retention (R: ${Math.round(avgR)}%, ${totalLapses} lapses${hasLeech ? ', includes leech cards' : ''}). Act as an encouraging diagnostic mentor. Deconstruct complex mechanisms into accessible sub-steps. Provide analogical scaffolding and check foundational definitions before demanding high-level synthesis.`;
    } else if (avgR >= 90 && avgStability >= 14 && totalLapses === 0) {
      mode = 'adversarial';
      guidanceDirective = `Adversarial Inoculation Mode: The candidate possesses high retention and stability (R: ${Math.round(avgR)}%, stability: ${avgStability}d). Act as a rigorous Oxford/MIT peer reviewer. Inoculate them against overconfidence by challenging boundary conditions, presenting counter-intuitive edge cases, and asking why counter-hypotheses fail.`;
    } else {
      mode = 'dialectic';
      guidanceDirective = `Dialectic Inquest Mode: Standard balanced Socratic examination (R: ${Math.round(avgR)}%). Challenge their causal mechanism, verify the absence of ungrounded jargon crutches, and demand precise cause-and-effect reasoning.`;
    }

    return {
      retrievability: avgR,
      averageStabilityDays: avgStability,
      totalCards: count,
      lapseCount: totalLapses,
      mode,
      guidanceDirective,
    };
  }
}
