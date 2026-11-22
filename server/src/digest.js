/**
 * The weekly progress email: on Sunday evening in each student's time zone, a short summary of their
 * week (cards reviewed, focus time, streak, what's coming up) from the data their account syncs.
 * Students turn it on in Settings; every email has a link that turns it off without signing in.
 */

import crypto from 'node:crypto';
import { db } from './db.js';
import { isValidTimeZone, localTime } from './reminders.js';

/** Sunday, from 17:00 local time. */
const SEND_WEEKDAY = 0;
const SEND_FROM_MINUTES = 17 * 60;
const DAY_MS = 86_400_000;
const UPCOMING_DAYS = 14;
const MAX_UPCOMING = 5;

export const newUnsubscribeToken = () => crypto.randomBytes(24).toString('base64url');

const dayToUtc = (day) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
const isDayKey = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** 0 for Sunday … 6 for Saturday, of a YYYY-MM-DD day. */
export const weekdayOf = (day) => new Date(dayToUtc(day)).getUTCDay();

/** The ISO week of a YYYY-MM-DD day, like 2026-W47. */
export function isoWeekOf(day) {
  const date = new Date(dayToUtc(day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday); // the Thursday of this week decides its year
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const formatMinutes = (minutes) => {
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

const formatDay = (day) =>
  new Date(dayToUtc(day)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

const inDays = (days) => (days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`);

const cardsOf = (decks) => {
  const byId = new Map();
  for (const deck of decks) {
    for (const concept of deck?.concepts ?? []) {
      for (const card of concept?.retrievalCards ?? []) if (card?.id && !card.hidden) byId.set(card.id, card);
    }
  }
  return [...byId.values()];
};

/**
 * The week's numbers. `today` is the student's local day; the week is the 7 days up to `now`.
 */
export function weekSummary({ decks = [], stats = {}, focusLog = [], planner = [], now, today }) {
  const since = now.getTime() - 7 * DAY_MS;
  const within = (iso) => {
    const t = Date.parse(iso ?? '');
    return Number.isFinite(t) && t > since && t <= now.getTime();
  };
  const cards = cardsOf(decks);
  const lastStudied = Date.parse(stats?.lastStudiedAt ?? '');
  const streakAlive = Number.isFinite(lastStudied) ? now.getTime() - lastStudied <= 2 * DAY_MS : stats?.lastActiveDate && dayToUtc(today) - dayToUtc(stats.lastActiveDate) <= DAY_MS;
  const upcoming = planner
    .filter((item) => item && !item.done && isDayKey(item.date) && typeof item.title === 'string')
    .map((item) => ({ title: item.title, kind: item.kind, date: item.date, daysLeft: Math.round((dayToUtc(item.date) - dayToUtc(today)) / DAY_MS) }))
    .filter((item) => item.daysLeft >= 0 && item.daysLeft <= UPCOMING_DAYS)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, MAX_UPCOMING);
  return {
    cardsReviewed: cards.filter((card) => within(card.lastReviewDate)).length,
    dueNow: cards.filter((card) => card.reps > 0 && card.nextReviewDate && Date.parse(card.nextReviewDate) <= now.getTime()).length,
    focusMinutes: focusLog.filter((entry) => within(entry?.endedAt)).reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0),
    streak: streakAlive ? Math.max(0, Number(stats?.currentStreak) || 0) : 0,
    upcoming,
  };
}

const KIND_LABEL = { exam: 'Exam', homework: 'Due' };

/** The email: subject, plain text and simple HTML. */
export function digestEmail({ name, summary, reviewUrl, unsubscribeUrl, settingsUrl }) {
  const first = String(name || '').trim().split(/\s+/)[0] || 'there';
  const { cardsReviewed, dueNow, focusMinutes, streak, upcoming } = summary;
  const quiet = cardsReviewed === 0 && focusMinutes === 0;
  const subject = quiet ? 'Your Studify week' : `Your week: ${plural(cardsReviewed, 'card')} reviewed${focusMinutes > 0 ? `, ${formatMinutes(focusMinutes)} focused` : ''}`;
  const intro = quiet ? "You didn't study on Studify this week. A few minutes a day is enough to keep what you've learned." : "Here's your week on Studify.";

  const stats = [
    ['Cards reviewed', String(cardsReviewed)],
    ['Focus time', formatMinutes(focusMinutes)],
    ['Streak', plural(streak, 'day')],
  ];
  const upcomingLines = upcoming.map((item) => `${KIND_LABEL[item.kind] ?? 'Coming up'}: ${item.title}, ${formatDay(item.date)} (${inDays(item.daysLeft)})`);
  const call = dueNow > 0 ? `${plural(dueNow, 'card is', 'cards are')} due now.` : 'Nothing is due right now. Add a deck or practise ahead.';
  const stop = unsubscribeUrl ? `Stop these emails: ${unsubscribeUrl}` : `Turn these emails off in Settings → Reminders: ${settingsUrl}`;

  const text = [
    `Hi ${first},`,
    '',
    intro,
    '',
    ...stats.map(([label, value]) => `${label}: ${value}`),
    ...(upcomingLines.length ? ['', 'Coming up in the next two weeks:', ...upcomingLines.map((line) => `- ${line}`)] : []),
    '',
    call,
    `Start today's review: ${reviewUrl}`,
    '',
    '—',
    'You get this every Sunday because you turned on the weekly email in Studify.',
    stop,
  ].join('\n');

  const cell = 'padding:10px 14px;border:1px solid #e4e4ec;border-radius:10px;text-align:center';
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1c28;max-width:520px">
<p>Hi ${escapeHtml(first)},</p>
<p>${escapeHtml(intro)}</p>
<table role="presentation" cellspacing="8" style="border-collapse:separate;margin:0 -8px"><tr>
${stats.map(([label, value]) => `<td style="${cell}"><div style="font-size:20px;font-weight:700">${escapeHtml(value)}</div><div style="font-size:12px;color:#6b6b80">${escapeHtml(label)}</div></td>`).join('\n')}
</tr></table>
${upcomingLines.length ? `<p style="margin-bottom:4px"><strong>Coming up in the next two weeks</strong></p>\n<ul style="margin-top:0;padding-left:20px">${upcomingLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>` : ''}
<p>${escapeHtml(call)}</p>
<p><a href="${escapeHtml(reviewUrl)}" style="display:inline-block;padding:10px 18px;border-radius:10px;background:#5b5bd6;color:#fff;text-decoration:none;font-weight:600">Start today's review</a></p>
<p style="font-size:12px;color:#6b6b80">You get this every Sunday because you turned on the weekly email in Studify.
${unsubscribeUrl ? `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b6b80">Stop these emails</a>` : `Turn it off in <a href="${escapeHtml(settingsUrl)}" style="color:#6b6b80">Settings → Reminders</a>`}.</p>
</div>`;
  return { subject, text, html };
}

const parse = (json, fallback) => {
  try {
    return json ? JSON.parse(json) ?? fallback : fallback;
  } catch {
    return fallback;
  }
};

/**
 * Sends the weekly emails that are due: Sunday from 17:00 in the student's time zone, once a week.
 * A failed send is retried on the next run.
 */
export async function runDigests({ now = new Date(), mailer, siteUrl = '', apiUrl = '' }) {
  if (!mailer) return { checked: 0, sent: 0 };
  const rows = await db.all(
    `SELECT d.user_id, d.time_zone, d.unsubscribe_token, d.last_sent_week, u.name, u.email, s.stats_json
     FROM digest_subscriptions d JOIN users u ON u.id = d.user_id LEFT JOIN user_stats s ON s.user_id = d.user_id`,
  );
  let sent = 0;
  for (const row of rows) {
    if (!isValidTimeZone(row.time_zone)) continue;
    const { day, minutes } = localTime(now, row.time_zone);
    if (weekdayOf(day) !== SEND_WEEKDAY || minutes < SEND_FROM_MINUTES) continue;
    const week = isoWeekOf(day);
    if (row.last_sent_week === week) continue;

    const decks = (await db.all('SELECT data_json FROM study_sessions WHERE user_id = $1', [row.user_id])).map((r) => parse(r.data_json, null)).filter(Boolean);
    const documents = Object.fromEntries(
      (await db.all("SELECT kind, data_json FROM user_documents WHERE user_id = $1 AND kind IN ('focus_log', 'planner')", [row.user_id])).map((r) => [r.kind, parse(r.data_json, {})]),
    );
    const items = (doc) => (Array.isArray(doc?.items) ? doc.items : []);
    const summary = weekSummary({
      decks,
      stats: parse(row.stats_json, {}),
      focusLog: items(documents.focus_log),
      planner: items(documents.planner),
      now,
      today: day,
    });
    const unsubscribeUrl = apiUrl ? `${apiUrl}/api/digest/unsubscribe?t=${row.unsubscribe_token}` : '';
    const mail = digestEmail({
      name: row.name,
      summary,
      reviewUrl: `${siteUrl}/?launch=quick_sprint`,
      unsubscribeUrl,
      settingsUrl: siteUrl || '',
    });
    try {
      await mailer.send({
        to: row.email,
        ...mail,
        headers: unsubscribeUrl ? { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined,
      });
      await db.run('UPDATE digest_subscriptions SET last_sent_week = $1 WHERE user_id = $2', [week, row.user_id]);
      sent++;
    } catch (err) {
      console.warn('[Digest] Could not send a weekly email:', err?.message ?? err);
    }
  }
  return { checked: rows.length, sent };
}

/** Sends weekly emails now and every few minutes while the server is up. Does nothing without email set up. */
export function startDigestSchedule({ mailer, siteUrl, apiUrl, everyMs = 15 * 60_000 } = {}) {
  if (!mailer) return () => {};
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const { sent } = await runDigests({ mailer, siteUrl, apiUrl });
      if (sent > 0) console.log(`[Digest] Sent ${sent} weekly emails.`);
    } catch (err) {
      console.error('[Digest] Run failed:', err.message);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(run, everyMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
