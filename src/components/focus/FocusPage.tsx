import React, { useEffect, useState } from 'react';
import { FocusService } from '../../services/focusService';
import { useFocusState } from '../../hooks/useFocusTimer';
import { FocusNotesCard } from './FocusNotesCard';
import { FocusSoundCard } from './FocusSoundCard';
import { FocusTasksCard } from './FocusTasksCard';
import { FocusTimerCard } from './FocusTimerCard';
import { FocusTodayCard } from './FocusTodayCard';

const readExtras = () => ({ summary: FocusService.summary(), suggestions: FocusService.suggestions() });

/**
 * The Focus workspace: a Pomodoro timer with the session's tasks, a notes pad, background
 * sound and today's focus time. The timer keeps running on other pages.
 */
export const FocusPage: React.FC = () => {
  const { timer, settings, tasks, now } = useFocusState();
  // Read on changes only, not on every tick of the clock.
  const [{ summary, suggestions }, setExtras] = useState(readExtras);
  useEffect(() => FocusService.subscribe(() => setExtras(readExtras())), []);
  const currentTaskId = tasks.some(t => t.id === timer.taskId && !t.done) ? timer.taskId : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-fadeIn">
      <header className="min-w-0">
        <h1 className="text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">Focus</h1>
        <p className="mt-1 text-[15px] text-ink-muted">Work in focused sessions with short breaks. The timer keeps going if you switch pages.</p>
      </header>

      {/* One column on phones (timer, tasks, notes, then the rest); two from lg. */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:items-start">
        <div className="contents lg:col-span-7 lg:flex lg:flex-col lg:gap-5">
          <div className="order-1">
            <FocusTimerCard timer={timer} settings={settings} tasks={tasks} now={now} />
          </div>
          <div className="order-4">
            <FocusSoundCard />
          </div>
          <div className="order-5">
            <FocusTodayCard summary={summary} />
          </div>
        </div>
        <div className="contents lg:col-span-5 lg:flex lg:flex-col lg:gap-5">
          <div className="order-2">
            <FocusTasksCard tasks={tasks} currentTaskId={currentTaskId} suggestions={suggestions} />
          </div>
          <div className="order-3">
            <FocusNotesCard />
          </div>
        </div>
      </div>
    </div>
  );
};
