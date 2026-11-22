import type { ConceptCheckpoint, LessonLog, RetrievalCard, StudentEducationProfile, StudySession, TimetableLesson } from '../types';
import { buildSession, type GenerationRequest, type GenerationStage } from '../components/ingestion/deckGenerator';
import { AuthService } from './authService';
import { AIService } from './aiService';
import { PlannerService } from './plannerService';
import { StorageService } from './storageService';
import { TimetableService, nextLessonDay } from './timetableService';

/**
 * After a lesson: what was covered and any homework, saved in seconds; then, if the student wants,
 * flashcards made from it, added to that subject's class-notes deck so they come up in tonight's review.
 */

export interface LessonEntry {
  topic: string;
  notes?: string;
  homework?: string;
  /** When the homework is due; defaults to the subject's next lesson. */
  homeworkDue?: string;
}

/** When homework set in this lesson is due by default: the next lesson of the subject, or a week later. */
export function defaultHomeworkDue(lessons: readonly TimetableLesson[], lesson: TimetableLesson, day: string): string {
  const next = nextLessonDay(lessons, lesson, day);
  if (next) return next;
  const [y, m, d] = day.split('-').map(Number);
  const week = new Date(y, m - 1, d + 7);
  return `${week.getFullYear()}-${String(week.getMonth() + 1).padStart(2, '0')}-${String(week.getDate()).padStart(2, '0')}`;
}

/** Saves what was covered (and the homework, into the planner). Quick and offline: no AI here. */
export function saveLessonLog(lesson: TimetableLesson, day: string, entry: LessonEntry): LessonLog {
  const topic = entry.topic.trim().slice(0, 120);
  if (!topic) throw new Error('What did you cover?');
  const existing = TimetableService.logFor(lesson.id, day);
  let homeworkItemId = existing?.homeworkItemId;
  const homework = entry.homework?.trim();
  if (homework && !homeworkItemId) {
    const item = PlannerService.add({
      kind: 'homework',
      title: `${lesson.subject}: ${homework}`,
      date: entry.homeworkDue || defaultHomeworkDue(TimetableService.getLessons(), lesson, day),
      folderId: lesson.folderId,
      topics: [topic],
    });
    homeworkItemId = item.id;
  }
  return TimetableService.saveLog({
    lessonId: lesson.id,
    date: day,
    subject: lesson.subject,
    folderId: lesson.folderId,
    topic,
    notes: entry.notes?.trim().slice(0, 4000) || undefined,
    homeworkItemId,
    deckId: existing?.deckId,
    cardCount: existing?.cardCount,
  });
}

/** Whether cards can be made: the AI needs an account or the student's own key. */
export const canMakeLessonCards = (): boolean => !AIService.needsSignIn();

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'subject';

/** The subject's class-notes deck: one per subject, one topic per lesson. */
export function classNotesDeckId(lesson: Pick<TimetableLesson, 'folderId' | 'subject'>): string {
  return `class-notes-${lesson.folderId ? slug(lesson.folderId) : slug(lesson.subject)}`;
}

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const shortDate = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d));
};

const profileOf = (): StudentEducationProfile => {
  const user = AuthService.getCurrentUser();
  if (user) return { age: user.age, country: user.country, grade: user.grade };
  return StorageService.getGuestEducationProfile() ?? { age: 16, country: '', grade: '' };
};

/** Adds a lesson's cards to its subject's class-notes deck (made the first time), as one topic. */
export function addToClassNotes(lesson: Pick<TimetableLesson, 'folderId' | 'subject'>, day: string, topic: string, generated: StudySession): { deck: StudySession; added: number } {
  const cards = generated.concepts.flatMap(concept => concept.retrievalCards);
  if (cards.length === 0) throw new Error('No cards came back. Try adding a little more detail.');
  const id = classNotesDeckId(lesson);
  const existing = StorageService.getSessions().find(session => session.id === id);
  const deck: StudySession = existing ?? {
    id,
    title: `${lesson.subject}: class notes`,
    category: lesson.subject,
    folderId: lesson.folderId,
    description: `Flashcards from your ${lesson.subject} lessons, one topic per lesson.`,
    concepts: [],
    currentConceptIndex: 0,
    currentPhase: 'retrieval',
    elapsedSeconds: 0,
    createdAt: new Date().toISOString(),
    casualFlashcardMode: true,
  };
  const conceptId = uid('lesson');
  const first = generated.concepts[0];
  const concept: ConceptCheckpoint = {
    id: conceptId,
    order: deck.concepts.length + 1,
    title: `${topic} · ${shortDate(day)}`,
    estimatedMinutes: generated.concepts.reduce((sum, c) => sum + (c.estimatedMinutes || 5), 0),
    mentalModel: first?.mentalModel ?? '',
    coreTakeaways: generated.concepts.flatMap(c => c.coreTakeaways ?? []).slice(0, 6),
    keyTerms: generated.concepts.flatMap(c => c.keyTerms ?? []).slice(0, 8),
    feynmanPrompt: first?.feynmanPrompt ?? '',
    sampleMasteryExplanation: first?.sampleMasteryExplanation ?? '',
    retrievalCards: cards.map((card): RetrievalCard => ({ ...card, id: uid('rc'), conceptId })),
  };
  const updated: StudySession = { ...deck, concepts: [...deck.concepts, concept] };
  StorageService.saveSession(updated);
  StorageService.saveCards(concept.retrievalCards);
  return { deck: updated, added: concept.retrievalCards.length };
}

/** Makes flashcards from a logged lesson and adds them to the subject's class notes. */
export async function makeLessonCards(
  lesson: TimetableLesson,
  log: LessonLog,
  onStage?: (stage: GenerationStage) => void,
): Promise<{ deck: StudySession; added: number }> {
  if (!canMakeLessonCards()) throw new Error('Sign in (free) to turn lessons into flashcards.');
  const request: GenerationRequest = log.notes
    ? { kind: 'notes', text: `Lesson: ${lesson.subject}\nTopic: ${log.topic}\n\n${log.notes}` }
    : { kind: 'topic', text: `${log.topic} (${lesson.subject})`, depthTier: 'foundational' };
  const generated = await buildSession(request, profileOf(), onStage);
  const result = addToClassNotes(lesson, log.date, log.topic, generated);
  TimetableService.saveLog({ ...log, deckId: result.deck.id, cardCount: (log.cardCount ?? 0) + result.added });
  return result;
}
