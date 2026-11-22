import { beforeEach, describe, expect, it } from 'vitest';
import type { LessonLog, TimetableLesson } from '../types';
import { cleanLesson, isoWeekday, lessonsOn, lessonsToLog, nextLessonDay, TimetableService } from './timetableService';

const lesson = (over: Partial<TimetableLesson>): TimetableLesson => ({
  id: over.id ?? `l-${Math.random()}`,
  subject: 'Biology',
  weekday: 1,
  start: '09:00',
  end: '09:45',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  ...over,
});

// 2026-11-23 is a Monday.
const MONDAY = '2026-11-23';

describe('the timetable', () => {
  beforeEach(() => localStorage.clear());

  it('numbers days Monday 1 to Sunday 7', () => {
    expect(isoWeekday(new Date(2026, 10, 23))).toBe(1);
    expect(isoWeekday(new Date(2026, 10, 29))).toBe(7);
  });

  it("lists a day's lessons earliest first", () => {
    const lessons = [lesson({ id: 'b', start: '11:00', end: '11:45' }), lesson({ id: 'a' }), lesson({ id: 'tue', weekday: 2 })];
    expect(lessonsOn(lessons, MONDAY).map(l => l.id)).toEqual(['a', 'b']);
  });

  it('asks to log a lesson once it has ended, until it is logged', () => {
    const lessons = [lesson({ id: 'early' }), lesson({ id: 'late', start: '13:00', end: '13:45' })];
    const at = (h: number, m: number) => new Date(2026, 10, 23, h, m);
    expect(lessonsToLog(lessons, [], at(9, 30))).toEqual([]);
    expect(lessonsToLog(lessons, [], at(9, 45)).map(l => l.id)).toEqual(['early']);
    const logged = [{ lessonId: 'early', date: MONDAY } as LessonLog];
    expect(lessonsToLog(lessons, logged, at(14, 0)).map(l => l.id)).toEqual(['late']);
  });

  it("finds a subject's next lesson, into next week if need be", () => {
    const lessons = [lesson({ weekday: 1 }), lesson({ weekday: 3 }), lesson({ subject: 'Maths', weekday: 2 })];
    expect(nextLessonDay(lessons, { subject: 'biology' }, MONDAY)).toBe('2026-11-25');
    expect(nextLessonDay(lessons, { subject: 'Biology' }, '2026-11-25')).toBe('2026-11-30');
    expect(nextLessonDay(lessons, { subject: 'Art' }, MONDAY)).toBeNull();
  });

  it('checks a lesson before saving it', () => {
    expect(cleanLesson({ subject: ' ', weekday: 1, start: '09:00', end: '10:00' })).toEqual({ error: 'Which subject is it?' });
    expect(cleanLesson({ subject: 'Art', weekday: 1, start: '10:00', end: '09:00' })).toEqual({ error: 'It has to end after it starts.' });
    expect(cleanLesson({ subject: 'Art', weekday: 8, start: '09:00', end: '10:00' })).toEqual({ error: 'Pick a day.' });
    const added = TimetableService.add({ subject: '  Art ', weekday: 2, start: '09:00', end: '10:00', room: ' ' });
    expect(added).toMatchObject({ subject: 'Art', room: undefined });
    TimetableService.remove(added.id);
    expect(TimetableService.getLessons()).toEqual([]);
  });
});
