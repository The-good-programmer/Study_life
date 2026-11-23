import type { StudentEducationProfile, StudySession, SubjectFolder } from '../types';
import { buildSession, type GenerationStage } from '../components/ingestion/deckGenerator';
import { AuthService } from './authService';
import { PlannerService } from './plannerService';
import { StorageService } from './storageService';
import { TimetableService, type LessonDraft } from './timetableService';
import type { SyllabusItem } from './syllabusService';

/**
 * The set-up assistant's work: from what the AI read (a timetable, a syllabus), the student's
 * subjects, lessons, exams and starter decks, each linked to its subject so exam plans and class
 * notes work at once. The student checks each step before anything is saved.
 */

const COLORS = ['indigo', 'emerald', 'amber', 'rose', 'cyan', 'purple', 'blue'];

const ICONS: [RegExp, string][] = [
  [/bio|life|anatom/i, '🧬'],
  [/chem/i, '🧪'],
  [/phys/i, '⚛️'],
  [/math|algebra|calculus|geometr|statist/i, '📐'],
  [/hist/i, '🏛️'],
  [/geog|earth/i, '🌍'],
  [/english|literat|writing|essay/i, '📝'],
  [/spanish|french|german|turkish|bulgarian|italian|chinese|japanese|arabic|latin|language/i, '💬'],
  [/comput|program|coding|\bcs\b|ict|informat/i, '💻'],
  [/art|design|music|drama/i, '🎨'],
  [/econ|business|account|finance/i, '📈'],
  [/medic|nurs|health|pharm/i, '🩺'],
  [/law|politic|civic/i, '⚖️'],
  [/psych|soci|philos/i, '🧠'],
];

/** A subject's icon, from its name. */
export const iconFor = (name: string): string => ICONS.find(([pattern]) => pattern.test(name))?.[1] ?? '📚';

const keyOf = (name: string) => name.trim().toLowerCase();

export interface SetupSubject {
  name: string;
  /** Its folder, if the student already has one. */
  folderId?: string;
  /** What the syllabus says it covers: exam titles and topics, to aim its starter deck. */
  topics: string[];
  lessons: number;
  exams: number;
}

/** The subjects named in the timetable and syllabus (one each, whatever the case), with their topics. */
export function subjectsFrom(lessons: readonly LessonDraft[], items: readonly SyllabusItem[], folders: readonly SubjectFolder[]): SetupSubject[] {
  const byKey = new Map<string, SetupSubject>();
  const folderName = (id?: string) => folders.find(f => f.id === id)?.name;
  const subjectOf = (name: string | undefined, folderId?: string) => {
    const shown = folderName(folderId) ?? name?.trim();
    if (!shown) return null;
    const key = keyOf(shown);
    if (!byKey.has(key)) byKey.set(key, { name: shown, folderId: folders.find(f => keyOf(f.name) === key)?.id, topics: [], lessons: 0, exams: 0 });
    return byKey.get(key)!;
  };
  for (const lesson of lessons) {
    const subject = subjectOf(lesson.subject, lesson.folderId);
    if (subject) subject.lessons++;
  }
  for (const item of items) {
    const subject = subjectOf(item.subjectName, item.folderId);
    if (!subject) continue;
    if (item.kind === 'exam') subject.exams++;
    // Its topics, or an exam's title when the syllabus lists none ("Unit 3 test: cells").
    const topics = item.topics?.length ? item.topics : item.kind === 'exam' ? [item.title] : [];
    for (const topic of topics) {
      if (!subject.topics.some(t => keyOf(t) === keyOf(topic))) subject.topics.push(topic);
    }
  }
  return [...byKey.values()].sort((a, b) => b.exams - a.exams || b.lessons - a.lessons || a.name.localeCompare(b.name));
}

/** Makes the folders the student doesn't have yet (each its own colour and icon); returns name → folder id. */
export function ensureSubjects(subjects: readonly Pick<SetupSubject, 'name' | 'folderId'>[]): Map<string, string> {
  const ids = new Map<string, string>();
  const existing = StorageService.getFolders();
  let colorIndex = existing.length;
  for (const subject of subjects) {
    const have = subject.folderId ?? existing.find(f => keyOf(f.name) === keyOf(subject.name))?.id;
    if (have) {
      ids.set(keyOf(subject.name), have);
      continue;
    }
    const folder = StorageService.createFolder(subject.name, COLORS[colorIndex++ % COLORS.length], iconFor(subject.name));
    ids.set(keyOf(subject.name), folder.id);
  }
  return ids;
}

/** Saves the checked lessons and deadlines, each linked to its subject. Returns how many of each. */
export function saveSetup(lessons: readonly LessonDraft[], items: readonly SyllabusItem[], subjects: readonly SetupSubject[]): { lessons: number; items: number; folderIds: Map<string, string> } {
  const folderIds = ensureSubjects(subjects);
  const folderFor = (name?: string, folderId?: string) => folderId ?? (name ? folderIds.get(keyOf(name)) : undefined);
  let added = 0;
  for (const lesson of lessons) {
    TimetableService.add({ ...lesson, folderId: folderFor(lesson.subject, lesson.folderId) });
    added++;
  }
  const planned = PlannerService.addMany(items.map(({ subjectName, ...item }) => ({ ...item, folderId: folderFor(subjectName, item.folderId) })));
  return { lessons: added, items: planned.length, folderIds };
}

const profileOf = (): StudentEducationProfile => {
  const user = AuthService.getCurrentUser();
  if (user) return { age: user.age, country: user.country, grade: user.grade };
  return StorageService.getGuestEducationProfile() ?? { age: 16, country: '', grade: '' };
};

/** Makes and saves a starter deck for a subject, aimed at what its syllabus covers. */
export async function makeStarterDeck(subject: SetupSubject, folderId: string | undefined, onStage?: (stage: GenerationStage) => void): Promise<StudySession> {
  const text = subject.topics.length > 0 ? `${subject.name}: ${subject.topics.slice(0, 8).join('; ')}` : subject.name;
  const session = await buildSession({ kind: 'topic', text, depthTier: 'foundational' }, profileOf(), onStage);
  const saved: StudySession = { ...session, folderId, category: session.category || subject.name };
  StorageService.saveSession(saved);
  return saved;
}

export { markSetupDone, shouldOfferSetup } from './setupOffer';
