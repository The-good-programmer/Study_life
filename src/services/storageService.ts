import type { RetrievalCard, StudySession, UserStats } from '../types';

const STORAGE_KEYS = {
  SESSIONS: 'studify_sessions_v1',
  CARDS: 'studify_cards_v1',
  STATS: 'studify_stats_v1',
  API_KEY: 'studify_gemini_api_key',
  SOUND_PREF: 'studify_sound_pref',
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
  private static calculateLevel(xp: number): { level: number; title: string } {
    // 150 XP per level
    const level = Math.max(1, Math.floor(xp / 150) + 1);
    const titleIndex = Math.min(LEVEL_TITLES.length - 1, level - 1);
    return { level, title: LEVEL_TITLES[titleIndex] };
  }

  public static getStats(): UserStats {
    const raw = localStorage.getItem(STORAGE_KEYS.STATS);
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

  public static saveStats(stats: UserStats) {
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
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

  public static recordStudyMinutes(minutes: number) {
    const stats = this.getStats();
    const added = Math.max(1, Math.round(minutes));
    stats.totalStudyMinutes += added;
    stats.todayMinutes = (stats.todayMinutes || 0) + added;
    this.saveStats(stats);
  }

  public static setDailyGoal(minutes: number) {
    const stats = this.getStats();
    stats.dailyGoalMinutes = Math.max(5, Math.min(240, minutes));
    this.saveStats(stats);
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
      localStorage.setItem(STORAGE_KEYS.API_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.API_KEY);
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
    localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(cards));
  }

  public static saveCards(newCards: RetrievalCard[]) {
    const cards = this.getAllCards();
    newCards.forEach(newCard => {
      const idx = cards.findIndex(c => c.id === newCard.id);
      if (idx >= 0) {
        cards[idx] = newCard;
      } else {
        cards.push(newCard);
      }
    });
    localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(cards));
  }

  public static getAllCards(): RetrievalCard[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CARDS);
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
    const sessions = this.getSessions();
    const idx = sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      sessions[idx] = session;
    } else {
      sessions.unshift(session);
    }
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions.slice(0, 50)));
  }

  public static deleteSession(id: string) {
    const sessions = this.getSessions().filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  }

  public static getSessions(): StudySession[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
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
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(data.sessions));
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
}
