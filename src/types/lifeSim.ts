export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink';

export type LifeSimBuffType = 
  | 'coin_multiplier'    // e.g. +20% coins on flashcards / study
  | 'study_wage_boost'   // flat bonus tokens on study sprints
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

/** One thing raising pay right now. The pay multiplier is 1 plus the sum of the bonuses. */
export interface PayBoost {
  id: string;
  label: string;
  /** e.g. 0.15 for +15% */
  bonus: number;
  /** When a timed boost (a meal) runs out, as an ISO string. */
  endsAt?: string;
}

export interface LedgerExpense {
  id: string;
  mealId: string;
  name: string;
  emoji: string;
  cost: number;
  category: MealCategory | 'housing' | 'gear';
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
  dinnerId: string | null;
  drinkId?: string | null;
  eatenMeals?: {
    breakfast?: boolean;
    lunch?: boolean;
    dinner?: boolean;
    drink?: boolean;
  };
  totalExpenses: number;
  totalEarnings: number;
  netBalance: number; // totalEarnings - totalExpenses
  housingTier?: HousingTier;
  rentPaidToday?: boolean;
  ownedGear?: string[];
  academicRoleId?: string;
  expenses: LedgerExpense[];
  wages: LedgerWage[];
}

export type HousingTier = 'dorm' | 'studio' | 'flat' | 'penthouse';

export interface HousingProperty {
  id: HousingTier;
  level: number;
  name: string;
  subtitle: string;
  rentPerDay: number;
  upgradeCost: number;
  minCardsReviewed: number;
  minNetWorth: number;
  wageMultiplier: number;
  perkDescription: string;
  unlockedRooms: HomeRoomId[];
  decor: string[];
  icon: string;
}

export interface StudentGearItem {
  id: string;
  name: string;
  category: 'tech' | 'comfort' | 'audio' | 'desk';
  cost: number;
  emoji: string;
  perk: string;
  bonusMultiplier: number; // e.g. 0.10 for +10%
}

export interface AcademicRole {
  id: string;
  title: string;
  minCardsReviewed: number;
  baseWagePerSprint: number;
  icon: string;
  description: string;
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

export type HomeRoomId = 'study' | 'bedroom' | 'living' | 'kitchen' | 'balcony';

export type DesignSlotType = 
  | 'desk' 
  | 'chair' 
  | 'bed' 
  | 'sofa' 
  | 'lighting' 
  | 'plant' 
  | 'rug' 
  | 'wall_art' 
  | 'station' 
  | 'shelf';

export type DesignAestheticStyle = 
  | 'Scandinavian' 
  | 'Dark Academia' 
  | 'Modern Lo-Fi' 
  | 'Japanese Zen' 
  | 'Industrial Chic';

export interface RoomFurnitureItem {
  id: string;
  name: string;
  subtitle: string;
  category: DesignSlotType;
  brandStyle: DesignAestheticStyle;
  cost: number; // AxonCoins
  roomCompatibility: HomeRoomId[];
  focusBonus: number; // +X Focus Points
  comfortBonus: number; // +X Comfort Index
  designValue: number; // Room valuation in tokens
  wageMultiplier: number; // Not applied to pay: furniture only raises the room's rating
  emoji: string;
  description: string;
  colorHex?: string;
  gradient?: string;
  interactiveAction?: {
    type: 'study' | 'brew_coffee' | 'nap_rest' | 'play_music' | 'toggle_light';
    label: string;
    tooltip: string;
  };
}

export interface HomeRoomDefinition {
  id: HomeRoomId;
  name: string;
  subtitle: string;
  icon: string;
  slots: DesignSlotType[];
  description: string;
  defaultWallColor: string;
  defaultFloorColor: string;
}

export interface EquippedFurnitureState {
  [roomId: string]: {
    [slotType: string]: string; // furnitureId
  };
}

export interface RoomDesignEvaluation {
  starRating: number; // 1.0 to 5.0
  totalValue: number;
  totalFocusBonus: number;
  totalComfortBonus: number;
  totalWageMultiplier: number;
  harmonyTitle: string;
  jurorFeedback: string[];
  lastEvaluatedAt: string;
  /** The parts the rating adds up from (before it is kept between 3 and 5). */
  breakdown: {
    base: number;
    filledSlots: number;
    totalSlots: number;
    /** Up to 0.9, for spots with a piece in them. */
    completeness: number;
    /** Up to 0.65, from what the pieces are worth. */
    value: number;
    /** 0.35 once three pieces share a style. */
    harmony: number;
    matchedStyle: string | null;
  };
}
