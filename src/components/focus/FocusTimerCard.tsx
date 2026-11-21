import React, { useState, useSyncExternalStore } from 'react';
import { Maximize2, Settings2 } from 'lucide-react';
import type { FocusTask } from '../../types';
import { FocusService } from '../../services/focusService';
import { PHASES, formatClock, progressAt, remainingAt, type FocusSettings, type TimerState } from '../../services/focusTimer';
import { PHASE_LABELS } from '../../hooks/useFocusTimer';
import { cn } from '../../utils/cn';
import { Card, IconButton, Kbd, ProgressRing } from '../ui/primitives';
import { FocusControls } from './FocusControls';
import { FocusPresetChips } from './FocusPresetChips';
import { FocusSettingsDialog } from './FocusSettingsDialog';
import { FocusSoundMenu } from './FocusSoundMenu';
import { FocusTaskPicker } from './FocusTaskPicker';
import { BREAK_TIPS } from './focusUi';

const WIDE = '(min-width: 640px)';
const subscribeWide = (onChange: () => void) => {
  const query = window.matchMedia(WIDE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
/** Whether the screen is at least phone-landscape wide. */
const useWide = () => useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => true);

interface FocusTimerCardProps {
  timer: TimerState;
  settings: FocusSettings;
  tasks: FocusTask[];
  now: number;
  onFullscreen: () => void;
}

/** The timer: phase, clock, the task it is for, controls, the long-break cycle and background sound. */
export const FocusTimerCard: React.FC<FocusTimerCardProps> = ({ timer, settings, tasks, now, onFullscreen }) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const wide = useWide();
  const remaining = remainingAt(timer, now);
  const isBreak = timer.phase !== 'focus';
  const running = timer.status === 'running';
  const untilLong = Math.max(0, settings.longBreakEvery - timer.completedInCycle);

  return (
    <Card className="relative flex flex-col gap-5 overflow-hidden p-4 sm:p-5">
      {/* A soft glow in the phase's colour while the timer runs. */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 transition-opacity duration-700',
          isBreak
            ? 'bg-[radial-gradient(ellipse_at_50%_0%,var(--success-soft),transparent_70%)]'
            : 'bg-[radial-gradient(ellipse_at_50%_0%,var(--brand-soft),transparent_70%)]',
          running ? 'opacity-100' : 'opacity-0',
        )}
      />

      <div className="relative flex items-center justify-between gap-2">
        <div role="group" aria-label="Timer phase" className="flex min-w-0 rounded-full border border-line bg-canvas p-1">
          {PHASES.map(phase => (
            <button
              key={phase}
              type="button"
              onClick={() => FocusService.choosePhase(phase)}
              disabled={running}
              aria-pressed={timer.phase === phase}
              className={cn(
                'h-8 whitespace-nowrap rounded-full px-2 text-xs font-medium transition-colors min-[380px]:px-2.5 sm:px-3.5 sm:text-[13px] cursor-pointer disabled:cursor-not-allowed',
                timer.phase === phase ? 'bg-surface-hover text-ink' : 'text-ink-subtle hover:text-ink-muted disabled:hover:text-ink-subtle',
              )}
            >
              {PHASE_LABELS[phase]}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center">
          <IconButton icon={Maximize2} label="Full screen (F)" onClick={onFullscreen} className="h-8 w-8 sm:h-9 sm:w-9" />
          <IconButton icon={Settings2} label="Timer settings" onClick={() => setSettingsOpen(true)} className="h-8 w-8 sm:h-9 sm:w-9" />
        </div>
      </div>

      <div className="relative flex flex-col items-center gap-5 pt-1">
        <div className={cn('rounded-full transition-[filter] duration-700', running && (isBreak ? 'drop-shadow-[0_0_28px_var(--success-soft)]' : 'drop-shadow-[0_0_28px_var(--brand-soft)]'))}>
          <ProgressRing value={progressAt(timer, now) * 100} size={wide ? 288 : 248} stroke={wide ? 12 : 11} tone={isBreak ? 'success' : 'brand'}>
            <span
              className="text-[60px] font-semibold leading-none tracking-tight text-ink tabular-nums sm:text-[72px]"
              role="timer"
              aria-label={`${formatClock(remaining)} left`}
            >
              {formatClock(remaining)}
            </span>
            <span className={cn('mt-2.5 text-[13px] font-medium', isBreak ? 'text-success' : 'text-brand-text')}>
              {timer.status === 'paused' ? `${PHASE_LABELS[timer.phase]} · paused` : PHASE_LABELS[timer.phase]}
            </span>
          </ProgressRing>
        </div>

        {isBreak ? (
          <p className="max-w-sm text-center text-[13px] text-ink-muted">{BREAK_TIPS[timer.phase as keyof typeof BREAK_TIPS]}</p>
        ) : (
          <FocusTaskPicker tasks={tasks} currentId={timer.taskId} />
        )}

        <FocusControls
          timer={timer}
          now={now}
          footer={
            timer.status === 'idle' ? (
              <FocusPresetChips settings={settings} />
            ) : (
              <p className="hidden h-8 items-center gap-1.5 text-xs text-ink-subtle sm:flex">
                <Kbd>Space</Kbd> start or pause · <Kbd>F</Kbd> full screen
              </p>
            )
          }
        />
      </div>

      <div className="relative flex items-center justify-between gap-3 border-t border-line pt-4">
        <div className="flex min-w-0 items-center gap-2.5 text-xs text-ink-subtle">
          <div className="flex shrink-0 items-center gap-1" aria-hidden="true">
            {Array.from({ length: settings.longBreakEvery }, (_, i) => (
              <span key={i} className={cn('h-2 w-2 rounded-full', i < timer.completedInCycle ? 'bg-brand' : 'bg-line-strong')} />
            ))}
          </div>
          <span className="truncate">
            {timer.phase === 'long-break'
              ? 'Long break'
              : untilLong === 0
                ? 'Long break next'
                : `${untilLong} more ${untilLong === 1 ? 'session' : 'sessions'} until a long break`}
          </span>
        </div>
        <FocusSoundMenu />
      </div>

      <FocusSettingsDialog isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} />
    </Card>
  );
};
