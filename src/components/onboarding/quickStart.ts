import { StorageService } from '../../services/storageService';

/** A topic typed before signing up, so the quick start can go on with it afterwards. */
export const QUICK_START_TOPIC_KEY = 'studify_quick_start_topic';
/** Set once the first-visit quick start (or the older tour) has been seen. */
export const QUICK_START_SEEN_KEY = 'axon_tour_seen';

/** Whether to greet the visitor with the quick start: never seen it, and no decks yet. */
export function shouldShowQuickStart(): boolean {
  try {
    if (localStorage.getItem(QUICK_START_SEEN_KEY) === 'true') return false;
  } catch {
    return false;
  }
  return StorageService.getSessions().length === 0;
}

export function markQuickStartSeen(): void {
  try {
    localStorage.setItem(QUICK_START_SEEN_KEY, 'true');
    sessionStorage.removeItem(QUICK_START_TOPIC_KEY);
  } catch {
    // Private mode: it may show again next visit.
  }
}

/** The topic typed before signing up, if any. */
export function pendingQuickStartTopic(): string | null {
  try {
    return sessionStorage.getItem(QUICK_START_TOPIC_KEY);
  } catch {
    return null;
  }
}
