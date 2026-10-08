import { beforeEach, describe, expect, it } from 'vitest';
import type { DailyLedger } from '../types/lifeSim';
import { LIFE_KEYS, StorageService } from './storageService';
import { characterService } from './characterService';
import { lifeSimService } from './lifeSimService';

/** Another tab changing saved data: it writes storage directly, behind this tab's services. */
const inOtherTab = <T>(base: string, change: (saved: T) => T) => {
  const key = StorageService.lifeKey(base);
  localStorage.setItem(key, JSON.stringify(change(JSON.parse(localStorage.getItem(key) ?? 'null'))));
};

type SavedCharacter = { coins: number; hairColor: string };

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('studify_life_data_split_v1', '1');
  StorageService.setActiveUserId(null);
  lifeSimService.resetForTesting();
});

describe('the wallet with the app open in two tabs', () => {
  beforeEach(() => characterService.addCoins(350)); // 500 in both tabs

  it('keeps tokens spent in another tab when this tab earns', () => {
    inOtherTab<SavedCharacter>(LIFE_KEYS.CHARACTER, saved => ({ ...saved, coins: saved.coins - 400 }));
    characterService.addCoins(10);
    expect(characterService.getWalletBalance()).toBe(110);
  });

  it('spends only what the saved wallet holds', () => {
    inOtherTab<SavedCharacter>(LIFE_KEYS.CHARACTER, saved => ({ ...saved, coins: 30 }));
    expect(characterService.spendCoins(100)).toBe(false);
    expect(characterService.getWalletBalance()).toBe(30);
  });

  it("doesn't let an open avatar editor write back an old balance", () => {
    const editorCopy = characterService.getCharacter(); // 500 tokens, when the editor opened
    inOtherTab<SavedCharacter>(LIFE_KEYS.CHARACTER, saved => ({ ...saved, coins: 100 }));

    characterService.updateCustomization({ ...editorCopy, hairColor: '#123456', coins: 9999, level: 40 });
    expect(characterService.getCharacter()).toMatchObject({ hairColor: '#123456', coins: 100, level: 1 });
  });
});

describe('the ledger and home with the app open in two tabs', () => {
  beforeEach(() => characterService.addCoins(1000));

  it('keeps purchases made in another tab when this tab is paid', () => {
    const [furniture] = lifeSimService.getFurnitureCatalog().filter(item => item.cost > 0);
    // The other tab buys a piece of furniture: it owns it, and its ledger records the expense.
    inOtherTab<string[]>(LIFE_KEYS.OWNED_FURNITURE, saved => [...(saved ?? []), furniture.id]);
    inOtherTab<DailyLedger>(LIFE_KEYS.LEDGER, () => ({
      ...lifeSimService.getDailyLedger(),
      expenses: [{ id: 'other-tab', mealId: furniture.id, name: furniture.name, emoji: '', cost: furniture.cost, category: 'gear', purchasedAt: '' }],
      totalExpenses: furniture.cost,
      netBalance: -furniture.cost,
      rentPaidToday: true,
    }));

    lifeSimService.awardStudyWage('Reviews', 30);

    const ledger = lifeSimService.getDailyLedger();
    expect(ledger.expenses.map(e => e.id)).toContain('other-tab');
    expect(ledger.totalExpenses).toBe(furniture.cost);
    expect(ledger.totalEarnings).toBeGreaterThanOrEqual(30);
    expect(ledger.rentPaidToday).toBe(true);
    expect(lifeSimService.isFurnitureOwned(furniture.id)).toBe(true);
  });

  it('keeps furniture bought in another tab when this tab buys some', () => {
    const [first, second] = lifeSimService.getFurnitureCatalog().filter(item => item.cost > 0);
    inOtherTab<string[]>(LIFE_KEYS.OWNED_FURNITURE, saved => [...(saved ?? []), first.id]);

    expect(lifeSimService.buyFurniture(second.id).success).toBe(true);
    expect(JSON.parse(localStorage.getItem(StorageService.lifeKey(LIFE_KEYS.OWNED_FURNITURE)) ?? '[]')).toEqual(
      expect.arrayContaining([first.id, second.id]),
    );
  });

  it("won't charge rent again when another tab already paid it", () => {
    inOtherTab<DailyLedger>(LIFE_KEYS.LEDGER, () => ({ ...lifeSimService.getDailyLedger(), housingTier: 'studio', rentPaidToday: false }));
    StorageService.setActiveUserId(null); // this tab now holds the studio, with today's rent unpaid
    inOtherTab<DailyLedger>(LIFE_KEYS.LEDGER, saved => ({ ...saved, rentPaidToday: true }));

    const before = characterService.getWalletBalance();
    expect(lifeSimService.payDailyRent().success).toBe(false);
    expect(characterService.getWalletBalance()).toBe(before);
  });
});
