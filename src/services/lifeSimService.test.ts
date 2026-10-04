import { describe, it, expect, beforeEach } from 'vitest';
import { lifeSimService } from './lifeSimService';
import { axolotlService } from './axolotlService';

describe('lifeSimService', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset coins
    const state = axolotlService.getState();
    axolotlService.addCoins(100 - (state.axonCoins || 0));
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
});
