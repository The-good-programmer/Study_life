import React from 'react';
import { Pause, Timer } from 'lucide-react';
import { formatClock, remainingAt } from '../../services/focusTimer';
import { PHASE_LABELS, useFocusState } from '../../hooks/useFocusTimer';
import { cn } from '../../utils/cn';

/** The time left, in the top bar, while a timer is going on another page. Opens Focus. */
export const FocusTimerPill: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { timer, now } = useFocusState();
  if (timer.status === 'idle') return null;
  const isBreak = timer.phase !== 'focus';
  const clock = formatClock(remainingAt(timer, now));
  const paused = timer.status === 'paused';
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Open Focus"
      aria-label={`${PHASE_LABELS[timer.phase]}, ${clock} left${paused ? ', paused' : ''}. Open Focus`}
      className={cn(
        'flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-semibold tabular-nums transition-colors cursor-pointer max-[379px]:px-2',
        isBreak
          ? 'border-success/30 bg-success-soft text-success hover:border-success/50'
          : 'border-brand/30 bg-brand-soft text-brand-text hover:border-brand/50',
      )}
    >
      {/* The icon goes on the narrowest phones, where the top bar is full. */}
      {paused ? (
        <Pause className="h-3.5 w-3.5 max-[379px]:hidden" aria-hidden="true" />
      ) : (
        <Timer className="h-3.5 w-3.5 max-[379px]:hidden" aria-hidden="true" />
      )}
      {clock}
    </button>
  );
};
