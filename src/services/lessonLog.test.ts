import { beforeEach, describe, expect, it } from 'vitest';
import type { StudySession } from '../types';
import { StorageService } from './storageService';
import { PlannerService } from './plannerService';
import { TimetableService } from './timetableService';
import { addToClassNotes, canMakeLessonCards, classNotesDeckId, makeLessonCards, saveLessonLog } from './lessonLog';

const generated = (n: number): StudySession =>
  ({
    id: 's',
    title: 'x',
    category: 'x',
    description: '',
    currentConceptIndex: 0,
    currentPhase: 'priming',
    elapsedSeconds: 0,
    createdAt: '',
    concepts: [
      {
        id: 'c',
        order: 1,
        title: 'C',
        estimatedMinutes: 5,
        mentalModel: 'Solar panels',
        coreTakeaways: ['Light splits water'],
        keyTerms: [],
        feynmanPrompt: '',
        sampleMasteryExplanation: '',
        retrievalCards: Array.from({ length: n }, (_, i) => ({ id: `g${i}`, conceptId: 'c', question: `Q${i}?`, answer: `A${i}`, stability: 0, difficulty: 0, reps: 0, lapses: 0 })),
      },
    ],
  }) as StudySession;

describe('logging a lesson', () => {
  beforeEach(() => localStorage.clear());

  it("saves the topic, and homework due at the subject's next lesson", () => {
    // Biology on Monday and Wednesday; 2026-11-23 is a Monday.
    const monday = TimetableService.add({ subject: 'Biology', weekday: 1, start: '09:00', end: '09:45' });
    TimetableService.add({ subject: 'Biology', weekday: 3, start: '11:00', end: '11:45' });
    const log = saveLessonLog(monday, '2026-11-23', { topic: ' The Calvin cycle ', homework: 'Worksheet 4' });
    expect(log.topic).toBe('The Calvin cycle');
    const homework = PlannerService.getItems().find(item => item.id === log.homeworkItemId)!;
    expect(homework).toMatchObject({ kind: 'homework', title: 'Biology: Worksheet 4', date: '2026-11-25', topics: ['The Calvin cycle'] });
    // Logging it again updates the same log, and doesn't add the homework twice.
    saveLessonLog(monday, '2026-11-23', { topic: 'The Calvin cycle and RuBisCO', homework: 'Worksheet 4' });
    expect(TimetableService.getLogs()).toHaveLength(1);
    expect(PlannerService.getItems()).toHaveLength(1);
  });

  it("adds each lesson's cards to one class-notes deck per subject, a topic per lesson", () => {
    const lesson = { subject: 'Biology' };
    addToClassNotes(lesson, '2026-11-23', 'Light reactions', generated(3));
    const { deck, added } = addToClassNotes(lesson, '2026-11-25', 'Calvin cycle', generated(2));
    expect(added).toBe(2);
    expect(deck.id).toBe(classNotesDeckId(lesson));
    expect(deck.title).toBe('Biology: class notes');
    expect(deck.concepts.map(c => c.title)).toEqual(['Light reactions · 23 Nov', 'Calvin cycle · 25 Nov']);
    const ids = deck.concepts.flatMap(c => c.retrievalCards.map(card => card.id));
    expect(new Set(ids).size).toBe(5); // new ids, never the generator's
    expect(deck.concepts[1].retrievalCards.every(card => card.conceptId === deck.concepts[1].id)).toBe(true);
    expect(StorageService.getSessions().filter(s => s.id === deck.id)).toHaveLength(1);
  });

  it('only makes cards with AI (an account or a key), never a template deck', async () => {
    expect(canMakeLessonCards()).toBe(false);
    const lesson = TimetableService.add({ subject: 'Art', weekday: 1, start: '09:00', end: '09:45' });
    const log = saveLessonLog(lesson, '2026-11-23', { topic: 'Colour theory' });
    await expect(makeLessonCards(lesson, log)).rejects.toThrow(/Sign in/);
    expect(StorageService.getSessions()).toEqual([]);
  });
});
