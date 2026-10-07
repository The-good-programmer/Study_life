import type { ConfidenceLevel, ExamQuadrant, ExamQuestionResult, ExamReport } from '../../types';

/** Pure scoring rules for the confidence-weighted Mock Exam. */

/** Best score a single question can earn (correct with high confidence). */
export const MAX_POINTS_PER_QUESTION = 20;

/** Calibration at or above this earns the "Calibrated Mind" badge. */
export const CALIBRATED_THRESHOLD = 80;

/**
 * Confidence-weighted points and metacognitive quadrant for one answer.
 * Being confidently wrong (a blindspot) costs the most; an honest "I don't know" costs nothing.
 */
export const scoreAnswer = (
  isCorrect: boolean,
  confidence: ConfidenceLevel,
): { quadrant: ExamQuadrant; points: number } => {
  if (isCorrect) {
    if (confidence === 'high') return { quadrant: 'mastery', points: MAX_POINTS_PER_QUESTION };
    if (confidence === 'medium') return { quadrant: 'mastery', points: 14 };
    return { quadrant: 'lucky-guess', points: 5 };
  }
  if (confidence === 'high') return { quadrant: 'blindspot', points: -15 };
  if (confidence === 'medium') return { quadrant: 'known-unknown', points: -5 };
  return { quadrant: 'known-unknown', points: 0 };
};

/** The probability of being right that each confidence level claims. */
const CONFIDENCE_PROBABILITY: Record<ConfidenceLevel, number> = {
  low: 0.33,
  medium: 0.66,
  high: 0.9,
};

/**
 * How well the student's confidence predicted being right, 0-100, from the Brier score
 * (mean squared gap between claimed probability and the actual 0/1 outcome).
 * Unlike counting "medium" as always calibrated, answering everything "medium" does not
 * score well unless accuracy is high, and being confidently wrong is punished hardest.
 */
export const calibrationPercent = (
  results: ReadonlyArray<Pick<ExamQuestionResult, 'confidence' | 'isCorrect'>>,
): number => {
  if (results.length === 0) return 0;
  const brier =
    results.reduce((sum, r) => {
      const gap = CONFIDENCE_PROBABILITY[r.confidence] - (r.isCorrect ? 1 : 0);
      return sum + gap * gap;
    }, 0) / results.length;
  return Math.round((1 - brier) * 100);
};

interface BuildExamReportInput {
  results: ExamQuestionResult[];
  deckTitle: string;
  timeSpentSeconds: number;
  now: Date;
}

/** Aggregates per-question results into the saved scorecard. */
export const buildExamReport = ({ results, deckTitle, timeSpentSeconds, now }: BuildExamReportInput): ExamReport => {
  const total = results.length;
  const correctCount = results.filter(r => r.isCorrect).length;
  const countQuadrant = (quadrant: ExamQuadrant) => results.filter(r => r.quadrant === quadrant).length;

  return {
    id: `exam-${now.getTime()}`,
    date: now.toISOString(),
    deckTitle,
    totalQuestions: total,
    correctCount,
    rawAccuracyPercent: total === 0 ? 0 : Math.round((correctCount / total) * 100),
    confidenceWeightedScore: results.reduce((sum, r) => sum + r.pointsEarned, 0),
    maxPossibleScore: total * MAX_POINTS_PER_QUESTION,
    calibrationPercent: calibrationPercent(results),
    blindspotCount: countQuadrant('blindspot'),
    luckyGuessCount: countQuadrant('lucky-guess'),
    knownUnknownCount: countQuadrant('known-unknown'),
    masteryCount: countQuadrant('mastery'),
    timeSpentSeconds,
    questionResults: results,
  };
};
