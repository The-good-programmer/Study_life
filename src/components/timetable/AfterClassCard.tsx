import React, { useState } from 'react';
import { Check, NotebookPen } from 'lucide-react';
import type { StudySession, TimetableLesson } from '../../types';
import { dayKey } from '../../services/plannerService';
import { lessonsOn } from '../../services/timetableService';
import { Button } from '../ui/primitives';
import { LessonLogDialog } from './LessonLogDialog';
import { useMinuteClock, useTimetable } from './useTimetable';

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

/**
 * Today's lessons on the home page, on days that have any: a finished lesson asks what was covered
 * (a few seconds, and its topic becomes tonight's flashcards); logged ones show their topic.
 */
export const AfterClassCard: React.FC<{
  onStartSession: (session: StudySession) => void;
  onOpenAuth?: () => void;
}> = ({ onStartSession, onOpenAuth }) => {
  const { lessons, logs } = useTimetable();
  const [logging, setLogging] = useState<TimetableLesson | null>(null);
  const now = useMinuteClock();
  const today = dayKey(now);
  const todays = lessonsOn(lessons, today);
  if (todays.length === 0) return null;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const toLog = todays.filter(l => minutesOf(l.end) <= minutesNow && !logs.some(log => log.lessonId === l.id && log.date === today)).length;

  return (
    <section aria-labelledby="after-class-title" className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="after-class-title" className="text-[15px] font-semibold text-ink">
          After class
        </h2>
        <p className="text-[13px] text-ink-subtle">
          {toLog > 0 ? `${toLog} ${toLog === 1 ? 'lesson' : 'lessons'} to note down` : 'Note what you covered after each lesson'}
        </p>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {todays.map(lesson => {
          const log = logs.find(l => l.lessonId === lesson.id && l.date === today);
          const ended = minutesOf(lesson.end) <= minutesNow;
          const started = minutesOf(lesson.start) <= minutesNow;
          return (
            <li key={lesson.id} className="flex items-center gap-3 py-2.5">
              <span className="w-[86px] shrink-0 text-[13px] tabular-nums text-ink-subtle">
                {lesson.start}–{lesson.end}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-ink">{lesson.subject}</span>
                {log && (
                  <span className="flex items-center gap-1 truncate text-[13px] text-success">
                    <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {log.topic}
                      {log.cardCount ? ` · ${log.cardCount} cards` : ''}
                    </span>
                  </span>
                )}
              </span>
              {!log && started && (
                <Button variant={ended ? 'primary' : 'secondary'} size="sm" icon={NotebookPen} onClick={() => setLogging(lesson)}>
                  Log it
                </Button>
              )}
              {!log && !started && <span className="text-xs text-ink-subtle">Later</span>}
            </li>
          );
        })}
      </ul>
      {logging && (
        <LessonLogDialog
          lesson={logging}
          day={today}
          onClose={() => setLogging(null)}
          onStudy={session => {
            setLogging(null);
            onStartSession(session);
          }}
          onOpenAuth={onOpenAuth}
        />
      )}
    </section>
  );
};
