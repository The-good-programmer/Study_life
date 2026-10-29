import { ApiConfig } from './apiConfig';
import { buildCalendar } from './calendarExport';
import { PlannerService } from './plannerService';
import { StorageService } from './storageService';

/**
 * The planner as a calendar others can subscribe to. Signed-in students turn on a private link;
 * from then on each change to the planner is sent to the server, and Google, Apple or Outlook
 * calendars pick it up when they next check (every few hours; Google can take up to a day).
 */

/** Set per profile while the link is on, so changes are sent. */
const FEED_ON_KEY = 'studify_calendar_feed_on_v1';
/** How long to wait after the last planner change before sending. */
const PUBLISH_DELAY_MS = 2000;

export interface FeedStatus {
  token: string | null;
}

/** The calendar file for what is in the planner now. */
export const currentCalendar = (): string =>
  buildCalendar(PlannerService.getItems(), { folders: StorageService.getFolders(), name: 'Studify planner' });

/** The feed's https link, which works wherever the API is (same site or its own host). */
export function feedUrl(token: string): string {
  const base = ApiConfig.getBaseUrl();
  const absolute = base.startsWith('http') ? base : `${window.location.origin}${base}`;
  return `${absolute}/calendar/feed.ics?token=${encodeURIComponent(token)}`;
}

/** The webcal:// form, which Apple Calendar and Outlook open as a subscription. */
export const webcalUrl = (token: string): string => feedUrl(token).replace(/^https?:\/\//, 'webcal://');

/** Google Calendar's "add by URL" page with the feed filled in. */
export const googleCalendarUrl = (token: string): string =>
  `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl(token))}`;

const isOn = (): boolean => {
  try {
    return localStorage.getItem(StorageService.getKey(FEED_ON_KEY)) === '1';
  } catch {
    return false;
  }
};

const setOn = (on: boolean) => {
  try {
    if (on) localStorage.setItem(StorageService.getKey(FEED_ON_KEY), '1');
    else localStorage.removeItem(StorageService.getKey(FEED_ON_KEY));
  } catch {
    // Storage blocked: the link still works, it just isn't kept up to date from here.
  }
};

let lastSent: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

async function send(ics: string): Promise<{ token: string } | { error: string }> {
  const res = await ApiConfig.request<{ token: string }>('/calendar/feed', { method: 'PUT', body: JSON.stringify({ ics }) });
  if (!res.ok || !res.data?.token) return { error: res.error || 'Could not reach Studify. Check your connection and try again.' };
  lastSent = ics;
  return { token: res.data.token };
}

export const CalendarFeedService = {
  isSignedIn(): boolean {
    return Boolean(ApiConfig.getToken());
  },

  /** The account's link, if it has one. */
  async status(): Promise<FeedStatus | { error: string }> {
    const res = await ApiConfig.request<FeedStatus>('/calendar/feed');
    if (!res.ok || !res.data) return { error: res.error || 'Could not reach Studify.' };
    setOn(Boolean(res.data.token));
    return { token: res.data.token };
  },

  /** Sends the planner and turns the link on (making one the first time). */
  async turnOn(): Promise<{ token: string } | { error: string }> {
    const result = await send(currentCalendar());
    if ('token' in result) setOn(true);
    return result;
  },

  async turnOff(): Promise<{ ok: true } | { error: string }> {
    const res = await ApiConfig.request('/calendar/feed', { method: 'DELETE' });
    if (!res.ok) return { error: res.error || 'Could not reach Studify.' };
    setOn(false);
    lastSent = null;
    return { ok: true };
  },

  /** A new link; calendars subscribed to the old one stop updating. */
  async reset(): Promise<{ token: string } | { error: string }> {
    const res = await ApiConfig.request<{ token: string }>('/calendar/feed/reset', { method: 'POST' });
    if (!res.ok || !res.data?.token) return { error: res.error || 'Could not reach Studify.' };
    return { token: res.data.token };
  },

  /**
   * Keeps the link up to date: after any change to stored study data, sends the planner if it
   * changed and the link is on. Returns a function that stops it.
   */
  startAutoPublish(): () => void {
    const unsubscribe = PlannerService.subscribe(() => {
      if (!isOn() || !ApiConfig.getToken()) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const ics = currentCalendar();
        // Reviews and other study changes also land here; only a changed calendar is sent.
        // DTSTAMP changes every build, so compare without it.
        const withoutStamps = (text: string | null) => text?.replace(/^DTSTAMP:[^\r\n]*/gm, '');
        if (withoutStamps(ics) === withoutStamps(lastSent)) return;
        void send(ics);
      }, PUBLISH_DELAY_MS);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
      timer = null;
    };
  },
};
