import { useEffect, useState } from 'react';
import type { LessonLog, TimetableLesson } from '../../types';
import { StorageService } from '../../services/storageService';

/** The timetable and lesson logs, kept current as they change (here, or from another device). */
export function useTimetable(): { lessons: TimetableLesson[]; logs: LessonLog[] } {
  const read = () => ({ lessons: StorageService.getTimetable(), logs: StorageService.getLessonLogs() });
  const [state, setState] = useState(read);
  useEffect(() => StorageService.addMutationListener(() => setState(read())), []);
  return state;
}

/** The current time, updated every minute, so a lesson can be logged as soon as it ends. */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
