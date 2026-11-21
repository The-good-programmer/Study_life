import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FocusLogEntry, FocusTask, PlannerItem } from '../types';
import { FocusService, LATE_AFTER_MS, completionMessage, plannerSuggestions, summarize } from './focusService';
import { PlannerService, dayKey } from './plannerService';
import { StorageService } from './storageService';

const MIN = 60_000;
const NOW = new Date(2026, 10, 21, 10, 0);
const T0 = NOW.getTime();

beforeEach(() => {
  localStorage.clear();
  StorageService.setActiveUserId(null);
});

afterEach(() => {
  vi.useRealTimers();
  StorageService.setActiveUserId(null);
});

describe('finishing a focus session', () => {
  it('logs it for its task and moves on to a break', () => {
    const task = FocusService.addTask('Read chapter 4')!;
    expect(FocusService.getTimer().taskId).toBe(task.id);

    FocusService.start(T0);
    expect(FocusService.tick(T0 + 24 * MIN)).toBeNull();

    const done = FocusService.tick(T0 + 25 * MIN + 500)!;
    expect(done.finished).toBe('focus');
    expect(done.late).toBe(false);
    expect(done.entry).toMatchObject({ minutes: 25, taskId: task.id, taskTitle: 'Read chapter 4', day: dayKey(NOW) });
    expect(FocusService.getTimer()).toMatchObject({ phase: 'short-break', status: 'running', completedInCycle: 1 });
    expect(FocusService.getTasks()[0].pomodoros).toBe(1);
    expect(FocusService.summary(NOW)).toMatchObject({ todayMinutes: 25, todaySessions: 1 });
  });

  it('records an ending only once, however many times it is noticed', () => {
    FocusService.start(T0);
    expect(FocusService.tick(T0 + 25 * MIN)).not.toBeNull();
    expect(FocusService.tick(T0 + 25 * MIN + 10)).toBeNull();
    expect(FocusService.getLog()).toHaveLength(1);
  });

  it("doesn't start the next phase when the ending is noticed long after", () => {
    FocusService.start(T0);
    const done = FocusService.tick(T0 + 25 * MIN + LATE_AFTER_MS + 1)!;
    expect(done.late).toBe(true);
    expect(done.next.status).toBe('idle');
    // The session itself still counts, at the time it ended.
    expect(FocusService.getLog()[0].endedAt).toBe(new Date(T0 + 25 * MIN).toISOString());
  });

  it("doesn't log breaks", () => {
    FocusService.choosePhase('short-break');
    FocusService.start(T0);
    expect(FocusService.tick(T0 + 5 * MIN)?.finished).toBe('short-break');
    expect(FocusService.getLog()).toHaveLength(0);
  });
});

describe('settings', () => {
  it('gives a waiting timer the new length, but leaves a running one alone', () => {
    FocusService.saveSettings({ focusMinutes: 50 });
    expect(FocusService.getTimer().durationMs).toBe(50 * MIN);
    FocusService.start(T0);
    FocusService.saveSettings({ focusMinutes: 10 });
    expect(FocusService.getTimer().endsAt).toBe(T0 + 50 * MIN);
  });
});

describe('tasks', () => {
  it('ignores empty titles, and adds a planner item only once', () => {
    expect(FocusService.addTask('   ')).toBeNull();
    const a = FocusService.addTask('Essay', 'plan-1')!;
    const b = FocusService.addTask('Essay again', 'plan-1')!;
    expect(b.id).toBe(a.id);
    expect(FocusService.getTasks()).toHaveLength(1);
  });

  it('marks the planner homework done along with its task', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const homework = PlannerService.add({ kind: 'homework', title: 'Maths sheet', date: dayKey(NOW) });
    const task = FocusService.addTask(homework.title, homework.id)!;
    FocusService.updateTask(task.id, { done: true });
    expect(PlannerService.getItems()[0].done).toBe(true);
    FocusService.updateTask(task.id, { done: false });
    expect(PlannerService.getItems()[0].done).toBe(false);
  });

  it('lets go of the timer task when it is done or deleted', () => {
    const a = FocusService.addTask('A')!;
    FocusService.updateTask(a.id, { done: true });
    expect(FocusService.getTimer().taskId).toBeNull();

    const b = FocusService.addTask('B')!;
    expect(FocusService.getTimer().taskId).toBe(b.id);
    FocusService.removeTask(b.id);
    expect(FocusService.getTimer().taskId).toBeNull();
  });

  it('keeps tasks and notes per profile, and brings a guest\'s along on sign-in', () => {
    FocusService.addTask('Guest task');
    FocusService.saveNotes('guest notes');

    StorageService.setActiveUserId('usr_a');
    expect(FocusService.getTasks()).toHaveLength(0);
    FocusService.saveNotes('account notes');
    StorageService.setActiveUserId(null);

    StorageService.migrateGuestDataToUser('usr_a');
    StorageService.setActiveUserId('usr_a');
    expect(FocusService.getTasks().map(t => t.title)).toEqual(['Guest task']);
    expect(FocusService.getNotes()).toBe('account notes\n\nguest notes');
  });

  it('tells listeners about changes, but not about each keystroke in the notes', () => {
    const listener = vi.fn();
    const unsubscribe = FocusService.subscribe(listener);
    FocusService.addTask('Something');
    expect(listener).toHaveBeenCalled();
    listener.mockClear();
    FocusService.saveNotes('typing');
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe('summarize', () => {
  const entry = (day: string, minutes: number): FocusLogEntry => ({ id: `${day}-${minutes}`, day, endedAt: '', minutes });
  const daysAgo = (n: number) => dayKey(new Date(2026, 10, 21 - n));

  it('adds up today and the last seven days', () => {
    const log = [entry(daysAgo(0), 25), entry(daysAgo(0), 25), entry(daysAgo(3), 50), entry(daysAgo(7), 25), entry(daysAgo(-1), 25)];
    expect(summarize(log, NOW)).toEqual({ todayMinutes: 50, todaySessions: 2, weekMinutes: 100, weekSessions: 3 });
  });
});

describe('plannerSuggestions', () => {
  const item = (id: string): PlannerItem => ({ id, kind: 'homework', title: id, date: '2026-11-21', createdAt: '', updatedAt: '' });
  const task = (plannerItemId?: string): FocusTask => ({ id: `t-${plannerItemId}`, title: 'x', done: true, pomodoros: 0, plannerItemId, createdAt: '' });

  it('offers overdue homework first, leaving out what is already a task', () => {
    const plan = { overdue: [item('late')], dueSoon: [item('a'), item('b')] };
    expect(plannerSuggestions(plan, [task('a')]).map(i => i.id)).toEqual(['late', 'b']);
  });
});

describe('completionMessage', () => {
  it('says what comes next', () => {
    FocusService.start(T0);
    const focusDone = FocusService.tick(T0 + 25 * MIN)!;
    expect(completionMessage(focusDone, FocusService.getSettings())).toEqual({
      title: 'Focus session done',
      body: 'Your 5-minute break has started.',
    });
    const breakDone = FocusService.tick(T0 + 30 * MIN)!;
    expect(completionMessage(breakDone, FocusService.getSettings()).title).toBe("Break's over");
  });
});
