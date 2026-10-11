import type { BodyType, CharacterGender } from '../../../../types/character';

/**
 * Body measurements for the avatar, in metres, as sculpted (the whole avatar
 * is then shown at AVATAR_SCALE). Proportions follow a young adult, about
 * seven heads tall: the head is sculpted at life-like proportions in its own
 * frame (see head.ts) and scaled by headScale.
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
  // Head (in the head's own unscaled frame, see head.ts)
  /** Half-width of the cranium. */
  headWidth: number;
  /** Half-width of the jaw at its angle. */
  jawWidth: number;
  /** 0 = square chin, 1 = round, narrow chin. */
  chinRound: number;
  browRidge: number;
  noseSize: number;
  eyeRadius: number;
  /** Half the distance between the pupils. */
  eyeSpacing: number;
  mouthHalfWidth: number;
  lipFullness: number;
  lashWeight: number; // fuller lashes and a more open eye for a feminine read
  /** Uniform scale of the whole head and everything on it. */
  headScale: number;
  /** Where the head's frame sits relative to the head bone (metres). */
  headOffset: [number, number, number];
}

/** The avatar is sculpted ~1.42 m tall and shown at this scale (~1.63 m). */
export const AVATAR_SCALE = 1.15;

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
    shoulderX: 0.148,
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
    chestHalfWidth: 0.134,
    chestDepth: 0.102,
    shoulderRadius: 0.056,
    neckRadius: 0.044,
    upperArmRadius: 0.036 * limb,
    forearmRadius: 0.031 * limb,
    wristRadius: 0.022 * limb,
    thighRadius: 0.071 * limb,
    kneeRadius: 0.046 * limb,
    calfRadius: 0.047 * limb,
    ankleRadius: 0.029 * limb,
    bust: 0,
    glute: 0.055,
    headWidth: 0.096,
    jawWidth: 0.067,
    chinRound: 0.5,
    browRidge: 0.003,
    noseSize: 1,
    eyeRadius: 0.0172,
    eyeSpacing: 0.041,
    mouthHalfWidth: 0.025,
    lipFullness: 1,
    lashWeight: 0,
    headScale: 0.7,
    headOffset: [0, 0, 0.012],
  };

  if (gender === 'male') {
    const broad = athletic ? 1.07 : slender ? 0.94 : 1;
    return {
      ...base,
      shoulderX: 0.156 * broad,
      chestHalfWidth: 0.142 * broad,
      chestDepth: athletic ? 0.11 : 0.102,
      shoulderRadius: athletic ? 0.058 : 0.054,
      waistHalfWidth: slender ? 0.11 : 0.118,
      hipHalfWidth: 0.13,
      neckRadius: 0.0475,
      glute: 0.05,
      headWidth: 0.0975,
      jawWidth: 0.071,
      chinRound: 0.15,
      browRidge: 0.0055,
      noseSize: 1.08,
      mouthHalfWidth: 0.0255,
      lipFullness: 0.9,
    };
  }

  if (gender === 'female') {
    return {
      ...base,
      shoulderX: slender ? 0.134 : 0.14,
      chestHalfWidth: slender ? 0.12 : 0.126,
      chestDepth: 0.098,
      shoulderRadius: 0.05,
      waistHalfWidth: slender ? 0.098 : 0.106,
      hipHalfWidth: athletic ? 0.15 : slender ? 0.14 : 0.148,
      hipJointX: 0.088,
      neckRadius: 0.04,
      upperArmRadius: 0.032 * limb,
      forearmRadius: 0.0275 * limb,
      wristRadius: 0.02 * limb,
      thighRadius: 0.073 * limb,
      calfRadius: 0.045 * limb,
      bust: athletic ? 0.85 : slender ? 0.75 : 1,
      glute: 0.062,
      headWidth: 0.094,
      jawWidth: 0.059,
      chinRound: 0.85,
      browRidge: 0.0008,
      noseSize: 0.88,
      eyeRadius: 0.0176,
      eyeSpacing: 0.0405,
      mouthHalfWidth: 0.0242,
      lipFullness: 1.15,
      lashWeight: 1,
    };
  }

  // Non-binary: an androgynous midpoint.
  return {
    ...base,
    shoulderX: 0.148,
    chestHalfWidth: 0.132,
    waistHalfWidth: 0.112,
    hipHalfWidth: 0.138,
    chinRound: 0.55,
    lipFullness: 1.05,
    lashWeight: 0.4,
  };
}
