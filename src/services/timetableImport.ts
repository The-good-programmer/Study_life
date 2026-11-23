import type { SubjectFolder, TimetableLesson } from '../types';
import { AIService } from './aiService';
import { TIMETABLE_EXTRACTION_SCHEMA } from './aiSchemas';
import { cleanLesson, sameSubject, type LessonDraft } from './timetableService';
import { matchSubject } from './syllabusService';

/** Timetable text sent to the AI: a timetable is short, so this is plenty. */
const MAX_TIMETABLE_CHARS = 20_000;

export type TimetableSource = { text: string } | { image: { mimeType: string; data: string } };

const PROMPT = `You read a student's weekly school or university timetable and list every lesson in it.

Rules:
- One item per lesson, lecture, lab, seminar or class, on each day it happens. A subject taught on three days is three items.
- weekday: 1 Monday, 2 Tuesday, 3 Wednesday, 4 Thursday, 5 Friday, 6 Saturday, 7 Sunday.
- start and end: 24-hour HH:MM. If only periods are given with their times listed elsewhere on the timetable, use those times. If a lesson has no time you can read, leave it out. Never guess.
- subject: as the timetable names it, without teacher names or codes in brackets.
- room: only if the timetable gives one.
- Leave out breaks, lunch, registration and free periods.
- If it isn't a timetable, return an empty list.`;

/**
 * Turns the AI's answer into lessons to check: drops anything that isn't a valid lesson, links each to the
 * student's subject of the same name, and leaves out exact repeats and lessons already in the timetable.
 */
export function toLessonDrafts(raw: unknown, folders: SubjectFolder[], existing: readonly TimetableLesson[] = []): LessonDraft[] {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as { lessons?: unknown }).lessons) ? (raw as { lessons: unknown[] }).lessons : [];
  const drafts: LessonDraft[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const subject = typeof e.subject === 'string' ? e.subject : '';
    const folder = matchSubject(subject, folders);
    const cleaned = cleanLesson({
      subject: folder?.name ?? subject,
      weekday: Number(e.weekday),
      start: typeof e.start === 'string' ? e.start.padStart(5, '0') : '',
      end: typeof e.end === 'string' ? e.end.padStart(5, '0') : '',
      room: typeof e.room === 'string' ? e.room : undefined,
      folderId: folder?.id,
    });
    if ('error' in cleaned) continue;
    const lesson = cleaned.lesson;
    const repeat = (other: LessonDraft) => other.weekday === lesson.weekday && other.start === lesson.start && sameSubject(other, lesson);
    if (drafts.some(repeat) || existing.some(repeat)) continue;
    drafts.push(lesson);
  }
  return drafts.sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
}

/** Reads the lessons in a timetable photo or text. Throws when the AI can't be reached. */
export async function readTimetable(source: TimetableSource, folders: SubjectFolder[], existing: readonly TimetableLesson[]): Promise<LessonDraft[]> {
  const contents =
    'text' in source
      ? `${PROMPT}\n\nTIMETABLE:\n${source.text.slice(0, MAX_TIMETABLE_CHARS)}`
      : [{ role: 'user', parts: [{ text: `${PROMPT}\n\nThe timetable is in the attached photo.` }, { inlineData: source.image }] }];
  const text = await AIService.generateText(contents, undefined, false, TIMETABLE_EXTRACTION_SCHEMA);
  const parsed = AIService.safeParseJSON<unknown>(text, null);
  if (parsed === null) throw new Error('The AI sent back something unreadable. Try again.');
  return toLessonDrafts(parsed, folders, existing);
}
