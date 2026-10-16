import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  canPlaceFurniture,
  DEFAULT_EQUIPPED_FURNITURE,
  FURNITURE_CATALOG,
  HOME_ROOMS,
  lifeSimService,
  rateRoomDesign,
  sanitizeEquippedFurniture,
} from './lifeSimService';
import { characterService } from './characterService';
import { LIFE_KEYS, StorageService } from './storageService';
import type { DesignSlotType, HomeRoomId, RoomFurnitureItem } from '../types/lifeSim';

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
    localStorage.setItem('studify_life_data_split_v1', '1');
    // Services keep the wallet and ledger in memory: reload them from the now empty storage.
    StorageService.setActiveUserId(null);
    lifeSimService.resetForTesting();
    characterService.addCoins(100 - characterService.getWalletBalance());
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

  it('rates the starter study low, with tips to raise it', () => {
    const evaluation = lifeSimService.calculateRoomDesignScore('study');
    const b = evaluation.breakdown;
    // 3 of 8 spots (0.75), 90 of 700 tokens (0.13), 3 Scandinavian pieces of 6 (0.5).
    expect(evaluation.starRating).toBe(2.38);
    expect(b).toMatchObject({ base: 1, filledSlots: 3, totalSlots: 8, completeness: 0.75, value: 0.13, harmony: 0.5 });
    expect(b).toMatchObject({ valueTarget: 700, styleTarget: 6, matchedStyle: 'Scandinavian', matchingPieces: 3 });
    expect(evaluation.totalValue).toBe(90);
    expect(evaluation.jurorFeedback[0]).toContain('5 empty spots');
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

describe('furniture placement', () => {
  const designsKey = () => StorageService.lifeKey(LIFE_KEYS.ROOM_DESIGNS);
  const ownedKey = () => StorageService.lifeKey(LIFE_KEYS.OWNED_FURNITURE);

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('studify_life_data_split_v1', '1');
    StorageService.setActiveUserId(null);
    lifeSimService.resetForTesting();
    characterService.addCoins(100 - characterService.getWalletBalance());
  });

  it('only lists a piece for rooms with a spot for it', () => {
    for (const item of FURNITURE_CATALOG) {
      expect(item.roomCompatibility.length, item.id).toBeGreaterThan(0);
      for (const roomId of item.roomCompatibility) {
        expect(HOME_ROOMS.find(room => room.id === roomId)?.slots, `${item.id} in ${roomId}`).toContain(item.category);
      }
    }
  });

  it('offers the study no station pieces, since it has no spot for one', () => {
    const study = lifeSimService.getFurnitureCatalog({ room: 'study' });
    expect(study.length).toBeGreaterThan(0);
    expect(study.some(item => item.category === 'station')).toBe(false);
    expect(study.every(item => canPlaceFurniture(item, 'study'))).toBe(true);

    const turntable = FURNITURE_CATALOG.find(item => item.id === 'station_lofi_turntable')!;
    expect(canPlaceFurniture(turntable, 'living')).toBe(true);
    // Even if the data listed the study again, the spot check would still say no.
    expect(canPlaceFurniture({ ...turntable, roomCompatibility: ['study', 'living'] }, 'study')).toBe(false);
  });

  it('does not place an owned piece in a room with no spot for it', () => {
    expect(lifeSimService.buyFurniture('station_moka_pot').success).toBe(true);
    const result = lifeSimService.equipFurniture('station_moka_pot', 'study');
    expect(result.success).toBe(false);
    expect(result.error).toContain('no spot');
    expect(lifeSimService.getAllEquippedState().study.station).toBeUndefined();
  });

  it('does not furnish a room the home has not unlocked', () => {
    expect(lifeSimService.buyFurniture('rug_minimal_linen').success).toBe(true);
    const result = lifeSimService.equipFurniture('rug_minimal_linen', 'living');
    expect(result.success).toBe(false);
    expect(result.error).toContain('bigger home');
    expect(lifeSimService.getAllEquippedState().living).toEqual({});
  });

  it('takes no tokens for a piece it could not place', () => {
    const locked = lifeSimService.buyFurniture('sofa_dorm_futon', 'living');
    expect(locked.success).toBe(false);
    const noSpot = lifeSimService.buyFurniture('station_moka_pot', 'study');
    expect(noSpot.success).toBe(false);
    expect(noSpot.error).toContain('no spot');

    expect(lifeSimService.getWalletBalance()).toBe(100);
    expect(lifeSimService.isFurnitureOwned('sofa_dorm_futon')).toBe(false);
    expect(lifeSimService.isFurnitureOwned('station_moka_pot')).toBe(false);
    expect(lifeSimService.getDailyLedger().expenses).toHaveLength(0);
  });

  it('buys and places a piece once its room comes with the home', () => {
    moveIntoStudio();
    const result = lifeSimService.buyFurniture('sofa_dorm_futon', 'living');
    expect(result.success).toBe(true);
    expect(lifeSimService.getEquippedFurniture('living').sofa?.id).toBe('sofa_dorm_futon');
    expect(lifeSimService.calculateRoomDesignScore('living').breakdown.filledSlots).toBe(1);
  });

  it('places an owned piece through buyFurniture, and passes on why it could not', () => {
    expect(lifeSimService.buyFurniture('rug_minimal_linen').success).toBe(true);
    const locked = lifeSimService.buyFurniture('rug_minimal_linen', 'living');
    expect(locked).toMatchObject({ success: false, error: expect.stringContaining('bigger home') });
    expect(lifeSimService.buyFurniture('rug_minimal_linen', 'study').success).toBe(true);
    expect(lifeSimService.getEquippedFurniture('study').rug?.id).toBe('rug_minimal_linen');
  });

  it('loads older saves with misplaced pieces, dropping them from rooms but keeping them owned', () => {
    localStorage.setItem(
      designsKey(),
      JSON.stringify({
        study: { desk: 'desk_basic_oak', chair: 'desk_walnut_exec', bed: 'bed_campus_twin', station: 'station_moka_pot', shelf: 'gone_item' },
        living: { chair: 'chair_boucle_swivel', sofa: 'sofa_dorm_futon' },
        bedroom: 'broken',
      }),
    );
    localStorage.setItem(ownedKey(), JSON.stringify(['station_moka_pot', 'chair_boucle_swivel', 'sofa_dorm_futon', 'desk_walnut_exec']));
    // Any change reloads the saved home first.
    expect(lifeSimService.equipFurniture('desk_basic_oak', 'study').success).toBe(true);

    const state = lifeSimService.getAllEquippedState();
    expect(state.study).toEqual({ desk: 'desk_basic_oak', bed: 'bed_campus_twin' });
    // A sofa in the still-locked living room is a fine spot: it shows once the room unlocks.
    expect(state.living).toEqual({ sofa: 'sofa_dorm_futon' });
    expect(state.bedroom).toEqual({});
    expect(Object.keys(state).sort()).toEqual(HOME_ROOMS.map(room => room.id).sort());
    expect(JSON.parse(localStorage.getItem(designsKey())!).study.station).toBeUndefined();
    for (const id of ['station_moka_pot', 'chair_boucle_swivel', 'sofa_dorm_futon', 'desk_walnut_exec']) {
      expect(lifeSimService.isFurnitureOwned(id), id).toBe(true);
    }
  });

  it('falls back to the starter rooms for an unreadable save', () => {
    expect(sanitizeEquippedFurniture(null).study).toEqual(DEFAULT_EQUIPPED_FURNITURE.study);
    expect(sanitizeEquippedFurniture('nonsense').kitchen).toEqual({});
    localStorage.setItem(designsKey(), '{not json');
    expect(lifeSimService.equipFurniture('desk_basic_oak', 'study').success).toBe(true);
    expect(lifeSimService.getAllEquippedState().study).toEqual(DEFAULT_EQUIPPED_FURNITURE.study);
  });
});

describe('room rating', () => {
  const byId = (id: string) => FURNITURE_CATALOG.find(item => item.id === id)!;

  /** Every way to fill a room's spots with pieces that can stand there. */
  const everyFullRoom = function* (roomId: HomeRoomId) {
    const room = HOME_ROOMS.find(r => r.id === roomId)!;
    const options = room.slots.map(slot => FURNITURE_CATALOG.filter(item => item.category === slot && canPlaceFurniture(item, roomId)));
    const pick = new Array(options.length).fill(0);
    while (true) {
      yield Object.fromEntries(room.slots.map((slot, i) => [slot, options[i][pick[i]]]));
      let i = 0;
      while (i < pick.length && ++pick[i] === options[i].length) pick[i++] = 0;
      if (i === pick.length) return;
    }
  };

  it('rates an empty room 1', () => {
    for (const room of HOME_ROOMS) {
      const evaluation = rateRoomDesign(room.id, {});
      expect(evaluation.starRating, room.id).toBe(1);
      expect(evaluation.breakdown).toMatchObject({ completeness: 0, value: 0, harmony: 0, matchedStyle: null });
    }
  });

  it('lets every room reach 5 with full, valuable, matching pieces, and never leaves 1 to 5', () => {
    for (const room of HOME_ROOMS) {
      let best = 0;
      let worst = 5;
      let mismatches = 0;
      for (const pieces of everyFullRoom(room.id)) {
        const { starRating, breakdown: b } = rateRoomDesign(room.id, pieces);
        if (Math.abs(starRating - (b.base + b.completeness + b.value + b.harmony)) > 1e-9) mismatches += 1;
        best = Math.max(best, starRating);
        worst = Math.min(worst, starRating);
      }
      expect(mismatches, room.id).toBe(0);
      expect(best, room.id).toBe(5);
      // A full room of the cheapest, most mixed pieces still beats a half-empty one.
      expect(worst, room.id).toBeGreaterThanOrEqual(3);
    }
  }, 30_000);

  it('never lowers the rating for adding a piece to an empty spot', () => {
    const pieces: Partial<Record<DesignSlotType, RoomFurnitureItem>> = {};
    let last = rateRoomDesign('study', pieces).starRating;
    for (const id of ['desk_cyber_matrix', 'chair_aeron_mesh', 'art_anatomy_diagram', 'plant_bonsai_juniper', 'rug_bauhaus_woven', 'bed_campus_twin']) {
      const item = byId(id);
      pieces[item.category] = item;
      const next = rateRoomDesign('study', pieces).starRating;
      expect(next, id).toBeGreaterThan(last);
      last = next;
    }
  });

  it('ignores pieces in a spot the room does not have', () => {
    expect(rateRoomDesign('study', { station: byId('station_moka_pot') }).starRating).toBe(1);
    expect(rateRoomDesign('study', { desk: byId('chair_aeron_mesh') }).starRating).toBe(1);
  });

  it('points a full room at the part still short', () => {
    const study = rateRoomDesign('study', {
      desk: byId('desk_cyber_matrix'),
      chair: byId('chair_leather_scholar'),
      bed: byId('bed_campus_twin'),
      lighting: byId('light_edison_chandelier'),
      plant: byId('plant_bonsai_juniper'),
      rug: byId('rug_persian_heriz'),
      wall_art: byId('art_tokyo_night_photo'),
      shelf: byId('shelf_walnut_library'),
    });
    expect(study.breakdown.value).toBe(1);
    expect(study.breakdown.harmony).toBeLessThan(1);
    expect(study.jurorFeedback[0]).toMatch(/^(Use|Pick one style)/);
    expect(study.starRating).toBeLessThan(5);
  });

  it('does not count focus, comfort or pay toward the rating', () => {
    const desk = byId('desk_basic_oak');
    const plain = rateRoomDesign('study', { desk });
    const boosted = rateRoomDesign('study', { desk: { ...desk, focusBonus: 99, comfortBonus: 99, wageMultiplier: 9 } });
    expect(boosted.starRating).toBe(plain.starRating);
    expect(boosted.totalWageMultiplier).toBe(0);
  });
});


