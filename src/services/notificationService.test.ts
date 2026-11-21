import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from './notificationService';
import { ApiConfig } from './apiConfig';

describe('reminders that arrive with Studify closed', () => {
  const subscription = {
    endpoint: 'https://push.example.com/send/abc',
    toJSON: () => ({ endpoint: 'https://push.example.com/send/abc', keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: vi.fn(async () => true),
  };
  let pushManager: { getSubscription: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> };
  let requests: { url: string; body: unknown }[];

  beforeEach(() => {
    localStorage.clear();
    requests = [];
    pushManager = { getSubscription: vi.fn(async () => null), subscribe: vi.fn(async () => subscription) };
    vi.stubGlobal('window', { PushManager: function PushManager() {}, Notification: {} });
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn(async () => 'granted') });
    vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ pushManager }) } });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        requests.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
        if (String(url).endsWith('/reminders/key')) return Response.json({ publicKey: 'BPk3y_-abc' });
        return Response.json({ success: true });
      }),
    );
    ApiConfig.setToken('test-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    ApiConfig.setToken(null);
  });

  it('subscribes this browser and tells the server the time zone and time', async () => {
    NotificationService.saveSettings({ reminderHour: 19, reminderMinute: 0 });
    const result = await NotificationService.enablePushReminders();
    expect(result.ok).toBe(true);
    expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true, applicationServerKey: expect.any(Uint8Array) }));
    const subscribe = requests.find(r => r.url.endsWith('/reminders/subscribe'))!;
    expect(subscribe.body).toMatchObject({ subscription: { endpoint: subscription.endpoint }, remindAt: '19:00', timeZone: expect.any(String) });
    expect(NotificationService.getSettings()).toMatchObject({ enabled: true, push: true });
  });

  it('sends a new time, and stops on the server and in the browser when turned off', async () => {
    await NotificationService.enablePushReminders();
    pushManager.getSubscription.mockResolvedValue(subscription);

    NotificationService.saveSettings({ reminderHour: 20 });
    await NotificationService.updatePushReminderTime();
    expect(requests.filter(r => r.url.endsWith('/reminders/subscribe')).at(-1)!.body).toMatchObject({ remindAt: '20:00' });

    await NotificationService.disablePushReminders();
    expect(requests.at(-1)).toMatchObject({ url: expect.stringMatching(/\/reminders\/unsubscribe$/), body: { endpoint: subscription.endpoint } });
    expect(subscription.unsubscribe).toHaveBeenCalled();
    expect(NotificationService.getSettings().push).toBe(false);
  });

  it('says so when notifications are blocked', async () => {
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn(async () => 'denied') });
    const result = await NotificationService.enablePushReminders();
    expect(result).toEqual({ ok: false, message: 'Your browser blocked notifications for Studify.' });
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });
});
