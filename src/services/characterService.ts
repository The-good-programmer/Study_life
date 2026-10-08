import { 
  type CharacterCustomization,
  type CharacterGender,
  type BodyType,
  type HairStyle,
  type Eyewear,
  type Headwear,
  type OutfitTop,
  type OutfitBottom,
  type Shoes,
  type CharacterMood,
  type CharacterPose,
} from '../types/character';
import { LIFE_KEYS, StorageService } from './storageService';
import { STARTING_COINS } from './economy/wallet';
import { soundEngine } from './soundEngine';

const LEGACY_AXOLOTL_KEY = 'studify_axolotl_sanctuary_v1';

export type CharacterListener = (character: CharacterCustomization) => void;

export type StylePresetId = 'scholar' | 'tech' | 'athlete' | 'cozy' | 'creative';

/** Clothes, hair and accessories for each named style; never figure or skin tone. */
const STYLE_PRESETS: Record<StylePresetId, Partial<CharacterCustomization>> = {
  scholar: {
    outfitTop: 'button-down',
    topColor: '#1e3a8a',
    topSecondaryColor: '#ffffff',
    outfitBottom: 'chinos',
    bottomColor: '#b49f82',
    hairStyle: 'side-part',
    hairColor: '#382212',
    eyewear: 'wireframe',
    headwear: 'none',
    shoes: 'loafers',
    shoesColor: '#78350f',
  },
  tech: {
    outfitTop: 'casual-tee',
    topColor: '#334155',
    outfitBottom: 'jeans',
    bottomColor: '#1e293b',
    hairStyle: 'spiky',
    hairColor: '#06b6d4',
    eyewear: 'thick-frame',
    headwear: 'headphones',
    headwearColor: '#06b6d4',
    shoes: 'sneakers',
    shoesColor: '#ffffff',
  },
  athlete: {
    outfitTop: 'varsity-jacket',
    topColor: '#991b1b',
    topSecondaryColor: '#ffffff',
    outfitBottom: 'joggers',
    bottomColor: '#1e293b',
    hairStyle: 'ponytail',
    hairColor: '#66391a',
    eyewear: 'none',
    headwear: 'cap',
    headwearColor: '#991b1b',
    shoes: 'running',
    shoesColor: '#dc2626',
  },
  cozy: {
    outfitTop: 'hoodie',
    topColor: '#4f46e5',
    topSecondaryColor: '#6366f1',
    outfitBottom: 'pleated-skirt',
    bottomColor: '#1d4ed8',
    hairStyle: 'bob-cut',
    hairColor: '#e5b958',
    eyewear: 'round',
    headwear: 'beanie',
    headwearColor: '#4f46e5',
    shoes: 'sneakers',
    shoesColor: '#ffffff',
  },
  creative: {
    outfitTop: 'sweater',
    topColor: '#065f46',
    outfitBottom: 'chinos',
    bottomColor: '#b49f82',
    hairStyle: 'curly-afro',
    hairColor: '#171717',
    eyewear: 'round',
    headwear: 'none',
    shoes: 'boots',
    shoesColor: '#78350f',
  },
};

const LOOK_KEYS = [
  'gender', 'bodyType', 'skinTone', 'hairStyle', 'hairColor', 'facialHair', 'facialHairColor', 'eyeColor',
  'eyewear', 'eyewearColor', 'headwear', 'headwearColor', 'outfitTop', 'topColor', 'topSecondaryColor',
  'outfitBottom', 'bottomColor', 'shoes', 'shoesColor',
] as const satisfies readonly (keyof CharacterCustomization)[];

/**
 * How an avatar looks (name, figure, hair, clothes) and nothing that is earned: no tokens,
 * level or stats. It also reads avatars from outside the app (cloud sync), so anything
 * that isn't a plain style id or hex color is left out.
 */
export const appearanceOf = (
  source: Partial<Record<keyof CharacterCustomization, unknown>>,
): Partial<CharacterCustomization> => {
  const look: Record<string, string> = {};
  for (const key of LOOK_KEYS) {
    const value = source[key];
    const pattern = key === 'skinTone' || key.endsWith('Color') ? /^#[0-9a-f]{3,8}$/i : /^[a-z-]{1,24}$/;
    if (typeof value === 'string' && pattern.test(value)) look[key] = value;
  }
  const name = typeof source.name === 'string' ? source.name.trim().slice(0, 24) : '';
  if (name) look.name = name;
  return look as Partial<CharacterCustomization>;
};

class CharacterService {
  private character: CharacterCustomization;
  private listeners: Set<CharacterListener> = new Set();

  constructor() {
    this.character = this.loadCharacter();
    // Each profile has its own avatar and wallet; switch to it on sign-in and sign-out.
    StorageService.addProfileListener(() => {
      this.character = this.loadCharacter();
      this.notify();
    });
  }

  private loadCharacter(): CharacterCustomization {
    const defaultCharacter: CharacterCustomization = {
      name: 'Scholar',
      gender: 'male',
      bodyType: 'athletic',
      skinTone: '#e5b88f',
      hairStyle: 'short-fade',
      hairColor: '#171717',
      facialHair: 'none',
      facialHairColor: '#171717',
      eyeColor: '#3b2011',
      eyewear: 'none',
      eyewearColor: '#1e293b',
      headwear: 'none',
      headwearColor: '#4f46e5',
      outfitTop: 'hoodie',
      topColor: '#1e3a8a',
      topSecondaryColor: '#334155',
      outfitBottom: 'jeans',
      bottomColor: '#1d4ed8',
      shoes: 'sneakers',
      shoesColor: '#ffffff',
      mood: 'focused',
      pose: 'idle',
      level: 1,
      xp: 25,
      coins: STARTING_COINS,
      energy: 90,
      happiness: 85,
      hunger: 80,
      studyTitle: 'Curious Scholar',
      unlockedItems: ['hoodie', 'varsity-jacket', 'jeans', 'sneakers', 'headphones', 'short-fade', 'side-part'],
    };

    try {
      const raw = localStorage.getItem(StorageService.lifeKey(LIFE_KEYS.CHARACTER));
      if (raw) {
        const parsed = JSON.parse(raw);
        // If it was the legacy placeholder default from the first version, upgrade to the male default
        const isLegacyFemaleDefault = parsed.gender === 'female' && parsed.hairStyle === 'bob-cut' && parsed.name === 'Scholar';
        return {
          ...defaultCharacter,
          ...parsed,
          ...(isLegacyFemaleDefault ? { gender: 'male', hairStyle: 'short-fade', skinTone: '#e5b88f', eyeColor: '#3b2011', topColor: '#1e3a8a', headwear: 'none' } : {}),
          unlockedItems: Array.from(new Set([...defaultCharacter.unlockedItems, ...(parsed.unlockedItems || [])])),
        };
      }

      // Check legacy axolotl data to preserve coins, XP, and progression
      const legacyRaw = localStorage.getItem(LEGACY_AXOLOTL_KEY);
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        const migrated: CharacterCustomization = {
          ...defaultCharacter,
          coins: typeof legacy.axonCoins === 'number' ? legacy.axonCoins : defaultCharacter.coins,
          level: typeof legacy.friendshipLevel === 'number' ? legacy.friendshipLevel : defaultCharacter.level,
          xp: typeof legacy.friendshipXP === 'number' ? legacy.friendshipXP : defaultCharacter.xp,
          happiness: typeof legacy.happiness === 'number' ? legacy.happiness : defaultCharacter.happiness,
          energy: typeof legacy.energy === 'number' ? legacy.energy : defaultCharacter.energy,
        };
        // Adopted once, by this profile: saved here, then removed so no other profile takes the same coins.
        localStorage.setItem(StorageService.lifeKey(LIFE_KEYS.CHARACTER), JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_AXOLOTL_KEY);
        return migrated;
      }
    } catch {
      // Fallback
    }

    return defaultCharacter;
  }

  public getCharacter(): CharacterCustomization {
    return { ...this.character };
  }

  public subscribe(listener: CharacterListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn({ ...this.character }));
    try {
      localStorage.setItem(StorageService.lifeKey(LIFE_KEYS.CHARACTER), JSON.stringify(this.character));
    } catch (e) {
      console.warn('[CharacterService] Failed to persist state:', e);
    }
  }

  public updateCustomization(partial: Partial<CharacterCustomization>) {
    this.character = {
      ...this.character,
      ...partial,
    };
    this.notify();
  }

  public updateName(name: string) {
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) return;
    this.character.name = trimmed;
    this.notify();
  }

  public setGender(gender: CharacterGender) {
    this.character.gender = gender;
    this.notify();
  }

  public setBodyType(bodyType: BodyType) {
    this.character.bodyType = bodyType;
    this.notify();
  }

  public setSkinTone(skinTone: string) {
    this.character.skinTone = skinTone;
    this.notify();
  }

  public setHair(hairStyle: HairStyle, hairColor?: string) {
    this.character.hairStyle = hairStyle;
    if (hairColor) {
      this.character.hairColor = hairColor;
    }
    this.notify();
  }

  public setHairColor(color: string) {
    this.character.hairColor = color;
    this.notify();
  }

  public setEyeColor(color: string) {
    this.character.eyeColor = color;
    this.notify();
  }

  public setEyewear(eyewear: Eyewear, color?: string) {
    this.character.eyewear = eyewear;
    if (color) this.character.eyewearColor = color;
    this.notify();
  }

  public setHeadwear(headwear: Headwear, color?: string) {
    this.character.headwear = headwear;
    if (color) this.character.headwearColor = color;
    this.notify();
  }

  public setOutfit(
    top: OutfitTop,
    bottom: OutfitBottom,
    options?: { topColor?: string; topSecondaryColor?: string; bottomColor?: string; shoes?: Shoes; shoesColor?: string }
  ) {
    this.character.outfitTop = top;
    this.character.outfitBottom = bottom;
    if (options?.topColor) this.character.topColor = options.topColor;
    if (options?.topSecondaryColor) this.character.topSecondaryColor = options.topSecondaryColor;
    if (options?.bottomColor) this.character.bottomColor = options.bottomColor;
    if (options?.shoes) this.character.shoes = options.shoes;
    if (options?.shoesColor) this.character.shoesColor = options.shoesColor;
    this.notify();
  }

  public setMood(mood: CharacterMood) {
    this.character.mood = mood;
    this.notify();
  }

  public setPose(pose: CharacterPose) {
    this.character.pose = pose;
    this.notify();
  }

  public getWalletBalance(): number {
    return this.character.coins || 0;
  }

  public addCoins(amount: number) {
    this.character.coins = Math.max(0, (this.character.coins || 0) + amount);
    this.notify();
  }

  public spendCoins(amount: number): boolean {
    if ((this.character.coins || 0) < amount) return false;
    this.character.coins -= amount;
    this.notify();
    return true;
  }

  public feed(_snackType: string = 'berry'): { hunger: number; happiness: number; energy: number } {
    this.character.hunger = Math.min(100, (this.character.hunger || 70) + 25);
    this.character.energy = Math.min(100, (this.character.energy || 70) + 15);
    this.character.happiness = Math.min(100, (this.character.happiness || 80) + 10);
    this.character.mood = 'energetic';
    soundEngine.playSuccess();
    this.notify();
    return {
      hunger: this.character.hunger,
      happiness: this.character.happiness,
      energy: this.character.energy,
    };
  }

  /** A named style: clothes, hair and accessories. Your figure and skin tone stay as you chose them. */
  public presetLook(presetId: StylePresetId): Partial<CharacterCustomization> {
    return { ...STYLE_PRESETS[presetId] };
  }

  /** A random style: hair, clothes and accessories, again leaving figure and skin tone alone. */
  public randomLook(): Partial<CharacterCustomization> {
    const hairStyles: HairStyle[] = ['short-fade', 'curly-afro', 'bob-cut', 'long-wavy', 'ponytail', 'spiky', 'side-part', 'buzz'];
    const tops: OutfitTop[] = ['hoodie', 'varsity-jacket', 'button-down', 'sweater', 'lab-coat', 'casual-tee'];
    const bottoms: OutfitBottom[] = ['jeans', 'chinos', 'joggers', 'pleated-skirt', 'shorts'];
    const eyes: Eyewear[] = ['none', 'wireframe', 'thick-frame', 'round', 'sunglasses'];
    const heads: Headwear[] = ['none', 'cap', 'beanie', 'mortarboard', 'headphones'];
    const hairColors = ['#171717', '#382212', '#66391a', '#e5b958', '#06b6d4', '#f472b6', '#8b5cf6'];
    const topColors = ['#1e3a8a', '#991b1b', '#065f46', '#334155', '#d97706', '#581c87', '#4f46e5'];

    const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    return {
      hairStyle: pick(hairStyles),
      hairColor: pick(hairColors),
      outfitTop: pick(tops),
      topColor: pick(topColors),
      outfitBottom: pick(bottoms),
      eyewear: pick(eyes),
      headwear: pick(heads),
    };
  }
}

export const characterService = new CharacterService();
