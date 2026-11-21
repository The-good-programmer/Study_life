import { useEffect, useState } from 'react';
import { FocusService, completionMessage, type FocusCompletion } from '../services/focusService';
import { formatClock, remainingAt, type FocusPhase } from '../services/focusTimer';
import { NotificationService } from '../services/notificationService';
import { soundEngine } from '../services/soundEngine';

export const PHASE_LABELS: Record<FocusPhase, string> = {
  focus: 'Focus',
  'short-break': 'Short break',
  'long-break': 'Long break',
};

const read = () => ({ timer: FocusService.getTimer(), settings: FocusService.getSettings(), tasks: FocusService.getTasks() });

/** The timer, its settings and the tasks, kept current, with `now` moving on while the timer runs. */
export function useFocusState() {
  const [state, setState] = useState(read);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => FocusService.subscribe(() => {
    setState(read());
    setNow(Date.now());
  }), []);
  const running = state.timer.status === 'running';
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);
  return { ...state, now };
}

/** How long a phase-change message stays on screen. */
const MESSAGE_MS = 8_000;

/**
 * Runs the timer for the whole app: notices when a phase ends (on any page), chimes, sends
 * the notification if it is turned on, and shows the time left in the tab's title. Returns
 * the latest phase change to show on screen, and a way to dismiss it.
 */
export function useFocusTimerAlerts(): { message: { title: string; body: string } | null; dismiss: () => void } {
  const [message, setMessage] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    const originalTitle = document.title;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const announce = (completion: FocusCompletion) => {
      const settings = FocusService.getSettings();
      const text = completionMessage(completion, settings);
      if (settings.chime && !completion.late) soundEngine.playCompletionChime();
      if (settings.notify && NotificationService.getPermission() === 'granted') {
        void NotificationService.showNotification(text.title, { body: text.body, tag: 'studify-focus', data: { url: '/' } });
      }
      setMessage(text);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setMessage(null), MESSAGE_MS);
    };

    const showTitle = () => {
      const timer = FocusService.getTimer();
      if (timer.status === 'idle') {
        document.title = originalTitle;
        return;
      }
      const clock = formatClock(remainingAt(timer, Date.now()));
      document.title = `${timer.status === 'paused' ? 'Paused' : clock} · ${PHASE_LABELS[timer.phase]} | Studify`;
    };

    const check = () => {
      const completion = FocusService.tick();
      if (completion) announce(completion);
      showTitle();
    };

    check();
    const id = setInterval(check, 1000);
    document.addEventListener('visibilitychange', check);
    const unsubscribe = FocusService.subscribe(showTitle);
    return () => {
      clearInterval(id);
      clearTimeout(hideTimer);
      document.removeEventListener('visibilitychange', check);
      unsubscribe();
      document.title = originalTitle;
    };
  }, []);

  return { message, dismiss: () => setMessage(null) };
}
