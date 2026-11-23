/**
 * Studify Web Push & Daily Streak Reminder Notification Service
 * Duolingo-grade habit loop reminders to protect student streaks.
 */

import { StorageService } from './storageService';
import { ApiConfig } from './apiConfig';

export interface NotificationSettings {
  enabled: boolean;
  reminderHour: number; // 0 - 23, e.g. 19 for 7 PM
  reminderMinute: number; // 0 - 59
  sound: boolean;
  /** Reminders come from the server as push notifications, so they arrive with Studify closed. */
  push?: boolean;
  /** With push on: a notification when each lesson in the timetable ends (on unless turned off). */
  afterClass?: boolean;
}

/** A Web Push key (base64url) as the bytes the browser's push manager wants. */
const keyBytes = (base64url: string): Uint8Array<ArrayBuffer> => {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
};

const remindAtOf = (settings: NotificationSettings) =>
  `${String(settings.reminderHour).padStart(2, '0')}:${String(settings.reminderMinute).padStart(2, '0')}`;

const SETTINGS_KEY = 'studify_notification_settings';
const LAST_NOTIF_KEY = 'studify_last_notification_date';

export class NotificationService {
  private static defaultSettings: NotificationSettings = {
    enabled: false,
    reminderHour: 19, // 7:00 PM
    reminderMinute: 0,
    sound: true,
  };

  /**
   * Check if the browser supports notifications and service worker
   */
  public static isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  /**
   * Get current permission state: 'granted' | 'denied' | 'default'
   */
  public static getPermission(): NotificationPermission {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
  }

  /**
   * Load user's notification preferences
   */
  public static getSettings(): NotificationSettings {
    try {
      const raw = localStorage.getItem(StorageService.getKey(SETTINGS_KEY));
      if (raw) return { ...this.defaultSettings, ...JSON.parse(raw) };
    } catch {}
    return { ...this.defaultSettings };
  }

  /**
   * Save user's notification preferences
   */
  public static saveSettings(settings: Partial<NotificationSettings>): NotificationSettings {
    const updated = { ...this.getSettings(), ...settings };
    try {
      localStorage.setItem(StorageService.getKey(SETTINGS_KEY), JSON.stringify(updated));
    } catch {}
    return updated;
  }

  /**
   * Request system notification permission from the user
   */
  public static async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      const result = await Notification.requestPermission();
      const granted = result === 'granted';
      if (granted) {
        this.saveSettings({ enabled: true });
        this.scheduleStreakCheck();
      } else {
        this.saveSettings({ enabled: false });
      }
      return granted;
    } catch (err) {
      console.warn('[NotificationService] Permission request failed:', err);
      return false;
    }
  }

  /**
   * Dispatches a notification using the active ServiceWorker registration
   */
  public static async showNotification(title: string, options: NotificationOptions = {}): Promise<boolean> {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        await registration.showNotification(title, {
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: 'studify-habit-loop',
          ...options,
        } as NotificationOptions);
        return true;
      }
    } catch (err) {
      console.warn('[NotificationService] Failed to show via serviceWorker, trying native fallback:', err);
    }

    // Fallback to direct window Notification
    try {
      new Notification(title, {
        icon: '/favicon.svg',
        ...options,
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Whether this browser can get push notifications (on iPhone, only once added to the Home Screen). */
  public static isPushSupported(): boolean {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  /** Tells the server this browser's subscription, time zone and reminder time. */
  private static async sendSubscription(subscription: PushSubscription, settings: NotificationSettings): Promise<void> {
    const res = await ApiConfig.request('/reminders/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        remindAt: remindAtOf(settings),
        afterClass: settings.afterClass !== false,
      }),
    });
    if (!res.ok) throw new Error(res.error || 'The server did not accept the reminder.');
  }

  /**
   * Turns on reminders that arrive with Studify closed (signed-in students): asks for permission,
   * subscribes this browser to push, and registers it with the server. Resolves with a message to
   * show when it couldn't.
   */
  public static async enablePushReminders(): Promise<{ ok: boolean; message?: string }> {
    if (!this.isPushSupported()) return { ok: false, message: 'This browser can’t get notifications when Studify is closed.' };
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, message: 'Your browser blocked notifications for Studify.' };
    try {
      const keyRes = await ApiConfig.request<{ publicKey: string }>('/reminders/key');
      if (!keyRes.ok || !keyRes.data?.publicKey) throw new Error('Couldn’t reach the server.');
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(keyRes.data.publicKey) }));
      const settings = this.saveSettings({ enabled: true, push: true });
      await this.sendSubscription(subscription, settings);
      return { ok: true };
    } catch (err) {
      this.saveSettings({ push: false });
      return { ok: false, message: err instanceof Error ? err.message : 'Couldn’t turn on reminders.' };
    }
  }

  /** Sends the new reminder time to the server, when reminders come from it. */
  public static async updatePushReminderTime(): Promise<void> {
    const settings = this.getSettings();
    if (!settings.push || !this.isPushSupported()) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await this.sendSubscription(subscription, settings);
  }

  /** Turns after-class notifications on or off for this browser (with push reminders on). */
  public static async setAfterClass(on: boolean): Promise<void> {
    this.saveSettings({ afterClass: on });
    await this.updatePushReminderTime();
  }

  /** Stops server reminders for this browser (on turning reminders off, and on signing out). */
  public static async disablePushReminders(): Promise<void> {
    this.saveSettings({ push: false });
    if (!this.isPushSupported()) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;
      await ApiConfig.request('/reminders/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: subscription.endpoint }) });
      await subscription.unsubscribe();
    } catch {
      // Offline: the server drops the subscription once the browser stops answering.
    }
  }

  /**
   * Trigger a test notification so the user immediately experiences the coaching
   */
  public static async sendTestNotification(): Promise<boolean> {
    const granted = await this.requestPermission();
    if (!granted) return false;

    return this.showNotification('Reminders are on', {
      body: "This is what a reminder looks like. You'll get one at your chosen time on days you haven't studied yet.",
      data: { url: '/' },
    });
  }

  /**
   * Check if daily study is pending and send a reminder if past the scheduled hour
   */
  public static async checkDailyReminder(todayMinutes: number, currentStreak: number): Promise<void> {
    const settings = this.getSettings();
    // With push on, the server sends the reminder (even with Studify closed); don't send a second one.
    if (!settings.enabled || settings.push || Notification.permission !== 'granted') return;

    // If student has already studied today, streak is safe!
    if (todayMinutes > 0) return;

    const todayDateStr = new Date().toISOString().split('T')[0];
    const lastNotified = localStorage.getItem(StorageService.getKey(LAST_NOTIF_KEY));
    if (lastNotified === todayDateStr) {
      // Already sent reminder today
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();

    // Fire if past or at the user's preferred reminder hour
    if (currentHour >= settings.reminderHour) {
      const streakText = currentStreak > 1 
        ? `Your ${currentStreak}-day streak is in danger! 🔥`
        : `Keep your study momentum alive today! ✨`;

      const success = await this.showNotification(streakText, {
        body: `A few minutes of flashcards keeps your streak going.`,
        data: { url: '/?launch=quick_sprint' },
        requireInteraction: true,
      });

      if (success) {
        try {
          localStorage.setItem(StorageService.getKey(LAST_NOTIF_KEY), todayDateStr);
        } catch {}
      }
    }
  }

  /**
   * Schedule recurring daily check timer
   */
  public static scheduleStreakCheck(): void {
    if (typeof window === 'undefined') return;

    // Check once every 15 minutes while app tab is alive
    const INTERVAL_MS = 15 * 60 * 1000;
    setInterval(() => {
      try {
        const stats = StorageService.getStats();
        this.checkDailyReminder(stats.todayMinutes || 0, stats.currentStreak || 0);
      } catch {}
    }, INTERVAL_MS);
  }
}
