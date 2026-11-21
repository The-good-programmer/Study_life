/**
 * Pomodoro timer rules for the Focus workspace. Pure functions only: given a state and a
 * time, say what the next state is. The timer stores when a phase ends rather than counting
 * down, so it stays right across reloads, background tabs and other pages.
 */

export type FocusPhase = 'focus' | 'short-break' | 'long-break';

export interface FocusSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  /** A long break comes after this many focus sessions. */
  longBreakEvery: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  /** Play a chime when a phase ends. */
  chime: boolean;
  /** Show a system notification when a phase ends. */
  notify: boolean;
  /** Keep the screen from going to sleep while the timer runs (phones and tablets). */
  keepAwake: boolean;
}

export const DEFAULT_FOCUS_SETTINGS: FocusSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
  chime: true,
  notify: false,
  keepAwake: true,
};

type NumericSetting = 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'longBreakEvery';

/** Allowed range of each number setting, inclusive. */
export const SETTING_LIMITS: Record<NumericSetting, readonly [number, number]> = {
  focusMinutes: [1, 120],
  shortBreakMinutes: [1, 30],
  longBreakMinutes: [1, 60],
  longBreakEvery: [2, 8],
};

const clampInt = (value: unknown, [min, max]: readonly [number, number], fallback: number): number => {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
};

/** Settings as saved, with anything missing or out of range replaced. */
export function cleanSettings(raw: unknown): FocusSettings {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const bool = (key: keyof FocusSettings) =>
    typeof source[key] === 'boolean' ? (source[key] as boolean) : (DEFAULT_FOCUS_SETTINGS[key] as boolean);
  const num = (key: NumericSetting) => clampInt(source[key], SETTING_LIMITS[key], DEFAULT_FOCUS_SETTINGS[key]);
  return {
    focusMinutes: num('focusMinutes'),
    shortBreakMinutes: num('shortBreakMinutes'),
    longBreakMinutes: num('longBreakMinutes'),
    longBreakEvery: num('longBreakEvery'),
    autoStartBreaks: bool('autoStartBreaks'),
    autoStartFocus: bool('autoStartFocus'),
    chime: bool('chime'),
    notify: bool('notify'),
    keepAwake: bool('keepAwake'),
  };
}

export interface TimerState {
  phase: FocusPhase;
  status: 'idle' | 'running' | 'paused';
  /** Epoch ms the phase ends, while running. */
  endsAt: number | null;
  /** Ms left, while paused. */
  remainingMs: number | null;
  /** Length of the current phase, fixed when it was set up. */
  durationMs: number;
  /** Focus sessions finished since the last long break. */
  completedInCycle: number;
  /** The task this focus session is for. */
  taskId: string | null;
}

export const PHASES: readonly FocusPhase[] = ['focus', 'short-break', 'long-break'];

export const phaseMs = (phase: FocusPhase, settings: FocusSettings): number =>
  (phase === 'focus' ? settings.focusMinutes : phase === 'short-break' ? settings.shortBreakMinutes : settings.longBreakMinutes) * 60_000;

/** A phase set up and waiting for Start. */
export const idleState = (
  phase: FocusPhase,
  settings: FocusSettings,
  completedInCycle = 0,
  taskId: string | null = null,
): TimerState => ({
  phase,
  status: 'idle',
  endsAt: null,
  remainingMs: null,
  durationMs: phaseMs(phase, settings),
  completedInCycle,
  taskId,
});

/** A saved timer, or a fresh one when it is missing or damaged. */
export function cleanTimerState(raw: unknown, settings: FocusSettings): TimerState {
  if (!raw || typeof raw !== 'object') return idleState('focus', settings);
  const s = raw as Partial<TimerState>;
  const phase = PHASES.includes(s.phase as FocusPhase) ? (s.phase as FocusPhase) : 'focus';
  const completedInCycle = clampInt(s.completedInCycle, [0, SETTING_LIMITS.longBreakEvery[1]], 0);
  const taskId = typeof s.taskId === 'string' ? s.taskId : null;
  const durationMs = typeof s.durationMs === 'number' && s.durationMs > 0 ? s.durationMs : phaseMs(phase, settings);
  if (s.status === 'running' && typeof s.endsAt === 'number' && Number.isFinite(s.endsAt)) {
    return { phase, status: 'running', endsAt: s.endsAt, remainingMs: null, durationMs, completedInCycle, taskId };
  }
  if (s.status === 'paused' && typeof s.remainingMs === 'number' && s.remainingMs > 0) {
    return { phase, status: 'paused', endsAt: null, remainingMs: Math.min(s.remainingMs, durationMs), durationMs, completedInCycle, taskId };
  }
  return { ...idleState(phase, settings, completedInCycle, taskId) };
}

/** Ms left in the current phase at `now`. */
export const remainingAt = (state: TimerState, now: number): number => {
  if (state.status === 'running' && state.endsAt !== null) return Math.max(0, state.endsAt - now);
  if (state.status === 'paused' && state.remainingMs !== null) return state.remainingMs;
  return state.durationMs;
};

/** Ms of the current phase actually run so far (the clock only moves while running). */
export const elapsedAt = (state: TimerState, now: number): number => Math.max(0, state.durationMs - remainingAt(state, now));

/** Share of the phase gone by, 0 to 1. */
export const progressAt = (state: TimerState, now: number): number =>
  state.durationMs > 0 ? Math.max(0, Math.min(1, 1 - remainingAt(state, now) / state.durationMs)) : 0;

export const start = (state: TimerState, now: number): TimerState =>
  state.status === 'running'
    ? state
    : { ...state, status: 'running', endsAt: now + remainingAt(state, now), remainingMs: null };

export const pause = (state: TimerState, now: number): TimerState =>
  state.status !== 'running' ? state : { ...state, status: 'paused', endsAt: null, remainingMs: remainingAt(state, now) };

/** Back to the start of the current phase. */
export const reset = (state: TimerState, settings: FocusSettings): TimerState =>
  idleState(state.phase, settings, state.completedInCycle, state.taskId);

/** Picks a phase by hand, keeping the cycle count. */
export const choosePhase = (state: TimerState, phase: FocusPhase, settings: FocusSettings): TimerState =>
  idleState(phase, settings, state.completedInCycle, state.taskId);

/** Whether a running phase has reached its end. */
export const isDue = (state: TimerState, now: number): boolean =>
  state.status === 'running' && state.endsAt !== null && now >= state.endsAt;

/** What follows a phase that ran to its end. */
export function nextAfterFinished(
  phase: FocusPhase,
  completedInCycle: number,
  settings: FocusSettings,
): { phase: FocusPhase; completedInCycle: number } {
  if (phase === 'focus') {
    const completed = completedInCycle + 1;
    return completed >= settings.longBreakEvery
      ? { phase: 'long-break', completedInCycle: completed }
      : { phase: 'short-break', completedInCycle: completed };
  }
  return { phase: 'focus', completedInCycle: phase === 'long-break' ? 0 : completedInCycle };
}

/** Moves on when a phase ran to its end, starting the next one if the settings say so. */
export function finish(state: TimerState, settings: FocusSettings, now: number, allowAutoStart = true): TimerState {
  const next = nextAfterFinished(state.phase, state.completedInCycle, settings);
  const idle = idleState(next.phase, settings, next.completedInCycle, state.taskId);
  const autoStart = allowAutoStart && (next.phase === 'focus' ? settings.autoStartFocus : settings.autoStartBreaks);
  return autoStart ? start(idle, now) : idle;
}

/**
 * Leaves the current phase early. A skipped focus session doesn't count towards the long
 * break, and nothing starts on its own.
 */
export function skip(state: TimerState, settings: FocusSettings): TimerState {
  if (state.phase === 'focus') {
    const phase: FocusPhase = state.completedInCycle >= settings.longBreakEvery ? 'long-break' : 'short-break';
    return idleState(phase, settings, state.completedInCycle, state.taskId);
  }
  return idleState('focus', settings, state.phase === 'long-break' ? 0 : state.completedInCycle, state.taskId);
}

/** "25:00", "4:05", "105:00". */
export const formatClock = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};
