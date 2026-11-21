import React, { useCallback, useEffect, useState } from 'react';
import { FocusService, type FocusSummary } from '../../services/focusService';
import { useFocusState } from '../../hooks/useFocusTimer';
import { FocusFullscreen } from './FocusFullscreen';
import { FocusNotesCard } from './FocusNotesCard';
import { FocusTasksCard } from './FocusTasksCard';
import { FocusTimerCard } from './FocusTimerCard';
import { formatMinutes, plural, toggleTimer } from './focusUi';

const readExtras = () => ({ summary: FocusService.summary(), suggestions: FocusService.suggestions() });

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable));
};

/** Focus time today and this week, in one line by the title. */
const FocusTimeLine: React.FC<{ summary: FocusSummary }> = ({ summary }) => (
  <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]" title="Finished focus sessions also count toward your daily goal and streak">
    <div className="flex items-baseline gap-1.5">
      <dt className="text-ink-subtle">Today</dt>
      <dd className="font-semibold text-ink tabular-nums">{formatMinutes(summary.todayMinutes)}</dd>
      <dd className="text-ink-subtle">· {plural(summary.todaySessions, 'session')}</dd>
    </div>
    <div className="h-3.5 w-px bg-line-strong" aria-hidden="true" />
    <div className="flex items-baseline gap-1.5">
      <dt className="text-ink-subtle">Last 7 days</dt>
      <dd className="font-semibold text-ink tabular-nums">{formatMinutes(summary.weekMinutes)}</dd>
    </div>
  </dl>
);

/**
 * The Focus workspace: a Pomodoro timer (with background sound) beside the session's tasks
 * and a notes pad. The timer keeps running on other pages.
 */
export const FocusPage: React.FC = () => {
  const { timer, settings, tasks, now } = useFocusState();
  // Read on changes only, not on every tick of the clock.
  const [{ summary, suggestions }, setExtras] = useState(readExtras);
  useEffect(() => FocusService.subscribe(() => setExtras(readExtras())), []);
  const [fullscreen, setFullscreen] = useState(false);
  const closeFullscreen = useCallback(() => setFullscreen(false), []);
  const currentTaskId = tasks.some(t => t.id === timer.taskId && !t.done) ? timer.taskId : null;

  // Space starts and pauses; F opens and closes full screen. Not while typing, and not when a
  // dialog or menu is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]:not([aria-label="Focus timer, full screen"]), [role="menu"]')) return;
      if (e.code === 'Space') {
        if ((e.target as HTMLElement | null)?.closest('button, a, [role="switch"], [role="radio"]')) return;
        e.preventDefault();
        toggleTimer();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setFullscreen(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-fadeIn">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">Focus</h1>
          <p className="mt-1 text-[15px] text-ink-muted">Focused sessions with short breaks. The timer keeps going on other pages.</p>
        </div>
        <FocusTimeLine summary={summary} />
      </header>

      <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
        <div className="min-w-0 lg:sticky lg:top-20 lg:col-span-7">
          <FocusTimerCard timer={timer} settings={settings} tasks={tasks} now={now} onFullscreen={() => setFullscreen(true)} />
        </div>
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-5">
          <FocusTasksCard tasks={tasks} currentTaskId={currentTaskId} suggestions={suggestions} />
          <FocusNotesCard />
        </div>
      </div>

      {fullscreen && <FocusFullscreen timer={timer} tasks={tasks} now={now} onClose={closeFullscreen} />}
    </div>
  );
};
