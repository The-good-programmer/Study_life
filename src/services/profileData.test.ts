import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIFE_KEYS, StorageService } from './storageService';
import { characterService } from './characterService';
import { lifeSimService } from './lifeSimService';
import { STARTING_COINS } from './economy/wallet';
import { grantReward } from './economy/rewardService';

const coins = () => characterService.getCharacter().coins;

/** As after an update from a version that kept life-sim data once per device. */
const useFreshStorage = () => {
  localStorage.clear();
  localStorage.setItem('studify_life_data_split_v1', '1');
  StorageService.setActiveUserId(null);
};

describe('life-sim data per profile', () => {
  beforeEach(useFreshStorage);
  afterEach(() => {
    vi.useRealTimers();
    StorageService.setActiveUserId(null);
  });

  it('gives each profile its own wallet, and switches to it on sign-in and sign-out', () => {
    expect(coins()).toBe(STARTING_COINS);
    characterService.addCoins(40);
    expect(coins()).toBe(STARTING_COINS + 40);

    StorageService.setActiveUserId('usr_a');
    expect(coins()).toBe(STARTING_COINS);
    characterService.addCoins(5);

    StorageService.setActiveUserId(null);
    expect(coins()).toBe(STARTING_COINS + 40);
    StorageService.setActiveUserId('usr_a');
    expect(coins()).toBe(STARTING_COINS + 5);
  });

  it("keeps an account's pay, rent and home away from other profiles", () => {
    StorageService.setActiveUserId('usr_a');
    lifeSimService.awardStudyWage('Reviews', 30);
    expect(lifeSimService.getDailyLedger().totalEarnings).toBe(30);

    StorageService.setActiveUserId('usr_b');
    expect(lifeSimService.getDailyLedger().totalEarnings).toBe(0);
    expect(coins()).toBe(STARTING_COINS);
  });

  it('keeps a streak freeze with the profile that bought it', () => {
    StorageService.setActiveUserId('usr_a');
    expect(lifeSimService.buyStreakFreeze().success).toBe(true);
    expect(StorageService.hasSynapticFreeze()).toBe(true);
    StorageService.setActiveUserId('usr_b');
    expect(StorageService.hasSynapticFreeze()).toBe(false);
  });

  it('removes a deleted account’s wallet and home with its study data', () => {
    StorageService.setActiveUserId('usr_gone');
    characterService.addCoins(10);
    StorageService.setActiveUserId(null);
    StorageService.purgeUserData('usr_gone');
    expect(localStorage.getItem(`${LIFE_KEYS.CHARACTER}_usr_gone`)).toBeNull();
  });
});

describe('device-wide life-sim data from older versions', () => {
  beforeEach(() => {
    localStorage.clear();
    StorageService.setActiveUserId(null);
    localStorage.removeItem('studify_life_data_split_v1');
  });

  it('goes to the signed-in account once, moved rather than copied', () => {
    localStorage.setItem(LIFE_KEYS.CHARACTER, JSON.stringify({ name: 'Old', coins: 900 }));
    StorageService.setActiveUserId('usr_first');
    expect(coins()).toBe(900);
    expect(localStorage.getItem(LIFE_KEYS.CHARACTER)).toBeNull();

    StorageService.setActiveUserId('usr_second');
    expect(coins()).toBe(STARTING_COINS);
  });
});

describe('guest progress carried into an account', () => {
  beforeEach(useFreshStorage);

  it('gives a new account the guest’s wallet and home as they are', () => {
    characterService.addCoins(100);
    StorageService.migrateGuestDataToUser('usr_new');
    StorageService.setActiveUserId('usr_new');
    expect(coins()).toBe(STARTING_COINS + 100);
    StorageService.setActiveUserId(null);
    expect(coins()).toBe(STARTING_COINS);
  });

  it('adds what the guest earned, beyond the starting gift, to an existing wallet', () => {
    StorageService.setActiveUserId('usr_old');
    characterService.addCoins(20);
    StorageService.setActiveUserId(null);
    grantReward({ kind: 'match-clear' }); // the guest earns 20

    StorageService.migrateGuestDataToUser('usr_old');
    StorageService.setActiveUserId('usr_old');
    expect(coins()).toBe(STARTING_COINS + 20 + 20);

    // Signing out and back in again brings nothing new: the fresh guest's gift stays behind.
    StorageService.setActiveUserId(null);
    StorageService.migrateGuestDataToUser('usr_old');
    StorageService.setActiveUserId('usr_old');
    expect(coins()).toBe(STARTING_COINS + 20 + 20);
  });

  it("counts the guest's earnings against the account's daily limits", () => {
    StorageService.setActiveUserId('usr_old');
    grantReward({ kind: 'match-clear' });
    grantReward({ kind: 'match-clear' }); // the account reaches today's speed-match cap
    const before = coins();

    StorageService.setActiveUserId(null);
    expect(grantReward({ kind: 'match-clear' }).tokens).toBe(20); // a guest has caps of its own

    StorageService.migrateGuestDataToUser('usr_old');
    StorageService.setActiveUserId('usr_old');
    // Past the cap a match pays a quarter, so the account gains 5 of the guest's 20.
    expect(coins()).toBe(before + 5);
  });

  it('leaves what the guest bought behind when the account has its own home', () => {
    StorageService.setActiveUserId('usr_old');
    characterService.addCoins(5);
    StorageService.setActiveUserId(null);

    // Spent from the starting gift every new guest gets.
    const furniture = lifeSimService.getFurnitureCatalog().find(item => item.cost > 0 && item.cost <= 100)!;
    expect(lifeSimService.buyStreakFreeze().success).toBe(true);
    expect(lifeSimService.buyFurniture(furniture.id).success).toBe(true);

    StorageService.migrateGuestDataToUser('usr_old');
    StorageService.setActiveUserId('usr_old');
    expect(StorageService.hasSynapticFreeze()).toBe(false);
    expect(lifeSimService.isFurnitureOwned(furniture.id)).toBe(false);
    expect(coins()).toBe(STARTING_COINS + 5);
  });
});

describe('weekly XP', () => {
  beforeEach(useFreshStorage);
  afterEach(() => vi.useRealTimers());

  it('starts over each Monday and remembers the best week', () => {
    vi.setSystemTime(new Date('2026-10-07T10:00:00.000Z')); // a Wednesday
    StorageService.addWeeklyXP(50);
    vi.setSystemTime(new Date('2026-10-11T23:00:00.000Z')); // Sunday, same week
    StorageService.addWeeklyXP(30);
    expect(StorageService.getWeeklyXP()).toEqual({ current: 80, best: 80 });

    vi.setSystemTime(new Date('2026-10-12T08:00:00.000Z')); // Monday
    expect(StorageService.getWeeklyXP()).toEqual({ current: 0, best: 80 });
    StorageService.addWeeklyXP(10);
    expect(StorageService.getWeeklyXP()).toEqual({ current: 10, best: 80 });
  });

  it('is kept per profile', () => {
    StorageService.addWeeklyXP(25);
    StorageService.setActiveUserId('usr_a');
    expect(StorageService.getWeeklyXP().current).toBe(0);
  });
});
