import type { EarningEntry, ExamReport, FocusLogEntry, FocusTask, InterleavingSessionReport, PlannerItem, RetrievalCard, StudySession, UserStats, StudentEducationProfile, SubjectFolder, CognitiveMemoryProfile } from '../types';
import { deckWithSavedProgress, withNewerContent, withSavedProgress, type CardContentPatch } from '../utils/cardProgress';
import { STARTING_COINS, guestEarningsAllowance, transferableGuestCoins } from './economy/wallet';
import { IndexedDbService } from './indexedDbService';
import { uncoveredMs, type StudyInterval } from '../utils/studyIntervals';
import { cleanDeletionLog, newerProgress, type DeletionKind, type DeletionLog } from './syncMerge';
import { DEFAULT_NEW_CARDS_PER_DAY, buildDailyQueue, type DailyQueue } from './dailyReview';

const STORAGE_KEYS = {
  SESSIONS: 'studify_sessions_v1',
  CARDS: 'studify_cards_v1',
  STATS: 'studify_stats_v1',
  EXAM_REPORTS: 'studify_exam_reports_v1',
  INTERLEAVING_REPORTS: 'studify_interleaving_reports_v1',
  DIAGRAMS: 'studify_concept_diagrams_v1',
  API_KEY: 'studify_gemini_api_key',
  SOUND_PREF: 'studify_sound_pref',
  ACTIVITY: 'studify_activity_history_v1',
  GUEST_PROFILE: 'studify_guest_education_profile_v1',
  FOLDERS: 'studify_folders_v1',
  EARNINGS: 'studify_earnings_v1',
  COMPLETIONS: 'studify_paid_completions_v1',
  WEEKLY_XP: 'studify_weekly_xp_v1',
  PLANNER: 'studify_planner_v1',
  FOCUS_TASKS: 'studify_focus_tasks_v1',
  FOCUS_LOG: 'studify_focus_log_v1',
  FOCUS_NOTES: 'studify_focus_notes_v1',
  STUDY_INTERVALS: 'studify_study_intervals_v1',
  FOCUS_NOTES_SAVED: 'studify_focus_notes_saved_v1',
  DELETIONS: 'studify_deletions_v1',
  SYNC_STATE: 'studify_sync_state_v1',
  NEW_CARDS_TODAY: 'studify_new_cards_v1',
};

/** The Monday a date's week starts on, as YYYY-MM-DD in UTC. */
const weekStartOf = (date: Date): string => {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().split('T')[0];
};

/**
 * Life-sim data: the avatar and wallet, the day's ledger, meal boosts, the home and its
 * furniture, and the streak freeze. Kept per profile like study data, through lifeKey().
 */
export const LIFE_KEYS = {
  CHARACTER: 'studify_user_character_v1',
  LEDGER: 'studify_daily_ledger_v1',
  BUFFS: 'studify_active_buffs_v1',
  LEDGER_HISTORY: 'studify_ledger_history_v1',
  ROOM_DESIGNS: 'studify_room_designs_v1',
  OWNED_FURNITURE: 'studify_owned_furniture_v1',
  HOME_FINISHES: 'studify_home3d_finishes_v1',
  HOME_ROTATIONS: 'studify_home3d_rotations_v1',
  STREAK_FREEZE: 'axon_synaptic_freeze_active',
} as const;

/** Set once the device-wide life-sim data of older versions has been given to a profile. */
const LIFE_SPLIT_MARKER = 'studify_life_data_split_v1';

/** Study data stored per profile (guest or account): what a reset or account deletion removes. */
const PROFILE_DATA_KEYS = [
  STORAGE_KEYS.SESSIONS,
  STORAGE_KEYS.CARDS,
  STORAGE_KEYS.STATS,
  STORAGE_KEYS.ACTIVITY,
  STORAGE_KEYS.EXAM_REPORTS,
  STORAGE_KEYS.INTERLEAVING_REPORTS,
  STORAGE_KEYS.EARNINGS,
  STORAGE_KEYS.DIAGRAMS,
  STORAGE_KEYS.FOLDERS,
  STORAGE_KEYS.COMPLETIONS,
  STORAGE_KEYS.WEEKLY_XP,
  STORAGE_KEYS.PLANNER,
  STORAGE_KEYS.FOCUS_TASKS,
  STORAGE_KEYS.FOCUS_LOG,
  STORAGE_KEYS.FOCUS_NOTES,
  STORAGE_KEYS.STUDY_INTERVALS,
  STORAGE_KEYS.FOCUS_NOTES_SAVED,
  STORAGE_KEYS.DELETIONS,
  STORAGE_KEYS.SYNC_STATE,
  STORAGE_KEYS.NEW_CARDS_TODAY,
];

const LEVEL_TITLES = [
  'Synapse Builder',
  'Deep Worker',
  'Active Retrievist',
  'Feynman Practitioner',
  'Cortical Architect',
  'Cognitive Alchemist',
  'Hippocampal Maestro',
  'Memory Champion',
  'Neuroplastic Prodigy',
  'Cognitive Sovereign'
];

/** An earnings log as saved, or empty when missing or unreadable. */
const parseEarnings = (raw: string | null): EarningEntry[] => {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export class StorageService {
  private static activeUserId: string | null = (() => {
    try {
      return localStorage.getItem('studify_active_user_id');
    } catch {
      return null;
    }
  })();

  public static setActiveUserId(userId: string | null): void {
    this.activeUserId = userId;
    this.overflow.clear();
    void this.hydrateOverflow();
    // Services that cache a profile's data in memory (wallet, ledger) reload it.
    this.profileListeners.forEach(fn => {
      try { fn(); } catch {}
    });
  }

  private static profileListeners = new Set<() => void>();

  /** Called after switching profiles (signing in or out). */
  public static addProfileListener(listener: () => void): () => void {
    this.profileListeners.add(listener);
    return () => this.profileListeners.delete(listener);
  }

  /** The active profile's storage key for a piece of life-sim data (see LIFE_KEYS). */
  public static lifeKey(base: string): string {
    this.splitDeviceLifeDataOnce();
    return this.getKey(base);
  }

  /**
   * Older versions kept life-sim data once per device. The first time this version runs,
   * that copy goes to the active profile: moved, not copied, so tokens are never
   * duplicated. A guest already owns it (the guest's keys have no suffix).
   */
  private static splitDeviceLifeDataOnce(): void {
    try {
      if (localStorage.getItem(LIFE_SPLIT_MARKER)) return;
      localStorage.setItem(LIFE_SPLIT_MARKER, '1');
      if (!this.activeUserId) return;
      for (const base of Object.values(LIFE_KEYS)) {
        const deviceCopy = localStorage.getItem(base);
        const ownKey = `${base}_${this.activeUserId}`;
        if (deviceCopy !== null && localStorage.getItem(ownKey) === null) {
          localStorage.setItem(ownKey, deviceCopy);
          localStorage.removeItem(base);
        }
      }
    } catch {
      // Storage unavailable: nothing to split.
    }
  }

  public static getActiveUserId(): string | null {
    return this.activeUserId;
  }

  public static getKey(baseKey: string): string {
    if (baseKey === STORAGE_KEYS.API_KEY || baseKey === STORAGE_KEYS.SOUND_PREF) {
      return baseKey;
    }
    if (!this.activeUserId) {
      return baseKey;
    }
    return `${baseKey}_${this.activeUserId}`;
  }

  /**
   * Values that did not fit in localStorage. They live in memory and are mirrored
   * to IndexedDB (`overflow:<key>`), so reads must consult this map before localStorage.
   */
  private static overflow = new Map<string, string>();

  private static readonly OVERFLOW_PREFIX = 'overflow:';

  private static readRaw(key: string): string | null {
    const spilled = this.overflow.get(key);
    if (spilled !== undefined) return spilled;
    return localStorage.getItem(key);
  }

  private static dropOverflow(key: string): void {
    if (this.overflow.delete(key)) {
      IndexedDbService.removeItem(this.OVERFLOW_PREFIX + key).catch(() => {});
    }
  }

  /** Removes spilled copies of a key, including their IndexedDB mirror. Resolves once that is committed. */
  private static purgeOverflow(key: string): Promise<void> {
    this.overflow.delete(key);
    return IndexedDbService.removeItem(this.OVERFLOW_PREFIX + key).then(
      () => undefined,
      () => undefined,
    );
  }

  /** Removes one profile's study data from localStorage and the IndexedDB overflow. */
  private static removeProfileData(suffix: string, bases: readonly string[] = PROFILE_DATA_KEYS): Promise<void> {
    const removals = bases.map(base => {
      const key = `${base}${suffix}`;
      localStorage.removeItem(key);
      return this.purgeOverflow(key);
    });
    return Promise.all(removals).then(() => undefined);
  }

  /**
   * Deletes the active profile's study data: decks, cards, stats, history, reports and
   * subjects. The earnings log stays with the wallet, so a reset cannot reopen today's
   * pay caps. Preferences and other profiles are untouched. Reload the page afterwards
   * so in-memory services start clean.
   */
  public static async clearStudyData(): Promise<void> {
    const suffix = this.activeUserId ? `_${this.activeUserId}` : '';
    await this.removeProfileData(suffix, PROFILE_DATA_KEYS.filter(base => base !== STORAGE_KEYS.EARNINGS));
    this.notifyMutation();
  }

  /**
   * Loads any spilled values for the active user from IndexedDB. Await this at startup
   * and after switching users, before the UI reads study data.
   */
  public static async hydrateOverflow(): Promise<void> {
    const bases = [
      STORAGE_KEYS.SESSIONS,
      STORAGE_KEYS.CARDS,
      STORAGE_KEYS.EXAM_REPORTS,
      STORAGE_KEYS.INTERLEAVING_REPORTS,
      STORAGE_KEYS.ACTIVITY,
      STORAGE_KEYS.FOLDERS,
      STORAGE_KEYS.STATS,
      STORAGE_KEYS.EARNINGS,
    ];
    await Promise.all(bases.map(async (base) => {
      const key = this.getKey(base);
      const value = await IndexedDbService.getItem(this.OVERFLOW_PREFIX + key);
      if (value !== null && !this.overflow.has(key)) this.overflow.set(key, value);
    }));
  }

  /**
   * Resilient writer that protects against QuotaExceededError. Data that cannot fit in
   * localStorage is kept durably in IndexedDB and served back through readRaw.
   */
  private static safeSetItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      this.dropOverflow(key);
      return true;
    } catch (e) {
      console.warn(`[StorageService] localStorage.setItem failed for key "${key}":`, e);
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
        try {
          // Prune ephemeral diagram caches from localStorage (these are backed up in IndexedDB)
          localStorage.removeItem(this.getKey(STORAGE_KEYS.DIAGRAMS));

          // Retry write without destroying any user decks
          localStorage.setItem(key, value);
          this.dropOverflow(key);
          return true;
        } catch {
          // Still constrained: keep the newest value in memory and persist it to IndexedDB.
          // A stale localStorage copy may remain, but readRaw always prefers this value.
          if (IndexedDbService.isSupported()) {
            this.overflow.set(key, value);
            IndexedDbService.setItem(this.OVERFLOW_PREFIX + key, value).then((ok) => {
              if (!ok) console.error('[StorageService] IndexedDB overflow write failed for', key);
            });
            return true;
          }
        }
      }
      return false;
    }
  }

  private static calculateLevel(xp: number): { level: number; title: string } {
    // 150 XP per level
    const level = Math.max(1, Math.floor(xp / 150) + 1);
    const titleIndex = Math.min(LEVEL_TITLES.length - 1, level - 1);
    return { level, title: LEVEL_TITLES[titleIndex] };
  }

  /** The learner's level and title, from their XP. A cheap read for display. */
  public static getStudyLevel(): { level: number; title: string } {
    try {
      const raw = this.readRaw(this.getKey(STORAGE_KEYS.STATS));
      return this.calculateLevel(raw ? Number(JSON.parse(raw).xp) || 0 : 0);
    } catch {
      return this.calculateLevel(0);
    }
  }

  public static hasSynapticFreeze(): boolean {
    try {
      return localStorage.getItem(this.lifeKey(LIFE_KEYS.STREAK_FREEZE)) === 'true';
    } catch {
      return false;
    }
  }

  public static setSynapticFreeze(active: boolean): void {
    try {
      if (active) {
        localStorage.setItem(this.lifeKey(LIFE_KEYS.STREAK_FREEZE), 'true');
      } else {
        localStorage.removeItem(this.lifeKey(LIFE_KEYS.STREAK_FREEZE));
      }
    } catch {}
    this.notifyMutation();
  }

  public static getStats(): UserStats {
    const raw = this.readRaw(this.getKey(STORAGE_KEYS.STATS));
    const today = new Date().toISOString().split('T')[0];

    const defaultStats: UserStats = {
      totalStudyMinutes: 0,
      sessionsCompleted: 0,
      conceptsMastered: 0,
      currentStreak: 0,
      lastActiveDate: '',
      cardsDueCount: 0,
      xp: 0,
      level: 1,
      levelTitle: 'Synapse Builder',
      dailyGoalMinutes: 25,
      todayMinutes: 0,
      targetRetention: 0.90,
    };

    if (!raw) {
      defaultStats.cardsDueCount = this.getDueCards().length;
      return defaultStats;
    }

    try {
      const stats: UserStats = { ...defaultStats, ...JSON.parse(raw) };
      
      // Handle day rollover and streak protection
      if (stats.lastActiveDate && stats.lastActiveDate !== today) {
        const last = new Date(stats.lastActiveDate);
        const curr = new Date(today);
        const diffDays = Math.round((curr.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          // Exactly 1 day since last study. Streak is intact and alive,
          // but NOT incremented yet (user must complete active study today).
          // Reset daily study minutes for the new day.
          if (stats.todayMinutes !== 0) {
            stats.todayMinutes = 0;
            this.safeSetItem(this.getKey(STORAGE_KEYS.STATS), JSON.stringify(stats));
          }
        } else if (diffDays === 2) {
          // Missed 1 day! Check if Synaptic Freeze is active
          const hasFreeze = this.hasSynapticFreeze();
          if (hasFreeze && stats.currentStreak > 0) {
            // Shield the streak! Consume freeze item
            try {
              localStorage.removeItem(this.lifeKey(LIFE_KEYS.STREAK_FREEZE));
            } catch {}
            // Treat the missed day as protected by backdating lastActiveDate to yesterday
            const yesterday = new Date(curr.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            stats.lastActiveDate = yesterday;
            stats.todayMinutes = 0;
            this.safeSetItem(this.getKey(STORAGE_KEYS.STATS), JSON.stringify(stats));
          } else {
            // Unshielded missed day: streak resets
            stats.currentStreak = 0;
            stats.todayMinutes = 0;
            this.safeSetItem(this.getKey(STORAGE_KEYS.STATS), JSON.stringify(stats));
          }
        } else if (diffDays > 2) {
          // Missed multiple days: streak resets (freeze only covers 1 missed day)
          try {
            localStorage.removeItem(this.lifeKey(LIFE_KEYS.STREAK_FREEZE));
          } catch {}
          stats.currentStreak = 0;
          stats.todayMinutes = 0;
          this.safeSetItem(this.getKey(STORAGE_KEYS.STATS), JSON.stringify(stats));
        }
      }

      const { level, title } = this.calculateLevel(stats.xp || 0);
      stats.level = level;
      stats.levelTitle = title;
      stats.cardsDueCount = this.getDueCards().length;
      return stats;
    } catch {
      return defaultStats;
    }
  }

  private static mutationListeners: Array<() => void> = [];

  public static addMutationListener(listener: () => void): () => void {
    this.mutationListeners.push(listener);
    return () => {
      this.mutationListeners = this.mutationListeners.filter(l => l !== listener);
    };
  }

  private static notifyMutation(): void {
    this.mutationListeners.forEach(fn => {
      try { fn(); } catch {}
    });
  }

  public static saveStats(stats: UserStats) {
    this.safeSetItem(this.getKey(STORAGE_KEYS.STATS), JSON.stringify(stats));
    this.notifyMutation();
  }

  public static addXP(amount: number): { newXP: number; newLevel: number; leveledUp: boolean } {
    const stats = this.getStats();
    const oldLevel = stats.level;
    stats.xp = (stats.xp || 0) + Math.max(0, Math.round(amount));

    const { level, title } = this.calculateLevel(stats.xp);
    stats.level = level;
    stats.levelTitle = title;

    this.saveStats(stats);
    return {
      newXP: stats.xp,
      newLevel: level,
      leveledUp: level > oldLevel,
    };
  }

  /**
   * XP earned this week (from Monday, in UTC like the app's days) and the best week so
   * far, per profile. Older versions kept one ever-growing total per device; it is ignored.
   */
  public static getWeeklyXP(): { current: number; best: number } {
    try {
      const saved = JSON.parse(this.readRaw(this.getKey(STORAGE_KEYS.WEEKLY_XP)) || 'null') as
        | { week: string; current: number; best: number }
        | null;
      if (!saved) return { current: 0, best: 0 };
      const current = saved.week === weekStartOf(new Date()) ? saved.current : 0;
      return { current, best: Math.max(saved.best || 0, current) };
    } catch {
      return { current: 0, best: 0 };
    }
  }

  /** This week's XP with the week it belongs to (its Monday, UTC), as friends see it. */
  public static getWeeklyXPForSync(now: Date = new Date()): { weekXp: number; weekXpWeek: string } {
    const week = weekStartOf(now);
    try {
      const saved = JSON.parse(this.readRaw(this.getKey(STORAGE_KEYS.WEEKLY_XP)) || 'null') as { week: string; current: number } | null;
      return { weekXp: saved?.week === week ? saved.current : 0, weekXpWeek: week };
    } catch {
      return { weekXp: 0, weekXpWeek: week };
    }
  }

  public static addWeeklyXP(amount: number): number {
    const safeAmount = Math.max(0, Math.round(amount));
    const { current, best } = this.getWeeklyXP();
    const next = current + safeAmount;
    this.safeSetItem(
      this.getKey(STORAGE_KEYS.WEEKLY_XP),
      JSON.stringify({ week: weekStartOf(new Date()), current: next, best: Math.max(best, next) }),
    );
    // The device-wide totals of older versions are no longer read.
    ['lotti_weekly_xp', 'lotti_weekly_xp_best', 'axon_weekly_xp'].forEach(key => localStorage.removeItem(key));
    this.addXP(safeAmount);
    return next;
  }

  /** Append-only log of every XP/token payout, kept for daily caps and future server validation. */
  public static getEarnings(): EarningEntry[] {
    const raw = this.readRaw(this.getKey(STORAGE_KEYS.EARNINGS));
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public static saveEarnings(entries: EarningEntry[]): void {
    this.safeSetItem(this.getKey(STORAGE_KEYS.EARNINGS), JSON.stringify(entries));
  }

  public static getActivityHistory(): Record<string, number> {
    const raw = this.readRaw(this.getKey(STORAGE_KEYS.ACTIVITY));
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  public static saveActivityHistory(history: Record<string, number>) {
    this.safeSetItem(this.getKey(STORAGE_KEYS.ACTIVITY), JSON.stringify(history));
  }

  /**
   * Records active study for today, advancing streak if consecutive day
   */
  public static recordActiveStudyDay(): UserStats {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const stats = this.getStats();
    // Kept at most a minute stale, so studying doesn't save stats on every card.
    const previous = Date.parse(stats.lastStudiedAt ?? '');
    const touch = !Number.isFinite(previous) || now.getTime() - previous > 60_000;
    if (touch) stats.lastStudiedAt = now.toISOString();

    if (stats.lastActiveDate !== today) {
      if (stats.lastActiveDate) {
        const last = new Date(stats.lastActiveDate);
        const curr = new Date(today);
        const diffDays = Math.round((curr.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          stats.currentStreak = (stats.currentStreak || 0) + 1;
        } else {
          stats.currentStreak = 1;
        }
      } else {
        // First active day ever
        stats.currentStreak = 1;
      }
      stats.lastActiveDate = today;
      this.saveStats(stats);
    } else if (touch) {
      this.saveStats(stats);
    }

    return stats;
  }

  /** How long recent study intervals are kept, to tell when new study time overlaps them. */
  private static readonly STUDY_INTERVAL_WINDOW_MS = 24 * 60 * 60 * 1000;

  /** Study time recorded in the last day, from reviews and focus sessions. */
  private static getRecentStudyIntervals(now: number): StudyInterval[] {
    const cutoff = now - this.STUDY_INTERVAL_WINDOW_MS;
    return this.readArray<StudyInterval>(STORAGE_KEYS.STUDY_INTERVALS).filter(
      i => typeof i?.start === 'number' && typeof i?.end === 'number' && i.end > cutoff,
    );
  }

  /**
   * Adds study time to today's minutes, the streak and the activity history. `interval` is when
   * the time was spent (by default, the `minutes` just before now). Time already recorded for an
   * overlapping interval (reviewing during a focus session, say) counts once, not twice.
   */
  public static recordStudyMinutes(minutes: number, interval?: StudyInterval) {
    const now = Date.now();
    const span = interval ?? { start: now - Math.max(0, minutes) * 60_000, end: now };
    const recent = this.getRecentStudyIntervals(now);
    const uncovered = uncoveredMs(recent, span);
    const overlapped = uncovered < span.end - span.start;
    if (span.end > span.start) {
      this.safeSetItem(this.getKey(STORAGE_KEYS.STUDY_INTERVALS), JSON.stringify([...recent, { start: span.start, end: span.end }]));
    }

    const stats = this.recordActiveStudyDay();
    // A session with no overlap counts at least a minute, as it always has.
    const added = overlapped ? Math.round(uncovered / 60_000) : Math.max(1, Math.round(minutes));
    if (added <= 0) return;
    stats.totalStudyMinutes += added;
    stats.todayMinutes = (stats.todayMinutes || 0) + added;
    this.saveStats(stats);

    const today = new Date().toISOString().split('T')[0];
    const history = this.getActivityHistory();
    history[today] = (history[today] || 0) + added;
    this.saveActivityHistory(history);
  }

  public static getNewCardsPerDay(): number {
    return this.getStats().newCardsPerDay ?? DEFAULT_NEW_CARDS_PER_DAY;
  }

  public static setNewCardsPerDay(count: number) {
    const stats = this.getStats();
    stats.newCardsPerDay = Math.max(1, Math.min(100, Math.round(count)));
    this.saveStats(stats);
  }

  private static localDay(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  /** Ids of new cards first studied today (they count against today's new-card limit). */
  public static getNewCardsStartedToday(now: Date = new Date()): string[] {
    const raw = this.readRaw(this.getKey(STORAGE_KEYS.NEW_CARDS_TODAY));
    try {
      const log = raw ? JSON.parse(raw) : null;
      return log?.day === this.localDay(now) && Array.isArray(log.ids) ? log.ids : [];
    } catch {
      return [];
    }
  }

  /** Notes a new card studied for the first time today. */
  public static recordNewCardStarted(cardId: string, now: Date = new Date()): void {
    const ids = this.getNewCardsStartedToday(now);
    if (ids.includes(cardId)) return;
    this.safeSetItem(this.getKey(STORAGE_KEYS.NEW_CARDS_TODAY), JSON.stringify({ day: this.localDay(now), ids: [...ids, cardId] }));
  }

  /** Today's review across every deck: cards due now, then new cards up to the daily limit. */
  public static getDailyQueue(now: Date = new Date()): DailyQueue {
    const decks = this.getSessions().map(deck => this.deckWithLatestProgress(deck));
    return buildDailyQueue(decks, this.savedCardsById(), {
      now,
      newPerDay: this.getNewCardsPerDay(),
      newStartedToday: this.getNewCardsStartedToday(now).length,
    });
  }

  public static setDailyGoal(minutes: number) {
    const stats = this.getStats();
    stats.dailyGoalMinutes = Math.max(5, Math.min(240, minutes));
    this.saveStats(stats);
  }

  public static setTargetRetention(rate: number) {
    const stats = this.getStats();
    stats.targetRetention = Math.max(0.75, Math.min(0.97, rate));
    this.saveStats(stats);
  }

  public static getTargetRetention(): number {
    return this.getStats().targetRetention || 0.90;
  }

  /**
   * Marks a finished session (see completionKey) as recorded and paid. True the first
   * time for a given key, false after, so reopening a summary never pays twice.
   */
  public static claimCompletion(key: string): boolean {
    const storageKey = this.getKey(STORAGE_KEYS.COMPLETIONS);
    let claimed: string[] = [];
    try {
      const parsed = JSON.parse(this.readRaw(storageKey) || '[]');
      if (Array.isArray(parsed)) claimed = parsed;
    } catch {
      claimed = [];
    }
    if (claimed.includes(key)) return false;
    this.safeSetItem(storageKey, JSON.stringify([key, ...claimed].slice(0, 500)));
    return true;
  }

  public static recordCompletedSession() {
    const stats = this.recordActiveStudyDay();
    stats.sessionsCompleted += 1;
    this.saveStats(stats);
  }

  public static recordMasteredConcept() {
    const stats = this.recordActiveStudyDay();
    stats.conceptsMastered += 1;
    this.saveStats(stats);
  }

  public static getApiKey(): string {
    return localStorage.getItem(STORAGE_KEYS.API_KEY) || '';
  }

  public static setApiKey(key: string) {
    if (key.trim()) {
      this.safeSetItem(STORAGE_KEYS.API_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.API_KEY);
    }
  }

  /**
   * Synchronizes card updates back to its parent session in SESSIONS
   */
  private static syncCardToSessions(card: RetrievalCard) {
    const sessions = this.getSessions();
    let updated = false;
    for (const s of sessions) {
      for (const c of s.concepts) {
        const idx = c.retrievalCards.findIndex(rc => rc.id === card.id);
        if (idx >= 0) {
          c.retrievalCards[idx] = { ...c.retrievalCards[idx], ...card };
          updated = true;
          break;
        }
      }
      if (updated) break;
    }
    if (updated) {
      this.safeSetItem(this.getKey(STORAGE_KEYS.SESSIONS), JSON.stringify(sessions));
    }
  }

  public static saveCard(card: RetrievalCard) {
    const today = new Date().toISOString().split('T')[0];
    if (card.lastReviewDate && card.lastReviewDate.startsWith(today)) {
      this.recordActiveStudyDay();
    }
    const cards = this.getAllCards();
    const index = cards.findIndex(c => c.id === card.id);
    if (index >= 0) {
      cards[index] = card;
    } else {
      cards.push(card);
    }
    this.safeSetItem(this.getKey(STORAGE_KEYS.CARDS), JSON.stringify(cards));
    this.syncCardToSessions(card);
    // A review changes what's due; counts shown elsewhere (the sidebar) refresh on this.
    this.notifyMutation();
  }

  public static saveCards(newCards: RetrievalCard[]) {
    const cards = this.getAllCards();
    const cardMap = new Map(cards.map(c => [c.id, c]));
    newCards.forEach(newCard => {
      cardMap.set(newCard.id, newCard);
    });
    const merged = Array.from(cardMap.values());
    this.safeSetItem(this.getKey(STORAGE_KEYS.CARDS), JSON.stringify(merged));

    // Also sync all updated cards into sessions
    const sessions = this.getSessions();
    let sessionUpdated = false;
    newCards.forEach(nc => {
      sessions.forEach(s => {
        s.concepts.forEach(c => {
          const idx = c.retrievalCards.findIndex(rc => rc.id === nc.id);
          if (idx >= 0) {
            c.retrievalCards[idx] = { ...c.retrievalCards[idx], ...nc };
            sessionUpdated = true;
          }
        });
      });
    });
    if (sessionUpdated) {
      this.safeSetItem(this.getKey(STORAGE_KEYS.SESSIONS), JSON.stringify(sessions));
    }
    this.notifyMutation();
  }

  /**
   * Changes a card's text (or hides it) in the saved cards and in every deck that holds it, marked
   * with the time, so the edit wins over older copies here and on the student's other devices.
   * Returns the card as saved, or null if there is no such card.
   */
  public static updateCardContent(cardId: string, patch: CardContentPatch, now: Date = new Date()): RetrievalCard | null {
    const saved = this.getAllCards().find(c => c.id === cardId);
    if (!saved) return null;
    const updated: RetrievalCard = { ...saved, ...patch, updatedAt: now.toISOString() };
    this.saveCards([updated]);
    return updated;
  }

  /** Hides a card from every review, or shows it again. */
  public static setCardHidden(cardId: string, hidden: boolean, now: Date = new Date()): RetrievalCard | null {
    return this.updateCardContent(cardId, { hidden: hidden || undefined }, now);
  }

  /**
   * Permanently deletes a card from both the global card queue and any parent sessions
   */
  /**
   * Swaps one card for others inside its deck, in the same place (e.g. a hard card
   * split into simpler ones). The new cards join the review queue and the old one
   * leaves it. A card that belongs to no deck is simply replaced in the queue.
   */
  public static replaceCard(cardId: string, replacements: RetrievalCard[]): void {
    const owner = this.getSessions().find(s => s.concepts.some(c => c.retrievalCards.some(rc => rc.id === cardId)));
    if (!owner) {
      this.deleteCard(cardId);
      if (replacements.length > 0) this.saveCards(replacements);
      return;
    }
    this.saveSession({
      ...owner,
      concepts: owner.concepts.map(concept => {
        const index = concept.retrievalCards.findIndex(rc => rc.id === cardId);
        if (index < 0) return concept;
        const next = [...concept.retrievalCards];
        next.splice(index, 1, ...replacements.map(card => ({ ...card, conceptId: concept.id })));
        return { ...concept, retrievalCards: next };
      }),
    });
  }

  public static deleteCard(cardId: string) {
    const cards = this.getAllCards().filter(c => c.id !== cardId);
    this.safeSetItem(this.getKey(STORAGE_KEYS.CARDS), JSON.stringify(cards));

    const sessions = this.getSessions();
    let sessionUpdated = false;
    sessions.forEach(s => {
      s.concepts.forEach(c => {
        const idx = c.retrievalCards.findIndex(rc => rc.id === cardId);
        if (idx >= 0) {
          c.retrievalCards.splice(idx, 1);
          sessionUpdated = true;
        }
      });
    });
    if (sessionUpdated) {
      this.safeSetItem(this.getKey(STORAGE_KEYS.SESSIONS), JSON.stringify(sessions));
    }
    this.notifyMutation();
  }

  public static toggleCardStar(cardId: string): boolean {
    const cards = this.getAllCards();
    const idx = cards.findIndex(c => c.id === cardId);
    let newStatus = true;
    if (idx >= 0) {
      cards[idx].isStarred = !cards[idx].isStarred;
      newStatus = !!cards[idx].isStarred;
      this.safeSetItem(this.getKey(STORAGE_KEYS.CARDS), JSON.stringify(cards));
    } else {
      const sessions = this.getSessions();
      let currentSessionStar = false;
      let foundInSession = false;
      for (const s of sessions) {
        for (const c of s.concepts) {
          const card = c.retrievalCards.find(rc => rc.id === cardId);
          if (card) {
            currentSessionStar = !!card.isStarred;
            foundInSession = true;
            break;
          }
        }
        if (foundInSession) break;
      }
      newStatus = foundInSession ? !currentSessionStar : true;
      cards.push({ id: cardId, isStarred: newStatus } as RetrievalCard);
      this.safeSetItem(this.getKey(STORAGE_KEYS.CARDS), JSON.stringify(cards));
    }

    const sessions = this.getSessions();
    let sessionUpdated = false;
    sessions.forEach(s => {
      s.concepts.forEach(c => {
        const card = c.retrievalCards.find(rc => rc.id === cardId);
        if (card) {
          card.isStarred = newStatus;
          sessionUpdated = true;
        }
      });
    });
    if (sessionUpdated) {
      this.safeSetItem(this.getKey(STORAGE_KEYS.SESSIONS), JSON.stringify(sessions));
    }
    this.notifyMutation();
    return newStatus;
  }

  public static isCardStarred(cardId: string): boolean {
    const cards = this.getAllCards();
    const card = cards.find(c => c.id === cardId);
    if (card && card.isStarred !== undefined) return !!card.isStarred;
    const sessions = this.getSessions();
    for (const s of sessions) {
      for (const c of s.concepts) {
        const rc = c.retrievalCards.find(rcard => rcard.id === cardId);
        if (rc && rc.isStarred !== undefined) return !!rc.isStarred;
      }
    }
    return false;
  }

  public static getSoundPreference(): string {
    return this.readRaw(this.getKey(STORAGE_KEYS.SOUND_PREF)) || 'binaural-40hz';
  }

  public static setSoundPreference(pref: string): void {
    this.safeSetItem(this.getKey(STORAGE_KEYS.SOUND_PREF), pref);
  }

  public static getAllCards(): RetrievalCard[] {
    const raw = this.readRaw(this.getKey(STORAGE_KEYS.CARDS));
    let cards: RetrievalCard[] = [];
    if (raw) {
      try {
        cards = JSON.parse(raw);
      } catch {
        cards = [];
      }
    }

    // Auto-backfill: Check if any sessions contain cards not yet indexed in CARDS
    const sessions = this.getSessions();
    const cardMap = new Map<string, RetrievalCard>(cards.map(c => [c.id, c]));
    let backfilled = false;

    sessions.forEach(s => {
      s.concepts?.forEach(c => {
        c.retrievalCards?.forEach(rc => {
          if (!cardMap.has(rc.id)) {
            cardMap.set(rc.id, rc);
            backfilled = true;
          }
        });
      });
    });

    if (backfilled) {
      const merged = Array.from(cardMap.values());
      this.safeSetItem(this.getKey(STORAGE_KEYS.CARDS), JSON.stringify(merged));
      return merged;
    }

    return cards;
  }

  /** The saved cards by id, without the backfill from decks that getAllCards does. */
  private static savedCardsById(): Map<string, RetrievalCard> {
    const raw = this.readRaw(this.getKey(STORAGE_KEYS.CARDS));
    if (!raw) return new Map();
    try {
      const cards: RetrievalCard[] = JSON.parse(raw);
      return new Map(cards.map(card => [card.id, card]));
    } catch {
      return new Map();
    }
  }

  /**
   * The card with its saved review progress. A deck's own copy of a card can be older
   * (a deck held in memory during a study session, say); schedule reviews from this,
   * or a review overwrites the ones made since that copy was taken.
   */
  public static withLatestProgress(card: RetrievalCard): RetrievalCard {
    return withSavedProgress(card, this.savedCardsById().get(card.id));
  }

  /** The deck with each card's saved review progress. */
  public static deckWithLatestProgress(session: StudySession): StudySession {
    return deckWithSavedProgress(session, this.savedCardsById());
  }

  public static getDueCards(): RetrievalCard[] {
    const all = this.getAllCards();
    const now = new Date();
    return all.filter(c => {
      if (c.hidden) return false;
      if (!c.nextReviewDate) return true;
      return new Date(c.nextReviewDate) <= now;
    });
  }

  /**
   * Returns the count of distinct cards reviewed today
   */
  public static getReviewedTodayCount(): number {
    const today = new Date().toISOString().split('T')[0];
    const all = this.getAllCards();
    return all.filter(c => c.lastReviewDate && c.lastReviewDate.startsWith(today)).length;
  }

  /**
   * Syncs cards from a study session into the global CARDS queue while preserving existing FSRS review progress.
   */
  private static syncSessionCardsToGlobalQueue(sessionCards: RetrievalCard[]): void {
    const raw = this.readRaw(this.getKey(STORAGE_KEYS.CARDS));
    let existingCards: RetrievalCard[] = [];
    if (raw) {
      try { existingCards = JSON.parse(raw); } catch { existingCards = []; }
    }
    const cardMap = new Map<string, RetrievalCard>(existingCards.map(c => [c.id, c]));

    sessionCards.forEach(sc => {
      const existing = cardMap.get(sc.id);
      if (existing) {
        // Preserve higher review progress (e.g. if already scheduled)
        const reps = Math.max(existing.reps || 0, sc.reps || 0);
        const stability = (existing.reps || 0) >= (sc.reps || 0) ? (existing.stability || sc.stability) : sc.stability;
        const difficulty = (existing.reps || 0) >= (sc.reps || 0) ? (existing.difficulty || sc.difficulty) : sc.difficulty;
        const lastReviewDate = existing.lastReviewDate || sc.lastReviewDate;
        const nextReviewDate = existing.nextReviewDate || sc.nextReviewDate;
        const isStarred = existing.isStarred !== undefined ? existing.isStarred : sc.isStarred;

        // A card edited during a review keeps that edit over an older copy in the deck being saved.
        cardMap.set(sc.id, withNewerContent({
          ...sc,
          ...existing,
          hidden: sc.hidden,
          updatedAt: sc.updatedAt,
          clozeTemplate: sc.clozeTemplate ?? existing.clozeTemplate,
          question: sc.question,
          answer: sc.answer,
          hint: sc.hint || existing.hint,
          explanation: sc.explanation || existing.explanation,
          options: sc.options || existing.options,
          masks: sc.masks || existing.masks,
          imageUrl: sc.imageUrl || existing.imageUrl,
          reps,
          stability,
          difficulty,
          lastReviewDate,
          nextReviewDate,
          isStarred,
        }, existing));
      } else {
        cardMap.set(sc.id, sc);
      }
    });

    this.safeSetItem(this.getKey(STORAGE_KEYS.CARDS), JSON.stringify(Array.from(cardMap.values())));
  }

  private static cardIdsOf(session: StudySession): string[] {
    return session.concepts?.flatMap(c => c.retrievalCards?.map(rc => rc.id) || []) || [];
  }

  /** Drops cards from the review queue when no remaining deck contains them. */
  private static removeCardsNoLongerInAnyDeck(cardIds: string[], remainingSessions: StudySession[]): void {
    if (cardIds.length === 0) return;
    const stillUsed = new Set(remainingSessions.flatMap(s => this.cardIdsOf(s)));
    const toDelete = new Set(cardIds.filter(id => !stillUsed.has(id)));
    if (toDelete.size === 0) return;
    const raw = this.readRaw(this.getKey(STORAGE_KEYS.CARDS));
    if (!raw) return;
    try {
      const cards: RetrievalCard[] = JSON.parse(raw);
      this.safeSetItem(this.getKey(STORAGE_KEYS.CARDS), JSON.stringify(cards.filter(c => !toDelete.has(c.id))));
    } catch {
      // A corrupt queue is rebuilt from the decks on the next read.
    }
  }

  /**
   * Readies decks to be stored. Their cards join the review queue first; the queue keeps each card's
   * furthest progress. Each deck is then stored with that progress: a deck held in memory during a
   * study session still has its cards as they were when it was loaded, and saving it must not roll
   * back the reviews since. The copy is also lightweight: a heavy base64 PDF payload moves to
   * IndexedDB, so it doesn't blow the 5MB limit.
   */
  private static prepareDecksToStore(decks: StudySession[]): StudySession[] {
    const deckCards = decks.flatMap(s => s.concepts?.flatMap(c => c.retrievalCards || []) || []);
    if (deckCards.length > 0) {
      this.syncSessionCardsToGlobalQueue(deckCards);
    }
    const savedCards = this.savedCardsById();
    return decks.map(deck => {
      const pdfDataUrl = deck.sourceDocument?.pdfDataUrl;
      const offloadPdf = !!pdfDataUrl && pdfDataUrl.length > 20000;
      if (offloadPdf) {
        IndexedDbService.setItem(`pdf_${deck.id}`, pdfDataUrl).catch(() => {});
      }
      return {
        ...deckWithSavedProgress(deck, savedCards),
        sourceDocument: deck.sourceDocument ? {
          ...deck.sourceDocument,
          pdfDataUrl: offloadPdf ? '[indexeddb]' : pdfDataUrl,
        } : undefined,
      };
    });
  }

  /**
   * Writes the whole deck list, then takes cards that were in a deck and are in none now out of the
   * review queue, so they don't keep coming due. No deck is ever dropped to save space: a list too
   * big for localStorage spills to IndexedDB (see safeSetItem).
   */
  private static writeSessions(sessions: StudySession[], previous: StudySession[]): void {
    this.safeSetItem(this.getKey(STORAGE_KEYS.SESSIONS), JSON.stringify(sessions));
    this.removeCardsNoLongerInAnyDeck(previous.flatMap(s => this.cardIdsOf(s)), sessions);
    this.notifyMutation();
  }

  /** Saves a deck. An edited deck keeps its place in the list; a new one goes first. */
  public static saveSession(session: StudySession) {
    const [stored] = this.prepareDecksToStore([session]);
    const sessions = this.getSessions();
    const next = [...sessions];
    const idx = next.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      next[idx] = stored;
    } else {
      next.unshift(stored);
    }
    this.writeSessions(next, sessions);
  }

  /** Replaces the deck list, storing each deck the way saveSession does. */
  public static saveSessions(sessions: StudySession[]): void {
    this.writeSessions(this.prepareDecksToStore(sessions), this.getSessions());
  }

  public static async loadPDFDataUrl(sessionId: string): Promise<string | null> {
    const fromIdb = await IndexedDbService.getItem(`pdf_${sessionId}`);
    if (fromIdb) return fromIdb;
    const session = this.getSessions().find(s => s.id === sessionId);
    if (session?.sourceDocument?.pdfDataUrl && session.sourceDocument.pdfDataUrl !== '[indexeddb]') {
      return session.sourceDocument.pdfDataUrl;
    }
    return null;
  }

  public static deleteSession(id: string) {
    const sessions = this.getSessions();
    const sessionToDelete = sessions.find(s => s.id === id);
    const updatedSessions = sessions.filter(s => s.id !== id);
    this.recordDeletion('decks', id);
    this.safeSetItem(this.getKey(STORAGE_KEYS.SESSIONS), JSON.stringify(updatedSessions));
    IndexedDbService.removeItem(`pdf_${id}`).catch(() => {});

    // Remove this deck's cards from the review queue, unless another deck still uses them.
    if (sessionToDelete) {
      this.removeCardsNoLongerInAnyDeck(this.cardIdsOf(sessionToDelete), updatedSessions);
    }
    this.notifyMutation();
  }

  public static getSessions(): StudySession[] {
    const raw = this.readRaw(this.getKey(STORAGE_KEYS.SESSIONS));
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static getFolders(): SubjectFolder[] {
    const raw = this.readRaw(this.getKey(STORAGE_KEYS.FOLDERS));
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public static saveFolders(folders: SubjectFolder[]): void {
    this.safeSetItem(this.getKey(STORAGE_KEYS.FOLDERS), JSON.stringify(folders));
    this.notifyMutation();
  }

  /** Exams, homework and other dated items in the planner. */
  public static getPlannerItems(): PlannerItem[] {
    const raw = this.readRaw(this.getKey(STORAGE_KEYS.PLANNER));
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public static savePlannerItems(items: PlannerItem[]): void {
    this.safeSetItem(this.getKey(STORAGE_KEYS.PLANNER), JSON.stringify(items));
    this.notifyMutation();
  }

  /** A JSON array saved under a profile key, or empty when missing or unreadable. */
  private static readArray<T>(baseKey: string): T[] {
    const raw = this.readRaw(this.getKey(baseKey));
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /*
   * Focus workspace data. It isn't part of cloud sync, so saving it doesn't notify the
   * mutation listeners (which would start a sync); FocusService tells its own listeners.
   */

  public static getFocusTasks(): FocusTask[] {
    return this.readArray<FocusTask>(STORAGE_KEYS.FOCUS_TASKS);
  }

  public static saveFocusTasks(tasks: FocusTask[]): void {
    this.safeSetItem(this.getKey(STORAGE_KEYS.FOCUS_TASKS), JSON.stringify(tasks));
  }

  public static getFocusLog(): FocusLogEntry[] {
    return this.readArray<FocusLogEntry>(STORAGE_KEYS.FOCUS_LOG);
  }

  public static saveFocusLog(entries: FocusLogEntry[]): void {
    this.safeSetItem(this.getKey(STORAGE_KEYS.FOCUS_LOG), JSON.stringify(entries));
  }

  public static getFocusNotes(): string {
    return this.readRaw(this.getKey(STORAGE_KEYS.FOCUS_NOTES)) ?? '';
  }

  /** When the Focus notes were last changed (epoch ms; 0 if never), for account sync. */
  public static getFocusNotesUpdatedAt(): number {
    return Number(this.readRaw(this.getKey(STORAGE_KEYS.FOCUS_NOTES_SAVED))) || 0;
  }

  public static saveFocusNotes(notes: string, updatedAt: number = Date.now()): void {
    this.safeSetItem(this.getKey(STORAGE_KEYS.FOCUS_NOTES_SAVED), String(updatedAt));
    const key = this.getKey(STORAGE_KEYS.FOCUS_NOTES);
    if (notes) this.safeSetItem(key, notes);
    else {
      localStorage.removeItem(key);
      this.dropOverflow(key);
    }
  }

  /** What was deleted on this profile, and when, so account sync deletes it on other devices too. */
  public static getDeletions(): DeletionLog {
    const raw = this.readRaw(this.getKey(STORAGE_KEYS.DELETIONS));
    try {
      return cleanDeletionLog(raw ? JSON.parse(raw) : null);
    } catch {
      return cleanDeletionLog(null);
    }
  }

  public static saveDeletions(log: DeletionLog): void {
    this.safeSetItem(this.getKey(STORAGE_KEYS.DELETIONS), JSON.stringify(log));
  }

  public static recordDeletion(kind: DeletionKind, ids: string | readonly string[]): void {
    const list = typeof ids === 'string' ? [ids] : ids;
    if (list.length === 0) return;
    const log = this.getDeletions();
    const at = new Date().toISOString();
    for (const id of list) log[kind][id] = at;
    this.saveDeletions(log);
  }

  /** Account sync's own bookkeeping for this profile (what was last sent, and when it last pulled). */
  public static getSyncState<T>(): T | null {
    const raw = this.readRaw(this.getKey(STORAGE_KEYS.SYNC_STATE));
    try {
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  public static saveSyncState(state: unknown): void {
    this.safeSetItem(this.getKey(STORAGE_KEYS.SYNC_STATE), JSON.stringify(state));
  }

  /**
   * Takes review progress from another device's copies of cards, where it is newer than what
   * is saved here (see newerProgress). Card content and stars stay as they are on this device.
   */
  public static mergeCardProgress(cards: readonly RetrievalCard[]): void {
    if (cards.length === 0) return;
    const saved = this.savedCardsById();
    let changed = false;
    for (const card of cards) {
      if (!card || typeof card.id !== 'string') continue;
      const updated = newerProgress(saved.get(card.id), card);
      if (updated) {
        saved.set(card.id, updated);
        changed = true;
      }
    }
    if (changed) this.safeSetItem(this.getKey(STORAGE_KEYS.CARDS), JSON.stringify(Array.from(saved.values())));
  }

  public static createFolder(name: string, color: string = 'indigo', icon: string = '📚', description: string = ''): SubjectFolder {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Folder name cannot be empty');
    const folders = this.getFolders();
    const newFolder: SubjectFolder = {
      id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: trimmed,
      color,
      icon,
      description: description.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    folders.push(newFolder);
    this.saveFolders(folders);
    return newFolder;
  }

  public static updateFolder(id: string, updates: Partial<Omit<SubjectFolder, 'id' | 'createdAt'>>): SubjectFolder | null {
    const folders = this.getFolders();
    const idx = folders.findIndex(f => f.id === id);
    if (idx === -1) return null;
    const updated: SubjectFolder = {
      ...folders[idx],
      ...updates,
      name: updates.name !== undefined ? updates.name.trim() : folders[idx].name,
      updatedAt: new Date().toISOString(),
    };
    folders[idx] = updated;
    this.saveFolders(folders);
    return updated;
  }

  public static deleteFolder(id: string): void {
    this.recordDeletion('folders', id);
    const folders = this.getFolders().filter(f => f.id !== id);
    this.saveFolders(folders);

    // Unassign this folderId from any sessions so decks remain safe!
    const sessions = this.getSessions();
    let hasChanges = false;
    const updatedSessions = sessions.map(s => {
      if (s.folderId === id) {
        hasChanges = true;
        const copy = { ...s };
        delete copy.folderId;
        return copy;
      }
      return s;
    });

    if (hasChanges) {
      this.saveSessions(updatedSessions);
    } else {
      this.notifyMutation();
    }
  }

  public static setDeckFolder(sessionId: string, folderId: string | null | undefined): void {
    const sessions = this.getSessions();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx !== -1) {
      if (folderId) {
        sessions[idx].folderId = folderId;
      } else {
        delete sessions[idx].folderId;
      }
      this.saveSessions(sessions);
    }
  }

  /** A deck holding cards that belong to no deck, or null when there are none. */
  private static deckForLooseCards(cards: RetrievalCard[]): StudySession | null {
    if (cards.length === 0) return null;
    const id = `restored-${Date.now()}`;
    const conceptId = `${id}-cards`;
    return {
      id,
      title: 'Restored cards',
      category: 'Restored',
      description: 'Cards from a backup that were not in any deck.',
      concepts: [{
        id: conceptId,
        order: 0,
        title: 'Restored cards',
        estimatedMinutes: 0,
        mentalModel: '',
        coreTakeaways: [],
        keyTerms: [],
        feynmanPrompt: '',
        sampleMasteryExplanation: '',
        retrievalCards: cards.map(c => ({ ...c, conceptId })),
      }],
      currentConceptIndex: 0,
      currentPhase: 'retrieval',
      elapsedSeconds: 0,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Exports all student data to JSON
   */
  public static exportAllDataAsJSON(): string {
    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      stats: this.getStats(),
      cards: this.getAllCards(),
      sessions: this.getSessions(),
      folders: this.getFolders(),
      planner: this.getPlannerItems(),
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Restores student data from JSON backup. A backup with decks replaces the decks and the review
   * queue: the current decks' cards leave the queue, so none keeps coming due without a deck. A
   * backup card that belongs to none of its decks (orphaned when the backup was taken) is kept, in
   * a deck of its own, so it can be studied and deleted like any other.
   */
  public static importDataFromJSON(jsonString: string): { success: boolean; message: string } {
    try {
      const data = JSON.parse(jsonString);
      if (!data.cards && !data.stats && !data.sessions && !data.folders && !data.planner) {
        return { success: false, message: 'Invalid backup format.' };
      }
      if (data.stats) this.saveStats(data.stats);
      const replacesDecks = Array.isArray(data.sessions);
      const decks: StudySession[] = replacesDecks ? data.sessions : this.getSessions();
      const backupCards: RetrievalCard[] = Array.isArray(data.cards) ? data.cards : [];
      const inDecks = new Set(decks.flatMap(s => this.cardIdsOf(s)));
      const looseDeck = this.deckForLooseCards(backupCards.filter(c => !inDecks.has(c.id)));
      const rehomed = new Map(looseDeck?.concepts[0].retrievalCards.map(c => [c.id, c]));
      const restoredCards = backupCards.map(c => rehomed.get(c.id) ?? c);
      if (replacesDecks) {
        // Replace the queue before the decks, so the decks are stored with the backup's progress.
        this.safeSetItem(this.getKey(STORAGE_KEYS.CARDS), JSON.stringify(restoredCards));
      } else if (restoredCards.length > 0) {
        this.saveCards(restoredCards);
      }
      if (replacesDecks || looseDeck) {
        this.saveSessions(looseDeck ? [...decks, looseDeck] : decks);
      }
      if (data.folders && Array.isArray(data.folders)) {
        this.saveFolders(data.folders);
      }
      if (Array.isArray(data.planner)) {
        this.savePlannerItems(data.planner);
      }
      return { 
        success: true, 
        message: `Successfully restored ${data.cards?.length || 0} flashcards, ${data.sessions?.length || 0} sessions, and ${data.folders?.length || 0} subject folders!` 
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Corrupted file';
      return { success: false, message: `Import error: ${msg}` };
    }
  }

  /**
   * Exports flashcards to Anki-compatible Tab-Separated Values (TSV)
   */
  public static exportCardsToAnkiCSV(): string {
    const cards = this.getAllCards();
    const rows = cards.map(c => {
      const front = (c.question || '').replace(/\t/g, ' ').replace(/\n/g, '<br>');
      const back = `${(c.answer || '')}${c.explanation ? '<br><small>' + c.explanation + '</small>' : ''}`
        .replace(/\t/g, ' ')
        .replace(/\n/g, '<br>');
      const tags = 'Studify::FSRS';
      return `${front}\t${back}\t${tags}`;
    });
    return `#separator:tab\n#html:true\n#tags column:3\n${rows.join('\n')}`;
  }

  public static saveExamReport(report: ExamReport): void {
    const existing = this.getExamReports();
    const updated = [report, ...existing.filter(r => r.id !== report.id)].slice(0, 30);
    this.safeSetItem(this.getKey(STORAGE_KEYS.EXAM_REPORTS), JSON.stringify(updated));
  }

  public static getExamReports(): ExamReport[] {
    const raw = this.readRaw(this.getKey(STORAGE_KEYS.EXAM_REPORTS));
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static saveInterleavingReport(report: InterleavingSessionReport): void {
    const existing = this.getInterleavingReports();
    const updated = [report, ...existing.filter(r => r.id !== report.id)].slice(0, 30);
    this.safeSetItem(this.getKey(STORAGE_KEYS.INTERLEAVING_REPORTS), JSON.stringify(updated));
  }

  public static getInterleavingReports(): InterleavingSessionReport[] {
    const raw = this.readRaw(this.getKey(STORAGE_KEYS.INTERLEAVING_REPORTS));
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static saveConceptDiagram(conceptId: string, dataUrl: string): void {
    // Save to IndexedDB asynchronously for unconstrained persistence
    IndexedDbService.setItem(`diagram_${conceptId}`, dataUrl).catch(() => {});
    try {
      const raw = this.readRaw(this.getKey(STORAGE_KEYS.DIAGRAMS));
      const map = raw ? JSON.parse(raw) : {};
      map[conceptId] = dataUrl;
      this.safeSetItem(this.getKey(STORAGE_KEYS.DIAGRAMS), JSON.stringify(map));
    } catch (e) {
      console.warn('Could not save concept diagram:', e);
    }
  }

  public static getConceptDiagram(conceptId: string): string | null {
    try {
      const raw = this.readRaw(this.getKey(STORAGE_KEYS.DIAGRAMS));
      if (!raw) return null;
      const map = JSON.parse(raw);
      return map[conceptId] || null;
    } catch {
      return null;
    }
  }

  public static async loadConceptDiagramAsync(conceptId: string): Promise<string | null> {
    const idbResult = await IndexedDbService.getItem(`diagram_${conceptId}`);
    if (idbResult) return idbResult;
    return this.getConceptDiagram(conceptId);
  }

  /**
   * Checks if there is any study progress in Guest mode (unscoped storage)
   */
  public static hasGuestData(): boolean {
    try {
      const sessions = this.readRaw(STORAGE_KEYS.SESSIONS);
      const cards = this.readRaw(STORAGE_KEYS.CARDS);
      const stats = this.readRaw(STORAGE_KEYS.STATS);
      const parsedSessions = sessions ? JSON.parse(sessions) : [];
      const parsedCards = cards ? JSON.parse(cards) : [];
      const parsedStats = stats ? JSON.parse(stats) : null;
      return (
        parsedSessions.length > 0 ||
        parsedCards.length > 0 ||
        (parsedStats && ((parsedStats.xp || 0) > 0 || (parsedStats.totalStudyMinutes || 0) > 0))
      );
    } catch {
      return false;
    }
  }

  /**
   * Returns a breakdown of existing Guest study data
   */
  public static getGuestDataSummary(): { deckCount: number; cardCount: number; xp: number } {
    try {
      const sessions = this.readRaw(STORAGE_KEYS.SESSIONS);
      const cards = this.readRaw(STORAGE_KEYS.CARDS);
      const stats = this.readRaw(STORAGE_KEYS.STATS);
      const parsedSessions = sessions ? JSON.parse(sessions) : [];
      const parsedCards = cards ? JSON.parse(cards) : [];
      const parsedStats = stats ? JSON.parse(stats) : null;
      return {
        deckCount: parsedSessions.length,
        cardCount: parsedCards.length,
        xp: parsedStats?.xp || 0,
      };
    } catch {
      return { deckCount: 0, cardCount: 0, xp: 0 };
    }
  }

  /**
   * Clears guest study data from localStorage while preserving global app preferences
   */
  public static clearGuestData(): void {
    try {
      void this.removeProfileData('');
      localStorage.removeItem(STORAGE_KEYS.GUEST_PROFILE);
    } catch (e) {
      console.warn('[StorageService] Error clearing guest data:', e);
    }
  }

  /**
   * Migrates guest data to a target user's isolated storage namespace
   * Non-destructive: merges guest sessions, cards, stats, and reports into existing user data.
   */
  public static migrateGuestDataToUser(
    userId: string,
    clearGuest: boolean = true
  ): { migratedDecks: number; migratedCards: number; migratedXP: number } {
    const guestSessionsRaw = this.readRaw(STORAGE_KEYS.SESSIONS);
    const guestCardsRaw = this.readRaw(STORAGE_KEYS.CARDS);
    const guestStatsRaw = this.readRaw(STORAGE_KEYS.STATS);
    const guestActivityRaw = this.readRaw(STORAGE_KEYS.ACTIVITY);
    const guestExamRaw = this.readRaw(STORAGE_KEYS.EXAM_REPORTS);
    const guestInterleaveRaw = this.readRaw(STORAGE_KEYS.INTERLEAVING_REPORTS);
    const guestDiagramsRaw = this.readRaw(STORAGE_KEYS.DIAGRAMS);
    const guestFoldersRaw = this.readRaw(STORAGE_KEYS.FOLDERS);
    const guestEarningsRaw = this.readRaw(STORAGE_KEYS.EARNINGS);
    const guestPlannerRaw = this.readRaw(STORAGE_KEYS.PLANNER);
    const guestFocusTasksRaw = this.readRaw(STORAGE_KEYS.FOCUS_TASKS);
    const guestFocusLogRaw = this.readRaw(STORAGE_KEYS.FOCUS_LOG);
    const guestFocusNotes = this.readRaw(STORAGE_KEYS.FOCUS_NOTES);
    // What the guest's earnings come to under the account's own daily caps. Worked out
    // before the logs are merged below (see transferableGuestCoins).
    const guestAllowance = guestEarningsAllowance(
      parseEarnings(this.readRaw(`${STORAGE_KEYS.EARNINGS}_${userId}`)),
      parseEarnings(guestEarningsRaw),
    );

    let migratedDecks = 0;
    let migratedCards = 0;
    let migratedXP = 0;

    let guestSessions: StudySession[] = [];
    if (guestSessionsRaw) {
      try {
        const parsed = JSON.parse(guestSessionsRaw);
        if (Array.isArray(parsed)) {
          guestSessions = parsed;
          migratedDecks = guestSessions.length;
        }
      } catch {}
    }

    // 1. Merge Sessions
    if (guestSessions.length > 0) {
      const userSessionsKey = `${STORAGE_KEYS.SESSIONS}_${userId}`;
      const userSessionsRaw = this.readRaw(userSessionsKey);
      let userSessions: StudySession[] = [];
      if (userSessionsRaw) {
        try {
          const parsed = JSON.parse(userSessionsRaw);
          if (Array.isArray(parsed)) userSessions = parsed;
        } catch {}
      }

      const sessionMap = new Map<string, StudySession>();
      userSessions.forEach(s => sessionMap.set(s.id, s));

      guestSessions.forEach((guestS) => {
        const existing = sessionMap.get(guestS.id);
        if (!existing) {
          sessionMap.set(guestS.id, guestS);
        } else {
          const existingTime = Math.max(
            existing.completedAt ? new Date(existing.completedAt).getTime() : 0,
            existing.createdAt ? new Date(existing.createdAt).getTime() : 0
          );
          const guestTime = Math.max(
            guestS.completedAt ? new Date(guestS.completedAt).getTime() : 0,
            guestS.createdAt ? new Date(guestS.createdAt).getTime() : 0
          );
          if (guestTime >= existingTime) {
            sessionMap.set(guestS.id, guestS);
          }
        }
      });

      this.safeSetItem(userSessionsKey, JSON.stringify(Array.from(sessionMap.values())));
    }

    // 2. Merge Cards
    let guestCards: RetrievalCard[] = [];
    if (guestCardsRaw) {
      try {
        const parsed = JSON.parse(guestCardsRaw);
        if (Array.isArray(parsed)) {
          guestCards = parsed;
          migratedCards = guestCards.length;
        }
      } catch {}
    }

    if (guestCards.length > 0 || guestSessions.length > 0) {
      const userCardsKey = `${STORAGE_KEYS.CARDS}_${userId}`;
      const userCardsRaw = this.readRaw(userCardsKey);
      let userCards: RetrievalCard[] = [];
      if (userCardsRaw) {
        try {
          const parsed = JSON.parse(userCardsRaw);
          if (Array.isArray(parsed)) userCards = parsed;
        } catch {}
      }

      const cardMap = new Map<string, RetrievalCard>();
      userCards.forEach(c => cardMap.set(c.id, c));

      guestCards.forEach((guestC) => {
        const existing = cardMap.get(guestC.id);
        if (!existing) {
          cardMap.set(guestC.id, guestC);
        } else {
          if ((guestC.reps || 0) >= (existing.reps || 0)) {
            cardMap.set(guestC.id, guestC);
          }
        }
      });

      // Ensure any cards inside guest sessions are also present in card map
      guestSessions.forEach(s => {
        (s.concepts || []).forEach(cp => {
          (cp.retrievalCards || []).forEach(rc => {
            if (!cardMap.has(rc.id)) {
              cardMap.set(rc.id, rc);
            }
          });
        });
      });

      this.safeSetItem(userCardsKey, JSON.stringify(Array.from(cardMap.values())));
    }

    // 3. Merge Stats
    if (guestStatsRaw) {
      try {
        const guestStats: UserStats = JSON.parse(guestStatsRaw);
        migratedXP = guestStats.xp || 0;

        const userStatsKey = `${STORAGE_KEYS.STATS}_${userId}`;
        const userStatsRaw = this.readRaw(userStatsKey);
        let userStats: UserStats | null = null;
        if (userStatsRaw) {
          try {
            userStats = JSON.parse(userStatsRaw);
          } catch {}
        }

        if (userStats) {
          const mergedXP = (userStats.xp || 0) + (guestStats.xp || 0);
          const { level, title } = this.calculateLevel(mergedXP);
          const currentStreak = Math.max(userStats.currentStreak || 0, guestStats.currentStreak || 0);

          let lastActiveDate = userStats.lastActiveDate || guestStats.lastActiveDate || new Date().toISOString().split('T')[0];
          if (userStats.lastActiveDate && guestStats.lastActiveDate) {
            lastActiveDate = guestStats.lastActiveDate >= userStats.lastActiveDate ? guestStats.lastActiveDate : userStats.lastActiveDate;
          }

          const mergedStats: UserStats = {
            ...userStats,
            xp: mergedXP,
            level,
            levelTitle: title,
            totalStudyMinutes: (userStats.totalStudyMinutes || 0) + (guestStats.totalStudyMinutes || 0),
            sessionsCompleted: (userStats.sessionsCompleted || 0) + (guestStats.sessionsCompleted || 0),
            conceptsMastered: (userStats.conceptsMastered || 0) + (guestStats.conceptsMastered || 0),
            todayMinutes: (userStats.todayMinutes || 0) + (guestStats.todayMinutes || 0),
            currentStreak,
            lastActiveDate,
          };
          this.safeSetItem(userStatsKey, JSON.stringify(mergedStats));
        } else {
          const { level, title } = this.calculateLevel(guestStats.xp || 0);
          guestStats.level = level;
          guestStats.levelTitle = title;
          this.safeSetItem(userStatsKey, JSON.stringify(guestStats));
        }
      } catch {}
    }

    // 4. Merge Activity History
    if (guestActivityRaw) {
      try {
        const guestActivity = JSON.parse(guestActivityRaw);
        if (Array.isArray(guestActivity) && guestActivity.length > 0) {
          const userActivityKey = `${STORAGE_KEYS.ACTIVITY}_${userId}`;
          const userActivityRaw = this.readRaw(userActivityKey);
          let userActivity: any[] = [];
          if (userActivityRaw) {
            try {
              const parsed = JSON.parse(userActivityRaw);
              if (Array.isArray(parsed)) userActivity = parsed;
            } catch {}
          }
          const actMap = new Map<string, any>();
          userActivity.forEach((a, i) => actMap.set(a.id || a.date || `u_${i}`, a));
          guestActivity.forEach((a, i) => {
            const key = a.id || a.date || `g_${i}`;
            if (!actMap.has(key)) actMap.set(key, a);
          });
          this.safeSetItem(userActivityKey, JSON.stringify(Array.from(actMap.values())));
        }
      } catch {}
    }

    // 5. Merge Exam Reports
    if (guestExamRaw) {
      try {
        const guestExams = JSON.parse(guestExamRaw);
        if (Array.isArray(guestExams) && guestExams.length > 0) {
          const userExamKey = `${STORAGE_KEYS.EXAM_REPORTS}_${userId}`;
          const userExamRaw = this.readRaw(userExamKey);
          let userExams: ExamReport[] = [];
          if (userExamRaw) {
            try {
              const parsed = JSON.parse(userExamRaw);
              if (Array.isArray(parsed)) userExams = parsed;
            } catch {}
          }
          const examMap = new Map<string, ExamReport>();
          userExams.forEach(e => examMap.set(e.id, e));
          guestExams.forEach((e: ExamReport) => {
            if (!examMap.has(e.id)) examMap.set(e.id, e);
          });
          this.safeSetItem(userExamKey, JSON.stringify(Array.from(examMap.values())));
        }
      } catch {}
    }

    // 6. Merge Interleaving Reports
    if (guestInterleaveRaw) {
      try {
        const guestInter = JSON.parse(guestInterleaveRaw);
        if (Array.isArray(guestInter) && guestInter.length > 0) {
          const userInterKey = `${STORAGE_KEYS.INTERLEAVING_REPORTS}_${userId}`;
          const userInterRaw = this.readRaw(userInterKey);
          let userInter: InterleavingSessionReport[] = [];
          if (userInterRaw) {
            try {
              const parsed = JSON.parse(userInterRaw);
              if (Array.isArray(parsed)) userInter = parsed;
            } catch {}
          }
          const interMap = new Map<string, InterleavingSessionReport>();
          userInter.forEach(r => interMap.set(r.id, r));
          guestInter.forEach((r: InterleavingSessionReport) => {
            if (!interMap.has(r.id)) interMap.set(r.id, r);
          });
          this.safeSetItem(userInterKey, JSON.stringify(Array.from(interMap.values())));
        }
      } catch {}
    }

    // 7. Merge Concept Diagrams
    if (guestDiagramsRaw) {
      try {
        const guestDiagrams = JSON.parse(guestDiagramsRaw);
        const userDiagramsKey = `${STORAGE_KEYS.DIAGRAMS}_${userId}`;
        const userDiagramsRaw = this.readRaw(userDiagramsKey);
        let userDiagrams = {};
        if (userDiagramsRaw) {
          try {
            userDiagrams = JSON.parse(userDiagramsRaw);
          } catch {}
        }
        const mergedDiagrams = { ...guestDiagrams, ...userDiagrams };
        this.safeSetItem(userDiagramsKey, JSON.stringify(mergedDiagrams));
      } catch {}
    }

    // 8. Merge subject folders, so migrated decks keep their subject
    // 9. Merge the earnings log, so daily pay caps still count what was earned as a guest
    // 9b. Merge the planner's exams and homework
    // 9c. Merge the Focus workspace's tasks and session log
    for (const [base, raw] of [
      [STORAGE_KEYS.FOLDERS, guestFoldersRaw],
      [STORAGE_KEYS.EARNINGS, guestEarningsRaw],
      [STORAGE_KEYS.PLANNER, guestPlannerRaw],
      [STORAGE_KEYS.FOCUS_TASKS, guestFocusTasksRaw],
      [STORAGE_KEYS.FOCUS_LOG, guestFocusLogRaw],
    ] as const) {
      if (!raw) continue;
      try {
        const guestItems = JSON.parse(raw);
        if (!Array.isArray(guestItems) || guestItems.length === 0) continue;
        const userKey = `${base}_${userId}`;
        let userItems: { id: string }[] = [];
        try {
          const parsed = JSON.parse(this.readRaw(userKey) || '[]');
          if (Array.isArray(parsed)) userItems = parsed;
        } catch {}
        const merged = new Map(userItems.map(item => [item.id, item]));
        guestItems.forEach((item: { id: string }) => {
          if (item && !merged.has(item.id)) merged.set(item.id, item);
        });
        this.safeSetItem(userKey, JSON.stringify(Array.from(merged.values())));
      } catch {}
    }

    // 9d. Focus notes: the guest's notes follow the account's own, unless the account already has them.
    if (guestFocusNotes && guestFocusNotes.trim()) {
      const userNotesKey = `${STORAGE_KEYS.FOCUS_NOTES}_${userId}`;
      const userNotes = this.readRaw(userNotesKey) ?? '';
      if (!userNotes.trim()) this.safeSetItem(userNotesKey, guestFocusNotes);
      else if (!userNotes.includes(guestFocusNotes.trim())) this.safeSetItem(userNotesKey, `${userNotes.trimEnd()}\n\n${guestFocusNotes}`);
    }

    // 10. Life-sim data: the wallet, home and avatar. Only when the guest copy is cleared,
    // so tokens move rather than being duplicated.
    if (clearGuest) {
      this.moveGuestLifeData(userId, guestAllowance);
    }

    // 11. Clear Guest Data to prevent ghost state or duplicate migrations
    if (clearGuest) {
      this.clearGuestData();
    }

    this.notifyMutation();
    return { migratedDecks, migratedCards, migratedXP };
  }

  /**
   * Moves the guest's life-sim data into an account, then removes the guest's copy.
   * An account with no life-sim data on this device takes the guest's as it is. One that
   * has its own keeps it, and gains only the tokens the guest earned, within the account's
   * daily caps (see transferableGuestCoins). The guest's purchases stay behind: every new
   * guest gets the starting gift, so carrying over what it bought (furniture, a streak
   * freeze) would hand the account a free gift each time it signs out and back in.
   */
  private static moveGuestLifeData(userId: string, guestAllowance: number): void {
    this.splitDeviceLifeDataOnce();
    const ownKey = (base: string) => `${base}_${userId}`;
    const accountHasLifeData = Object.values(LIFE_KEYS).some(base => localStorage.getItem(ownKey(base)) !== null);
    for (const base of Object.values(LIFE_KEYS)) {
      try {
        const guestRaw = localStorage.getItem(base);
        if (guestRaw === null) continue;
        if (!accountHasLifeData) {
          localStorage.setItem(ownKey(base), guestRaw);
        } else if (base === LIFE_KEYS.CHARACTER) {
          const extra = transferableGuestCoins(Number(JSON.parse(guestRaw).coins) || 0, guestAllowance);
          if (extra > 0) {
            const own = JSON.parse(localStorage.getItem(ownKey(base)) ?? '{}');
            localStorage.setItem(ownKey(base), JSON.stringify({ ...own, coins: Number(own.coins ?? STARTING_COINS) + extra }));
          }
        }
        localStorage.removeItem(base);
      } catch {
        // A corrupt guest value is left behind rather than merged.
      }
    }
  }

  /**
   * Deletes all local storage keys associated with a deleted user
   */
  public static purgeUserData(userId: string): void {
    try {
      void this.removeProfileData(`_${userId}`, [...PROFILE_DATA_KEYS, ...Object.values(LIFE_KEYS)]);
    } catch (e) {
      console.warn('[StorageService] Error purging user data:', e);
    }
  }

  /**
   * Retrieves guest educational calibration profile (age, country, grade)
   */
  public static getGuestEducationProfile(): StudentEducationProfile | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.GUEST_PROFILE);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Saves guest educational calibration profile
   */
  public static saveGuestEducationProfile(profile: StudentEducationProfile): void {
    try {
      localStorage.setItem(STORAGE_KEYS.GUEST_PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.warn('[StorageService] Failed to save guest education profile:', e);
    }
  }

  /**
   * Synthesizes longitudinal student cognitive history (lapse triggers, trap vulnerabilities, mastery ratio)
   */
  public static getCognitiveMemoryProfile(): CognitiveMemoryProfile {
    const cards = this.getAllCards();
    const totalCards = cards.length;
    
    let masteredCards = 0;
    let strugglingCards = 0;
    let totalStability = 0;
    const frequentLapseMap = new Map<string, number>();
    const trapFrequencyMap = new Map<string, number>();
    const weakTopicSet = new Set<string>();

    for (const card of cards) {
      totalStability += (card.stability || 1);
      if ((card.stability || 1) >= 21 && (card.lapses || 0) === 0 && (card.reps || 0) >= 2) {
        masteredCards++;
      }
      if ((card.lapses || 0) >= 2 || (card.difficulty || 5) >= 7) {
        strugglingCards++;
        const topic = card.question.slice(0, 50).trim();
        frequentLapseMap.set(topic, (frequentLapseMap.get(topic) || 0) + (card.lapses || 1));
        weakTopicSet.add(topic);
      }

      if (card.diagnosticDistractors) {
        for (const distractor of card.diagnosticDistractors) {
          if (distractor.trapType) {
            trapFrequencyMap.set(distractor.trapType, (trapFrequencyMap.get(distractor.trapType) || 0) + 1);
          }
        }
      }
    }

    // Inspect exam reports for incorrect cognitive traps
    const examReports = this.getExamReports();
    for (const report of examReports) {
      if (report.questionResults) {
        for (const qr of report.questionResults) {
          if (!qr.isCorrect && qr.card?.diagnosticDistractors) {
            const trap = qr.card.diagnosticDistractors.find(d => d.optionText === qr.userAnswer)?.trapType;
            if (trap) {
              trapFrequencyMap.set(trap, (trapFrequencyMap.get(trap) || 0) + 2);
            }
          }
        }
      }
    }

    const frequentLapseConcepts = Array.from(frequentLapseMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([concept]) => concept);

    const vulnerableTrapTypes = Array.from(trapFrequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([trap]) => trap);

    const averageStabilityDays = totalCards > 0 ? Math.round((totalStability / totalCards) * 10) / 10 : 1;

    return {
      totalCards,
      masteredCards,
      strugglingCards,
      frequentLapseConcepts,
      vulnerableTrapTypes,
      recentWeakTopics: Array.from(weakTopicSet).slice(0, 5),
      averageStabilityDays,
    };
  }
}
