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
  category: MealCategory | 'housing' | 'gear' | 'streak';
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
  /** Not checked: upgrades need minCardsReviewed and upgradeCost only. */
  minNetWorth: number;
  /** Pay multiplier on days the rent is paid, e.g. 1.15 for +15%. */
  wageMultiplier: number;
  /** Not shown: the home dialog describes a home from wageMultiplier and unlockedRooms. */
  perkDescription: string;
  /** Rooms this home lets you furnish; the others stay locked. */
  unlockedRooms: HomeRoomId[];
  /** Not shown, and not given on moving in: flavor names of the home's signature pieces. */
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
  /** Rooms the piece can stand in. Each one has a spot for its `category` (see canPlaceFurniture). */
  roomCompatibility: HomeRoomId[];
  /** Flavor only: not part of the room's rating or pay. */
  focusBonus: number;
  /** Flavor only: not part of the room's rating or pay. */
  comfortBonus: number;
  /** What the piece adds to the room's worth, one of the rating's three parts. */
  designValue: number;
  /** @deprecated Unused: furniture changes neither pay nor the rating. */
  wageMultiplier: number;
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
  /** Unused: the 3D house picks its own wall finish. */
  defaultWallColor: string;
  /** Unused: the 3D house picks its own floor finish. */
  defaultFloorColor: string;
}

export interface EquippedFurnitureState {
  [roomId: string]: {
    [slotType: string]: string; // furnitureId
  };
}

export interface RoomDesignEvaluation {
  /** 1.0 for an empty room to 5.0: the sum of the breakdown's parts. */
  starRating: number;
  /** What the placed pieces are worth in all (their designValue). */
  totalValue: number;
  /** Flavor only: not part of the rating. */
  totalFocusBonus: number;
  /** Flavor only: not part of the rating. */
  totalComfortBonus: number;
  /** @deprecated Always 0: furniture never changes pay. */
  totalWageMultiplier: number;
  /** The look the pieces share, e.g. "Scandinavian look", or "Mixed styles". */
  harmonyTitle: string;
  /** Changes that would raise the rating, the biggest first (one line when none are left). */
  jurorFeedback: string[];
  /** When the rating was worked out, as an ISO string. */
  lastEvaluatedAt: string;
  /** The parts the rating adds up from. */
  breakdown: {
    /** Where every room starts: 1. */
    base: number;
    filledSlots: number;
    totalSlots: number;
    /** Up to 2, for the share of spots with a piece in them. */
    completeness: number;
    /** Up to 1, for what the pieces are worth against valueTarget. */
    value: number;
    /** What the pieces must be worth in all for the full point. */
    valueTarget: number;
    /** Up to 1, for how many pieces share one style against styleTarget. */
    harmony: number;
    /** The style most pieces share, or null in an empty room. */
    matchedStyle: string | null;
    /** How many pieces are in matchedStyle. */
    matchingPieces: number;
    /** How many pieces in one style earn the full point. */
    styleTarget: number;
  };
}
