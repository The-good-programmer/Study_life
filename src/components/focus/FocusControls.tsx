import React from 'react';
import { CircleCheck, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { FocusService, MIN_COUNTED_MS } from '../../services/focusService';
import { elapsedAt, type TimerState } from '../../services/focusTimer';
import { cn } from '../../utils/cn';
import { Button, IconButton } from '../ui/primitives';
import { toggleTimer } from './focusUi';

/** Reset, Start/Pause and Skip, with "Finish now" under them once a focus session can be counted. */
export const FocusControls: React.FC<{ timer: TimerState; now: number; size?: 'md' | 'lg'; footer?: React.ReactNode }> = ({
  timer,
  now,
  size = 'md',
  footer,
}) => {
  const isBreak = timer.phase !== 'focus';
  const elapsed = elapsedAt(timer, now);
  const canFinish = timer.phase === 'focus' && timer.status !== 'idle' && elapsed >= MIN_COUNTED_MS;
  const mainLabel = timer.status === 'running' ? 'Pause' : timer.status === 'paused' ? 'Resume' : 'Start';
  const side = size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <IconButton
          icon={RotateCcw}
          label="Reset"
          onClick={() => FocusService.reset()}
          disabled={timer.status === 'idle'}
          className={cn(side, 'rounded-full disabled:pointer-events-none disabled:opacity-30')}
        />
        <Button
          variant="primary"
          size="lg"
          icon={timer.status === 'running' ? Pause : Play}
          onClick={toggleTimer}
          className={cn('rounded-full', size === 'lg' ? 'h-14 min-w-44 text-base' : 'min-w-36')}
        >
          {mainLabel}
        </Button>
        <IconButton
          icon={SkipForward}
          label={isBreak ? 'Skip the break' : 'Skip to the break (this session is not counted)'}
          onClick={() => FocusService.skip()}
          className={cn(side, 'rounded-full')}
        />
      </div>
      {canFinish ? (
        <Button size="sm" variant="ghost" icon={CircleCheck} onClick={() => FocusService.finishEarly()}>
          Finish now and count {Math.floor(elapsed / 60_000)} min
        </Button>
      ) : (
        footer
      )}
    </div>
  );
};
