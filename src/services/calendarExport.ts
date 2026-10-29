import type { PlannerItem, SubjectFolder } from '../types';
import { KIND_LABELS, dayKey, parseDayKey } from './plannerService';

/**
 * Builds an iCalendar (.ics) file from planner items, for Google Calendar, Apple Calendar and
 * Outlook. Items without a time are all-day events; timed ones last an hour, in the
 * calendar's own time zone (floating time), which is what a student typed in. Exams get a
 * reminder the day before (at 9:00 for an all-day exam).
 */

const PRODUCT_ID = '-//Studify//Planner//EN';

/** Escapes text for a property value (RFC 5545, 3.3.11). */
export const escapeText = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Splits a line into 75-octet pieces, continued with a space (RFC 5545, 3.1), without breaking a character. */
export const foldLine = (line: string): string => {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // Continuation lines start with a space, which counts towards their 75.
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
};

const compactDay = (key: string): string => key.replace(/-/g, '');

const utcStamp = (date: Date): string => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const nextDay = (key: string): string => {
  const date = parseDayKey(key);
  date.setDate(date.getDate() + 1);
  return dayKey(date);
};

/** The hour after HH:MM on a day, as a floating date-time; past midnight it runs into the next day. */
const hourLater = (key: string, time: string): string => {
  const [h, m] = time.split(':').map(Number);
  const date = parseDayKey(key);
  date.setHours(h + 1, m);
  return `${compactDay(dayKey(date))}T${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}00`;
};

const summaryOf = (item: PlannerItem): string =>
  item.kind === 'exam' ? `Exam: ${item.title}` : item.kind === 'homework' ? `Due: ${item.title}` : item.title;

export function buildCalendar(
  items: PlannerItem[],
  { folders = [], now = new Date(), name = 'Studify' }: { folders?: SubjectFolder[]; now?: Date; name?: string } = {},
): string {
  const subjects = new Map(folders.map(f => [f.id, f.name]));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODUCT_ID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
    // How often a subscribed calendar should check for changes (Apple, Outlook).
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ];

  for (const item of items) {
    const subject = item.folderId ? subjects.get(item.folderId) : undefined;
    const details = [
      subject ? `Subject: ${subject}` : '',
      item.topics?.length ? `Covers: ${item.topics.join(', ')}` : '',
      item.notes ?? '',
      item.done ? (item.kind === 'exam' ? 'Done.' : 'Handed in.') : '',
    ].filter(Boolean);

    lines.push(
      'BEGIN:VEVENT',
      `UID:${item.id}@studify`,
      `DTSTAMP:${utcStamp(now)}`,
      `LAST-MODIFIED:${utcStamp(new Date(item.updatedAt))}`,
    );
    if (item.time) {
      lines.push(`DTSTART:${compactDay(item.date)}T${item.time.replace(':', '')}00`, `DTEND:${hourLater(item.date, item.time)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compactDay(item.date)}`, `DTEND;VALUE=DATE:${compactDay(nextDay(item.date))}`);
    }
    lines.push(
      `SUMMARY:${escapeText(summaryOf(item))}`,
      `CATEGORIES:${escapeText(KIND_LABELS[item.kind])}`,
      'TRANSP:TRANSPARENT',
    );
    if (details.length > 0) lines.push(`DESCRIPTION:${escapeText(details.join('\n'))}`);
    if (item.kind === 'exam' && !item.done) {
      // An all-day event starts at midnight, so 15 hours before is 9:00 the day before.
      const trigger = item.time ? '-P1D' : '-PT15H';
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(`Tomorrow: ${item.title}`)}`, `TRIGGER:${trigger}`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
