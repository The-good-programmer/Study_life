import React, { useMemo, useState } from 'react';
import { Camera, Check, NotebookPen, Plus } from 'lucide-react';
import type { StudySession, TimetableLesson } from '../../types';
import { dayKey } from '../../services/plannerService';
import { StorageService } from '../../services/storageService';
import { NotificationService } from '../../services/notificationService';
import { WEEKDAY_NAMES, WEEKDAY_SHORT, isoWeekday } from '../../services/timetableService';
import { cn } from '../../utils/cn';
import { FOLDER_COLORS } from '../studio/folderOptions';
import { Button, Card } from '../ui/primitives';
import { LessonDialog } from './LessonDialog';
import { LessonLogDialog } from './LessonLogDialog';
import { TimetableImportDialog } from './TimetableImportDialog';
import { useMinuteClock, useTimetable } from './useTimetable';

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

/**
 * The weekly timetable (in the Planner): every lesson by day, colour-coded by subject. Today's lessons
 * can be logged right here; any lesson opens to edit.
 */
export const WeeklyTimetable: React.FC<{
  onStartSession: (session: StudySession) => void;
  onOpenAuth?: () => void;
}> = ({ onStartSession, onOpenAuth }) => {
  const { lessons, logs } = useTimetable();
  const folders = useMemo(() => StorageService.getFolders(), []);
  const [editing, setEditing] = useState<TimetableLesson | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [logging, setLogging] = useState<TimetableLesson | null>(null);
  const [importing, setImporting] = useState(false);
  const [notified] = useState(() => {
    const settings = NotificationService.getSettings();
    return Boolean(settings.push && settings.afterClass !== false);
  });
  const now = useMinuteClock();
  const today = dayKey(now);
  const todayWeekday = isoWeekday(now);
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  // Each subject its own colour (a Studify subject's own, if it has one), so a week is easy to read.
  const keyOf = (lesson: TimetableLesson) => lesson.folderId || lesson.subject.trim().toLowerCase();
  const subjectOrder = [...new Set(lessons.map(keyOf))].sort();

  // Monday to Friday, plus a weekend day when it has lessons.
  const days = [1, 2, 3, 4, 5, ...[6, 7].filter(d => lessons.some(l => l.weekday === d))];
  const byDay = (weekday: number) => lessons.filter(l => l.weekday === weekday).sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
  // On a phone, the week starts today.
  const phoneDays = [...days.filter(d => d >= todayWeekday), ...days.filter(d => d < todayWeekday)].filter(d => byDay(d).length > 0);

  const tile = (lesson: TimetableLesson) => {
    const folder = folders.find(f => f.id === lesson.folderId);
    const color = (folder && FOLDER_COLORS.find(c => c.id === folder.color)) || FOLDER_COLORS[subjectOrder.indexOf(keyOf(lesson)) % FOLDER_COLORS.length];
    const isToday = lesson.weekday === todayWeekday;
    const log = isToday ? logs.find(l => l.lessonId === lesson.id && l.date === today) : undefined;
    const started = isToday && minutesOf(lesson.start) <= minutesNow;
    return (
      <li key={lesson.id} className={cn('rounded-xl border p-2.5', color.border, color.bg)}>
        <button type="button" onClick={() => setEditing(lesson)} className="block w-full text-left cursor-pointer" aria-label={`Edit ${lesson.subject}, ${WEEKDAY_NAMES[lesson.weekday - 1]} ${lesson.start}`}>
          <span className={cn('block truncate text-[13px] font-semibold', color.text)}>{lesson.subject}</span>
          <span className="block text-xs tabular-nums text-ink-muted">
            {lesson.start}–{lesson.end}
          </span>
          {lesson.room && <span className="block truncate text-xs text-ink-subtle">{lesson.room}</span>}
        </button>
        {log ? (
          <button type="button" onClick={() => setLogging(lesson)} className="mt-1.5 flex w-full items-center gap-1 text-left text-xs text-success cursor-pointer">
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{log.topic}</span>
          </button>
        ) : (
          started && (
            <button
              type="button"
              onClick={() => setLogging(lesson)}
              className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-surface-solid px-2 py-1 text-xs font-medium text-ink shadow-sm cursor-pointer hover:text-brand-text"
            >
              <NotebookPen className="h-3.5 w-3.5" aria-hidden="true" />
              Log this lesson
            </button>
          )
        )}
      </li>
    );
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Timetable</h2>
          <p className="mt-0.5 text-[13px] text-ink-subtle">
            {lessons.length === 0
              ? 'Add your lessons. After each one, note what you covered and Studify turns it into flashcards for tonight.'
              : 'After each lesson, note what you covered: homework goes in the planner, and the topic becomes flashcards.'}
          </p>
          {lessons.length > 0 && !notified && (
            <p className="mt-1 text-[13px] text-ink-subtle">
              Tip: turn on reminders in Settings → Reminders to get a nudge when each lesson ends.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={lessons.length === 0 ? 'primary' : 'secondary'} size="sm" icon={Camera} onClick={() => setImporting(true)}>
            From a photo
          </Button>
          <Button variant="secondary" size="sm" icon={Plus} onClick={() => setAdding(todayWeekday <= 5 ? todayWeekday : 1)}>
            Add lesson
          </Button>
        </div>
      </div>

      {lessons.length > 0 && (
        <>
          {/* Phone: day by day, starting today */}
          <div className="space-y-3 md:hidden">
            {phoneDays.map(weekday => (
              <section key={weekday} aria-label={WEEKDAY_NAMES[weekday - 1]}>
                <h3 className={cn('mb-1.5 text-xs font-semibold uppercase tracking-wide', weekday === todayWeekday ? 'text-brand-text' : 'text-ink-subtle')}>
                  {weekday === todayWeekday ? 'Today' : WEEKDAY_NAMES[weekday - 1]}
                </h3>
                <ul className="space-y-1.5">{byDay(weekday).map(tile)}</ul>
              </section>
            ))}
          </div>

          {/* Wider screens: the whole week */}
          <div className="hidden gap-2 md:grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {days.map(weekday => (
              <section key={weekday} aria-label={WEEKDAY_NAMES[weekday - 1]} className="min-w-0">
                <h3
                  className={cn(
                    'mb-2 rounded-lg py-1 text-center text-xs font-semibold uppercase tracking-wide',
                    weekday === todayWeekday ? 'bg-brand-soft text-brand-text' : 'text-ink-subtle',
                  )}
                >
                  {WEEKDAY_SHORT[weekday - 1]}
                </h3>
                <ul className="space-y-1.5">{byDay(weekday).map(tile)}</ul>
                <button
                  type="button"
                  onClick={() => setAdding(weekday)}
                  aria-label={`Add a lesson on ${WEEKDAY_NAMES[weekday - 1]}`}
                  className="mt-1.5 flex h-8 w-full items-center justify-center rounded-xl border border-dashed border-line-strong text-ink-subtle transition-colors hover:border-brand hover:text-brand-text cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </section>
            ))}
          </div>
        </>
      )}

      {(editing || adding !== null) && (
        <LessonDialog
          lesson={editing}
          weekday={adding ?? undefined}
          onClose={() => {
            setEditing(null);
            setAdding(null);
          }}
        />
      )}
      {importing && <TimetableImportDialog onClose={() => setImporting(false)} onOpenAuth={onOpenAuth} />}
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
    </Card>
  );
};
