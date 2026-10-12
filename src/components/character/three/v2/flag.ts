/**
 * The asset-based v2 avatar is the default. `?avatar=v1` (or `v2`) in the
 * URL wins, then a stored preference (`studify_avatar_renderer`), so the
 * procedural v1 avatar stays one switch away. v2 itself also falls back to
 * v1 when its assets can't be loaded.
 */
export const AVATAR_RENDERER_KEY = 'studify_avatar_renderer';

export function isAvatarV2Enabled(search = typeof location === 'undefined' ? '' : location.search): boolean {
  const param = new URLSearchParams(search).get('avatar');
  if (param === 'v2') return true;
  if (param === 'v1') return false;
  try {
    return localStorage.getItem(AVATAR_RENDERER_KEY) !== 'v1';
  } catch {
    return true;
  }
}
