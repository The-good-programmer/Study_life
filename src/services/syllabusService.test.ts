import { describe, it, expect } from 'vitest';
import type { SubjectFolder } from '../types';
import { matchSubject, toSyllabusItems } from './syllabusService';

const folders: SubjectFolder[] = [
  { id: 'bio', name: 'AP Biology', createdAt: '' },
  { id: 'calc', name: 'Calculus II', createdAt: '' },
];

describe('matchSubject', () => {
  it('matches by name, ignoring case, or when one name contains the other', () => {
    expect(matchSubject('ap biology', folders)?.id).toBe('bio');
    expect(matchSubject('Calculus II (MATH 152)', folders)?.id).toBe('calc');
    expect(matchSubject('History', folders)).toBeUndefined();
  });
});

describe('toSyllabusItems', () => {
  it('keeps dated items, sorts them and links subjects', () => {
    const items = toSyllabusItems(
      {
        items: [
          { kind: 'homework', title: 'Problem set 4', date: '2026-11-12', time: '23:59', subject: 'Calculus II' },
          { kind: 'exam', title: 'Midterm', date: '2026-11-05', topics: ['Ch. 1-4', ''], subject: 'Chemistry' },
          { kind: 'exam', title: 'Final', date: 'TBA' },
          { kind: 'quiz', title: 'Quiz 2', date: '2026-11-07', time: 'noon' },
          { title: '  ', date: '2026-11-08' },
        ],
      },
      folders,
    );
    expect(items).toEqual([
      { kind: 'exam', title: 'Midterm', date: '2026-11-05', time: undefined, folderId: undefined, subjectName: 'Chemistry', topics: ['Ch. 1-4'], source: 'syllabus' },
      { kind: 'other', title: 'Quiz 2', date: '2026-11-07', time: undefined, folderId: undefined, subjectName: undefined, topics: undefined, source: 'syllabus' },
      { kind: 'homework', title: 'Problem set 4', date: '2026-11-12', time: '23:59', folderId: 'calc', subjectName: undefined, topics: undefined, source: 'syllabus' },
    ]);
  });

  it('puts unmatched items in the subject the student picked', () => {
    const [item] = toSyllabusItems({ items: [{ kind: 'exam', title: 'Final', date: '2026-12-10', subject: 'BIO 101' }] }, folders, 'bio');
    expect(item.folderId).toBe('bio');
    expect(item.subjectName).toBeUndefined();
  });

  it('copes with an answer that is not the expected shape', () => {
    expect(toSyllabusItems(null, folders)).toEqual([]);
    expect(toSyllabusItems({ items: 'none' }, folders)).toEqual([]);
  });
});
