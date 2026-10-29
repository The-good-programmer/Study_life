import type { PlannerItemKind, SubjectFolder } from '../types';
import { AIService } from './aiService';
import { PLANNER_EXTRACTION_SCHEMA } from './aiSchemas';
import { dayKey, isDayKey, isTimeOfDay, type PlannerDraft } from './plannerService';

/** Syllabus text sent to the AI; a syllabus is a few pages, and this keeps well under the service's cap. */
const MAX_SYLLABUS_CHARS = 60_000;

export type SyllabusSource = { text: string } | { image: { mimeType: string; data: string } };

/** An item read from a syllabus, for the student to check before it is added. */
export interface SyllabusItem extends PlannerDraft {
  /** The subject as the syllabus names it, when it matches none of the student's subjects. */
  subjectName?: string;
}

interface RawItem {
  kind?: unknown;
  title?: unknown;
  date?: unknown;
  time?: unknown;
  subject?: unknown;
  topics?: unknown;
}

const KINDS: PlannerItemKind[] = ['exam', 'homework', 'other'];

/** The student's subject a syllabus subject name refers to, by name. */
export const matchSubject = (name: string, folders: SubjectFolder[]): SubjectFolder | undefined => {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return undefined;
  return (
    folders.find(f => f.name.trim().toLowerCase() === wanted) ??
    folders.find(f => {
      const have = f.name.trim().toLowerCase();
      return have.length >= 3 && (wanted.includes(have) || have.includes(wanted));
    })
  );
};

/**
 * Turns the AI's answer into drafts: drops anything without a real date or a title, and
 * links each one to a subject. A whole syllabus is usually for one course, so `folderId`
 * (the subject the student picked) applies to items that name no subject of their own.
 */
export function toSyllabusItems(raw: unknown, folders: SubjectFolder[], folderId?: string): SyllabusItem[] {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items) ? (raw as { items: RawItem[] }).items : [];
  const items: SyllabusItem[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    if (!title || !isDayKey(entry.date)) continue;
    const kind = KINDS.includes(entry.kind as PlannerItemKind) ? (entry.kind as PlannerItemKind) : 'other';
    const subject = typeof entry.subject === 'string' ? entry.subject.trim() : '';
    const matched = subject ? matchSubject(subject, folders) : undefined;
    const topics = Array.isArray(entry.topics) ? entry.topics.filter((t): t is string => typeof t === 'string' && t.trim() !== '') : [];
    items.push({
      kind,
      title,
      date: entry.date,
      time: isTimeOfDay(entry.time) ? entry.time : undefined,
      folderId: matched?.id ?? folderId,
      subjectName: !matched && subject && !folderId ? subject : undefined,
      topics: topics.length > 0 ? topics : undefined,
      source: 'syllabus',
    });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

const buildPrompt = (today: string, subjectHint?: string) => `You read a course syllabus, schedule or assignment sheet for a student and list every dated deadline in it.

Today is ${today}. Use it to resolve dates given without a year (pick the next time that date comes round) and weekday names tied to a stated week.
${subjectHint ? `The student says this is for: ${subjectHint}.\n` : ''}
Rules:
- One item per exam, test, quiz, assignment, project, lab report, presentation or other dated deadline.
- Only dates the material states or that follow from it exactly. If an item has no date, leave it out. Never guess.
- kind: "exam" for exams, tests and quizzes; "homework" for anything handed in; "other" for anything else dated.
- title: short and specific, as the material names it.
- topics: what it covers, if the material says (chapters, units, topics).
- If nothing in the material is dated, return an empty list.`;

/** Reads the exams and deadlines in a syllabus. Throws when the AI can't be reached. */
export async function readSyllabus(
  source: SyllabusSource,
  { folders, folderId, now = new Date() }: { folders: SubjectFolder[]; folderId?: string; now?: Date },
): Promise<SyllabusItem[]> {
  const subjectHint = folderId ? folders.find(f => f.id === folderId)?.name : undefined;
  const prompt = buildPrompt(dayKey(now), subjectHint);
  const contents =
    'text' in source
      ? `${prompt}\n\nMATERIAL:\n${source.text.slice(0, MAX_SYLLABUS_CHARS)}`
      : [{ role: 'user', parts: [{ text: `${prompt}\n\nThe material is in the attached photo.` }, { inlineData: source.image }] }];

  const text = await AIService.generateText(contents, undefined, false, PLANNER_EXTRACTION_SCHEMA);
  const parsed = AIService.safeParseJSON<unknown>(text, null);
  if (parsed === null) throw new Error('The AI sent back something unreadable. Try again.');
  return toSyllabusItems(parsed, folders, folderId);
}
