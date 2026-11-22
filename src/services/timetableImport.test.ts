import { describe, expect, it } from 'vitest';
import type { SubjectFolder, TimetableLesson } from '../types';
import { toLessonDrafts } from './timetableImport';

const folders = [{ id: 'f-bio', name: 'Biology' }] as SubjectFolder[];

describe('reading a timetable', () => {
  it("keeps valid lessons, in week order, linked to the student's subjects", () => {
    const drafts = toLessonDrafts(
      {
        lessons: [
          { subject: 'Maths', weekday: 2, start: '9:20', end: '10:05', room: 'Room 11' },
          { subject: 'biology', weekday: 1, start: '08:30', end: '09:15' },
          { subject: 'Lunch?', weekday: 1, start: '12:00', end: '11:00' }, // ends before it starts
          { subject: '', weekday: 1, start: '13:00', end: '13:45' }, // no subject
          { subject: 'Art', weekday: 9, start: '13:00', end: '13:45' }, // no such day
        ],
      },
      folders,
    );
    expect(drafts).toEqual([
      { subject: 'Biology', weekday: 1, start: '08:30', end: '09:15', folderId: 'f-bio', room: undefined },
      { subject: 'Maths', weekday: 2, start: '09:20', end: '10:05', folderId: undefined, room: 'Room 11' },
    ]);
  });

  it('leaves out repeats and lessons already in the timetable', () => {
    const existing = [{ id: 'x', subject: 'Maths', weekday: 2, start: '09:20', end: '10:05' } as TimetableLesson];
    const lesson = { subject: 'Maths', weekday: 2, start: '09:20', end: '10:05' };
    const other = { subject: 'Maths', weekday: 3, start: '09:20', end: '10:05' };
    expect(toLessonDrafts({ lessons: [lesson, other, other] }, folders, existing).map(d => d.weekday)).toEqual([3]);
  });

  it('returns nothing for an answer that is not a timetable', () => {
    expect(toLessonDrafts(null, folders)).toEqual([]);
    expect(toLessonDrafts({ lessons: 'none' }, folders)).toEqual([]);
  });
});
