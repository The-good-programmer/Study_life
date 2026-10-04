export type MealCategory = 'breakfast' | 'lunch' | 'snack' | 'drink';

export type LifeSimBuffType = 
  | 'coin_multiplier'    // e.g. +20% coins on flashcards / study
  | 'xp_multiplier'      // e.g. +30% XP gain
  | 'streak_shield'      // protects streak against single lapse
  | 'zen_focus'          // calm theta boost / focus vibe
  | 'none';

export interface MealItem {
  id: string;
  name: string;
  subtitle: string;
  emoji: string;
  category: MealCategory;
  cost: number; // AxonCoins
  buffDescription: string;
  buffType: LifeSimBuffType;
  buffValue: number; // e.g. 1.25 for +25%
  buffDurationMinutes: number;
  tierRequired: 1 | 2 | 3;
}

export interface ActiveBuff {
  id: string;
  mealId: string;
  name: string;
  emoji: string;
  buffType: LifeSimBuffType;
  buffValue: number;
  startedAt: string;
  expiresAt: string; // ISO string
}

export interface LedgerExpense {
  id: string;
  mealId: string;
  name: string;
  emoji: string;
  cost: number;
  category: MealCategory;
  purchasedAt: string;
}

export interface LedgerWage {
  id: string;
  activity: string;
  rawAmount: number;
  buffBonus: number;
  totalAmount: number;
  earnedAt: string;
}

export interface DailyLedger {
  date: string; // YYYY-MM-DD
  breakfastId: string | null;
  lunchId: string | null;
  totalExpenses: number;
  totalEarnings: number;
  netBalance: number; // totalEarnings - totalExpenses
  expenses: LedgerExpense[];
  wages: LedgerWage[];
}

export type LifestyleTier = 'frugal' | 'cozy' | 'scholar';

export interface LifestyleTierMeta {
  tier: LifestyleTier;
  level: number;
  title: string;
  subtitle: string;
  minNetBalance: number;
  roomAtmosphere: string;
  deskStyle: string;
  wallStyle: string;
  perks: string[];
}
