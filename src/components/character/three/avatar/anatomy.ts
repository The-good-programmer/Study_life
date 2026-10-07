import type { BodyType, CharacterGender } from '../../../../types/character';

/**
 * Body measurements for the stylized avatar, in metres. The avatar is about
 * 1.55 m tall with a slightly enlarged head (≈5.6 heads tall), which reads as
 * friendly and intentional rather than as an imperfect realistic human.
 */
export interface AvatarDims {
  gender: CharacterGender;
  bodyType: BodyType;
  // Skeleton (bind pose, world space with feet on y = 0)
  pelvisY: number;
  waistY: number;
  chestY: number;
  neckY: number;
  headY: number;
  shoulderX: number;
  shoulderY: number;
  hipJointX: number;
  hipJointY: number;
  upperArmLen: number;
  forearmLen: number;
  handLen: number;
  thighLen: number;
  shinLen: number;
  ankleY: number;
  // Volumes
  hipHalfWidth: number;
  waistHalfWidth: number;
  chestHalfWidth: number;
  chestDepth: number;
  shoulderRadius: number;
  neckRadius: number;
  upperArmRadius: number;
  forearmRadius: number;
  wristRadius: number;
  thighRadius: number;
  kneeRadius: number;
  calfRadius: number;
  ankleRadius: number;
  bust: number; // 0 = none
  glute: number;
  // Head
  headWidth: number;
  jawWidth: number;
  jawLength: number;
  chinRound: number;
  browRidge: number;
  noseSize: number;
  eyeRadius: number;
  eyeSpacing: number;
  lashWeight: number; // thicker, winged lashes for a feminine read
  /** Uniform scale of the whole head (stylized: a little larger than life). */
  headScale: number;
}

/** Front-to-back flattening of the eyeballs: big stylized eyes without a bulge. */
export const EYE_DEPTH = 0.6;

/** Bind-pose arm angle away from the body (radians). See rig.ts. */
export const A_POSE_ANGLE = 0.5;

export function getAvatarDims(gender: CharacterGender, bodyType: BodyType = 'average'): AvatarDims {
  const slender = bodyType === 'slender';
  const athletic = bodyType === 'athletic';
  const limb = athletic ? 1.08 : slender ? 0.9 : 1;

  const base: AvatarDims = {
    gender,
    bodyType,
    pelvisY: 0.78,
    waistY: 0.88,
    chestY: 1.0,
    neckY: 1.15,
    headY: 1.222,
    shoulderX: 0.158,
    shoulderY: 1.115,
    hipJointX: 0.082,
    hipJointY: 0.72,
    upperArmLen: 0.235,
    forearmLen: 0.205,
    handLen: 0.105,
    thighLen: 0.32,
    shinLen: 0.315,
    ankleY: 0.085,
    hipHalfWidth: 0.135,
    waistHalfWidth: 0.12,
    chestHalfWidth: 0.145,
    chestDepth: 0.105,
    shoulderRadius: 0.056,
    neckRadius: 0.041,
    upperArmRadius: 0.043 * limb,
    forearmRadius: 0.037 * limb,
    wristRadius: 0.026 * limb,
    thighRadius: 0.078 * limb,
    kneeRadius: 0.05 * limb,
    calfRadius: 0.052 * limb,
    ankleRadius: 0.032 * limb,
    bust: 0,
    glute: 0.055,
    headWidth: 0.112,
    jawWidth: 0.082,
    jawLength: 0.07,
    chinRound: 0.5,
    browRidge: 0.004,
    noseSize: 1,
    eyeRadius: 0.026,
    eyeSpacing: 0.04,
    lashWeight: 0,
    headScale: 1.12,
  };

  if (gender === 'male') {
    const broad = athletic ? 1.1 : slender ? 0.93 : 1;
    return {
      ...base,
      shoulderX: 0.17 * broad,
      chestHalfWidth: 0.155 * broad,
      chestDepth: athletic ? 0.115 : 0.105,
      shoulderRadius: athletic ? 0.058 : 0.054,
      waistHalfWidth: slender ? 0.115 : 0.125,
      hipHalfWidth: 0.13,
      neckRadius: 0.045,
      glute: 0.05,
      jawWidth: 0.088,
      jawLength: 0.074,
      chinRound: 0.25,
      browRidge: 0.008,
      noseSize: 1.12,
    };
  }

  if (gender === 'female') {
    return {
      ...base,
      shoulderX: slender ? 0.142 : 0.148,
      chestHalfWidth: slender ? 0.128 : 0.135,
      chestDepth: 0.098,
      shoulderRadius: 0.05,
      waistHalfWidth: slender ? 0.098 : 0.106,
      hipHalfWidth: athletic ? 0.15 : slender ? 0.14 : 0.148,
      hipJointX: 0.088,
      neckRadius: 0.037,
      upperArmRadius: 0.039 * limb,
      forearmRadius: 0.033 * limb,
      wristRadius: 0.024 * limb,
      thighRadius: 0.08 * limb,
      calfRadius: 0.05 * limb,
      bust: athletic ? 0.85 : slender ? 0.75 : 1,
      glute: 0.062,
      jawWidth: 0.076,
      jawLength: 0.066,
      chinRound: 0.8,
      browRidge: 0.002,
      noseSize: 0.88,
      eyeRadius: 0.027,
      lashWeight: 1,
    };
  }

  // Non-binary: an androgynous midpoint.
  return {
    ...base,
    shoulderX: 0.158,
    chestHalfWidth: 0.142,
    waistHalfWidth: 0.112,
    hipHalfWidth: 0.138,
    jawWidth: 0.082,
    chinRound: 0.55,
    lashWeight: 0.4,
  };
}
