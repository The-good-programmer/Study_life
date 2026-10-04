/**
 * Studify Web Push & Daily Streak Reminder Notification Service
 * Duolingo-grade habit loop reminders to protect student streaks.
 */

import { StorageService } from './storageService';

export interface NotificationSettings {
  enabled: boolean;
  reminderHour: number; // 0 - 23, e.g. 19 for 7 PM
  reminderMinute: number; // 0 - 59
  sound: boolean;
}

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

  /**
   * Trigger a test notification so the user immediately experiences Lottie's coaching
   */
  public static async sendTestNotification(): Promise<boolean> {
    const granted = await this.requestPermission();
    if (!granted) return false;

    return this.showNotification("Lottie is proud of you! 🐾", {
      body: "High five! Streak notifications are now active. We'll remind you to do a quick 3-minute study session before your streak breaks!",
      data: { url: '/' },
    });
  }

  /**
   * Check if daily study is pending and send a reminder if past the scheduled hour
   */
  public static async checkDailyReminder(todayMinutes: number, currentStreak: number): Promise<void> {
    const settings = this.getSettings();
    if (!settings.enabled || Notification.permission !== 'granted') return;

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
        body: `Just 3 minutes of quick flashcard practice will lock in today's progress. Lottie is waiting for you! 🐾`,
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
