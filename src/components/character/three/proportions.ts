import type { CharacterGender, BodyType } from '../../../types/character';

export interface CharacterProportions {
  shoulderWidth: number;
  chestWidth: number;
  waistWidth: number;
  hipsWidth: number;
  torsoHeight: number;
  legLength: number;
  headScale: number;
  neckRadius: number;
  armThickness: number;
  legThickness: number;
  jawWidth: number;
  chinWidth: number;
  chinSquareness: number;
  browRidgeDepth: number;
  noseLength: number;
  noseBridgeWidth: number;
  noseProjection: number;
  eyebrowThickness: number;
  eyebrowY: number;
  eyeOpeningY: number;
  hasAdamsApple: boolean;
  hasBlush: boolean;
  hasBust: boolean;
}

export function getProportions(gender: CharacterGender, bodyType: BodyType = 'athletic'): CharacterProportions {
  const isAthletic = bodyType === 'athletic';
  const isSlender = bodyType === 'slender';

  switch (gender) {
    case 'male':
      return {
        shoulderWidth: isAthletic ? 0.46 : isSlender ? 0.40 : 0.43,
        chestWidth: isAthletic ? 0.35 : isSlender ? 0.31 : 0.33,
        waistWidth: isAthletic ? 0.28 : isSlender ? 0.25 : 0.27,
        hipsWidth: 0.30,
        torsoHeight: 0.46,
        legLength: 0.86,
        headScale: 1.0,
        neckRadius: 0.058,
        armThickness: isAthletic ? 1.05 : isSlender ? 0.92 : 1.0,
        legThickness: isAthletic ? 1.05 : isSlender ? 0.94 : 1.0,
        jawWidth: 0.21,
        chinWidth: 0.075,
        chinSquareness: 0.025,
        browRidgeDepth: 0.018,
        noseLength: 0.062,
        noseBridgeWidth: 0.032,
        noseProjection: 0.038,
        eyebrowThickness: 0.010,
        eyebrowY: 0.060,
        eyeOpeningY: 0.020,
        hasAdamsApple: true,
        hasBlush: false,
        hasBust: false,
      };
    case 'female':
      return {
        shoulderWidth: isAthletic ? 0.36 : isSlender ? 0.33 : 0.35,
        chestWidth: isAthletic ? 0.28 : isSlender ? 0.25 : 0.27,
        waistWidth: isAthletic ? 0.22 : isSlender ? 0.20 : 0.22,
        hipsWidth: isAthletic ? 0.34 : isSlender ? 0.31 : 0.33,
        torsoHeight: 0.43,
        legLength: 0.83,
        headScale: 0.98,
        neckRadius: 0.048,
        armThickness: isAthletic ? 0.94 : isSlender ? 0.86 : 0.90,
        legThickness: isAthletic ? 0.98 : isSlender ? 0.88 : 0.93,
        jawWidth: 0.17,
        chinWidth: 0.05,
        chinSquareness: 0.01,
        browRidgeDepth: 0.005,
        noseLength: 0.054,
        noseBridgeWidth: 0.026,
        noseProjection: 0.032,
        eyebrowThickness: 0.007,
        eyebrowY: 0.064,
        eyeOpeningY: 0.024,
        hasAdamsApple: false,
        hasBlush: true,
        hasBust: true,
      };
    case 'nonbinary':
    default:
      return {
        shoulderWidth: 0.40,
        chestWidth: 0.31,
        waistWidth: 0.25,
        hipsWidth: 0.31,
        torsoHeight: 0.44,
        legLength: 0.84,
        headScale: 0.99,
        neckRadius: 0.052,
        armThickness: 1.0,
        legThickness: 1.0,
        jawWidth: 0.19,
        chinWidth: 0.062,
        chinSquareness: 0.018,
        browRidgeDepth: 0.010,
        noseLength: 0.058,
        noseBridgeWidth: 0.029,
        noseProjection: 0.035,
        eyebrowThickness: 0.008,
        eyebrowY: 0.062,
        eyeOpeningY: 0.022,
        hasAdamsApple: false,
        hasBlush: false,
        hasBust: false,
      };
  }
}
