import type { RetrievalCard, StudySession, UserStats } from '../types';

const STORAGE_KEYS = {
  SESSIONS: 'studify_sessions_v1',
  CARDS: 'studify_cards_v1',
  STATS: 'studify_stats_v1',
  API_KEY: 'studify_gemini_api_key',
  SOUND_PREF: 'studify_sound_pref',
};

export class StorageService {
  public static getStats(): UserStats {
    const raw = localStorage.getItem(STORAGE_KEYS.STATS);
    if (!raw) {
      return {
        totalStudyMinutes: 0,
        sessionsCompleted: 0,
        conceptsMastered: 0,
        currentStreak: 1,
        lastActiveDate: new Date().toISOString().split('T')[0],
        cardsDueCount: 0,
      };
    }
    try {
      const stats = JSON.parse(raw);
      // Update streak check
      const today = new Date().toISOString().split('T')[0];
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
        this.saveStats(stats);
      }
      stats.cardsDueCount = this.getDueCards().length;
      return stats;
    } catch {
      return {
        totalStudyMinutes: 0,
        sessionsCompleted: 0,
        conceptsMastered: 0,
        currentStreak: 1,
        lastActiveDate: new Date().toISOString().split('T')[0],
        cardsDueCount: 0,
      };
    }
  }

  public static saveStats(stats: UserStats) {
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
  }

  public static recordStudyMinutes(minutes: number) {
    const stats = this.getStats();
    stats.totalStudyMinutes += Math.max(1, Math.round(minutes));
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
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions.slice(0, 30)));
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
}
