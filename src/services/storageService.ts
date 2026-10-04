import type { ExamReport, InterleavingSessionReport, RetrievalCard, StudySession, UserStats, StudentEducationProfile } from '../types';
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
};

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
   * Resilient localStorage writer that protects against QuotaExceededError
   */
  private static safeSetItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn(`[StorageService] localStorage.setItem failed for key "${key}":`, e);
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
        try {
          // Prune heavy diagram caches to restore quota
          localStorage.removeItem(this.getKey(STORAGE_KEYS.DIAGRAMS));
          const raw = localStorage.getItem(this.getKey(STORAGE_KEYS.SESSIONS));
          if (raw) {
            const sessions: StudySession[] = JSON.parse(raw);
            if (sessions.length > 8) {
              localStorage.setItem(this.getKey(STORAGE_KEYS.SESSIONS), JSON.stringify(sessions.slice(0, 8)));
            }
          }
          localStorage.setItem(key, value);
          return true;
        } catch {
          // Ignore secondary failure
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

  public static getStats(): UserStats {
    const raw = localStorage.getItem(this.getKey(STORAGE_KEYS.STATS));
    const today = new Date().toISOString().split('T')[0];

    const defaultStats: UserStats = {
      totalStudyMinutes: 0,
      sessionsCompleted: 0,
      conceptsMastered: 0,
      currentStreak: 1,
      lastActiveDate: today,
      cardsDueCount: 0,
      xp: 0,
      level: 1,
      levelTitle: 'Synapse Builder',
      dailyGoalMinutes: 25,
      todayMinutes: 0,
      targetRetention: 0.90,
    };

    if (!raw) {
      return defaultStats;
    }

    try {
      const stats: UserStats = { ...defaultStats, ...JSON.parse(raw) };
      
      // Update streak and reset today's minutes if day changed
      if (stats.lastActiveDate !== today) {
        const last = new Date(stats.lastActiveDate);
        const curr = new Date(today);
        const diffDays = Math.round((curr.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          stats.currentStreak += 1;
        } else if (diffDays > 1) {
          stats.currentStreak = 1;
        }
        stats.lastActiveDate = today;
        stats.todayMinutes = 0; // Reset daily minutes for new day
        this.saveStats(stats);
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

  public static getActivityHistory(): Record<string, number> {
    const raw = localStorage.getItem(this.getKey(STORAGE_KEYS.ACTIVITY));
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

  public static recordStudyMinutes(minutes: number) {
    const stats = this.getStats();
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

  public static recordCompletedSession() {
    const stats = this.getStats();
    stats.sessionsCompleted += 1;
    this.saveStats(stats);
  }

  public static recordMasteredConcept() {
    const stats = this.getStats();
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

  public static getAllCards(): RetrievalCard[] {
    const raw = localStorage.getItem(this.getKey(STORAGE_KEYS.CARDS));
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static getDueCards(): RetrievalCard[] {
    const all = this.getAllCards();
    const now = new Date();
    return all.filter(c => {
      if (!c.nextReviewDate) return true;
      return new Date(c.nextReviewDate) <= now;
    });
  }

  public static saveSession(session: StudySession) {
    // If the session has a heavy base64 PDF payload, offload it to IndexedDB
    if (session.sourceDocument?.pdfDataUrl && session.sourceDocument.pdfDataUrl.length > 20000) {
      IndexedDbService.setItem(`pdf_${session.id}`, session.sourceDocument.pdfDataUrl).catch(() => {});
    }

    // Create a lightweight copy for localStorage that won't blow the 5MB limit
    const lightweightSession: StudySession = {
      ...session,
      sourceDocument: session.sourceDocument ? {
        ...session.sourceDocument,
        pdfDataUrl: session.sourceDocument.pdfDataUrl && session.sourceDocument.pdfDataUrl.length > 20000
          ? '[indexeddb]'
          : session.sourceDocument.pdfDataUrl
      } : undefined
    };

    const sessions = this.getSessions();
    const idx = sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      sessions[idx] = lightweightSession;
    } else {
      sessions.unshift(lightweightSession);
    }
    this.safeSetItem(this.getKey(STORAGE_KEYS.SESSIONS), JSON.stringify(sessions.slice(0, 30)));
    this.notifyMutation();
  }

  public static saveSessions(sessions: StudySession[]): void {
    this.safeSetItem(this.getKey(STORAGE_KEYS.SESSIONS), JSON.stringify(sessions.slice(0, 50)));
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
    const sessions = this.getSessions().filter(s => s.id !== id);
    this.safeSetItem(this.getKey(STORAGE_KEYS.SESSIONS), JSON.stringify(sessions));
    IndexedDbService.removeItem(`pdf_${id}`).catch(() => {});
  }

  public static getSessions(): StudySession[] {
    const raw = localStorage.getItem(this.getKey(STORAGE_KEYS.SESSIONS));
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
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
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Restores student data from JSON backup
   */
  public static importDataFromJSON(jsonString: string): { success: boolean; message: string } {
    try {
      const data = JSON.parse(jsonString);
      if (!data.cards && !data.stats && !data.sessions) {
        return { success: false, message: 'Invalid backup format.' };
      }
      if (data.stats) this.saveStats(data.stats);
      if (data.cards && Array.isArray(data.cards)) this.saveCards(data.cards);
      if (data.sessions && Array.isArray(data.sessions)) {
        localStorage.setItem(this.getKey(STORAGE_KEYS.SESSIONS), JSON.stringify(data.sessions));
      }
      return { 
        success: true, 
        message: `Successfully restored ${data.cards?.length || 0} flashcards and ${data.sessions?.length || 0} sessions!` 
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
    const raw = localStorage.getItem(this.getKey(STORAGE_KEYS.EXAM_REPORTS));
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
    const raw = localStorage.getItem(this.getKey(STORAGE_KEYS.INTERLEAVING_REPORTS));
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
      const raw = localStorage.getItem(this.getKey(STORAGE_KEYS.DIAGRAMS));
      const map = raw ? JSON.parse(raw) : {};
      map[conceptId] = dataUrl;
      this.safeSetItem(this.getKey(STORAGE_KEYS.DIAGRAMS), JSON.stringify(map));
    } catch (e) {
      console.warn('Could not save concept diagram:', e);
    }
  }

  public static getConceptDiagram(conceptId: string): string | null {
    try {
      const raw = localStorage.getItem(this.getKey(STORAGE_KEYS.DIAGRAMS));
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
      const sessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      const cards = localStorage.getItem(STORAGE_KEYS.CARDS);
      const stats = localStorage.getItem(STORAGE_KEYS.STATS);
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
      const sessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      const cards = localStorage.getItem(STORAGE_KEYS.CARDS);
      const stats = localStorage.getItem(STORAGE_KEYS.STATS);
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
   * Migrates guest data to a target user's isolated storage namespace
   */
  public static migrateGuestDataToUser(userId: string): { migratedDecks: number; migratedCards: number; migratedXP: number } {
    const guestSessionsRaw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    const guestCardsRaw = localStorage.getItem(STORAGE_KEYS.CARDS);
    const guestStatsRaw = localStorage.getItem(STORAGE_KEYS.STATS);
    const guestActivityRaw = localStorage.getItem(STORAGE_KEYS.ACTIVITY);
    const guestExamRaw = localStorage.getItem(STORAGE_KEYS.EXAM_REPORTS);
    const guestInterleaveRaw = localStorage.getItem(STORAGE_KEYS.INTERLEAVING_REPORTS);

    let migratedDecks = 0;
    let migratedCards = 0;
    let migratedXP = 0;

    if (guestSessionsRaw) {
      try {
        const guestSessions = JSON.parse(guestSessionsRaw);
        migratedDecks = guestSessions.length;
        localStorage.setItem(`${STORAGE_KEYS.SESSIONS}_${userId}`, guestSessionsRaw);
      } catch {}
    }

    if (guestCardsRaw) {
      try {
        const guestCards = JSON.parse(guestCardsRaw);
        migratedCards = guestCards.length;
        localStorage.setItem(`${STORAGE_KEYS.CARDS}_${userId}`, guestCardsRaw);
      } catch {}
    }

    if (guestStatsRaw) {
      try {
        const guestStats = JSON.parse(guestStatsRaw);
        migratedXP = guestStats.xp || 0;
        localStorage.setItem(`${STORAGE_KEYS.STATS}_${userId}`, guestStatsRaw);
      } catch {}
    }

    if (guestActivityRaw) {
      localStorage.setItem(`${STORAGE_KEYS.ACTIVITY}_${userId}`, guestActivityRaw);
    }
    if (guestExamRaw) {
      localStorage.setItem(`${STORAGE_KEYS.EXAM_REPORTS}_${userId}`, guestExamRaw);
    }
    if (guestInterleaveRaw) {
      localStorage.setItem(`${STORAGE_KEYS.INTERLEAVING_REPORTS}_${userId}`, guestInterleaveRaw);
    }

    return { migratedDecks, migratedCards, migratedXP };
  }

  /**
   * Deletes all local storage keys associated with a deleted user
   */
  public static purgeUserData(userId: string): void {
    try {
      localStorage.removeItem(`${STORAGE_KEYS.SESSIONS}_${userId}`);
      localStorage.removeItem(`${STORAGE_KEYS.CARDS}_${userId}`);
      localStorage.removeItem(`${STORAGE_KEYS.STATS}_${userId}`);
      localStorage.removeItem(`${STORAGE_KEYS.ACTIVITY}_${userId}`);
      localStorage.removeItem(`${STORAGE_KEYS.EXAM_REPORTS}_${userId}`);
      localStorage.removeItem(`${STORAGE_KEYS.INTERLEAVING_REPORTS}_${userId}`);
      localStorage.removeItem(`${STORAGE_KEYS.DIAGRAMS}_${userId}`);
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
}
