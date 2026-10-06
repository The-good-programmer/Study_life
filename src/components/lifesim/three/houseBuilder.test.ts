import { describe, it, expect, beforeAll } from 'vitest';
import {
  buildHouse,
  createMaterialLibrary,
  disposeObject,
  TIER_UNLOCKED_ROOMS,
} from './houseBuilder';
import { HOUSING_CATALOG } from '../../../services/lifeSimService';

describe('houseBuilder Architectural Tier System', () => {
  beforeAll(() => {
    if (typeof document === 'undefined') {
      const dummyCtx = new Proxy(
        {
          getImageData: () => ({ data: new Uint8ClampedArray(4) }),
          createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          createLinearGradient: () => ({ addColorStop: () => {} }),
          createRadialGradient: () => ({ addColorStop: () => {} }),
        },
        {
          get(target, prop) {
            if (prop in target) return (target as any)[prop];
            return () => {};
          },
        },
      );
      globalThis.document = {
        createElement: (tag: string) => {
          if (tag === 'canvas') {
            return {
              width: 512,
              height: 512,
              getContext: () => dummyCtx,
            };
          }
          return {};
        },
      } as any;
    }
  });

  it('defines only 1 unlocked room for the dorm starter tier', () => {
    expect(TIER_UNLOCKED_ROOMS.dorm).toEqual(['study']);
    const dormCatalog = HOUSING_CATALOG.find((h) => h.id === 'dorm');
    expect(dormCatalog?.unlockedRooms).toEqual(['study']);
    expect(dormCatalog?.level).toBe(1);
    expect(dormCatalog?.upgradeCost).toBe(0);
  });

  it('progressively expands unlocked wings in subsequent housing tiers', () => {
    expect(TIER_UNLOCKED_ROOMS.studio).toEqual(['study', 'living']);
    expect(TIER_UNLOCKED_ROOMS.flat).toEqual(['study', 'living', 'bedroom', 'kitchen']);
    expect(TIER_UNLOCKED_ROOMS.penthouse).toEqual(['study', 'living', 'bedroom', 'kitchen', 'balcony']);
  });

  it('builds a single-room house structure in dorm tier', () => {
    const lib = createMaterialLibrary();
    const house = buildHouse(lib, 'dorm');

    expect(house.root).toBeDefined();
    expect(house.interior).toBeDefined();
    expect(house.roof).toBeDefined();
    expect(house.furnitureRoot).toBeDefined();

    // In dorm tier, villa grounds (car, pergola, pool) are not active
    expect(house.villaGrounds.visible).toBe(false);

    // Pickers exist for all rooms (with unlocked flag indicating construction state)
    expect(house.pickers.get('study')?.userData.isUnlocked).toBe(true);
    expect(house.pickers.get('bedroom')?.userData.isUnlocked).toBe(false);
    expect(house.pickers.get('living')?.userData.isUnlocked).toBe(false);
    expect(house.pickers.get('kitchen')?.userData.isUnlocked).toBe(false);
    expect(house.pickers.get('balcony')?.userData.isUnlocked).toBe(false);

    // Only 1 interior room light is created in dorm tier (study light)
    expect(house.roomLights).toHaveLength(1);
    expect(house.roomLights[0].userData.roomId).toBe('study');

    // Clean up GPU resources
    disposeObject(house.root);
    lib.dispose();
  });

  it('builds full villa grounds only in penthouse tier', () => {
    const lib = createMaterialLibrary();
    const dormHouse = buildHouse(lib, 'dorm');
    expect(dormHouse.villaGrounds.visible).toBe(false);

    const penthouseHouse = buildHouse(lib, 'penthouse');
    expect(penthouseHouse.villaGrounds.visible).toBe(true);
    expect(penthouseHouse.roomLights).toHaveLength(5);

    // All pickers are unlocked in penthouse
    for (const [, picker] of penthouseHouse.pickers) {
      expect(picker.userData.isUnlocked).toBe(true);
    }

    disposeObject(dormHouse.root);
    disposeObject(penthouseHouse.root);
    lib.dispose();
  });
});
