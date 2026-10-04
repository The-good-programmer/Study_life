import { StorageService } from './storageService';

export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'obsidian' | 'diamond';

export interface LeagueCompetitor {
  id: string;
  name: string;
  avatar: string;
  subject: string;
  weeklyXP: number;
  streak: number;
  isUser?: boolean;
  ratePerHour?: number;
}

export interface LeagueStatus {
  tier: LeagueTier;
  tierName: string;
  tierColor: string;
  tierIcon: string;
  userRank: number;
  userWeeklyXP: number;
  competitors: LeagueCompetitor[];
  daysLeft: number;
  hoursLeft: number;
  isPromotionZone: boolean;
  isDemotionZone: boolean;
}

export interface FriendQuest {
  id: string;
  partnerName: string;
  partnerAvatar: string;
  goalDescription: string;
  targetCount: number;
  userProgress: number;
  partnerProgress: number;
  completed: boolean;
  rewardClaimed: boolean;
  expiresInDays: number;
}

export interface StudyBuddy {
  id: string;
  name: string;
  avatar: string;
  subject: string;
  streak: number;
  weeklyXP: number;
  isOnline: boolean;
}

const COHORT_STORAGE_KEY = 'axon_league_cohort_v2';
const FRIEND_QUEST_KEY = 'axon_friend_quest_v2';
const BUDDIES_STORAGE_KEY = 'axon_study_buddies_v2';

const BASE_PEER_PERSONAS = [
  { name: 'Elena Rostova', subject: 'Neurobiology • Oxford', avatar: '👩‍🔬', baseXP: 440, streak: 14, rate: 8 },
  { name: 'Marcus Vance', subject: 'Quant Finance • MIT', avatar: '👨‍💻', baseXP: 395, streak: 21, rate: 7 },
  { name: 'Aria Takahashi', subject: 'Cognitive Science • Tokyo', avatar: '👩‍🎓', baseXP: 350, streak: 9, rate: 6 },
  { name: 'Dr. Liam O’Connor', subject: 'Clinical Pathology • Edinburgh', avatar: '👨‍⚕️', baseXP: 295, streak: 35, rate: 5 },
  { name: 'Kenji Sato', subject: 'Organic Chemistry • Kyoto', avatar: '🧑‍🔬', baseXP: 250, streak: 6, rate: 4 },
  { name: 'Sarah Jenkins', subject: 'Constitutional Law • Yale', avatar: '👩‍⚖️', baseXP: 215, streak: 12, rate: 4 },
  { name: 'Mateo Rossi', subject: 'Astrophysics • Bologna', avatar: '🧑‍🚀', baseXP: 180, streak: 5, rate: 3 },
  { name: 'Chloe Dubois', subject: 'Cellular Immunology • Sorbonne', avatar: '👩‍⚕️', baseXP: 140, streak: 8, rate: 3 },
  { name: 'Priya Sharma', subject: 'Machine Learning • IIT', avatar: '👩‍💻', baseXP: 105, streak: 3, rate: 2 },
];

class LeagueService {
  /** Calculate user weekly XP estimate based on sessions and stats */
  public getUserWeeklyXP(): number {
    const stats = StorageService.getStats();
    try {
      const stored = localStorage.getItem('axon_weekly_xp');
      if (stored) return parseInt(stored, 10);
    } catch {}
    
    // Default fallback based on today's minutes + sessions completed
    const calculated = Math.max(120, (stats.todayMinutes * 15) + (stats.sessionsCompleted * 45));
    return calculated;
  }

  public addWeeklyXP(amount: number): number {
    const current = this.getUserWeeklyXP();
    const next = current + Math.max(0, Math.round(amount));
    try {
      localStorage.setItem('axon_weekly_xp', next.toString());
    } catch {}

    // Also advance the friend quest progress
    this.advanceFriendQuest(Math.round(amount / 5));

    return next;
  }

  public getLeagueTier(xp: number): LeagueTier {
    if (xp >= 1000) return 'diamond';
    if (xp >= 600) return 'obsidian';
    if (xp >= 350) return 'gold';
    if (xp >= 180) return 'silver';
    return 'bronze';
  }

  /**
   * Generates or simulates realistic peer XP advancement based on elapsed time
   */
  private getOrUpdateCohort(_userXP: number): LeagueCompetitor[] {
    const now = Date.now();
    let stored: { competitors: LeagueCompetitor[]; lastUpdated: number } | null = null;
    try {
      const raw = localStorage.getItem(COHORT_STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch {}

    // If cohort doesn't exist or is older than 7 days, generate fresh cohort
    if (!stored || !Array.isArray(stored.competitors) || (now - stored.lastUpdated > 7 * 24 * 60 * 60 * 1000)) {
      const newCompetitors: LeagueCompetitor[] = BASE_PEER_PERSONAS.map((p, i) => {
        const variance = Math.round((Math.sin(i * 1.5) * 35));
        const initialXP = Math.max(50, p.baseXP + variance);
        return {
          id: `peer-${i}`,
          name: p.name,
          subject: p.subject,
          avatar: p.avatar,
          weeklyXP: initialXP,
          streak: p.streak,
          ratePerHour: p.rate,
        };
      });

      const entry = { competitors: newCompetitors, lastUpdated: now };
      try {
        localStorage.setItem(COHORT_STORAGE_KEY, JSON.stringify(entry));
      } catch {}
      return newCompetitors;
    }

    // Realistic time-based simulation: competitors earn XP while student is away
    const elapsedHours = Math.min(24, (now - stored.lastUpdated) / (1000 * 60 * 60));
    if (elapsedHours > 0.5) {
      stored.competitors = stored.competitors.map((c) => {
        const hourlyRate = c.ratePerHour || 4;
        // Natural study probability curve (higher in evenings)
        const currentHour = new Date().getHours();
        const hourFactor = (currentHour >= 17 && currentHour <= 23) ? 1.6 : 0.8;
        const gain = Math.round(elapsedHours * hourlyRate * hourFactor * (0.8 + Math.random() * 0.4));
        return {
          ...c,
          weeklyXP: c.weeklyXP + gain,
        };
      });

      stored.lastUpdated = now;
      try {
        localStorage.setItem(COHORT_STORAGE_KEY, JSON.stringify(stored));
      } catch {}
    }

    return stored.competitors;
  }

  public getLeagueStatus(): LeagueStatus {
    const userXP = this.getUserWeeklyXP();
    const tier = this.getLeagueTier(userXP);
    const stats = StorageService.getStats();

    const tierMeta: Record<LeagueTier, { name: string; color: string; icon: string }> = {
      bronze: { name: 'Bronze League', color: 'from-amber-700 to-amber-900 text-amber-300', icon: '🥉' },
      silver: { name: 'Silver League', color: 'from-slate-400 to-slate-600 text-slate-200', icon: '🥈' },
      gold: { name: 'Gold League', color: 'from-amber-400 to-amber-600 text-amber-200', icon: '🥇' },
      obsidian: { name: 'Obsidian League', color: 'from-purple-600 to-indigo-900 text-purple-200', icon: '🔮' },
      diamond: { name: 'Diamond League', color: 'from-cyan-400 to-blue-600 text-cyan-200', icon: '💎' },
    };

    // Calculate days and hours left in weekly cycle (resets Sunday midnight)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday
    const daysLeft = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const hoursLeft = 24 - now.getHours();

    const peers = this.getOrUpdateCohort(userXP);

    const userCompetitor: LeagueCompetitor = {
      id: 'current-user',
      name: 'You (Lotti Scholar)',
      avatar: '🌟',
      subject: 'Active Syllabus',
      weeklyXP: userXP,
      streak: stats.currentStreak || 1,
      isUser: true,
    };

    const competitors = [...peers, userCompetitor];
    competitors.sort((a, b) => b.weeklyXP - a.weeklyXP);

    const userRank = competitors.findIndex(c => c.isUser) + 1;
    const isPromotionZone = userRank <= 3;
    const isDemotionZone = userRank >= competitors.length - 2;

    return {
      tier,
      tierName: tierMeta[tier].name,
      tierColor: tierMeta[tier].color,
      tierIcon: tierMeta[tier].icon,
      userRank,
      userWeeklyXP: userXP,
      competitors,
      daysLeft,
      hoursLeft,
      isPromotionZone,
      isDemotionZone,
    };
  }

  // --- FRIEND QUEST & STUDY BUDDY SYSTEM ---

  public getFriendQuest(): FriendQuest {
    try {
      const raw = localStorage.getItem(FRIEND_QUEST_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}

    const defaultQuest: FriendQuest = {
      id: 'quest-wk-current',
      partnerName: 'Elena Rostova',
      partnerAvatar: '👩‍🔬',
      goalDescription: 'Complete 30 Retrieval Practice Cards together',
      targetCount: 30,
      userProgress: 14,
      partnerProgress: 11,
      completed: false,
      rewardClaimed: false,
      expiresInDays: 3,
    };

    try {
      localStorage.setItem(FRIEND_QUEST_KEY, JSON.stringify(defaultQuest));
    } catch {}

    return defaultQuest;
  }

  public advanceFriendQuest(amount: number = 1): FriendQuest {
    const quest = this.getFriendQuest();
    if (quest.completed) return quest;

    const nextUser = Math.min(quest.targetCount, quest.userProgress + amount);
    // Partner occasionally advances too
    const partnerBoost = Math.random() > 0.6 ? 1 : 0;
    const nextPartner = Math.min(quest.targetCount, quest.partnerProgress + partnerBoost);
    const isDone = (nextUser + nextPartner) >= quest.targetCount;

    const updated: FriendQuest = {
      ...quest,
      userProgress: nextUser,
      partnerProgress: nextPartner,
      completed: isDone,
    };

    try {
      localStorage.setItem(FRIEND_QUEST_KEY, JSON.stringify(updated));
    } catch {}

    return updated;
  }

  public claimFriendQuestReward(): { coins: number; xp: number } | null {
    const quest = this.getFriendQuest();
    if (!quest.completed || quest.rewardClaimed) return null;

    quest.rewardClaimed = true;
    try {
      localStorage.setItem(FRIEND_QUEST_KEY, JSON.stringify(quest));
    } catch {}

    // Award 60 Axon Coins + 100 XP
    StorageService.addXP(100);
    try {
      const axRaw = localStorage.getItem('axon_axolotl_state');
      if (axRaw) {
        const state = JSON.parse(axRaw);
        state.axonCoins = (state.axonCoins || 0) + 60;
        localStorage.setItem('axon_axolotl_state', JSON.stringify(state));
      }
    } catch {}

    return { coins: 60, xp: 100 };
  }

  public getStudyBuddies(): StudyBuddy[] {
    try {
      const raw = localStorage.getItem(BUDDIES_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}

    const defaultBuddies: StudyBuddy[] = [
      { id: 'b-1', name: 'Elena Rostova', avatar: '👩‍🔬', subject: 'Neurobiology', streak: 14, weeklyXP: 440, isOnline: true },
      { id: 'b-2', name: 'Marcus Vance', avatar: '👨‍💻', subject: 'Quant Finance', streak: 21, weeklyXP: 395, isOnline: true },
      { id: 'b-3', name: 'Aria Takahashi', avatar: '👩‍🎓', subject: 'Cognitive Science', streak: 9, weeklyXP: 350, isOnline: false },
    ];

    try {
      localStorage.setItem(BUDDIES_STORAGE_KEY, JSON.stringify(defaultBuddies));
    } catch {}

    return defaultBuddies;
  }

  public addStudyBuddy(name: string, subject: string = 'General Studies'): StudyBuddy {
    const buddies = this.getStudyBuddies();
    const newBuddy: StudyBuddy = {
      id: `b-${Date.now()}`,
      name: name.trim() || 'New Study Buddy',
      avatar: '🌟',
      subject: subject.trim() || 'General Studies',
      streak: 1,
      weeklyXP: 100,
      isOnline: true,
    };

    buddies.push(newBuddy);
    try {
      localStorage.setItem(BUDDIES_STORAGE_KEY, JSON.stringify(buddies));
    } catch {}

    return newBuddy;
  }
}

export const leagueService = new LeagueService();
