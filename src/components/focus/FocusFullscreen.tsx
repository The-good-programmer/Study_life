import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Minimize2 } from 'lucide-react';
import type { FocusTask } from '../../types';
import { formatClock, progressAt, remainingAt, type TimerState } from '../../services/focusTimer';
import { PHASE_LABELS } from '../../hooks/useFocusTimer';
import { cn } from '../../utils/cn';
import { IconButton, ProgressRing } from '../ui/primitives';
import { FocusControls } from './FocusControls';
import { BREAK_TIPS } from './focusUi';

/** Controls fade out after this long without the mouse moving, while the timer runs. */
const IDLE_MS = 3000;

const subscribeResize = (onChange: () => void) => {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
};
/** The ring's size: as big as fits comfortably on screen. */
const useRingSize = () =>
  useSyncExternalStore(
    subscribeResize,
    () => Math.round(Math.max(220, Math.min(window.innerWidth * 0.78, window.innerHeight * 0.56, 520))),
    () => 360,
  );

interface FocusFullscreenProps {
  timer: TimerState;
  tasks: FocusTask[];
  now: number;
  onClose: () => void;
}

/** Just the clock, the task and the controls, filling the screen. Esc or F closes it. */
export const FocusFullscreen: React.FC<FocusFullscreenProps> = ({ timer, tasks, now, onClose }) => {
  const size = useRingSize();
  const [idle, setIdle] = useState(false);
  const isBreak = timer.phase !== 'focus';
  const running = timer.status === 'running';
  const task = tasks.find(t => t.id === timer.taskId && !t.done);
  const remaining = remainingAt(timer, now);

  // Ask for real full screen too; leaving it (Esc, or the browser's own button) closes this view.
  useEffect(() => {
    const root = document.documentElement;
    let entered = false;
    if (!document.fullscreenElement && root.requestFullscreen) {
      root
        .requestFullscreen()
        .then(() => {
          entered = true;
        })
        .catch(() => {});
    }
    const onChange = () => {
      if (entered && !document.fullscreenElement) onClose();
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [onClose]);

  // Esc closes (when the browser didn't go full screen, Esc reaches the page).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Hide the controls and the pointer when the mouse rests.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), IDLE_MS);
    };
    wake();
    window.addEventListener('pointermove', wake);
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
  }, []);

  const hidden = idle && running;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Focus timer, full screen"
      className={cn('fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8 bg-canvas px-6 animate-fadeIn', hidden && 'cursor-none')}
    >
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 transition-[background] duration-700',
          isBreak
            ? 'bg-[radial-gradient(ellipse_at_50%_35%,var(--success-soft),transparent_65%)]'
            : 'bg-[radial-gradient(ellipse_at_50%_35%,var(--brand-soft),transparent_65%)]',
        )}
      />

      <IconButton
        icon={Minimize2}
        label="Leave full screen (Esc)"
        onClick={onClose}
        className={cn('absolute right-4 top-4 transition-opacity duration-500 sm:right-6 sm:top-6', hidden && 'opacity-0')}
      />

      <div className="relative">
        <ProgressRing value={progressAt(timer, now) * 100} size={size} stroke={Math.max(10, Math.round(size / 28))} tone={isBreak ? 'success' : 'brand'}>
          <span role="timer" aria-label={`${formatClock(remaining)} left`} className="font-semibold leading-none tracking-tight text-ink tabular-nums" style={{ fontSize: Math.round(size * 0.27) }}>
            {formatClock(remaining)}
          </span>
          <span className={cn('mt-3 text-base font-medium sm:text-lg', isBreak ? 'text-success' : 'text-brand-text')}>
            {timer.status === 'paused' ? `${PHASE_LABELS[timer.phase]} · paused` : PHASE_LABELS[timer.phase]}
          </span>
        </ProgressRing>
      </div>

      <p className="relative max-w-xl text-center text-lg text-ink-muted">
        {isBreak ? BREAK_TIPS[timer.phase as keyof typeof BREAK_TIPS] : task ? task.title : ' '}
      </p>

      <div className={cn('relative transition-opacity duration-500', hidden && 'pointer-events-none opacity-0')}>
        <FocusControls timer={timer} now={now} size="lg" />
      </div>
    </div>
  );
};
