import { 
  type MealItem, 
  type ActiveBuff, 
  type DailyLedger, 
  type LifestyleTier, 
  type LifestyleTierMeta,
  type LedgerExpense,
  type LedgerWage
} from '../types/lifeSim';
import { axolotlService } from './axolotlService';
import { soundEngine } from './soundEngine';

export const CAFETERIA_MENU: MealItem[] = [
  // --- Breakfasts ---
  {
    id: 'oatmeal',
    name: 'Warm Instant Oatmeal',
    subtitle: 'Humble student breakfast to kickstart morning focus',
    emoji: '🥣',
    category: 'breakfast',
    cost: 0, // Free basic meal
    buffDescription: 'Standard morning sustenance (No extra buff)',
    buffType: 'none',
    buffValue: 1.0,
    buffDurationMinutes: 0,
    tierRequired: 1,
  },
  {
    id: 'pancakes',
    name: 'Blueberry Fluffy Pancakes',
    subtitle: 'Golden buttermilk pancakes drenched in pure maple syrup',
    emoji: '🥞',
    category: 'breakfast',
    cost: 15,
    buffDescription: '+15% Study Wage on all flashcards & sprints',
    buffType: 'coin_multiplier',
    buffValue: 1.15,
    buffDurationMinutes: 30,
    tierRequired: 1,
  },
  {
    id: 'avocado_toast',
    name: 'Artisan Avocado & Poached Egg Toast',
    subtitle: 'Toasted sourdough with Hass avocado, chili flakes, and cage-free egg',
    emoji: '🥑',
    category: 'breakfast',
    cost: 30,
    buffDescription: '+25% Study Wage & +25% XP Boost',
    buffType: 'coin_multiplier',
    buffValue: 1.25,
    buffDurationMinutes: 45,
    tierRequired: 2,
  },

  // --- Lunches ---
  {
    id: 'student_sandwich',
    name: 'Campus Deli Sandwich',
    subtitle: 'Classic PB&J and crisp apple to get through midday lectures',
    emoji: '🥪',
    category: 'lunch',
    cost: 0, // Free basic meal
    buffDescription: 'Steady baseline energy for midday studying',
    buffType: 'none',
    buffValue: 1.0,
    buffDurationMinutes: 0,
    tierRequired: 1,
  },
  {
    id: 'bento_box',
    name: 'Tokyo Teriyaki Bento',
    subtitle: 'Glazed salmon, steamed koshihikari rice, tamagoyaki, and edamame',
    emoji: '🍱',
    category: 'lunch',
    cost: 20,
    buffDescription: '+20% Study Wage on afternoon sessions',
    buffType: 'coin_multiplier',
    buffValue: 1.20,
    buffDurationMinutes: 40,
    tierRequired: 1,
  },
  {
    id: 'ramen_bowl',
    name: 'Steaming Tonkotsu Chashu Ramen',
    subtitle: 'Rich 12-hour broth, handmade noodles, soft egg, and roasted seaweed',
    emoji: '🍜',
    category: 'lunch',
    cost: 35,
    buffDescription: '+30% Study Wage & Streak Shield against 1 lapse',
    buffType: 'coin_multiplier',
    buffValue: 1.30,
    buffDurationMinutes: 60,
    tierRequired: 2,
  },

  // --- Drinks & Snacks ---
  {
    id: 'cold_brew',
    name: 'Nitro Cold Brew Coffee',
    subtitle: 'Velvety smooth single-origin cascade with micro-foam crown',
    emoji: '☕',
    category: 'drink',
    cost: 10,
    buffDescription: '+25% Coin Multiplier during rapid review sprints',
    buffType: 'coin_multiplier',
    buffValue: 1.25,
    buffDurationMinutes: 25,
    tierRequired: 1,
  },
  {
    id: 'matcha_latte',
    name: 'Ceremonial Uji Matcha Latte',
    subtitle: 'Stone-ground green tea whisked with oat milk for calm theta focus',
    emoji: '🍵',
    category: 'drink',
    cost: 15,
    buffDescription: '+20% XP Gain & Zen Theta brainwave buffer',
    buffType: 'xp_multiplier',
    buffValue: 1.20,
    buffDurationMinutes: 35,
    tierRequired: 1,
  },
  {
    id: 'boba_tea',
    name: 'Brown Sugar Tiger Boba',
    subtitle: 'Chewy warm tapioca pearls in caramelized milk tea',
    emoji: '🧋',
    category: 'drink',
    cost: 18,
    buffDescription: '+20% Coin Multiplier & Instant +25 Lottie Happiness',
    buffType: 'coin_multiplier',
    buffValue: 1.20,
    buffDurationMinutes: 30,
    tierRequired: 2,
  },
  {
    id: 'cookie',
    name: 'Freshly Baked Choc-Chip Cookie',
    subtitle: 'Warm gooey center with sea salt crystals',
    emoji: '🍪',
    category: 'snack',
    cost: 8,
    buffDescription: 'Quick delight snack (+15 Lottie Happiness & +10 Energy)',
    buffType: 'none',
    buffValue: 1.0,
    buffDurationMinutes: 15,
    tierRequired: 1,
  },
];

export const LIFESTYLE_TIERS: Record<LifestyleTier, LifestyleTierMeta> = {
  frugal: {
    tier: 'frugal',
    level: 1,
    title: 'Frugal Student',
    subtitle: 'Surviving on grit, instant meals, and library study sprints',
    minNetBalance: 0,
    roomAtmosphere: 'Cozy Spartan Dorm',
    deskStyle: 'Simple wooden study desk with desk lamp',
    wallStyle: 'Paper notes and sticky reminders',
    perks: ['Free basic meals available daily', 'Zero bankruptcy penalties'],
  },
  cozy: {
    tier: 'cozy',
    level: 2,
    title: 'Cozy Scholar',
    subtitle: 'Comfortable living with hot bakery pastries and warm ambiance',
    minNetBalance: 40,
    roomAtmosphere: 'Warm Lo-Fi Study Room',
    deskStyle: 'Solid oak desk with succulent plants and ceramic mug',
    wallStyle: 'Fairy lights and study milestone certificates',
    perks: ['Unlocks gourmet café menu items', '+10% passive happiness for Lottie'],
  },
  scholar: {
    tier: 'scholar',
    level: 3,
    title: "Dean's List Penthouse",
    subtitle: 'Living in academic luxury with artisan coffee and scenic city views',
    minNetBalance: 100,
    roomAtmosphere: 'Penthouse Study Sanctuary',
    deskStyle: 'Designer walnut workstation with retro record player',
    wallStyle: 'Floor-to-ceiling rainy city window view',
    perks: ['Unlocks exclusive penthouse aesthetics', 'Permanent +10% Wage Bonus on all study shifts'],
  },
};

const LEDGER_STORAGE_KEY = 'studify_daily_ledger_v1';
const BUFFS_STORAGE_KEY = 'studify_active_buffs_v1';
const HISTORY_STORAGE_KEY = 'studify_ledger_history_v1';

type LifeSimListener = () => void;

class LifeSimService {
  private currentLedger: DailyLedger;
  private activeBuffs: ActiveBuff[] = [];
  private listeners: Set<LifeSimListener> = new Set();

  constructor() {
    this.currentLedger = this.loadLedger();
    this.activeBuffs = this.loadBuffs();
    this.cleanExpiredBuffs();
  }

  private getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private loadLedger(): DailyLedger {
    const today = this.getTodayDateString();
    const defaultLedger: DailyLedger = {
      date: today,
      breakfastId: null,
      lunchId: null,
      totalExpenses: 0,
      totalEarnings: 0,
      netBalance: 0,
      expenses: [],
      wages: [],
    };

    try {
      const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
      if (raw) {
        const parsed: DailyLedger = JSON.parse(raw);
        if (parsed.date === today) {
          return parsed;
        } else {
          // It's a new day! Archive the previous day's ledger
          this.archiveLedger(parsed);
          this.saveLedger(defaultLedger);
          return defaultLedger;
        }
      }
    } catch {
      // Fallback
    }

    return defaultLedger;
  }

  private archiveLedger(ledger: DailyLedger) {
    try {
      const rawHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      const history: DailyLedger[] = rawHistory ? JSON.parse(rawHistory) : [];
      // Keep up to 30 days
      const updated = [ledger, ...history.filter(h => h.date !== ledger.date)].slice(0, 30);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  private saveLedger(ledger: DailyLedger) {
    try {
      localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(ledger));
    } catch {}
  }

  private loadBuffs(): ActiveBuff[] {
    try {
      const raw = localStorage.getItem(BUFFS_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {}
    return [];
  }

  private saveBuffs() {
    try {
      localStorage.setItem(BUFFS_STORAGE_KEY, JSON.stringify(this.activeBuffs));
    } catch {}
  }

  private cleanExpiredBuffs(): boolean {
    const now = new Date().getTime();
    const countBefore = this.activeBuffs.length;
    this.activeBuffs = this.activeBuffs.filter(b => new Date(b.expiresAt).getTime() > now);
    if (this.activeBuffs.length !== countBefore) {
      this.saveBuffs();
      return true;
    }
    return false;
  }

  public subscribe(listener: LifeSimListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch {}
    });
  }

  public getDailyLedger(): DailyLedger {
    // Check for midnight rollover
    const today = this.getTodayDateString();
    if (this.currentLedger.date !== today) {
      this.archiveLedger(this.currentLedger);
      this.currentLedger = {
        date: today,
        breakfastId: null,
        lunchId: null,
        totalExpenses: 0,
        totalEarnings: 0,
        netBalance: 0,
        expenses: [],
        wages: [],
      };
      this.saveLedger(this.currentLedger);
      this.notify();
    }
    return { ...this.currentLedger };
  }

  public getWalletBalance(): number {
    return axolotlService.getState().axonCoins || 0;
  }

  public getActiveBuffs(): ActiveBuff[] {
    this.cleanExpiredBuffs();
    return [...this.activeBuffs];
  }

  public getActiveMultiplier(type: 'coin_multiplier' | 'xp_multiplier'): number {
    this.cleanExpiredBuffs();
    let multiplier = 1.0;

    // Check tier bonus
    const tier = this.getLifestyleTier();
    if (tier === 'scholar' && type === 'coin_multiplier') {
      multiplier += 0.10; // +10% Dean's List perk
    }

    for (const buff of this.activeBuffs) {
      if (buff.buffType === type && buff.buffValue > multiplier) {
        multiplier = buff.buffValue;
      }
    }
    return multiplier;
  }

  public getLifestyleTier(): LifestyleTier {
    const net = this.currentLedger.netBalance;
    if (net >= LIFESTYLE_TIERS.scholar.minNetBalance) {
      return 'scholar';
    }
    if (net >= LIFESTYLE_TIERS.cozy.minNetBalance) {
      return 'cozy';
    }
    return 'frugal';
  }

  public buyMeal(mealId: string): { success: boolean; error?: string; meal?: MealItem } {
    const meal = CAFETERIA_MENU.find(m => m.id === mealId);
    if (!meal) {
      return { success: false, error: 'Meal item not found' };
    }

    // Check affordability
    const currentCoins = this.getWalletBalance();
    if (currentCoins < meal.cost) {
      return { 
        success: false, 
        error: `Not enough AxonCoins! You have 🪙${currentCoins}, but this costs 🪙${meal.cost}. Complete a study sprint to earn wages!` 
      };
    }

    // Deduct coins from unified wallet
    if (meal.cost > 0) {
      const spent = axolotlService.spendCoins(meal.cost);
      if (!spent) {
        return { success: false, error: 'Failed to deduct coins' };
      }
    }

    // Record expense in ledger
    const expenseEntry: LedgerExpense = {
      id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      mealId: meal.id,
      name: meal.name,
      emoji: meal.emoji,
      cost: meal.cost,
      category: meal.category,
      purchasedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    this.currentLedger.expenses.unshift(expenseEntry);
    this.currentLedger.totalExpenses += meal.cost;
    this.currentLedger.netBalance = this.currentLedger.totalEarnings - this.currentLedger.totalExpenses;

    if (meal.category === 'breakfast' && !this.currentLedger.breakfastId) {
      this.currentLedger.breakfastId = meal.id;
    } else if (meal.category === 'lunch' && !this.currentLedger.lunchId) {
      this.currentLedger.lunchId = meal.id;
    }

    this.saveLedger(this.currentLedger);

    // Apply active buff if applicable
    if (meal.buffType !== 'none' && meal.buffDurationMinutes > 0) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + meal.buffDurationMinutes * 60 * 1000).toISOString();

      // Replace or add buff
      this.activeBuffs = this.activeBuffs.filter(b => b.buffType !== meal.buffType);
      this.activeBuffs.push({
        id: `buff_${Date.now()}`,
        mealId: meal.id,
        name: meal.name,
        emoji: meal.emoji,
        buffType: meal.buffType,
        buffValue: meal.buffValue,
        startedAt: now.toISOString(),
        expiresAt,
      });
      this.saveBuffs();
    }

    // Feed Lottie happiness and energy
    try {
      axolotlService.feed('berry'); // Boost companion mood
      soundEngine.playSuccess();
    } catch {}

    this.notify();
    return { success: true, meal };
  }

  public awardStudyWage(activity: string, rawAmount: number): {
    rawAmount: number;
    buffBonus: number;
    totalAmount: number;
    activity: string;
  } {
    const multiplier = this.getActiveMultiplier('coin_multiplier');
    const totalAmount = Math.max(1, Math.round(rawAmount * multiplier));
    const buffBonus = Math.max(0, totalAmount - rawAmount);

    // Add coins to player's wallet
    axolotlService.addCoins(totalAmount);

    // Record in ledger
    const wageEntry: LedgerWage = {
      id: `wage_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      activity,
      rawAmount,
      buffBonus,
      totalAmount,
      earnedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    this.currentLedger.wages.unshift(wageEntry);
    this.currentLedger.totalEarnings += totalAmount;
    this.currentLedger.netBalance = this.currentLedger.totalEarnings - this.currentLedger.totalExpenses;
    this.saveLedger(this.currentLedger);

    try {
      soundEngine.playSuccess();
    } catch {}

    this.notify();

    // Dispatch global event for celebratory banner
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('study-wage-earned', {
          detail: { activity, rawAmount, buffBonus, totalAmount },
        })
      );
    }

    return { rawAmount, buffBonus, totalAmount, activity };
  }

  public getHistory(): DailyLedger[] {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

export const lifeSimService = new LifeSimService();
