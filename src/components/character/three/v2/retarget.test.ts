import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { AvatarAnimator } from '../avatar/animator';
import { getAvatarDims } from '../avatar/anatomy';
import { buildRig, BONE_NAMES, type BoneName } from '../avatar/rig';
import type { CharacterPose } from '../../../../types/character';
import { measureDims, Retargeter } from './retarget';
import { placeholderBase, PLACEHOLDER_BONE_MAP } from './placeholder';

const AIM: [BoneName, BoneName][] = [
  ['spine', 'chest'], ['chest', 'neck'], ['neck', 'head'],
  ['upperArmL', 'forearmL'], ['forearmL', 'handL'], ['upperArmR', 'forearmR'], ['forearmR', 'handR'],
  ['thighL', 'shinL'], ['shinL', 'footL'], ['thighR', 'shinR'], ['shinR', 'footR'],
];

function setup() {
  const root = new THREE.Group();
  const model = placeholderBase();
  root.add(model);
  root.updateMatrixWorld(true);
  const targets = {} as Record<BoneName, THREE.Object3D>;
  for (const n of BONE_NAMES) targets[n] = model.getObjectByName(PLACEHOLDER_BONE_MAP[n])!;
  const dims = measureDims(targets, root, getAvatarDims('nonbinary', 'average'));
  const proxy = buildRig(dims);
  root.add(proxy.root);
  root.updateMatrixWorld(true);
  const retarget = new Retargeter(proxy, root, targets);
  const animTargets = {
    bones: proxy.bones, bodyGroup: new THREE.Group(), lids: [], eyeballs: [], restLid: 0,
    book: new THREE.Group(), restHipsX: 0, upperArmLen: dims.upperArmLen, forearmLen: dims.forearmLen,
  };
  return { root, proxy, targets, retarget, animator: new AvatarAnimator(), animTargets };
}

const dir = (a: THREE.Object3D, b: THREE.Object3D) =>
  b.getWorldPosition(new THREE.Vector3()).sub(a.getWorldPosition(new THREE.Vector3())).normalize();

function expectAligned(s: ReturnType<typeof setup>) {
  s.root.updateMatrixWorld(true);
  for (const [a, b] of AIM) {
    const dp = dir(s.proxy.bones[a], s.proxy.bones[b]);
    const dt = dir(s.targets[a]!, s.targets[b]!);
    expect(dp.dot(dt), `${a}→${b}`).toBeGreaterThan(0.995);
  }
}

describe('Retargeter', () => {
  it('aims a T-pose import with foreign bone axes into the proxy A-pose', () => {
    const s = setup();
    // Before: the placeholder's arms are horizontal, the proxy's angled down.
    expect(dir(s.targets.upperArmL!, s.targets.forearmL!).y).toBeCloseTo(0, 3);
    expect(dir(s.proxy.bones.upperArmL, s.proxy.bones.forearmL).y).toBeLessThan(-0.1);
    s.retarget.apply();
    expectAligned(s);
  });

  it('follows every animator pose, including the IK-driven ones', () => {
    for (const pose of ['idle', 'wave', 'study', 'cheer', 'read'] as CharacterPose[]) {
      const s = setup();
      for (let i = 0; i < 40; i++) s.animator.update(0.05, pose, s.animTargets);
      s.retarget.apply();
      expectAligned(s);
    }
  });

  it("sizes the proxy so its hands land where the target's do (book in hand)", () => {
    for (const pose of ['study', 'read', 'wave', 'cheer'] as CharacterPose[]) {
      const s = setup();
      for (let i = 0; i < 40; i++) s.animator.update(0.05, pose, s.animTargets);
      s.retarget.apply();
      s.root.updateMatrixWorld(true);
      for (const n of ['handL', 'handR', 'footL', 'head'] as BoneName[]) {
        const gap = s.proxy.bones[n].getWorldPosition(new THREE.Vector3()).distanceTo(s.targets[n]!.getWorldPosition(new THREE.Vector3()));
        expect(gap, `${pose} ${n}`).toBeLessThan(0.02);
      }
    }
  });

  it('is unaffected by where the avatar stands or faces', () => {
    const s = setup();
    s.root.position.set(-4.2, 0.3, -3.2);
    s.root.rotation.y = Math.PI / 3.8;
    for (let i = 0; i < 40; i++) s.animator.update(0.05, 'wave', s.animTargets);
    s.retarget.apply();
    expectAligned(s);
  });

  it('carries hip sway over without drifting at rest', () => {
    const s = setup();
    const bind = s.targets.hips!.position.clone();
    s.retarget.apply();
    expect(s.targets.hips!.position.distanceTo(bind)).toBeLessThan(1e-6);
    s.proxy.bones.hips.position.x += 0.02;
    s.retarget.apply();
    s.root.updateMatrixWorld(true);
    const moved = s.targets.hips!.getWorldPosition(new THREE.Vector3());
    expect(moved.x).toBeCloseTo(0.02, 4);
  });
});
