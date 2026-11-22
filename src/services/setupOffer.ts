import { AuthService } from './authService';
import { StorageService } from './storageService';
import { TimetableService } from './timetableService';

/** Whether the set-up assistant is offered (kept apart from it so the app shell stays small). */

const DONE_KEY = 'studify_setup_assistant_done';

/** Whether to offer the assistant: a signed-in student with no timetable, who hasn't finished or closed it. */
export function shouldOfferSetup(): boolean {
  try {
    if (localStorage.getItem(StorageService.getKey(DONE_KEY)) === 'true') return false;
  } catch {
    return false;
  }
  return Boolean(AuthService.getCurrentUser()) && TimetableService.getLessons().length === 0;
}

export function markSetupDone(): void {
  try {
    localStorage.setItem(StorageService.getKey(DONE_KEY), 'true');
  } catch {
    // Private mode: it may be offered again.
  }
}
