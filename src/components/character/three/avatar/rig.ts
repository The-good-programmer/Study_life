import * as THREE from 'three';
import { A_POSE_ANGLE, type AvatarDims } from './anatomy';

export const BONE_NAMES = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'upperArmL', 'forearmL', 'handL',
  'upperArmR', 'forearmR', 'handR',
  'thighL', 'shinL', 'footL',
  'thighR', 'shinR', 'footR',
] as const;

export type BoneName = (typeof BONE_NAMES)[number];
export type BoneMap = Record<BoneName, THREE.Bone>;

export interface AvatarRig {
  /** Root of the bone hierarchy (the hips bone's parent). */
  root: THREE.Object3D;
  bones: BoneMap;
  skeleton: THREE.Skeleton;
  /** Index of each bone within skeleton.bones (for skin indices). */
  boneIndex: Record<BoneName, number>;
}

/**
 * Builds the avatar skeleton in its bind pose: an "A-pose" with the arms
 * angled A_POSE_ANGLE away from the body. Modelling in the A-pose keeps the
 * arms clear of the torso so the skin does not web together; animation then
 * sets absolute bone rotations (0 = arm hanging straight down).
 *
 * Conventions: +Y up, +Z forward (the face), +X is the avatar's left.
 */
export function buildRig(d: AvatarDims): AvatarRig {
  const bones = {} as BoneMap;
  for (const name of BONE_NAMES) {
    bones[name] = new THREE.Bone();
    bones[name].name = name;
  }

  const root = new THREE.Object3D();
  root.name = 'AvatarRigRoot';
  root.add(bones.hips);

  bones.hips.position.set(0, d.pelvisY, 0);
  bones.hips.add(bones.spine);
  bones.spine.position.set(0, d.waistY - d.pelvisY, 0);
  bones.spine.add(bones.chest);
  bones.chest.position.set(0, d.chestY - d.waistY, 0);
  bones.chest.add(bones.neck);
  bones.neck.position.set(0, d.neckY - d.chestY, -0.008);
  bones.neck.add(bones.head);
  bones.head.position.set(0, d.headY - d.neckY, 0.006);

  for (const side of [1, -1] as const) {
    const s = side === 1 ? 'L' : 'R';
    const upperArm = bones[`upperArm${s}`];
    const forearm = bones[`forearm${s}`];
    const hand = bones[`hand${s}`];
    bones.chest.add(upperArm);
    upperArm.position.set(side * d.shoulderX, d.shoulderY - d.chestY, -0.005);
    upperArm.rotation.z = side * A_POSE_ANGLE;
    upperArm.add(forearm);
    forearm.position.set(0, -d.upperArmLen, 0);
    forearm.add(hand);
    hand.position.set(0, -d.forearmLen, 0);

    const thigh = bones[`thigh${s}`];
    const shin = bones[`shin${s}`];
    const foot = bones[`foot${s}`];
    bones.hips.add(thigh);
    thigh.position.set(side * d.hipJointX, d.hipJointY - d.pelvisY, 0);
    thigh.add(shin);
    shin.position.set(0, -d.thighLen, 0);
    shin.add(foot);
    foot.position.set(0, -d.shinLen, 0);
  }

  root.updateMatrixWorld(true);
  const ordered = BONE_NAMES.map((n) => bones[n]);
  const skeleton = new THREE.Skeleton(ordered);
  const boneIndex = {} as Record<BoneName, number>;
  BONE_NAMES.forEach((n, i) => (boneIndex[n] = i));

  return { root, bones, skeleton, boneIndex };
}

/** World-space bind-pose position of a point given in a bone's local frame. */
export function bonePoint(rig: AvatarRig, bone: BoneName, x = 0, y = 0, z = 0) {
  return new THREE.Vector3(x, y, z).applyMatrix4(rig.bones[bone].matrixWorld);
}
