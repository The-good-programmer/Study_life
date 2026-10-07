import { describe, it, expect } from 'vitest';
import type { ConfidenceLevel, ExamQuestionResult, RetrievalCard } from '../../types';
import {
  CALIBRATED_THRESHOLD,
  buildExamReport,
  calibrationPercent,
  scoreAnswer,
} from './examScoring';

const card = { id: 'c', conceptId: 'k', question: 'q', answer: 'a', stability: 0, difficulty: 5, reps: 0, lapses: 0 } as RetrievalCard;

const result = (isCorrect: boolean, confidence: ConfidenceLevel): ExamQuestionResult => {
  const { quadrant, points } = scoreAnswer(isCorrect, confidence);
  return { card, conceptTitle: 'Concept', deckTitle: 'Deck', userAnswer: 'x', isCorrect, confidence, pointsEarned: points, quadrant };
};

/** n results, `rightCount` of which are correct, all at one confidence level. */
const batch = (confidence: ConfidenceLevel, n: number, rightCount: number) =>
  Array.from({ length: n }, (_, i) => result(i < rightCount, confidence));

describe('scoreAnswer', () => {
  it.each([
    [true, 'high', 'mastery', 20],
    [true, 'medium', 'mastery', 14],
    [true, 'low', 'lucky-guess', 5],
    [false, 'high', 'blindspot', -15],
    [false, 'medium', 'known-unknown', -5],
    [false, 'low', 'known-unknown', 0],
  ] as const)('correct=%s confidence=%s -> %s, %i points', (isCorrect, confidence, quadrant, points) => {
    expect(scoreAnswer(isCorrect, confidence)).toEqual({ quadrant, points });
  });

  it('punishes confident errors harder than honest uncertainty', () => {
    expect(scoreAnswer(false, 'high').points).toBeLessThan(scoreAnswer(false, 'low').points);
  });
});

describe('calibrationPercent', () => {
  it('is 0 for no answers', () => {
    expect(calibrationPercent([])).toBe(0);
  });

  it('rewards confident-and-right and unsure-and-wrong', () => {
    expect(calibrationPercent(batch('high', 10, 10))).toBe(99);
    expect(calibrationPercent(batch('low', 10, 0))).toBe(89);
  });

  it('punishes confident-and-wrong the most', () => {
    expect(calibrationPercent(batch('high', 10, 0))).toBeLessThan(20);
  });

  it('no longer lets "medium" on everything pass as calibrated (the old exploit)', () => {
    // The old formula counted every medium answer as calibrated: 100% regardless of accuracy.
    expect(calibrationPercent(batch('medium', 10, 5))).toBeLessThan(CALIBRATED_THRESHOLD);
    expect(calibrationPercent(batch('medium', 10, 0))).toBeLessThan(CALIBRATED_THRESHOLD);
  });

  it('still credits steady medium confidence when accuracy is genuinely high', () => {
    expect(calibrationPercent(batch('medium', 10, 10))).toBeGreaterThanOrEqual(CALIBRATED_THRESHOLD);
  });

  it('scores a mixed, well-calibrated student above the badge threshold', () => {
    const results = [...batch('high', 8, 8), ...batch('low', 4, 1), ...batch('medium', 4, 3)];
    expect(calibrationPercent(results)).toBeGreaterThanOrEqual(CALIBRATED_THRESHOLD);
  });

  it('ranks overconfidence below equally accurate honest uncertainty', () => {
    const overconfident = batch('high', 10, 5);
    const honest = [...batch('high', 5, 5), ...batch('low', 5, 0)];
    expect(calibrationPercent(honest)).toBeGreaterThan(calibrationPercent(overconfident));
  });
});

describe('buildExamReport', () => {
  const now = new Date('2026-03-04T10:00:00.000Z');

  it('aggregates counts, accuracy, score and quadrants', () => {
    const results = [
      result(true, 'high'), // mastery 20
      result(true, 'low'), // lucky guess 5
      result(false, 'high'), // blindspot -15
      result(false, 'low'), // known unknown 0
    ];
    const report = buildExamReport({ results, deckTitle: 'Biology', timeSpentSeconds: 95, now });
    expect(report).toMatchObject({
      id: `exam-${now.getTime()}`,
      date: now.toISOString(),
      deckTitle: 'Biology',
      totalQuestions: 4,
      correctCount: 2,
      rawAccuracyPercent: 50,
      confidenceWeightedScore: 10,
      maxPossibleScore: 80,
      masteryCount: 1,
      luckyGuessCount: 1,
      blindspotCount: 1,
      knownUnknownCount: 1,
      timeSpentSeconds: 95,
    });
    expect(report.calibrationPercent).toBe(calibrationPercent(results));
    expect(report.questionResults).toBe(results);
  });

  it('can total a negative weighted score', () => {
    const report = buildExamReport({ results: batch('high', 3, 0), deckTitle: 'D', timeSpentSeconds: 0, now });
    expect(report.confidenceWeightedScore).toBe(-45);
    expect(report.rawAccuracyPercent).toBe(0);
  });

  it('does not divide by zero for an empty exam', () => {
    const report = buildExamReport({ results: [], deckTitle: 'D', timeSpentSeconds: 0, now });
    expect(report.rawAccuracyPercent).toBe(0);
    expect(report.maxPossibleScore).toBe(0);
    expect(report.calibrationPercent).toBe(0);
  });
});
