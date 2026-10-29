import { describe, it, expect } from 'vitest';
import type { PlannerItem } from '../types';
import { buildCalendar, escapeText, foldLine } from './calendarExport';

const NOW = new Date(Date.UTC(2026, 9, 29, 9, 30));

const item = (overrides: Partial<PlannerItem>): PlannerItem => ({
  id: 'plan-1',
  kind: 'exam',
  title: 'Biology midterm',
  date: '2026-11-08',
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
  ...overrides,
});

const unfold = (ics: string) => ics.replace(/\r\n /g, '');

describe('buildCalendar', () => {
  it('writes an all-day exam with its subject, topics and a reminder the day before', () => {
    const ics = unfold(
      buildCalendar([item({ folderId: 'bio', topics: ['Cells', 'Mitosis'] })], { folders: [{ id: 'bio', name: 'AP Biology', createdAt: '' }], now: NOW }),
    );
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('UID:plan-1@studify');
    expect(ics).toContain('DTSTAMP:20261029T093000Z');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261108');
    expect(ics).toContain('DTEND;VALUE=DATE:20261109');
    expect(ics).toContain('SUMMARY:Exam: Biology midterm');
    expect(ics).toContain('DESCRIPTION:Subject: AP Biology\\nCovers: Cells\\, Mitosis');
    expect(ics).toContain('TRIGGER:-PT15H');
  });

  it('gives timed items an hour, running past midnight when needed', () => {
    const ics = buildCalendar([item({ kind: 'homework', title: 'Essay', time: '23:30', date: '2026-12-31' })], { now: NOW });
    expect(ics).toContain('DTSTART:20261231T233000');
    expect(ics).toContain('DTEND:20270101T003000');
    expect(ics).toContain('SUMMARY:Due: Essay');
    expect(ics).not.toContain('VALARM');
  });

  it('drops the reminder once an exam is done', () => {
    expect(buildCalendar([item({ done: true })], { now: NOW })).not.toContain('VALARM');
  });

  it('uses CRLF line endings throughout', () => {
    const ics = buildCalendar([item({})], { now: NOW });
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });
});

describe('escapeText', () => {
  it('escapes the characters iCalendar reserves', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });
});

describe('foldLine', () => {
  it('folds at 75 octets without splitting a character', () => {
    const line = `SUMMARY:${'é'.repeat(60)}`;
    const folded = foldLine(line);
    const encoder = new TextEncoder();
    for (const part of folded.split('\r\n')) expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });

  it('leaves short lines alone', () => {
    expect(foldLine('SUMMARY:short')).toBe('SUMMARY:short');
  });
});
