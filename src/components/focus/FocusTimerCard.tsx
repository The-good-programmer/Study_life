import React, { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, Settings2, SkipForward } from 'lucide-react';
import type { FocusTask } from '../../types';
import { FocusService } from '../../services/focusService';
import { PHASES, formatClock, progressAt, remainingAt, type FocusSettings, type TimerState } from '../../services/focusTimer';
import { soundEngine } from '../../services/soundEngine';
import { PHASE_LABELS } from '../../hooks/useFocusTimer';
import { cn } from '../../utils/cn';
import { Button, Card, IconButton, Kbd, ProgressRing } from '../ui/primitives';
import { FocusSettingsPanel } from './FocusSettingsPanel';

const BREAK_TIPS = {
  'short-break': 'Stand up, stretch, and look at something far away for a bit.',
  'long-break': 'Take a proper rest: walk around, drink some water, step away from screens.',
} as const;

interface FocusTimerCardProps {
  timer: TimerState;
  settings: FocusSettings;
  tasks: FocusTask[];
  now: number;
}

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable));
};

/** Starts or pauses the timer, from a click or a key press (which also lets the chime play later). */
const toggle = () => {
  soundEngine.unlock();
  FocusService.toggle();
};

export const FocusTimerCard: React.FC<FocusTimerCardProps> = ({ timer, settings, tasks, now }) => {
  const [showSettings, setShowSettings] = useState(false);
  const remaining = remainingAt(timer, now);
  const progress = progressAt(timer, now) * 100;
  const isBreak = timer.phase !== 'focus';
  const openTasks = tasks.filter(t => !t.done);
  const current = openTasks.find(t => t.id === timer.taskId);
  const untilLong = Math.max(0, settings.longBreakEvery - timer.completedInCycle);

  // Space starts and pauses, unless the student is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if ((e.target as HTMLElement | null)?.closest('button, a, [role="switch"]')) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const mainLabel = timer.status === 'running' ? 'Pause' : timer.status === 'paused' ? 'Resume' : 'Start';

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div role="group" aria-label="Timer phase" className="flex min-w-0 rounded-xl border border-line bg-canvas p-1">
          {PHASES.map(phase => (
            <button
              key={phase}
              type="button"
              onClick={() => FocusService.choosePhase(phase)}
              disabled={timer.status === 'running'}
              aria-pressed={timer.phase === phase}
              className={cn(
                'h-8 rounded-lg px-2.5 text-xs font-medium transition-colors sm:px-3 sm:text-[13px] cursor-pointer disabled:cursor-not-allowed',
                timer.phase === phase ? 'bg-surface-hover text-ink' : 'text-ink-subtle hover:text-ink-muted disabled:hover:text-ink-subtle',
              )}
            >
              {PHASE_LABELS[phase]}
            </button>
          ))}
        </div>
        <IconButton icon={Settings2} label="Timer settings" active={showSettings} onClick={() => setShowSettings(v => !v)} aria-expanded={showSettings} />
      </div>

      {showSettings && <FocusSettingsPanel settings={settings} />}

      <div className="flex flex-col items-center gap-4 py-2">
        <ProgressRing value={progress} size={232} stroke={12} tone={isBreak ? 'success' : 'brand'}>
          <span
            className="text-[56px] font-semibold leading-none tracking-tight text-ink tabular-nums"
            role="timer"
            aria-label={`${formatClock(remaining)} left`}
          >
            {formatClock(remaining)}
          </span>
          <span className={cn('mt-2 text-[13px] font-medium', isBreak ? 'text-success' : 'text-brand-text')}>
            {timer.status === 'paused' ? `${PHASE_LABELS[timer.phase]} · paused` : PHASE_LABELS[timer.phase]}
          </span>
        </ProgressRing>

        <div className="flex items-center gap-2">
          <IconButton icon={RotateCcw} label="Reset" onClick={() => FocusService.reset()} disabled={timer.status === 'idle'} className="disabled:opacity-40 disabled:pointer-events-none" />
          <Button
            variant="primary"
            size="lg"
            icon={timer.status === 'running' ? Pause : Play}
            onClick={toggle}
            className="min-w-36"
          >
            {mainLabel}
          </Button>
          <IconButton icon={SkipForward} label={isBreak ? 'Skip the break' : 'Skip to the break'} onClick={() => FocusService.skip()} />
        </div>

        <p className="hidden items-center gap-1.5 text-xs text-ink-subtle sm:flex">
          <Kbd>Space</Kbd> to start or pause
        </p>
      </div>

      {isBreak ? (
        <p className="rounded-xl bg-success-soft px-3 py-2.5 text-center text-[13px] text-ink-muted">
          {BREAK_TIPS[timer.phase as keyof typeof BREAK_TIPS]}
        </p>
      ) : (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-subtle">Working on</span>
          <select
            value={current?.id ?? ''}
            onChange={e => FocusService.setTimerTask(e.target.value || null)}
            className="h-10 w-full rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink transition-colors focus:border-brand focus:outline-none cursor-pointer"
          >
            <option value="">{openTasks.length > 0 ? 'No task picked' : 'Add a task to pick one'}</option>
            {openTasks.map(task => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line pt-4 text-xs text-ink-subtle">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: settings.longBreakEvery }, (_, i) => (
            <span key={i} className={cn('h-2 w-2 rounded-full', i < timer.completedInCycle ? 'bg-brand' : 'bg-line-strong')} />
          ))}
        </div>
        <span>
          {untilLong === 0
            ? 'Long break time'
            : `${timer.completedInCycle} of ${settings.longBreakEvery} sessions, then a long break`}
        </span>
      </div>
    </Card>
  );
};
