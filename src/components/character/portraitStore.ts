import type { CharacterCustomization } from '../../types/character';
import { appearanceOf } from '../../services/characterService';

/**
 * A rendered portrait of the 3D avatar, for the 2D avatar badge. It is made
 * when the user saves in the customizer (where 3D is already loaded) and
 * stored with a key of the look it shows, so the badge never shows a stale
 * portrait: any change of hair, clothes or colours falls back to the SVG
 * badge until the next save. Deliberately free of three.js imports.
 */
const STORAGE_KEY = 'studify_avatar_portrait';
const listeners = new Set<() => void>();

/** A short, stable key for how an avatar looks (name and stats excluded). */
export function lookKey(c: Partial<CharacterCustomization>): string {
  const look = appearanceOf(c);
  delete look.name;
  const text = JSON.stringify(Object.entries(look).sort(([a], [b]) => a.localeCompare(b)));
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** The stored portrait's image URL, if it shows this look. */
export function getPortrait(c: Partial<CharacterCustomization>): string | null {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { key: string; url: string } | null;
    return stored && stored.key === lookKey(c) ? stored.url : null;
  } catch {
    return null;
  }
}

export function savePortrait(c: Partial<CharacterCustomization>, url: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ key: lookKey(c), url }));
  } catch {
    return; // storage full or blocked: the SVG badge stays
  }
  listeners.forEach((fn) => fn());
}

export function subscribePortrait(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
