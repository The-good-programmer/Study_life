import React, { useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, GraduationCap, GripVertical, Pencil, Play, Plus, Timer, Trash2 } from 'lucide-react';
import type { FocusTask } from '../../types';
import { FocusService, MAX_TASK_TITLE, type FocusSuggestion } from '../../services/focusService';
import { dayKey, daysBetween, relativeDay } from '../../services/plannerService';
import { cn } from '../../utils/cn';
import { ActionMenu } from '../ui/ActionMenu';
import { Badge, Button, Card, IconButton, SectionHeader } from '../ui/primitives';

interface FocusTasksCardProps {
  tasks: FocusTask[];
  currentTaskId: string | null;
  suggestions: FocusSuggestion[];
  /** Opens the task's deck to study, when it has one that still exists. */
  onStudy?: (task: FocusTask) => void;
  /** Ids of the decks there are, for the Study buttons. */
  deckIds?: ReadonlySet<string>;
}

/** Shown on hover or keyboard focus where there is a mouse; always shown on touch screens. */
const REVEAL = '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100';

const RenameField: React.FC<{ task: FocusTask; onDone: () => void }> = ({ task, onDone }) => {
  const [value, setValue] = useState(task.title);
  const save = () => {
    if (value.trim() && value !== task.title) FocusService.updateTask(task.id, { title: value });
    onDone();
  };
  return (
    <input
      autoFocus
      value={value}
      maxLength={MAX_TASK_TITLE}
      aria-label={`Rename ${task.title}`}
      onChange={e => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={e => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') {
          e.preventDefault();
          onDone();
        }
      }}
      onFocus={e => e.target.select()}
      className="h-8 min-w-0 flex-1 rounded-lg border border-brand bg-canvas px-2 text-[13px] text-ink focus:outline-none"
    />
  );
};

interface TaskRowProps {
  task: FocusTask;
  onStudy?: () => void;
  index: number;
  count: number;
  current: boolean;
  dragOver: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

const TaskRow: React.FC<TaskRowProps> = ({ task, onStudy, index, count, current, dragOver, onDragStart, onDragOver, onDrop, onDragEnd }) => {
  const [renaming, setRenaming] = useState(false);
  const movable = !task.done && count > 1;

  // Tapping a task works on it; tapping the one already being worked on renames it.
  const onTitleClick = () => {
    if (task.done) return;
    if (current) setRenaming(true);
    else FocusService.setTimerTask(task.id);
  };

  return (
    <li
      draggable={movable && !renaming}
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
        onDragStart();
      }}
      onDragOver={e => {
        if (!movable) return;
        e.preventDefault();
        onDragOver();
      }}
      onDrop={e => {
        e.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'group relative flex items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-1.5 transition-colors',
        current ? 'border-brand/50 bg-brand-soft' : 'border-line bg-canvas hover:border-line-strong',
        task.done && 'opacity-60',
        dragOver && 'ring-2 ring-brand/60',
      )}
    >
      {movable ? (
        <span className={cn('hidden cursor-grab text-ink-subtle active:cursor-grabbing [@media(hover:hover)]:block', REVEAL)} aria-hidden="true">
          <GripVertical className="h-4 w-4" />
        </span>
      ) : (
        <span className="hidden w-4 [@media(hover:hover)]:block" aria-hidden="true" />
      )}
      <input
        type="checkbox"
        checked={task.done}
        onChange={e => FocusService.updateTask(task.id, { done: e.target.checked })}
        aria-label={task.done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
        className="ml-1 h-4 w-4 shrink-0 accent-[var(--brand)] cursor-pointer"
      />
      {renaming ? (
        <RenameField task={task} onDone={() => setRenaming(false)} />
      ) : (
        <button
          type="button"
          onClick={onTitleClick}
          onDoubleClick={() => setRenaming(true)}
          disabled={task.done}
          aria-label={task.done ? task.title : current ? `${task.title}, working on it now. Rename` : `Work on ${task.title}`}
          className="flex min-h-9 min-w-0 flex-1 flex-col justify-center rounded-lg px-1.5 text-left cursor-pointer disabled:cursor-default"
        >
          <span className={cn('line-clamp-2 break-words text-[13px] font-medium text-ink', task.done && 'line-through')}>{task.title}</span>
          {current && <span className="block text-[11px] font-medium text-brand-text">Working on this now</span>}
          {!current && task.plannerItemId && !task.done && <span className="block text-[11px] text-ink-subtle">From your planner</span>}
        </button>
      )}
      {task.pomodoros > 0 && !renaming && (
        <span className="flex shrink-0 items-center gap-1 px-1 text-xs tabular-nums text-ink-subtle" title={`${task.pomodoros} focus sessions`}>
          <Timer className="h-3.5 w-3.5" aria-hidden="true" />
          {task.pomodoros}
          <span className="sr-only">focus sessions</span>
        </span>
      )}
      {onStudy && !task.done && !renaming && (
        <Button size="sm" variant={current ? 'primary' : 'secondary'} icon={Play} onClick={onStudy} aria-label={`Study ${task.title}`} className="shrink-0">
          Study
        </Button>
      )}
      {!renaming && (
        <div className={cn('flex shrink-0 items-center transition-opacity', REVEAL)}>
          <IconButton icon={Trash2} label={`Delete ${task.title}`} onClick={() => FocusService.removeTask(task.id)} className="h-8 w-8 hover:text-danger" />
          {!task.done && (
            <ActionMenu
              label={`More actions for ${task.title}`}
              items={[
                { label: 'Rename', icon: Pencil, onSelect: () => setRenaming(true) },
                ...(index > 0 ? [{ label: 'Move up', icon: ArrowUp, onSelect: () => FocusService.moveTask(task.id, index - 1) }] : []),
                ...(index < count - 1 ? [{ label: 'Move down', icon: ArrowDown, onSelect: () => FocusService.moveTask(task.id, index + 1) }] : []),
                { label: 'Delete', icon: Trash2, tone: 'danger' as const, onSelect: () => FocusService.removeTask(task.id) },
              ]}
            />
          )}
        </div>
      )}
    </li>
  );
};

/** The tasks for this study session, with homework from the planner offered as tasks. */
export const FocusTasksCard: React.FC<FocusTasksCardProps> = ({ tasks, currentTaskId, suggestions, onStudy, deckIds }) => {
  const [title, setTitle] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // The day the page opened on, for the due dates below.
  const [today] = useState(() => dayKey(new Date()));
  const open = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (FocusService.addTask(title)) setTitle('');
  };

  const endDrag = () => {
    setDragId(null);
    setOverIndex(null);
  };

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Tasks"
        description={open.length > 1 ? 'Tap a task to work on it. Drag to reorder.' : "What you'll get done this session."}
      />

      <form onSubmit={add} className="flex gap-2">
        <label className="sr-only" htmlFor="focus-new-task">
          New task
        </label>
        <input
          id="focus-new-task"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={MAX_TASK_TITLE}
          placeholder="Add a task, e.g. Chemistry worksheet"
          className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand focus:outline-none"
        />
        <Button type="submit" icon={Plus} disabled={!title.trim()} aria-label="Add task">
          <span className="hidden sm:inline">Add</span>
        </Button>
      </form>

      {open.length > 0 ? (
        <ul className="space-y-1.5">
          {open.map((task, index) => (
            <TaskRow
              key={task.id}
              task={task}
              onStudy={onStudy && task.deckId && deckIds?.has(task.deckId) ? () => onStudy(task) : undefined}
              index={index}
              count={open.length}
              current={task.id === currentTaskId}
              dragOver={dragId !== null && dragId !== task.id && overIndex === index}
              onDragStart={() => setDragId(task.id)}
              onDragOver={() => setOverIndex(index)}
              onDrop={() => {
                if (dragId) FocusService.moveTask(dragId, index);
                endDrag();
              }}
              onDragEnd={endDrag}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-3 py-5 text-center text-[13px] text-ink-subtle">
          {done.length > 0 ? 'All done. Add another task, or take a break.' : 'Add what you want to work on, then start the timer.'}
        </p>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-subtle">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            From your planner
          </h3>
          <ul className="space-y-1.5">
            {suggestions.map(suggestion => {
              const { item } = suggestion;
              const title = suggestion.kind === 'exam' ? suggestion.title : item.title;
              const days = daysBetween(today, item.date);
              const Icon = suggestion.kind === 'exam' ? GraduationCap : Plus;
              return (
                <li key={`${suggestion.kind}-${item.id}`}>
                  <button
                    type="button"
                    onClick={() => FocusService.addSuggestion(suggestion)}
                    aria-label={`Add ${title} as a task`}
                    className="flex w-full items-center gap-3 rounded-xl border border-dashed border-line px-3 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-hover cursor-pointer"
                  >
                    <Icon className={cn('h-3.5 w-3.5 shrink-0', suggestion.kind === 'exam' ? 'text-danger' : 'text-ink-subtle')} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink-muted">{title}</span>
                    {suggestion.kind === 'exam' ? (
                      <Badge tone={days <= 2 ? 'due' : 'neutral'}>{days === 0 ? 'Exam today' : `Exam ${relativeDay(days)}`}</Badge>
                    ) : (
                      <Badge tone={days < 0 ? 'danger' : days <= 2 ? 'due' : 'neutral'}>{days < 0 ? 'Overdue' : `Due ${relativeDay(days)}`}</Badge>
                    )}
                  </button>
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
            {done.map((task, index) => (
              <TaskRow
                key={task.id}
                task={task}
                index={index}
                count={done.length}
                current={false}
                dragOver={false}
                onDragStart={() => {}}
                onDragOver={() => {}}
                onDrop={() => {}}
                onDragEnd={() => {}}
              />
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
