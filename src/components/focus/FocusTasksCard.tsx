import React, { useState } from 'react';
import { CalendarDays, Crosshair, Plus, Timer, Trash2 } from 'lucide-react';
import type { FocusTask, PlannerItem } from '../../types';
import { FocusService, MAX_TASK_TITLE } from '../../services/focusService';
import { dayKey, daysBetween, relativeDay } from '../../services/plannerService';
import { cn } from '../../utils/cn';
import { Badge, Button, Card, IconButton, SectionHeader } from '../ui/primitives';

interface FocusTasksCardProps {
  tasks: FocusTask[];
  currentTaskId: string | null;
  suggestions: PlannerItem[];
}

const TaskRow: React.FC<{ task: FocusTask; current: boolean }> = ({ task, current }) => (
  <li
    className={cn(
      'group flex items-center gap-3 rounded-xl border bg-canvas px-3 py-2',
      current ? 'border-brand/50 bg-brand-soft' : 'border-line',
      task.done && 'opacity-60',
    )}
  >
    <input
      type="checkbox"
      checked={task.done}
      onChange={e => FocusService.updateTask(task.id, { done: e.target.checked })}
      aria-label={task.done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
      className="h-4 w-4 shrink-0 accent-[var(--brand)] cursor-pointer"
    />
    <span className="min-w-0 flex-1">
      <span className={cn('block truncate text-[13px] font-medium text-ink', task.done && 'line-through')}>{task.title}</span>
      {(current || task.plannerItemId) && (
        <span className="block truncate text-[11px] text-ink-subtle">
          {current ? 'Working on this now' : 'From your planner'}
        </span>
      )}
    </span>
    {task.pomodoros > 0 && (
      <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-ink-subtle" title={`${task.pomodoros} focus sessions`}>
        <Timer className="h-3.5 w-3.5" aria-hidden="true" />
        {task.pomodoros}
        <span className="sr-only">focus sessions</span>
      </span>
    )}
    {!task.done && !current && (
      <IconButton icon={Crosshair} label={`Work on ${task.title}`} onClick={() => FocusService.setTimerTask(task.id)} className="h-8 w-8" />
    )}
    <IconButton
      icon={Trash2}
      label={`Delete ${task.title}`}
      onClick={() => FocusService.removeTask(task.id)}
      className="h-8 w-8 hover:text-danger"
    />
  </li>
);

/** The tasks for this study session, with homework from the planner offered as tasks. */
export const FocusTasksCard: React.FC<FocusTasksCardProps> = ({ tasks, currentTaskId, suggestions }) => {
  const [title, setTitle] = useState('');
  const open = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);
  // The day the page opened on, for the due dates below.
  const [today] = useState(() => dayKey(new Date()));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (FocusService.addTask(title)) setTitle('');
  };

  return (
    <Card className="space-y-4">
      <SectionHeader title="Tasks" description="What you'll get done this session." />

      <form onSubmit={add} className="flex gap-2">
        <label className="sr-only" htmlFor="focus-new-task">
          New task
        </label>
        <input
          id="focus-new-task"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={MAX_TASK_TITLE}
          placeholder="e.g. Finish chemistry worksheet"
          className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
        />
        <Button type="submit" icon={Plus} disabled={!title.trim()}>
          Add
        </Button>
      </form>

      {open.length > 0 ? (
        <ul className="space-y-1.5">
          {open.map(task => (
            <TaskRow key={task.id} task={task} current={task.id === currentTaskId} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[13px] text-ink-subtle">
          {done.length > 0 ? 'All done. Add another task or take a break.' : 'Add what you want to work on, then start the timer.'}
        </p>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-subtle">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            From your planner
          </h3>
          <ul className="space-y-1.5">
            {suggestions.map(item => {
              const days = daysBetween(today, item.date);
              return (
                <li key={item.id} className="flex items-center gap-3 rounded-xl border border-dashed border-line px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-muted">{item.title}</span>
                  <Badge tone={days < 0 ? 'danger' : days <= 2 ? 'due' : 'neutral'}>{days < 0 ? 'Overdue' : `Due ${relativeDay(days)}`}</Badge>
                  <IconButton icon={Plus} label={`Add ${item.title} as a task`} onClick={() => FocusService.addTask(item.title, item.id)} className="h-8 w-8" />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {done.length > 0 && (
        <details className="group/done">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-ink-subtle hover:text-ink-muted">
            <span>Done ({done.length})</span>
            <span className="group-open/done:hidden">Show</span>
            <span className="hidden group-open/done:inline">Hide</span>
          </summary>
          <ul className="mt-2 space-y-1.5">
            {done.map(task => (
              <TaskRow key={task.id} task={task} current={false} />
            ))}
          </ul>
          <Button size="sm" variant="ghost" onClick={() => FocusService.clearDone()} className="mt-2">
            Clear done tasks
          </Button>
        </details>
      )}
    </Card>
  );
};
