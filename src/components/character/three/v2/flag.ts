/**
 * The asset-based v2 avatar is opt-in while its content is being built:
 * `?avatar=v2` (or `v1`) in the URL wins, otherwise the stored preference.
 */
export const AVATAR_RENDERER_KEY = 'studify_avatar_renderer';

export function isAvatarV2Enabled(search = typeof location === 'undefined' ? '' : location.search): boolean {
  const param = new URLSearchParams(search).get('avatar');
  if (param === 'v2') return true;
  if (param === 'v1') return false;
  try {
    return localStorage.getItem(AVATAR_RENDERER_KEY) === 'v2';
  } catch {
    return false;
  }
}
