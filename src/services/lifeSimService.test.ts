import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { lifeSimService } from './lifeSimService';
import { characterService } from './characterService';
import { StorageService } from './storageService';

/** Meets the studio's requirements (25 reviews, 120 tokens) and moves in. */
const moveIntoStudio = () => {
  StorageService.saveCards([{ id: 'reviewed', conceptId: 'k', question: 'Q', answer: 'A', stability: 9, difficulty: 5, reps: 25, lapses: 0 }]);
  characterService.addCoins(100);
  const result = lifeSimService.upgradeHousing('studio');
  expect(result.success).toBe(true);
};

describe('lifeSimService', () => {
  beforeEach(() => {
    localStorage.clear();
    lifeSimService.resetForTesting();
    // Reset coins
    const char = characterService.getCharacter();
    characterService.addCoins(100 - (char.coins || 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes a fresh daily ledger for today with 0 expenses and 0 earnings', () => {
    const ledger = lifeSimService.getDailyLedger();
    expect(ledger).toBeDefined();
    expect(ledger.totalExpenses).toBe(0);
    expect(ledger.totalEarnings).toBe(0);
    expect(ledger.netBalance).toBe(0);
  });

  it('allows buying a free breakfast without deducting coins', () => {
    const initialCoins = lifeSimService.getWalletBalance();
    const result = lifeSimService.buyMeal('oatmeal');
    expect(result.success).toBe(true);
    expect(lifeSimService.getWalletBalance()).toBe(initialCoins);
    
    const ledger = lifeSimService.getDailyLedger();
    expect(ledger.breakfastId).toBe('oatmeal');
    expect(ledger.totalExpenses).toBe(0);
  });

  it('deducts coins and logs expenses when buying paid meal', () => {
    const initialCoins = lifeSimService.getWalletBalance();
    const result = lifeSimService.buyMeal('pancakes'); // 15 coins
    expect(result.success).toBe(true);
    expect(lifeSimService.getWalletBalance()).toBe(initialCoins - 15);

    const ledger = lifeSimService.getDailyLedger();
    expect(ledger.totalExpenses).toBe(15);
    expect(ledger.netBalance).toBe(-15);
  });

  it('activates buff and applies multiplier when awarding study wage', () => {
    // Buy pancakes (+15% coin multiplier)
    lifeSimService.buyMeal('pancakes');
    const buffs = lifeSimService.getActiveBuffs();
    expect(buffs.length).toBeGreaterThan(0);
    expect(buffs[0].mealId).toBe('pancakes');

    // Award raw study wage of 20 coins
    const wage = lifeSimService.awardStudyWage('Flashcards Sprint', 20);
    expect(wage.rawAmount).toBe(20);
    // 20 * 1.15 = 23 -> buffBonus 3
    expect(wage.totalAmount).toBe(23);
    expect(wage.buffBonus).toBe(3);

    const ledger = lifeSimService.getDailyLedger();
    expect(ledger.totalEarnings).toBe(23);
  });

  it('transitions lifestyle tier from frugal to cozy when net balance reaches threshold', () => {
    expect(lifeSimService.getLifestyleTier()).toBe('frugal');

    // Earn 50 coins
    lifeSimService.awardStudyWage('Deep Study Sprint', 50);
    expect(lifeSimService.getDailyLedger().netBalance).toBeGreaterThanOrEqual(40);
    expect(lifeSimService.getLifestyleTier()).toBe('cozy');
  });

  it('allows buying dinner and records dinnerId in daily ledger', () => {
    const res = lifeSimService.buyMeal('pasta_bolognese'); // 25 coins
    expect(res.success).toBe(true);
    const ledger = lifeSimService.getDailyLedger();
    expect(ledger.dinnerId).toBe('pasta_bolognese');
    expect(ledger.totalExpenses).toBe(25);
  });

  it("pays a home's bonus only on days its rent is paid", () => {
    vi.setSystemTime(new Date('2026-10-08T09:00:00.000Z'));
    lifeSimService.resetForTesting();
    moveIntoStudio();
    // The renovation day counts as paid.
    expect(lifeSimService.getActiveMultiplier()).toBe(1.15);

    vi.setSystemTime(new Date('2026-10-09T09:00:00.000Z'));
    expect(lifeSimService.isRentPaidToday()).toBe(false);
    expect(lifeSimService.getActiveMultiplier()).toBe(1);
    expect(lifeSimService.awardStudyWage('Reviews', 20).totalAmount).toBe(20);

    const before = lifeSimService.getWalletBalance();
    expect(lifeSimService.payDailyRent().success).toBe(true);
    expect(lifeSimService.getWalletBalance()).toBe(before - 18);
    expect(lifeSimService.getPayBoosts().map(boost => boost.id)).toEqual(['home']);
    expect(lifeSimService.awardStudyWage('Reviews', 20).totalAmount).toBe(23);
  });

  it('has no rent in the dorm, which has no pay bonus', () => {
    const result = lifeSimService.payDailyRent();
    expect(result.success).toBe(false);
    expect(result.error).toContain('no rent');
    expect(lifeSimService.getActiveMultiplier()).toBe(1);
  });

  it('upgrades one level at a time, so no renovation is skipped', () => {
    StorageService.saveCards([{ id: 'reviewed', conceptId: 'k', question: 'Q', answer: 'A', stability: 9, difficulty: 5, reps: 200, lapses: 0 }]);
    characterService.addCoins(1000);
    const result = lifeSimService.upgradeHousing('penthouse');
    expect(result.success).toBe(false);
    expect(result.error).toContain('level 2 first');
    expect(lifeSimService.getHousing().id).toBe('dorm');
  });

  it('allows buying student gear and stacks wage multipliers', () => {
    expect(lifeSimService.getOwnedGear()).toHaveLength(0);
    // Buy ANC Headphones (cost 45, +10% wage)
    const initialCoins = lifeSimService.getWalletBalance();
    const res = lifeSimService.buyGear('gear_headphones');
    expect(res.success).toBe(true);
    expect(lifeSimService.getOwnedGear()).toHaveLength(1);
    expect(lifeSimService.getOwnedGear()[0].id).toBe('gear_headphones');
    expect(lifeSimService.getWalletBalance()).toBe(initialCoins - 45);

    // Baseline dorm is 1.0, gear adds 0.10 => 1.10
    expect(lifeSimService.getActiveMultiplier()).toBe(1.10);
  });

  it('calculates academic role properly', () => {
    const role = lifeSimService.getAcademicRole();
    expect(role).toBeDefined();
    expect(role.id).toBe('role_freshman');
  });

  it('prevents paying rent twice in one day', () => {
    vi.setSystemTime(new Date('2026-10-08T09:00:00.000Z'));
    lifeSimService.resetForTesting();
    moveIntoStudio();
    vi.setSystemTime(new Date('2026-10-09T09:00:00.000Z'));
    const res1 = lifeSimService.payDailyRent();
    expect(res1.success).toBe(true);
    expect(lifeSimService.getDailyLedger().rentPaidToday).toBe(true);

    const res2 = lifeSimService.payDailyRent();
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('already been paid');
  });

  it('provides the 5 real-life rooms with slots and definitions', () => {
    const rooms = lifeSimService.getRooms();
    expect(rooms).toHaveLength(5);
    const roomIds = rooms.map(r => r.id);
    expect(roomIds).toEqual(['study', 'bedroom', 'living', 'kitchen', 'balcony']);

    const study = lifeSimService.getRoom('study');
    expect(study.slots).toContain('desk');
    expect(study.slots).toContain('chair');
    expect(study.slots).toContain('lighting');
    expect(study.slots).toContain('bed');
  });

  it('starts life in dorm with only study room unlocked', () => {
    expect(lifeSimService.getHousing().id).toBe('dorm');
    expect(lifeSimService.getUnlockedRooms()).toEqual(['study']);
    expect(lifeSimService.isRoomUnlocked('study')).toBe(true);
    expect(lifeSimService.isRoomUnlocked('kitchen')).toBe(false);
    expect(lifeSimService.isRoomUnlocked('bedroom')).toBe(false);
    expect(lifeSimService.isRoomUnlocked('living')).toBe(false);
    expect(lifeSimService.isRoomUnlocked('balcony')).toBe(false);
  });

  it('validates study and token requirements before upgrading housing', () => {
    // Studio requires 25 cards reviewed and 120 tokens
    const upgradeRes = lifeSimService.upgradeHousing('studio');
    expect(upgradeRes.success).toBe(false);
    expect(upgradeRes.error).toContain('cards reviewed');
  });

  it('initializes default equipped furniture and ownership for starter pieces', () => {
    const studyEquipped = lifeSimService.getEquippedFurniture('study');
    expect(studyEquipped.desk).toBeDefined();
    expect(studyEquipped.desk?.id).toBe('desk_basic_oak');
    expect(studyEquipped.chair?.id).toBe('chair_wooden_student');
    expect(studyEquipped.bed?.id).toBe('bed_campus_twin');

    expect(lifeSimService.isFurnitureOwned('desk_basic_oak')).toBe(true);
    expect(lifeSimService.isFurnitureOwned('chair_wooden_student')).toBe(true);
    expect(lifeSimService.isFurnitureOwned('bed_campus_twin')).toBe(true);

    // Other rooms start empty
    const bedEquipped = lifeSimService.getEquippedFurniture('bedroom');
    expect(bedEquipped.bed).toBeNull();
  });

  it('allows purchasing designer furniture and staging it in the room', () => {
    // Walnut desk costs 65 tokens
    const initialCoins = lifeSimService.getWalletBalance();
    expect(initialCoins).toBe(100);

    const buyRes = lifeSimService.buyFurniture('desk_walnut_exec', 'study');
    expect(buyRes.success).toBe(true);
    expect(buyRes.item?.id).toBe('desk_walnut_exec');

    // Balance deducted
    expect(lifeSimService.getWalletBalance()).toBe(initialCoins - 65);
    expect(lifeSimService.isFurnitureOwned('desk_walnut_exec')).toBe(true);

    // Staged in room
    const equipped = lifeSimService.getEquippedFurniture('study');
    expect(equipped.desk?.id).toBe('desk_walnut_exec');
    expect(equipped.desk?.focusBonus).toBe(14);
  });

  it('calculates Design Home 5-star score and juror feedback', () => {
    const evaluation = lifeSimService.calculateRoomDesignScore('study');
    expect(evaluation.starRating).toBeGreaterThanOrEqual(3.0);
    expect(evaluation.starRating).toBeLessThanOrEqual(5.0);
    expect(evaluation.totalValue).toBeGreaterThan(0);
    expect(evaluation.jurorFeedback.length).toBeGreaterThan(0);
  });

  it('sells one streak freeze at a time and records it in the day’s spending', () => {
    expect(lifeSimService.buyStreakFreeze().success).toBe(true);
    expect(StorageService.hasSynapticFreeze()).toBe(true);
    expect(lifeSimService.getWalletBalance()).toBe(50);
    expect(lifeSimService.getDailyLedger().expenses[0]).toMatchObject({ name: 'Streak freeze', cost: 50 });

    const again = lifeSimService.buyStreakFreeze();
    expect(again.success).toBe(false);
    expect(lifeSimService.getWalletBalance()).toBe(50);
  });

  it('does not sell a streak freeze without the tokens for it', () => {
    characterService.spendCoins(80);
    const result = lifeSimService.buyStreakFreeze();
    expect(result.success).toBe(false);
    expect(StorageService.hasSynapticFreeze()).toBe(false);
    expect(lifeSimService.getWalletBalance()).toBe(20);
  });

  it('replaces a meal boost with the next one instead of stacking them', () => {
    lifeSimService.buyMeal('pancakes');
    lifeSimService.buyMeal('cold_brew');
    const boosts = lifeSimService.getPayBoosts();
    expect(boosts).toHaveLength(1);
    expect(boosts[0].bonus).toBeCloseTo(0.25);
    expect(boosts[0].endsAt).toBeDefined();
    expect(lifeSimService.getActiveMultiplier()).toBe(1.25);
  });

  it('resets back to starter dorm life properly', () => {
    lifeSimService.buyGear('gear_headphones');
    expect(lifeSimService.getOwnedGear().length).toBeGreaterThan(0);

    lifeSimService.resetToStarterLife();
    expect(lifeSimService.getHousing().id).toBe('dorm');
    expect(lifeSimService.getOwnedGear()).toHaveLength(0);
    expect(lifeSimService.getUnlockedRooms()).toEqual(['study']);

    const studyEquipped = lifeSimService.getEquippedFurniture('study');
    expect(studyEquipped.desk?.id).toBe('desk_basic_oak');
    expect(studyEquipped.bed?.id).toBe('bed_campus_twin');
  });
});


