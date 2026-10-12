import type { CharacterCustomization } from '../../../types/character';
import { buildCharacter3D, type CharacterModelInstance } from './characterBuilder3d';
import { buildCharacterV2 } from './v2/characterBuilderV2';
import { isAvatarV2Enabled } from './v2/flag';

/** Builds the user's avatar with whichever renderer is enabled (see v2/flag.ts). */
export function buildAvatar(
  custom: CharacterCustomization,
  options: Parameters<typeof buildCharacter3D>[1] = {}
): CharacterModelInstance {
  return isAvatarV2Enabled() ? buildCharacterV2(custom, options) : buildCharacter3D(custom, options);
}
