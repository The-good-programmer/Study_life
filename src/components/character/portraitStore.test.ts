import { beforeEach, describe, expect, it } from 'vitest';
import type { CharacterCustomization } from '../../types/character';
import { getPortrait, lookKey, savePortrait, subscribePortrait } from './portraitStore';

const store = new Map<string, string>();
globalThis.localStorage ??= {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
} as Storage;

const look = (patch: Partial<CharacterCustomization> = {}) =>
  ({ name: 'Ada', gender: 'female', hairStyle: 'bob-cut', hairColor: '#382212', topColor: '#1e3a8a', level: 3, xp: 40, ...patch }) as CharacterCustomization;

describe('avatar portrait store', () => {
  beforeEach(() => localStorage.removeItem('studify_avatar_portrait'));

  it('keys portraits by look only (not name or progress)', () => {
    expect(lookKey(look())).toBe(lookKey(look({ name: 'Grace', level: 9, xp: 999 })));
    expect(lookKey(look())).not.toBe(lookKey(look({ hairStyle: 'buzz' })));
    expect(lookKey(look())).not.toBe(lookKey(look({ topColor: '#991b1b' })));
  });

  it('only returns a portrait for the look it shows, and notifies on save', () => {
    let calls = 0;
    const off = subscribePortrait(() => calls++);
    savePortrait(look(), 'data:image/webp;base64,AAA');
    expect(calls).toBe(1);
    expect(getPortrait(look({ level: 5 }))).toBe('data:image/webp;base64,AAA');
    expect(getPortrait(look({ hairColor: '#171717' }))).toBeNull();
    off();
    savePortrait(look(), 'data:x');
    expect(calls).toBe(1);
  });
});
