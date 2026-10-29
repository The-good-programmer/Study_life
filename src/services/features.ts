/**
 * Build-time feature flags. Each one is read from a VITE_ variable when the
 * app is built, so a flag that is off lets the bundler drop the code behind it.
 */

/**
 * The 3D world: Campus (the walkable home) and the 3D avatar editor. Off
 * unless the build sets VITE_ENABLE_3D_WORLD=true; when off, three.js and the
 * avatar assets are never downloaded and the 2D avatar badge stays.
 */
export const WORLD_3D_ENABLED = (import.meta.env.VITE_ENABLE_3D_WORLD as string | undefined) === 'true';
