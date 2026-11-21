import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FOCUS_SETTINGS,
  choosePhase,
  cleanSettings,
  cleanTimerState,
  finish,
  formatClock,
  idleState,
  isDue,
  nextAfterFinished,
  pause,
  progressAt,
  remainingAt,
  reset,
  skip,
  start,
} from './focusTimer';

const S = DEFAULT_FOCUS_SETTINGS;
const MIN = 60_000;
const T0 = 1_800_000_000_000;

describe('settings', () => {
  it('fills in missing settings and keeps numbers in range', () => {
    expect(cleanSettings(null)).toEqual(S);
    const s = cleanSettings({ focusMinutes: 500, shortBreakMinutes: 0, longBreakMinutes: '20', longBreakEvery: 3.6, chime: false, notify: 'yes' });
    expect(s.focusMinutes).toBe(120);
    expect(s.shortBreakMinutes).toBe(1);
    expect(s.longBreakMinutes).toBe(20);
    expect(s.longBreakEvery).toBe(4);
    expect(s.chime).toBe(false);
    expect(s.notify).toBe(S.notify);
  });
});

describe('running the timer', () => {
  it('counts down from the end time, and pauses and resumes where it was', () => {
    const idle = idleState('focus', S);
    expect(remainingAt(idle, T0)).toBe(25 * MIN);

    const running = start(idle, T0);
    expect(running.endsAt).toBe(T0 + 25 * MIN);
    expect(remainingAt(running, T0 + 10 * MIN)).toBe(15 * MIN);
    expect(progressAt(running, T0 + 5 * MIN)).toBeCloseTo(0.2);

    const paused = pause(running, T0 + 10 * MIN);
    expect(paused.status).toBe('paused');
    // Time passing while paused changes nothing.
    expect(remainingAt(paused, T0 + 60 * MIN)).toBe(15 * MIN);

    const resumed = start(paused, T0 + 60 * MIN);
    expect(resumed.endsAt).toBe(T0 + 75 * MIN);
    expect(isDue(resumed, T0 + 75 * MIN - 1)).toBe(false);
    expect(isDue(resumed, T0 + 75 * MIN)).toBe(true);
  });

  it('starting or pausing twice changes nothing', () => {
    const running = start(idleState('focus', S), T0);
    expect(start(running, T0 + MIN)).toBe(running);
    const idle = idleState('focus', S);
    expect(pause(idle, T0)).toBe(idle);
  });

  it('resets to the start of the same phase, keeping the cycle and task', () => {
    const running = start(idleState('short-break', S, 2, 'task-1'), T0);
    const r = reset(running, S);
    expect(r).toEqual(idleState('short-break', S, 2, 'task-1'));
  });

  it('lets a phase be picked by hand', () => {
    const picked = choosePhase(idleState('focus', S, 1), 'long-break', S);
    expect(picked.phase).toBe('long-break');
    expect(picked.durationMs).toBe(15 * MIN);
    expect(picked.completedInCycle).toBe(1);
  });
});

describe('the Pomodoro cycle', () => {
  it('takes short breaks, then a long one after every fourth focus session', () => {
    let phase = nextAfterFinished('focus', 0, S);
    expect(phase).toEqual({ phase: 'short-break', completedInCycle: 1 });
    phase = nextAfterFinished('short-break', 1, S);
    expect(phase).toEqual({ phase: 'focus', completedInCycle: 1 });
    expect(nextAfterFinished('focus', 3, S)).toEqual({ phase: 'long-break', completedInCycle: 4 });
    expect(nextAfterFinished('long-break', 4, S)).toEqual({ phase: 'focus', completedInCycle: 0 });
  });

  it('starts breaks on its own but waits to start focus, by default', () => {
    const focus = start(idleState('focus', S, 0, 'task-1'), T0);
    const onBreak = finish(focus, S, T0 + 25 * MIN);
    expect(onBreak).toMatchObject({ phase: 'short-break', status: 'running', endsAt: T0 + 30 * MIN, taskId: 'task-1' });
    const back = finish(onBreak, S, T0 + 30 * MIN);
    expect(back).toMatchObject({ phase: 'focus', status: 'idle', completedInCycle: 1 });
  });

  it('follows the auto-start settings, and never auto-starts when told not to', () => {
    const settings = { ...S, autoStartBreaks: false, autoStartFocus: true };
    const focus = start(idleState('focus', settings), T0);
    expect(finish(focus, settings, T0 + 25 * MIN).status).toBe('idle');
    const brk = start(idleState('short-break', settings), T0);
    expect(finish(brk, settings, T0 + 5 * MIN).status).toBe('running');
    expect(finish(brk, settings, T0 + 5 * MIN, false).status).toBe('idle');
  });

  it("doesn't count a skipped focus session", () => {
    const skipped = skip(start(idleState('focus', S, 1), T0), S);
    expect(skipped).toMatchObject({ phase: 'short-break', status: 'idle', completedInCycle: 1 });
    expect(skip(idleState('long-break', S, 4), S)).toMatchObject({ phase: 'focus', completedInCycle: 0 });
  });
});

describe('saved timers', () => {
  it('restores a running, paused or idle timer', () => {
    const running = start(idleState('focus', S), T0);
    expect(cleanTimerState(JSON.parse(JSON.stringify(running)), S)).toEqual(running);
    const paused = pause(running, T0 + MIN);
    expect(cleanTimerState(paused, S)).toEqual(paused);
  });

  it('starts fresh from damaged data', () => {
    expect(cleanTimerState('nonsense', S)).toEqual(idleState('focus', S));
    expect(cleanTimerState({ phase: 'nap', status: 'running', endsAt: 'soon' }, S)).toEqual(idleState('focus', S));
  });
});

describe('formatClock', () => {
  it('shows minutes and seconds, rounding up so it reads 0:00 only at the end', () => {
    expect(formatClock(25 * MIN)).toBe('25:00');
    expect(formatClock(4 * MIN + 5_000)).toBe('4:05');
    expect(formatClock(400)).toBe('0:01');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(105 * MIN)).toBe('105:00');
  });
});
