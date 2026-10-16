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

/** The head sits forward of the neck base: the neck leans forward a little. */
export const HEAD_BONE_Z = 0.02;
export type BoneMap = Record<BoneName, THREE.Bone>;

export interface AvatarRig {
  /** Root of the bone hierarchy (the hips bone's parent). */
  root: THREE.Object3D;
  bones: BoneMap;
  skeleton: THREE.Skeleton;
  /** Index of each bone within skeleton.bones (for skin indices). */
  boneIndex: Record<BoneName, number>;
}

/** Bones whose bind position `buildRig` can take as given, each after its parent. */
const PLACEABLE: [BoneName, BoneName | null][] = [
  ['hips', null], ['spine', 'hips'], ['chest', 'spine'], ['neck', 'chest'], ['head', 'neck'],
  ['upperArmL', 'chest'], ['upperArmR', 'chest'], ['thighL', 'hips'], ['thighR', 'hips'],
];

/**
 * Builds the avatar skeleton in its bind pose: an "A-pose" with the arms
 * angled A_POSE_ANGLE away from the body. Modelling in the A-pose keeps the
 * arms clear of the torso so the skin does not web together; animation then
 * sets absolute bone rotations (0 = arm hanging straight down).
 *
 * `joints` optionally places the spine, neck, head, shoulder and hip joints
 * (positions relative to the rig root) instead of the dims' straight column;
 * the v2 proxy rig copies an imported skeleton's joints this way, so its
 * spine follows that model's natural curve. Bind rotations are unchanged.
 *
 * Conventions: +Y up, +Z forward (the face), +X is the avatar's left.
 */
export function buildRig(d: AvatarDims, joints?: Partial<Record<BoneName, THREE.Vector3>>): AvatarRig {
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
  bones.head.position.set(0, d.headY - d.neckY, HEAD_BONE_Z);

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

  if (joints) {
    // These bones' parents have no bind rotation, so a local position is a plain offset.
    const at = new Map<BoneName, THREE.Vector3>();
    for (const [name, parent] of PLACEABLE) {
      const base = parent ? at.get(parent)! : new THREE.Vector3();
      const given = joints[name];
      if (given) bones[name].position.copy(given).sub(base);
      at.set(name, bones[name].position.clone().add(base));
    }
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
