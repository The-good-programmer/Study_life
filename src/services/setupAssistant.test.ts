import { beforeEach, describe, expect, it } from 'vitest';
import type { SubjectFolder } from '../types';
import { PlannerService } from './plannerService';
import { saveSetup, subjectsFrom, ensureSubjects, iconFor } from './setupAssistant';
import { StorageService } from './storageService';
import type { SyllabusItem } from './syllabusService';
import { TimetableService, type LessonDraft } from './timetableService';

const lesson = (subject: string, weekday: number, folderId?: string): LessonDraft => ({ subject, weekday, start: '09:00', end: '09:45', folderId });

describe('the set-up assistant', () => {
  beforeEach(() => localStorage.clear());

  it('lists each subject once, with its topics, busiest first', () => {
    const folders = [{ id: 'f-bio', name: 'Biology' }] as SubjectFolder[];
    const items: SyllabusItem[] = [
      { kind: 'exam', title: 'Unit test: cells', date: '2026-12-03', subjectName: 'chemistry' },
      { kind: 'exam', title: 'Cells and genes', date: '2026-12-10', folderId: 'f-bio', topics: ['Cells', 'DNA'] },
      { kind: 'exam', title: 'Mock', date: '2027-01-12', folderId: 'f-bio', topics: ['dna', 'Evolution'] },
      { kind: 'homework', title: 'Essay', date: '2026-12-01', subjectName: 'History' },
    ];
    const subjects = subjectsFrom([lesson('biology', 1, 'f-bio'), lesson('Maths', 1), lesson('maths', 3), lesson('Chemistry', 2)], items, folders);
    expect(subjects).toEqual([
      { name: 'Biology', folderId: 'f-bio', topics: ['Cells', 'DNA', 'Evolution'], lessons: 1, exams: 2 },
      { name: 'Chemistry', folderId: undefined, topics: ['Unit test: cells'], lessons: 1, exams: 1 },
      { name: 'Maths', folderId: undefined, topics: [], lessons: 2, exams: 0 },
      { name: 'History', folderId: undefined, topics: [], lessons: 0, exams: 0 },
    ]);
  });

  it('makes only the subjects the student does not have, each with an icon', () => {
    const bio = StorageService.createFolder('Biology');
    const ids = ensureSubjects([{ name: 'biology' }, { name: 'Chemistry' }]);
    expect(ids.get('biology')).toBe(bio.id);
    const chemistry = StorageService.getFolders().find(f => f.id === ids.get('chemistry'));
    expect(chemistry).toMatchObject({ name: 'Chemistry', icon: iconFor('Chemistry') });
    expect(StorageService.getFolders()).toHaveLength(2);
  });

  it('saves lessons and deadlines linked to their subjects', () => {
    const lessons = [lesson('Maths', 1), lesson('Maths', 3)];
    const items: SyllabusItem[] = [{ kind: 'exam', title: 'Maths mock', date: '2027-01-12', subjectName: 'Maths' }];
    const saved = saveSetup(lessons, items, subjectsFrom(lessons, items, []));
    expect(saved).toMatchObject({ lessons: 2, items: 1 });
    const maths = saved.folderIds.get('maths');
    expect(maths).toBeTruthy();
    expect(TimetableService.getLessons().map(l => l.folderId)).toEqual([maths, maths]);
    expect(PlannerService.getItems()).toEqual([expect.objectContaining({ title: 'Maths mock', folderId: maths })]);
    expect(PlannerService.getItems()[0]).not.toHaveProperty('subjectName');
  });

  it('picks an icon from the subject name', () => {
    expect(iconFor('AP Biology')).toBe('🧬');
    expect(iconFor('Further Maths')).toBe('📐');
    expect(iconFor('Underwater basket weaving')).toBe('📚');
  });
});
