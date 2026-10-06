import React from 'react';
import { CharacterCompanion, type CharacterCompanionProps } from '../character/CharacterCompanion';

export type LottieMascotProps = CharacterCompanionProps;

/**
 * Replaced Lottie Axolotl Mascot with the User's Custom 3D Character Companion.
 */
export const LottieMascot: React.FC<LottieMascotProps> = (props) => {
  return <CharacterCompanion {...props} />;
};
