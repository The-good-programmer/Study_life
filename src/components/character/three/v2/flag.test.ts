import { afterEach, describe, expect, it } from 'vitest';
import { AVATAR_RENDERER_KEY, isAvatarV2Enabled } from './flag';

const store = new Map<string, string>();
globalThis.localStorage ??= {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
} as Storage;

describe('avatar renderer flag', () => {
  afterEach(() => localStorage.removeItem(AVATAR_RENDERER_KEY));

  it('defaults to v2', () => {
    expect(isAvatarV2Enabled('')).toBe(true);
  });

  it('keeps v1 one switch away: URL first, then the stored preference', () => {
    expect(isAvatarV2Enabled('?avatar=v1')).toBe(false);
    localStorage.setItem(AVATAR_RENDERER_KEY, 'v1');
    expect(isAvatarV2Enabled('')).toBe(false);
    expect(isAvatarV2Enabled('?avatar=v2')).toBe(true);
  });
});
