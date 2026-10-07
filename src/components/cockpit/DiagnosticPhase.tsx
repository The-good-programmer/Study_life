import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, SkipForward, Target, X } from 'lucide-react';
import type { DiagnosticProbe, DiagnosticReport, StudySession } from '../../types';
import { soundEngine } from '../../services/soundEngine';
import { grantReward } from '../../services/economy/rewardService';
import { shouldIgnoreShortcut } from '../../utils/keyboard';
import { cn } from '../../utils/cn';
import { MathRenderer } from '../common/MathRenderer';
import { Button, ProgressBar } from '../ui/primitives';
import { isOptionCorrect } from './retrievalLogic';
import { buildWarmupProbes } from './warmupProbes';

interface DiagnosticPhaseProps {
  session: StudySession;
  onComplete: (report: DiagnosticReport) => void;
  onSkip: () => void;
}

type Answer = { userAnswer: string; isCorrect: boolean };

/** Step 1 of the guided session: a quick guess at each concept before studying it. */
export const DiagnosticPhase: React.FC<DiagnosticPhaseProps> = ({ session, onComplete, onSkip }) => {
  const [probes] = useState<DiagnosticProbe[]>(() => buildWarmupProbes(session));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const finishedRef = useRef(false);
  const skippedRef = useRef(false);

  const currentProbe = probes[currentIndex];
  const currentAnswer = answers[currentIndex];
  const isAnswered = !!currentAnswer;
  const correctCount = Object.values(answers).filter(a => a.isCorrect).length;

  // A deck with nothing to ask goes straight to the overview.
  useEffect(() => {
    if (probes.length === 0 && !skippedRef.current) {
      skippedRef.current = true;
      onSkip();
    }
  }, [probes.length, onSkip]);

  const handleSelectOption = useCallback(
    (option: string) => {
      if (isAnswered || !currentProbe) return;
      const isCorrect = isOptionCorrect(option, currentProbe.correctAnswer);
      if (isCorrect) soundEngine.playCorrectChime();
      else soundEngine.playIncorrectChime();
      setAnswers(prev => ({ ...prev, [currentIndex]: { userAnswer: option, isCorrect } }));
    },
    [isAnswered, currentProbe, currentIndex],
  );

  // After answering, the options are disabled; put focus on Next so Enter continues.
  useEffect(() => {
    if (isAnswered) nextButtonRef.current?.focus();
  }, [isAnswered, currentIndex]);

  const handleNext = useCallback(() => {
    if (!isAnswered) return;
    if (currentIndex + 1 < probes.length) {
      setCurrentIndex(i => i + 1);
      return;
    }
    if (finishedRef.current) return;
    finishedRef.current = true;
    const grant = grantReward({ kind: 'diagnostic' }, { label: 'Warm-up' });
    setEarnedXp(grant.xp);
    soundEngine.playSuccess();
    setIsFinished(true);
  }, [isAnswered, currentIndex, probes.length]);

  const handleFinish = useCallback(() => {
    const report: DiagnosticReport = {
      probes: probes.map((probe, idx) => ({
        ...probe,
        userAnswer: answers[idx]?.userAnswer,
        isCorrect: answers[idx]?.isCorrect || false,
      })),
      score: probes.length ? Math.round((correctCount / probes.length) * 100) : 0,
      completedAt: new Date().toISOString(),
    };
    onComplete(report);
  }, [probes, answers, correctCount, onComplete]);

  // 1-4 pick an answer; Enter continues (a focused button handles its own Enter).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreShortcut(e)) return;
      if (isFinished) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleFinish();
        }
        return;
      }
      if (!currentProbe) return;
      if (!isAnswered) {
        const digit = parseInt(e.key, 10);
        if (digit >= 1 && digit <= currentProbe.options.length) {
          e.preventDefault();
          handleSelectOption(currentProbe.options[digit - 1]);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFinished, isAnswered, currentProbe, handleSelectOption, handleNext, handleFinish]);

  if (probes.length === 0) return null;

  if (isFinished) {
    return (
      <div className="mx-auto max-w-2xl animate-fadeIn text-center">
        <p className="text-xs font-medium text-brand-text">Warm-up done</p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">
          {correctCount} of {probes.length} right
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-ink-muted">
          Guessing first helps you learn the rest faster. The ones you missed get extra attention next.
        </p>

        <ul className="mt-6 space-y-2 text-left">
          {probes.map((probe, idx) => {
            const isCorrect = answers[idx]?.isCorrect;
            return (
              <li key={probe.conceptId} className="flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
                <span
                  className={cn(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                    isCorrect ? 'bg-success-soft text-success' : 'bg-due-soft text-due',
                  )}
                >
                  {isCorrect ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Target className="h-3.5 w-3.5" aria-hidden="true" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{probe.conceptTitle}</p>
                  <p className="text-xs text-ink-subtle">{isCorrect ? 'You knew this one.' : 'Focus on this one in the overview.'}</p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 flex flex-col items-center gap-2">
          <Button variant="primary" size="lg" trailingIcon={ArrowRight} onClick={handleFinish} data-autofocus>
            Next: the overview
          </Button>
          {earnedXp > 0 && <p className="text-xs tabular-nums text-ink-subtle">Earned {earnedXp} XP</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl animate-fadeIn">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tabular-nums text-brand-text">
            Warm-up · Question {currentIndex + 1} of {probes.length}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-subtle">
            Guess before you study. Wrong answers are fine: they prime you to notice the right one.
          </p>
        </div>
        <Button size="sm" variant="ghost" trailingIcon={SkipForward} onClick={onSkip} className="-mr-2 shrink-0">
          Skip warm-up
        </Button>
      </div>
      <ProgressBar value={((currentIndex + (isAnswered ? 1 : 0)) / probes.length) * 100} className="mt-4" label="Warm-up progress" />

      <section className="mt-5 rounded-3xl border border-line-strong bg-surface p-6 sm:p-8">
        <p className="text-xs font-medium text-ink-subtle">{currentProbe.conceptTitle}</p>
        <h3 className="mt-2 text-lg font-medium leading-relaxed text-ink sm:text-xl">
          <MathRenderer text={currentProbe.question} />
        </h3>

        <div className="mt-6 space-y-2" role="group" aria-label="Answers">
          {currentProbe.options.map((option, idx) => {
            const isSelected = currentAnswer?.userAnswer === option;
            const isRight = isAnswered && isOptionCorrect(option, currentProbe.correctAnswer);
            const isWrongPick = isAnswered && isSelected && !isRight;
            return (
              <button
                key={`${idx}-${option}`}
                type="button"
                disabled={isAnswered}
                onClick={() => handleSelectOption(option)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[15px] transition-colors cursor-pointer disabled:cursor-default',
                  !isAnswered && 'border-line-strong text-ink hover:border-brand/60 hover:bg-surface-hover',
                  isRight && 'border-success bg-success-soft text-ink',
                  isWrongPick && 'border-danger bg-danger-soft text-ink',
                  isAnswered && !isRight && !isWrongPick && 'border-line text-ink-subtle opacity-60',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums',
                    isRight ? 'bg-success text-success-ink' : isWrongPick ? 'bg-danger text-danger-ink' : 'bg-surface-hover text-ink-muted',
                  )}
                  aria-hidden="true"
                >
                  {isRight ? <Check className="h-3.5 w-3.5" /> : isWrongPick ? <X className="h-3.5 w-3.5" /> : idx + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <MathRenderer text={option} />
                </span>
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 animate-fadeIn sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-ink-muted" role="status">
              {currentAnswer.isCorrect ? 'Right. You already know some of this.' : 'Not quite. Look out for this one in the overview.'}
            </p>
            <Button ref={nextButtonRef} variant="primary" trailingIcon={ArrowRight} onClick={handleNext}>
              {currentIndex + 1 < probes.length ? 'Next question' : 'See results'}
            </Button>
          </div>
        )}
      </section>

      <p className="mt-3 hidden text-center text-xs text-ink-subtle sm:block">
        Press 1 to {currentProbe.options.length} to answer, then Enter to continue.
      </p>
    </div>
  );
};
