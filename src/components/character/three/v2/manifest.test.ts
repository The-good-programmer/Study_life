import { describe, it, expect } from 'vitest';
import type { CharacterCustomization } from '../../../../types/character';
import { assetUrl, isManifest, missingItems, resolveItems, SLOT_IDS, type AvatarManifest } from './manifest';
import { placeholderManifest } from './placeholder';

const custom = (patch: Partial<CharacterCustomization> = {}) =>
  ({
    gender: 'female', bodyType: 'average', hairStyle: 'short-fade', facialHair: 'none', eyewear: 'none',
    headwear: 'none', outfitTop: 'casual-tee', outfitBottom: 'jeans', shoes: 'sneakers', ...patch,
  }) as CharacterCustomization;

describe('avatar manifest', () => {
  const m = placeholderManifest();

  it('picks the nearest available tier', () => {
    expect(assetUrl({ files: { medium: 'm', high: 'h' } }, 'low')).toBe('m');
    expect(assetUrl({ files: { medium: 'm', high: 'h' } }, 'high')).toBe('h');
    expect(assetUrl({ files: { high: 'h' } }, 'medium')).toBe('h');
    expect(assetUrl({ files: {} }, 'medium')).toBeNull();
  });

  it('resolves one asset per equipped slot and skips "none"', () => {
    const items = resolveItems(m, custom(), 'medium');
    expect(items.map((i) => i.slot).sort()).toEqual(['bottom', 'hair', 'shoes', 'top']);
    expect(items.every((i) => i.id === i.requested)).toBe(true);
  });

  it('falls back for ids the manifest lacks: required slots get a default, optional ones stay empty', () => {
    const items = resolveItems(m, custom({ outfitTop: 'lab-coat', hairStyle: 'bob-cut', headwear: 'crown' }), 'medium');
    const top = items.find((i) => i.slot === 'top')!;
    expect(top).toMatchObject({ requested: 'lab-coat', id: 'casual-tee' });
    expect(items.some((i) => i.slot === 'hair' || i.slot === 'headwear')).toBe(false);
  });

  it('tolerates saved data with unknown ids', () => {
    const items = resolveItems(m, custom({ outfitTop: 'tuxedo' as never }), 'high');
    expect(items.find((i) => i.slot === 'top')?.id).toBe('casual-tee');
  });

  it('reports which customizer options still need assets', () => {
    const missing = missingItems(m);
    expect(missing.top).toContain('lab-coat');
    expect(missing.top).not.toContain('casual-tee');
    expect(missing.eyewear).toEqual(SLOT_IDS.eyewear);
    const complete: AvatarManifest = { ...m, items: {} };
    for (const [slot, ids] of Object.entries(SLOT_IDS)) {
      complete.items[slot as keyof AvatarManifest['items']] = Object.fromEntries(ids.map((id) => [id, { files: { medium: id } }]));
    }
    expect(missingItems(complete)).toEqual({});
  });

  it('lists every option the customizer offers', () => {
    expect(SLOT_IDS.hair).toHaveLength(8);
    expect(SLOT_IDS.top).toHaveLength(6);
    expect(SLOT_IDS.bottom).toHaveLength(5);
    expect(SLOT_IDS.shoes).toHaveLength(4);
    expect(SLOT_IDS.headwear).toHaveLength(6);
    expect(SLOT_IDS.eyewear).toHaveLength(4);
    expect(SLOT_IDS.facialHair).toHaveLength(3);
  });

  it('validates the manifest shape', () => {
    expect(isManifest(m)).toBe(true);
    expect(isManifest({ version: 2 })).toBe(false);
    expect(isManifest(null)).toBe(false);
  });
});
