import type { FocusLogEntry, FocusTask, PlannerItem } from '../types';
import { StorageService } from './storageService';
import { PlannerService, dayKey, daysBetween, type DayPlan } from './plannerService';
import {
  choosePhase,
  cleanSettings,
  cleanTimerState,
  finish,
  isDue,
  pause,
  reset,
  skip,
  start,
  type FocusPhase,
  type FocusSettings,
  type TimerState,
} from './focusTimer';

/**
 * The Focus workspace: a Pomodoro timer, the tasks worked on and a notes pad.
 *
 * The timer and its settings belong to the device (one timer, whichever profile is signed
 * in). Tasks, notes and the log of finished sessions belong to the profile, like decks.
 */

const SETTINGS_KEY = 'studify_focus_settings_v1';
const TIMER_KEY = 'studify_focus_timer_v1';

/**
 * A phase noticed this long after it ended (a closed laptop, a page reopened hours later)
 * doesn't start the next phase on its own, and doesn't chime.
 */
export const LATE_AFTER_MS = 60_000;
/** Finished sessions older than this are dropped from the log. */
export const LOG_RETENTION_DAYS = 120;
export const MAX_TASKS = 200;
export const MAX_TASK_TITLE = 120;
export const MAX_NOTES_LENGTH = 20_000;
/** Planner homework offered as tasks. */
export const MAX_SUGGESTIONS = 5;

export interface FocusCompletion {
  finished: FocusPhase;
  next: TimerState;
  /** Noticed well after it ended: say so quietly instead of chiming. */
  late: boolean;
  /** Set when a focus session finished. */
  entry?: FocusLogEntry;
}

export interface FocusSummary {
  todayMinutes: number;
  todaySessions: number;
  /** Today and the six days before it. */
  weekMinutes: number;
  weekSessions: number;
}

const listeners = new Set<() => void>();
const notify = () =>
  listeners.forEach(fn => {
    try {
      fn();
    } catch {
      // A broken listener mustn't stop the others.
    }
  });

const readJson = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the timer still works for this page.
  }
};

const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const cleanTaskTitle = (title: string): string => title.replace(/\s+/g, ' ').trim().slice(0, MAX_TASK_TITLE);

/** Focus time today and over the last seven days. */
export function summarize(log: readonly FocusLogEntry[], now: Date = new Date()): FocusSummary {
  const today = dayKey(now);
  const summary: FocusSummary = { todayMinutes: 0, todaySessions: 0, weekMinutes: 0, weekSessions: 0 };
  for (const entry of log) {
    const daysAgo = daysBetween(entry.day, today);
    if (daysAgo < 0 || daysAgo > 6) continue;
    summary.weekMinutes += entry.minutes;
    summary.weekSessions += 1;
    if (daysAgo === 0) {
      summary.todayMinutes += entry.minutes;
      summary.todaySessions += 1;
    }
  }
  return summary;
}

/** Overdue and upcoming homework from the planner that isn't a task yet, most urgent first. */
export function plannerSuggestions(plan: Pick<DayPlan, 'overdue' | 'dueSoon'>, tasks: readonly FocusTask[]): PlannerItem[] {
  const linked = new Set(tasks.map(task => task.plannerItemId).filter(Boolean));
  return [...plan.overdue, ...plan.dueSoon].filter(item => !linked.has(item.id)).slice(0, MAX_SUGGESTIONS);
}

const getSettings = (): FocusSettings => cleanSettings(readJson(SETTINGS_KEY));
const getTimer = (): TimerState => cleanTimerState(readJson(TIMER_KEY), getSettings());
const setTimer = (timer: TimerState): TimerState => {
  writeJson(TIMER_KEY, timer);
  notify();
  return timer;
};

/** The open task the timer is set to, if any. */
const currentTask = (): FocusTask | undefined => {
  const { taskId } = getTimer();
  return taskId ? StorageService.getFocusTasks().find(t => t.id === taskId && !t.done) : undefined;
};

const saveTasks = (tasks: FocusTask[]) => {
  StorageService.saveFocusTasks(tasks);
  notify();
};

/** Saves a finished focus session and counts it for its task. */
const recordFocus = (timer: TimerState, endedAtMs: number): FocusLogEntry => {
  const ended = new Date(endedAtMs);
  const tasks = StorageService.getFocusTasks();
  const task = timer.taskId ? tasks.find(t => t.id === timer.taskId) : undefined;
  const entry: FocusLogEntry = {
    id: newId('focus'),
    day: dayKey(ended),
    endedAt: ended.toISOString(),
    minutes: Math.max(1, Math.round(timer.durationMs / 60_000)),
    ...(task ? { taskId: task.id, taskTitle: task.title } : {}),
  };
  const today = dayKey(ended);
  const kept = StorageService.getFocusLog().filter(e => daysBetween(e.day, today) <= LOG_RETENTION_DAYS);
  StorageService.saveFocusLog([...kept, entry]);
  if (task) StorageService.saveFocusTasks(tasks.map(t => (t.id === task.id ? { ...t, pomodoros: t.pomodoros + 1 } : t)));
  return entry;
};

/** Marks the planner item a task came from done or not done; a deleted item is left alone. */
const syncPlannerItem = (plannerItemId: string | undefined, done: boolean) => {
  if (!plannerItemId) return;
  try {
    const item = PlannerService.getItems().find(i => i.id === plannerItemId);
    if (item && Boolean(item.done) !== done) PlannerService.update(plannerItemId, { done });
  } catch {
    // The planner item couldn't be saved; the task still is.
  }
};

export const FocusService = {
  getSettings,

  saveSettings(changes: Partial<FocusSettings>): FocusSettings {
    const settings = cleanSettings({ ...getSettings(), ...changes });
    writeJson(SETTINGS_KEY, settings);
    // A timer waiting to start takes the new length at once; one already going keeps its own.
    const timer = getTimer();
    if (timer.status === 'idle') writeJson(TIMER_KEY, reset(timer, settings));
    notify();
    return settings;
  },

  getTimer,

  start(now: number = Date.now()): TimerState {
    return setTimer(start(getTimer(), now));
  },

  pause(now: number = Date.now()): TimerState {
    return setTimer(pause(getTimer(), now));
  },

  /** Start, pause or resume, whichever fits. */
  toggle(now: number = Date.now()): TimerState {
    const timer = getTimer();
    return setTimer(timer.status === 'running' ? pause(timer, now) : start(timer, now));
  },

  reset(): TimerState {
    return setTimer(reset(getTimer(), getSettings()));
  },

  skip(): TimerState {
    return setTimer(skip(getTimer(), getSettings()));
  },

  choosePhase(phase: FocusPhase): TimerState {
    return setTimer(choosePhase(getTimer(), phase, getSettings()));
  },

  setTimerTask(taskId: string | null): TimerState {
    return setTimer({ ...getTimer(), taskId });
  },

  /**
   * Finishes the phase if its time is up. Reads the timer afresh each time, so when two tabs
   * notice the same ending, only the first one records it.
   */
  tick(now: number = Date.now()): FocusCompletion | null {
    const timer = getTimer();
    if (!isDue(timer, now) || timer.endsAt === null) return null;
    const late = now - timer.endsAt > LATE_AFTER_MS;
    const next = finish(timer, getSettings(), now, !late);
    writeJson(TIMER_KEY, next);
    const entry = timer.phase === 'focus' ? recordFocus(timer, timer.endsAt) : undefined;
    notify();
    return { finished: timer.phase, next, late, entry };
  },

  getTasks(): FocusTask[] {
    return StorageService.getFocusTasks();
  },

  currentTask,

  /** Adds a task. With nothing to work on yet, it becomes the timer's task. */
  addTask(title: string, plannerItemId?: string): FocusTask | null {
    const clean = cleanTaskTitle(title);
    if (!clean) return null;
    const tasks = StorageService.getFocusTasks();
    const existing = plannerItemId ? tasks.find(t => t.plannerItemId === plannerItemId) : undefined;
    if (existing) return existing;
    if (tasks.length >= MAX_TASKS) return null;
    const task: FocusTask = {
      id: newId('task'),
      title: clean,
      done: false,
      pomodoros: 0,
      ...(plannerItemId ? { plannerItemId } : {}),
      createdAt: new Date().toISOString(),
    };
    StorageService.saveFocusTasks([...tasks, task]);
    if (!currentTask()) writeJson(TIMER_KEY, { ...getTimer(), taskId: task.id });
    notify();
    return task;
  },

  updateTask(id: string, changes: { title?: string; done?: boolean }): FocusTask | null {
    const tasks = StorageService.getFocusTasks();
    const current = tasks.find(t => t.id === id);
    if (!current) return null;
    const title = changes.title !== undefined ? cleanTaskTitle(changes.title) || current.title : current.title;
    const done = changes.done ?? current.done;
    const updated: FocusTask = { ...current, title, done };
    if (done && !current.done) updated.doneAt = new Date().toISOString();
    if (!done) delete updated.doneAt;
    saveTasks(tasks.map(t => (t.id === id ? updated : t)));
    if (done !== current.done) syncPlannerItem(current.plannerItemId, done);
    if (done && getTimer().taskId === id) setTimer({ ...getTimer(), taskId: null });
    return updated;
  },

  removeTask(id: string): void {
    saveTasks(StorageService.getFocusTasks().filter(t => t.id !== id));
    if (getTimer().taskId === id) setTimer({ ...getTimer(), taskId: null });
  },

  clearDone(): void {
    saveTasks(StorageService.getFocusTasks().filter(t => !t.done));
  },

  /** Homework from the planner that could be added as tasks. */
  suggestions(now: Date = new Date()): PlannerItem[] {
    return plannerSuggestions(PlannerService.today(now), StorageService.getFocusTasks());
  },

  getNotes(): string {
    return StorageService.getFocusNotes();
  },

  /** Saves the notes. Listeners aren't told: only the notes pad shows them. */
  saveNotes(notes: string): void {
    StorageService.saveFocusNotes(notes.slice(0, MAX_NOTES_LENGTH));
  },

  getLog(): FocusLogEntry[] {
    return StorageService.getFocusLog();
  },

  summary(now: Date = new Date()): FocusSummary {
    return summarize(StorageService.getFocusLog(), now);
  },

  /**
   * Calls back when the timer, settings or tasks change, here or in another tab, and on any
   * change to study data (a sign-in switches profiles; the planner feeds the suggestions).
   */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    const unsubStorage = StorageService.addMutationListener(listener);
    const onOtherTab = (e: StorageEvent) => {
      if (e.key === null || e.key.startsWith('studify_focus_')) listener();
    };
    if (typeof window !== 'undefined') window.addEventListener('storage', onOtherTab);
    return () => {
      listeners.delete(listener);
      unsubStorage();
      if (typeof window !== 'undefined') window.removeEventListener('storage', onOtherTab);
    };
  },
};

/** What to tell the student when a phase ends, in a notification or on screen. */
export function completionMessage(completion: FocusCompletion, settings: FocusSettings): { title: string; body: string } {
  const { finished, next, late } = completion;
  const minutes = Math.round(next.durationMs / 60_000);
  if (finished === 'focus') {
    const title = late ? 'A focus session finished while you were away' : 'Focus session done';
    const kind = next.phase === 'long-break' ? 'long break' : 'break';
    const body = next.status === 'running' ? `Your ${minutes}-minute ${kind} has started.` : `Time for a ${minutes}-minute ${kind}.`;
    return { title, body };
  }
  const title = late ? 'Your break ended while you were away' : "Break's over";
  const body =
    next.status === 'running'
      ? `Your next ${settings.focusMinutes}-minute focus session has started.`
      : 'Ready for the next focus session? Press Start when you are.';
  return { title, body };
}
