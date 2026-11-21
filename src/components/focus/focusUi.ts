import { FocusService } from '../../services/focusService';
import { soundEngine } from '../../services/soundEngine';

/** Shared Focus page helpers (kept out of the components so Fast Refresh works). */

export const BREAK_TIPS = {
  'short-break': 'Stand up, stretch, and look at something far away.',
  'long-break': 'Take a proper rest: walk around, drink some water, step away from screens.',
} as const;

/** Starts or pauses the timer, from a click or a key press (which also lets the chime play later). */
export const toggleTimer = () => {
  soundEngine.unlock();
  FocusService.toggle();
};

/** Puts the cursor in the Tasks card's "new task" field. */
export const focusNewTaskInput = () => {
  const input = document.getElementById('focus-new-task') as HTMLInputElement | null;
  input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  input?.focus({ preventScroll: true });
};

/** "45 min", "2 h", "2 h 05 min". */
export const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')} min`;
};

export const plural = (n: number, one: string): string => `${n} ${n === 1 ? one : `${one}s`}`;
