import type { EarningEntry, ExamReport, InterleavingSessionReport, RetrievalCard, StudySession, UserStats, StudentEducationProfile, SubjectFolder, CognitiveMemoryProfile } from '../types';
import { deckWithSavedProgress, withSavedProgress } from '../utils/cardProgress';
import { IndexedDbService } from './indexedDbService';

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
};

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

  public static hasSynapticFreeze(): boolean {
    try {
      return localStorage.getItem('axon_synaptic_freeze_active') === 'true';
    } catch {
      return false;
    }
  }

  public static setSynapticFreeze(active: boolean): void {
    try {
      if (active) {
        localStorage.setItem('axon_synaptic_freeze_active', 'true');
      } else {
        localStorage.removeItem('axon_synaptic_freeze_active');
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
              localStorage.removeItem('axon_synaptic_freeze_active');
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
            localStorage.removeItem('axon_synaptic_freeze_active');
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

  public static getWeeklyXP(): { current: number; best: number } {
    try {
      const rawCurrent = localStorage.getItem('lotti_weekly_xp') || localStorage.getItem('axon_weekly_xp') || '0';
      const rawBest = localStorage.getItem('lotti_weekly_xp_best') || '0';
      const current = parseInt(rawCurrent, 10) || 0;
      const best = Math.max(parseInt(rawBest, 10) || 0, current);
      return { current, best };
    } catch {
      return { current: 0, best: 0 };
    }
  }

  public static addWeeklyXP(amount: number): number {
    const safeAmount = Math.max(0, Math.round(amount));
    const { current, best } = this.getWeeklyXP();
    const next = current + safeAmount;
    const nextBest = Math.max(best, next);
    try {
      localStorage.setItem('lotti_weekly_xp', next.toString());
      localStorage.setItem('lotti_weekly_xp_best', nextBest.toString());
    } catch {}
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
    const today = new Date().toISOString().split('T')[0];
    const stats = this.getStats();

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
    }

    return stats;
  }

  public static recordStudyMinutes(minutes: number) {
    const stats = this.recordActiveStudyDay();
    const added = Math.max(1, Math.round(minutes));
    stats.totalStudyMinutes += added;
    stats.todayMinutes = (stats.todayMinutes || 0) + added;
    this.saveStats(stats);

    const today = new Date().toISOString().split('T')[0];
    const history = this.getActivityHistory();
    history[today] = (history[today] || 0) + added;
    this.saveActivityHistory(history);
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

        cardMap.set(sc.id, {
          ...sc,
          ...existing,
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
        });
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

  public static saveSession(session: StudySession) {
    // If the session has a heavy base64 PDF payload, offload it to IndexedDB
    if (session.sourceDocument?.pdfDataUrl && session.sourceDocument.pdfDataUrl.length > 20000) {
      IndexedDbService.setItem(`pdf_${session.id}`, session.sourceDocument.pdfDataUrl).catch(() => {});
    }

    // Sync the deck's cards into the review queue first; the queue keeps each card's furthest progress.
    const sessionCards = session.concepts?.flatMap(c => c.retrievalCards || []) || [];
    if (sessionCards.length > 0) {
      this.syncSessionCardsToGlobalQueue(sessionCards);
    }

    // Store the deck with that progress. A deck held in memory during a study session still has
    // its cards as they were when it was loaded, and saving it must not roll back the reviews since.
    // The copy is also lightweight, so a PDF payload doesn't blow the 5MB limit.
    const lightweightSession: StudySession = {
      ...deckWithSavedProgress(session, this.savedCardsById()),
      sourceDocument: session.sourceDocument ? {
        ...session.sourceDocument,
        pdfDataUrl: session.sourceDocument.pdfDataUrl && session.sourceDocument.pdfDataUrl.length > 20000
          ? '[indexeddb]'
          : session.sourceDocument.pdfDataUrl
      } : undefined
    };

    const sessions = this.getSessions();
    const idx = sessions.findIndex(s => s.id === session.id);
    // Cards taken out of a deck while editing it must leave the review queue too.
    const removedCardIds = idx >= 0 ? this.cardIdsOf(sessions[idx]).filter(id => !this.cardIdsOf(session).includes(id)) : [];
    if (idx >= 0) {
      sessions[idx] = lightweightSession;
    } else {
      sessions.unshift(lightweightSession);
    }
    this.safeSetItem(this.getKey(STORAGE_KEYS.SESSIONS), JSON.stringify(sessions.slice(0, 30)));
    this.removeCardsNoLongerInAnyDeck(removedCardIds, sessions);

    this.notifyMutation();
  }

  public static saveSessions(sessions: StudySession[]): void {
    this.safeSetItem(this.getKey(STORAGE_KEYS.SESSIONS), JSON.stringify(sessions.slice(0, 50)));
    const allCards = sessions.flatMap(s => s.concepts?.flatMap(c => c.retrievalCards || []) || []);
    if (allCards.length > 0) {
      this.syncSessionCardsToGlobalQueue(allCards);
    }
    this.notifyMutation();
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
    };
    folders[idx] = updated;
    this.saveFolders(folders);
    return updated;
  }

  public static deleteFolder(id: string): void {
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
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Restores student data from JSON backup
   */
  public static importDataFromJSON(jsonString: string): { success: boolean; message: string } {
    try {
      const data = JSON.parse(jsonString);
      if (!data.cards && !data.stats && !data.sessions && !data.folders) {
        return { success: false, message: 'Invalid backup format.' };
      }
      if (data.stats) this.saveStats(data.stats);
      if (data.cards && Array.isArray(data.cards)) this.saveCards(data.cards);
      if (data.sessions && Array.isArray(data.sessions)) {
        this.safeSetItem(this.getKey(STORAGE_KEYS.SESSIONS), JSON.stringify(data.sessions));
      }
      if (data.folders && Array.isArray(data.folders)) {
        this.saveFolders(data.folders);
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
    for (const [base, raw] of [
      [STORAGE_KEYS.FOLDERS, guestFoldersRaw],
      [STORAGE_KEYS.EARNINGS, guestEarningsRaw],
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

    // 10. Clear Guest Data to prevent ghost state or duplicate migrations
    if (clearGuest) {
      this.clearGuestData();
    }

    this.notifyMutation();
    return { migratedDecks, migratedCards, migratedXP };
  }

  /**
   * Deletes all local storage keys associated with a deleted user
   */
  public static purgeUserData(userId: string): void {
    try {
      void this.removeProfileData(`_${userId}`);
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
