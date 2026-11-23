/**
 * Study reminders sent as Web Push notifications, so they arrive with Studify closed.
 *
 * Each subscription is one browser of a signed-in student, with their time zone and chosen time.
 * Every few minutes runReminders() finds the ones whose time has come today, skips students who
 * already studied today (their stats arrive through account sync), and sends the rest a nudge with
 * their streak and how many cards are due.
 *
 * The Web Push keys are made by the server the first time they're needed and kept in app_secrets.
 */

import webpush from 'web-push';
import { db } from './db.js';

const VAPID_KEY = 'vapid';
let vapidKeys = null;

/** The server's Web Push key pair, made and saved on first use. */
export async function getVapidKeys() {
  if (vapidKeys) return vapidKeys;
  const read = async () => {
    const row = await db.one('SELECT value FROM app_secrets WHERE key = $1', [VAPID_KEY]);
    return row ? JSON.parse(row.value) : null;
  };
  let keys = await read();
  if (!keys) {
    const fresh = webpush.generateVAPIDKeys();
    // Two server instances starting at once: the first one's keys win, and both use them.
    await db.run('INSERT INTO app_secrets (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [VAPID_KEY, JSON.stringify(fresh)]);
    keys = await read();
  }
  vapidKeys = keys;
  return keys;
}

export const isValidTimeZone = (timeZone) => {
  if (typeof timeZone !== 'string' || !timeZone || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
};

export const isTimeOfDay = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** The local day (YYYY-MM-DD) and minutes since local midnight at `now` in a time zone. */
export function localTime(now, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const utcDay = (date) => date.toISOString().slice(0, 10);

/**
 * Whether the student studied today, in their time zone: their last study (`lastStudiedAt`, an
 * exact time) was after local midnight. Older apps only send the UTC date of the last study day,
 * which can't be placed in a local day exactly, so then only a study on today's UTC date counts.
 */
export function studiedToday(stats, now, minutesSinceMidnight) {
  const localMidnight = now.getTime() - minutesSinceMidnight * 60_000;
  const lastAt = Date.parse(stats?.lastStudiedAt ?? '');
  if (Number.isFinite(lastAt)) return lastAt >= localMidnight;
  return stats?.lastActiveDate === utcDay(now);
}

/** Cards due now across the student's synced decks. */
export async function countDueCards(userId, now) {
  const due = new Set();
  for (const row of await db.all('SELECT data_json FROM study_sessions WHERE user_id = $1', [userId])) {
    let deck;
    try {
      deck = JSON.parse(row.data_json);
    } catch {
      continue;
    }
    for (const concept of deck?.concepts ?? []) {
      for (const card of concept?.retrievalCards ?? []) {
        if (!card?.hidden && card?.reps > 0 && card.nextReviewDate && new Date(card.nextReviewDate) <= now) due.add(card.id);
      }
    }
  }
  return due.size;
}

/** What the reminder says. */
export function reminderMessage({ streak, due }) {
  const cards = due === 1 ? '1 card is' : `${due} cards are`;
  if (streak >= 2) {
    return {
      title: `Your ${streak}-day streak ends at midnight`,
      body: due > 0 ? `${cards} due. A few minutes keeps it going.` : 'A few minutes of practice keeps it going.',
      url: '/?launch=quick_sprint',
    };
  }
  return {
    title: due > 0 ? 'Time for a quick review' : 'Time to study',
    body: due > 0 ? `${cards} due. Review them before you forget them.` : 'A few minutes today makes tomorrow easier.',
    url: '/?launch=quick_sprint',
  };
}

/**
 * Sends the reminders that are due. `send(subscription, message)` delivers one; an error with
 * statusCode 404 or 410 means the browser dropped the subscription, which is then deleted. Other
 * failures are retried on the next run.
 */
export async function runReminders({ now = new Date(), send }) {
  const subscriptions = await db.all(
    `SELECT s.endpoint, s.user_id, s.keys_json, s.time_zone, s.remind_at, s.last_sent_day, u.stats_json
     FROM push_subscriptions s LEFT JOIN user_stats u ON u.user_id = s.user_id`,
  );
  const dueByUser = new Map();
  let sent = 0;

  for (const sub of subscriptions) {
    if (!isValidTimeZone(sub.time_zone) || !isTimeOfDay(sub.remind_at)) continue;
    const { day, minutes } = localTime(now, sub.time_zone);
    const [hour, minute] = sub.remind_at.split(':').map(Number);
    if (minutes < hour * 60 + minute || sub.last_sent_day === day) continue;

    const markSent = () => db.run('UPDATE push_subscriptions SET last_sent_day = $1 WHERE endpoint = $2', [day, sub.endpoint]);
    let stats = null;
    try {
      stats = sub.stats_json ? JSON.parse(sub.stats_json) : null;
    } catch {
      // Unreadable stats: remind anyway.
    }
    if (studiedToday(stats, now, minutes)) {
      await markSent();
      continue;
    }

    if (!dueByUser.has(sub.user_id)) dueByUser.set(sub.user_id, await countDueCards(sub.user_id, now));
    const message = reminderMessage({ streak: Number(stats?.currentStreak) || 0, due: dueByUser.get(sub.user_id) });
    try {
      await send({ endpoint: sub.endpoint, keys: JSON.parse(sub.keys_json) }, message);
      await markSent();
      sent++;
    } catch (err) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await db.run('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
      } else {
        console.warn('[Reminders] Could not send a reminder:', err?.message ?? err);
      }
    }
  }
  return { checked: subscriptions.length, sent };
}

/** Lessons only get a notification this soon after they end (a server that slept doesn't send stale ones). */
export const AFTER_CLASS_WINDOW_MINUTES = 20;

const minutesOfTime = (time) => {
  const [h, m] = String(time).split(':').map(Number);
  return h * 60 + m;
};

/** Day of the week (ISO, 1 = Monday) of a YYYY-MM-DD day. */
const isoWeekdayOf = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
};

const readDocument = async (userId, kind) => {
  const row = await db.one('SELECT data_json FROM user_documents WHERE user_id = $1 AND kind = $2', [userId, kind]);
  try {
    const items = row ? JSON.parse(row.data_json)?.items : null;
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};

/**
 * Lessons that ended since the last notification (and within the window), not yet logged, from a
 * student's synced timetable. `notifiedThrough` is "YYYY-MM-DD HH:MM" in their time zone, or null.
 */
export function lessonsJustEnded({ lessons, logs, day, minutes, notifiedThrough }) {
  const [sentDay, sentTime] = String(notifiedThrough ?? '').split(' ');
  const after = sentDay === day && isTimeOfDay(sentTime) ? minutesOfTime(sentTime) : -1;
  const weekday = isoWeekdayOf(day);
  return lessons.filter((lesson) => {
    if (!lesson || lesson.weekday !== weekday || !isTimeOfDay(lesson.end) || typeof lesson.subject !== 'string') return false;
    const end = minutesOfTime(lesson.end);
    if (end <= after || end > minutes || minutes - end > AFTER_CLASS_WINDOW_MINUTES) return false;
    return !logs.some((log) => log?.lessonId === lesson.id && log?.date === day);
  });
}

/** What an after-class notification says. */
export function afterClassMessage(lesson) {
  return {
    title: `${lesson.subject} just finished`,
    body: 'What did you cover? Note it in a few seconds and get flashcards for tonight.',
    url: `/?log=${encodeURIComponent(lesson.id)}`,
    tag: `studify-lesson-${lesson.id}`,
    action: 'Note it',
  };
}

/**
 * Sends a notification when a lesson in a student's timetable ends (browsers that left after-class
 * notifications on). Each lesson is notified once, and never once it's logged.
 */
export async function runAfterClass({ now = new Date(), send }) {
  const subscriptions = await db.all(
    'SELECT endpoint, user_id, keys_json, time_zone, lessons_notified_through FROM push_subscriptions WHERE after_class = TRUE',
  );
  const docs = new Map();
  let sent = 0;
  for (const sub of subscriptions) {
    if (!isValidTimeZone(sub.time_zone)) continue;
    if (!docs.has(sub.user_id)) {
      docs.set(sub.user_id, { lessons: await readDocument(sub.user_id, 'timetable'), logs: await readDocument(sub.user_id, 'lesson_logs') });
    }
    const { lessons, logs } = docs.get(sub.user_id);
    if (lessons.length === 0) continue;
    const { day, minutes } = localTime(now, sub.time_zone);
    const ended = lessonsJustEnded({ lessons, logs, day, minutes, notifiedThrough: sub.lessons_notified_through });
    if (ended.length === 0) continue;
    try {
      for (const lesson of ended) {
        await send({ endpoint: sub.endpoint, keys: JSON.parse(sub.keys_json) }, afterClassMessage(lesson));
        sent++;
      }
      const through = `${day} ${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      await db.run('UPDATE push_subscriptions SET lessons_notified_through = $1 WHERE endpoint = $2', [through, sub.endpoint]);
    } catch (err) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await db.run('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
      } else {
        console.warn('[Reminders] Could not send an after-class notification:', err?.message ?? err);
      }
    }
  }
  return { checked: subscriptions.length, sent };
}

/** Sends one reminder with web-push and the server's keys. */
export function createPushSender(subject) {
  return async (subscription, message) => {
    const keys = await getVapidKeys();
    await webpush.sendNotification(subscription, JSON.stringify(message), {
      vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
      TTL: 6 * 60 * 60,
    });
  };
}

/** Runs reminders now and every few minutes while the server is up. */
export function startReminderSchedule({ subject, everyMs = 5 * 60_000 } = {}) {
  const send = createPushSender(subject);
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const { sent } = await runReminders({ send });
      if (sent > 0) console.log(`[Reminders] Sent ${sent}.`);
      const afterClass = await runAfterClass({ send });
      if (afterClass.sent > 0) console.log(`[Reminders] Sent ${afterClass.sent} after-class.`);
    } catch (err) {
      console.error('[Reminders] Run failed:', err.message);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(run, everyMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
