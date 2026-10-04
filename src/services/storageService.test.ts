import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from './storageService';

describe('StorageService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes default stats correctly', () => {
    const stats = StorageService.getStats();
    expect(stats.level).toBe(1);
    expect(stats.levelTitle).toBe('Synapse Builder');
    expect(stats.xp).toBe(0);
    expect(stats.todayMinutes).toBe(0);
  });

  it('updates XP and recalculates level correctly', () => {
    const statsBefore = StorageService.getStats();
    expect(statsBefore.level).toBe(1);

    // 150 XP per level
    StorageService.addXP(350);

    const statsAfter = StorageService.getStats();
    expect(statsAfter.xp).toBe(350);
    expect(statsAfter.level).toBe(3); // floor(350 / 150) + 1 = 3
    expect(statsAfter.levelTitle).toBe('Active Retrievist');
  });

  it('tracks weekly XP correctly and maintains personal best', () => {
    StorageService.addWeeklyXP(120);
    let weekly = StorageService.getWeeklyXP();
    expect(weekly.current).toBe(120);
    expect(weekly.best).toBe(120);

    StorageService.addWeeklyXP(80);
    weekly = StorageService.getWeeklyXP();
    expect(weekly.current).toBe(200);
    expect(weekly.best).toBe(200);
  });

  it('toggles card bookmark star status correctly', () => {
    const cardId = 'card-test-starred-1';
    
    // First toggle: stars the card
    const isStarred1 = StorageService.toggleCardStar(cardId);
    expect(isStarred1).toBe(true);
    expect(StorageService.isCardStarred(cardId)).toBe(true);

    // Second toggle: unstars the card
    const isStarred2 = StorageService.toggleCardStar(cardId);
    expect(isStarred2).toBe(false);
    expect(StorageService.isCardStarred(cardId)).toBe(false);
  });

  it('stores and retrieves sound preferences safely', () => {
    expect(StorageService.getSoundPreference()).toBe('binaural-40hz');

    StorageService.setSoundPreference('rain');
    expect(StorageService.getSoundPreference()).toBe('rain');

    StorageService.setSoundPreference('off');
    expect(StorageService.getSoundPreference()).toBe('off');
  });
});
