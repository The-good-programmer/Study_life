import type { LessonLog, TimetableLesson } from '../types';
import { StorageService } from './storageService';
import { dayKey, isTimeOfDay, parseDayKey } from './plannerService';

/** Day of the week, ISO: 1 = Monday … 7 = Sunday. */
export const isoWeekday = (date: Date): number => ((date.getDay() + 6) % 7) + 1;

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const minutesOf = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/** Lessons of the same subject: the same Studify subject, or else the same name. */
export const sameSubject = (a: Pick<TimetableLesson, 'folderId' | 'subject'>, b: Pick<TimetableLesson, 'folderId' | 'subject'>): boolean =>
  a.folderId && b.folderId ? a.folderId === b.folderId : a.subject.trim().toLowerCase() === b.subject.trim().toLowerCase();

const byStart = (a: TimetableLesson, b: TimetableLesson) => minutesOf(a.start) - minutesOf(b.start);

/** The lessons on a day (YYYY-MM-DD), earliest first. */
export function lessonsOn(lessons: readonly TimetableLesson[], day: string): TimetableLesson[] {
  const weekday = isoWeekday(parseDayKey(day));
  return lessons.filter(lesson => lesson.weekday === weekday).sort(byStart);
}

/** Today's lessons that have ended and have nothing logged yet, most recent first. */
export function lessonsToLog(lessons: readonly TimetableLesson[], logs: readonly LessonLog[], now: Date = new Date()): TimetableLesson[] {
  const today = dayKey(now);
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return lessonsOn(lessons, today)
    .filter(lesson => minutesOf(lesson.end) <= minutesNow && !logs.some(log => log.lessonId === lesson.id && log.date === today))
    .reverse();
}

/** The day of this subject's next lesson after `day` (up to two weeks ahead), or null if there is none. */
export function nextLessonDay(lessons: readonly TimetableLesson[], lesson: Pick<TimetableLesson, 'folderId' | 'subject'>, day: string): string | null {
  const start = parseDayKey(day);
  for (let ahead = 1; ahead <= 14; ahead++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + ahead);
    if (lessons.some(other => other.weekday === isoWeekday(date) && sameSubject(other, lesson))) return dayKey(date);
  }
  return null;
}

export type LessonDraft = Pick<TimetableLesson, 'subject' | 'weekday' | 'start' | 'end'> & Partial<Pick<TimetableLesson, 'folderId' | 'room'>>;

/** Trims a draft and checks it, or returns an error to show. */
export function cleanLesson(draft: LessonDraft): { lesson: LessonDraft } | { error: string } {
  const subject = draft.subject.trim().slice(0, 60);
  if (!subject) return { error: 'Which subject is it?' };
  if (!Number.isInteger(draft.weekday) || draft.weekday < 1 || draft.weekday > 7) return { error: 'Pick a day.' };
  if (!isTimeOfDay(draft.start) || !isTimeOfDay(draft.end)) return { error: 'Add when it starts and ends.' };
  if (minutesOf(draft.end) <= minutesOf(draft.start)) return { error: 'It has to end after it starts.' };
  const room = draft.room?.trim().slice(0, 40);
  return { lesson: { subject, weekday: draft.weekday, start: draft.start, end: draft.end, folderId: draft.folderId || undefined, room: room || undefined } };
}

const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const TimetableService = {
  getLessons(): TimetableLesson[] {
    return StorageService.getTimetable();
  },

  add(draft: LessonDraft): TimetableLesson {
    const cleaned = cleanLesson(draft);
    if ('error' in cleaned) throw new Error(cleaned.error);
    const now = new Date().toISOString();
    const lesson: TimetableLesson = { ...cleaned.lesson, id: newId('lesson'), createdAt: now, updatedAt: now };
    StorageService.saveTimetable([...StorageService.getTimetable(), lesson]);
    return lesson;
  },

  update(id: string, draft: LessonDraft): TimetableLesson | null {
    const cleaned = cleanLesson(draft);
    if ('error' in cleaned) throw new Error(cleaned.error);
    const lessons = StorageService.getTimetable();
    const index = lessons.findIndex(lesson => lesson.id === id);
    if (index === -1) return null;
    const updated: TimetableLesson = { ...lessons[index], ...cleaned.lesson, updatedAt: new Date().toISOString() };
    lessons[index] = updated;
    StorageService.saveTimetable(lessons);
    return updated;
  },

  remove(id: string): void {
    StorageService.recordDeletion('timetable', id);
    StorageService.saveTimetable(StorageService.getTimetable().filter(lesson => lesson.id !== id));
  },

  getLogs(): LessonLog[] {
    return StorageService.getLessonLogs();
  },

  logFor(lessonId: string, day: string): LessonLog | undefined {
    return StorageService.getLessonLogs().find(log => log.lessonId === lessonId && log.date === day);
  },

  saveLog(log: Omit<LessonLog, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<LessonLog, 'id' | 'createdAt'>>): LessonLog {
    const logs = StorageService.getLessonLogs();
    const now = new Date().toISOString();
    const existing = logs.findIndex(other => (log.id ? other.id === log.id : other.lessonId === log.lessonId && other.date === log.date));
    const saved: LessonLog = {
      ...(existing >= 0 ? logs[existing] : {}),
      ...log,
      id: existing >= 0 ? logs[existing].id : newId('log'),
      createdAt: existing >= 0 ? logs[existing].createdAt : now,
      updatedAt: now,
    } as LessonLog;
    if (existing >= 0) logs[existing] = saved;
    else logs.push(saved);
    StorageService.saveLessonLogs(logs);
    return saved;
  },
};
