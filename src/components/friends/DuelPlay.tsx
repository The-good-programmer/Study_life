import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Timer } from 'lucide-react';
import { DUEL_SECONDS_PER_QUESTION, type DuelQuestion } from '../../services/duelService';
import { cn } from '../../utils/cn';

/**
 * Answering a duel: one question at a time, 20 seconds each, no feedback until the end (both
 * players get the same). Calls onFinish with each answer (null when time ran out) and the time taken.
 */
export const DuelPlay: React.FC<{
  questions: DuelQuestion[];
  onFinish: (answers: (number | null)[], ms: number) => void;
}> = ({ questions, onFinish }) => {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [left, setLeft] = useState(DUEL_SECONDS_PER_QUESTION);
  const [picked, setPicked] = useState<number | null>(null);
  const started = useRef(0);
  const finished = useRef(false);

  useEffect(() => {
    started.current = performance.now();
  }, []);

  const answer = useCallback(
    (choice: number | null) => {
      if (finished.current || picked !== null) return;
      setPicked(choice ?? -1);
      // A short pause shows the pick before the next question.
      setTimeout(() => {
        const next = [...answers, choice];
        if (next.length >= questions.length) {
          finished.current = true;
          onFinish(next, Math.round(performance.now() - started.current));
          return;
        }
        setAnswers(next);
        setIndex(next.length);
        setLeft(DUEL_SECONDS_PER_QUESTION);
        setPicked(null);
      }, 350);
    },
    [answers, picked, questions.length, onFinish],
  );

  // The clock: at 0 the question counts as unanswered.
  useEffect(() => {
    if (picked !== null) return;
    if (left <= 0) {
      answer(null);
      return;
    }
    const timer = setTimeout(() => setLeft(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [left, picked, answer]);

  // 1–4 pick a choice.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 4) {
        e.preventDefault();
        answer(n - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer]);

  const question = questions[index];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-[13px] text-ink-muted">
        <span className="tabular-nums">
          Question {index + 1} of {questions.length}
        </span>
        <span className={cn('inline-flex items-center gap-1 tabular-nums', left <= 5 && 'text-danger')} aria-live="off">
          <Timer className="h-3.5 w-3.5" aria-hidden="true" />
          {left}s
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface-hover" aria-hidden="true">
        <div className="h-full bg-brand transition-[width] duration-1000 ease-linear" style={{ width: `${(left / DUEL_SECONDS_PER_QUESTION) * 100}%` }} />
      </div>
      <p className="min-h-[3.5rem] text-[18px] font-semibold leading-snug text-ink">{question.question}</p>
      <div className="grid gap-2">
        {question.options.map((option, i) => (
          <button
            key={`${index}-${i}`}
            type="button"
            onClick={() => answer(i)}
            disabled={picked !== null}
            className={cn(
              'flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-[14px] transition-colors cursor-pointer disabled:cursor-default',
              picked === i ? 'border-brand bg-brand-soft text-ink' : 'border-line-strong bg-canvas text-ink hover:border-brand/60',
            )}
          >
            <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-line-strong text-[11px] font-semibold text-ink-subtle">{i + 1}</span>
            <span className="min-w-0 break-words">{option}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
