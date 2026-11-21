import React from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import type { FocusTask } from '../../types';
import { FocusService } from '../../services/focusService';
import { cn } from '../../utils/cn';
import { usePopover } from './usePopover';
import { focusNewTaskInput } from './focusUi';

/** "Working on: Chemistry ▾", a menu of the open tasks to pick the timer's task from. */
export const FocusTaskPicker: React.FC<{ tasks: FocusTask[]; currentId: string | null; className?: string }> = ({ tasks, currentId, className }) => {
  const { open, setOpen, rootRef } = usePopover();
  const openTasks = tasks.filter(t => !t.done);
  const current = openTasks.find(t => t.id === currentId);

  if (openTasks.length === 0) {
    return (
      <button
        type="button"
        onClick={focusNewTaskInput}
        className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer', className)}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Add a task to work on
      </button>
    );
  }

  const pick = (id: string | null) => {
    FocusService.setTimerTask(id);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn('relative max-w-full', className)}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-line bg-canvas px-3 text-[13px] transition-colors hover:border-line-strong cursor-pointer"
      >
        <span className="shrink-0 text-ink-subtle">{current ? 'Working on' : 'Pick a task'}</span>
        {current && <span className="min-w-0 truncate font-medium text-ink">{current.title}</span>}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Pick a task"
          className="absolute left-1/2 top-full z-30 mt-1.5 max-h-72 w-72 max-w-[calc(100vw-3rem)] -translate-x-1/2 overflow-y-auto rounded-xl border border-line-strong bg-surface-solid p-1 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.6)] animate-fadeIn"
        >
          {openTasks.map(task => (
            <button
              key={task.id}
              type="button"
              role="menuitemradio"
              aria-checked={task.id === current?.id}
              onClick={() => pick(task.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink transition-colors hover:bg-surface-hover cursor-pointer"
            >
              <Check className={cn('h-3.5 w-3.5 shrink-0 text-brand-text', task.id !== current?.id && 'invisible')} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{task.title}</span>
            </button>
          ))}
          <div className="my-1 h-px bg-line" />
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!current}
            onClick={() => pick(null)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-muted transition-colors hover:bg-surface-hover cursor-pointer"
          >
            <Check className={cn('h-3.5 w-3.5 shrink-0 text-brand-text', current && 'invisible')} aria-hidden="true" />
            No task
          </button>
        </div>
      )}
    </div>
  );
};
