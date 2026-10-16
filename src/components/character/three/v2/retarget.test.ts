import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { AvatarAnimator, type AnimatorTargets, type HandPose } from '../avatar/animator';
import { getAvatarDims } from '../avatar/anatomy';
import { buildRig, BONE_NAMES, type BoneName } from '../avatar/rig';
import type { CharacterPose } from '../../../../types/character';
import type { AvatarManifest } from './manifest';
import { measureDims, measureJoints, Retargeter } from './retarget';
import { placeholderBase, PLACEHOLDER_BONE_MAP } from './placeholder';
import { SkeletonShaper } from './skeletonShape';

const AIM: [BoneName, BoneName][] = [
  ['spine', 'chest'], ['chest', 'neck'], ['neck', 'head'],
  ['upperArmL', 'forearmL'], ['forearmL', 'handL'], ['upperArmR', 'forearmR'], ['forearmR', 'handR'],
  ['thighL', 'shinL'], ['shinL', 'footL'], ['thighR', 'shinR'], ['shinR', 'footR'],
];

const manifest = JSON.parse(readFileSync('public/avatar/manifest.json', 'utf8')) as AvatarManifest;

/** The shipped base's skeleton (nodes only, read from the glTF's JSON chunk: no mesh decoding). */
function shippedSkeleton(): THREE.Object3D {
  const glb = readFileSync(`public${manifest.base.files.medium}`);
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
  const joints = new Set<number>(json.skins.flatMap((s: { joints: number[] }) => s.joints));
  const nodes = (json.nodes as { name?: string; translation?: number[]; rotation?: number[]; scale?: number[] }[]).map((n, i) => {
    const o = joints.has(i) ? new THREE.Bone() : new THREE.Object3D();
    o.name = n.name ?? '';
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
    return o;
  });
  json.nodes.forEach((n: { children?: number[] }, i: number) => n.children?.forEach((c) => nodes[i].add(nodes[c])));
  const scene = new THREE.Group();
  for (const i of json.scenes[json.scene ?? 0].nodes as number[]) scene.add(nodes[i]);
  return scene;
}

type Kind = 'placeholder' | 'shipped';

function setup(kind: Kind = 'placeholder', jointMorph?: string) {
  const root = new THREE.Group();
  const model = kind === 'shipped' ? shippedSkeleton() : placeholderBase();
  const boneMap = kind === 'shipped' ? manifest.boneMap : PLACEHOLDER_BONE_MAP;
  root.add(model);
  root.updateMatrixWorld(true);
  const named = new Map<string, THREE.Object3D>();
  model.traverse((o) => {
    if (o.name && !named.has(o.name)) named.set(o.name, o);
  });
  if (jointMorph) {
    const bones = [...named.values()].filter((o): o is THREE.Bone => (o as THREE.Bone).isBone);
    new SkeletonShaper(root, bones, manifest.jointMorphs).apply({ [jointMorph]: 1 });
  }
  const targets = {} as Record<BoneName, THREE.Object3D>;
  for (const n of BONE_NAMES) targets[n] = named.get(boneMap[n])!;
  const dims = measureDims(targets, root, getAvatarDims('nonbinary', 'average'));
  const proxy = buildRig(dims, measureJoints(targets, root));
  root.add(proxy.root);
  root.updateMatrixWorld(true);
  const retarget = new Retargeter(proxy, root, targets);
  const animTargets: AnimatorTargets = {
    bones: proxy.bones, bodyGroup: new THREE.Group(), lids: [], eyeballs: [], restLid: 0,
    book: new THREE.Group(), restHipsX: 0, upperArmLen: dims.upperArmLen, forearmLen: dims.forearmLen,
    clavicles: retarget.clavicles,
  };
  const animator = new AvatarAnimator();
  const run = (pose: CharacterPose, frames = 40) => {
    for (let i = 0; i < frames; i++) animator.update(0.05, pose, animTargets);
    retarget.apply(animator.hands);
    root.updateMatrixWorld(true);
  };
  return { root, proxy, targets, named, retarget, animator, animTargets, run };
}

const dir = (a: THREE.Object3D, b: THREE.Object3D) =>
  b.getWorldPosition(new THREE.Vector3()).sub(a.getWorldPosition(new THREE.Vector3())).normalize();
const at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
const worldQ = (o: THREE.Object3D) => o.getWorldQuaternion(new THREE.Quaternion());
// The glTF's bind quaternions are not quite unit length, so compare normalised copies.
const degrees = (a: THREE.Quaternion, b: THREE.Quaternion) => THREE.MathUtils.radToDeg(a.clone().normalize().angleTo(b.clone().normalize()));

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

  it('follows every animator pose, including the IK-driven ones, on both skeletons', () => {
    for (const kind of ['placeholder', 'shipped'] as Kind[]) {
      for (const pose of ['idle', 'wave', 'study', 'cheer', 'read'] as CharacterPose[]) {
        const s = setup(kind);
        s.run(pose);
        expectAligned(s);
      }
    }
  });

  it("sizes the proxy so its hands land where the target's do (book in hand)", () => {
    for (const kind of ['placeholder', 'shipped'] as Kind[]) {
      for (const pose of ['study', 'read', 'wave', 'cheer'] as CharacterPose[]) {
        const s = setup(kind);
        s.run(pose);
        for (const n of ['handL', 'handR', 'footL', 'head'] as BoneName[]) {
          const gap = at(s.proxy.bones[n]).distanceTo(at(s.targets[n]!));
          expect(gap, `${kind} ${pose} ${n}`).toBeLessThan(0.02);
        }
      }
    }
  });

  it('is unaffected by where the avatar stands or faces', () => {
    const s = setup();
    s.root.position.set(-4.2, 0.3, -3.2);
    s.root.rotation.y = Math.PI / 3.8;
    s.run('wave');
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

  it("keeps the model's own spine curve and forward neck, so the head stays level", () => {
    const s = setup('shipped');
    const column = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head'].map((n) => s.named.get(n)!);
    const bind = column.map((b) => b.quaternion.clone());
    // At rest the column is left exactly as modelled (it used to be straightened, tipping the head back ~10°).
    s.retarget.apply();
    column.forEach((b, i) => expect(degrees(b.quaternion, bind[i]), b.name).toBeLessThan(0.05));
    // In idle the head turns exactly as the proxy's does: a little, never chin-up.
    const headBind = worldQ(s.targets.head);
    const proxyBind = worldQ(s.proxy.bones.head);
    s.run('idle');
    const turn = worldQ(s.targets.head).multiply(headBind.invert());
    const proxyTurn = worldQ(s.proxy.bones.head).multiply(proxyBind.invert());
    expect(degrees(turn, proxyTurn)).toBeLessThan(0.5);
    expect(degrees(turn, new THREE.Quaternion())).toBeLessThan(6);
  });

  it("spreads the chest's bend over the spine bones in between", () => {
    const s = setup('shipped');
    const [s1, s2, s3] = ['spine_01', 'spine_02', 'spine_03'].map((n) => s.named.get(n)!);
    const bind = [s1, s2, s3].map(worldQ);
    s.run('study');
    const [d1, d2, d3] = [s1, s2, s3].map((b, i) => worldQ(b).multiply(bind[i].clone().invert()));
    const total = degrees(d1, d3);
    expect(total).toBeGreaterThan(1);
    expect(degrees(d1, d2)).toBeCloseTo(total / 2, 1);
  });

  it('raises the clavicles with the arms and keeps the hands on the proxy hands', () => {
    const s = setup('shipped');
    const clavicle = s.named.get('clavicle_r')!;
    const rest = clavicle.quaternion.clone();
    s.run('idle');
    expect(degrees(clavicle.quaternion, rest)).toBeLessThan(1);
    s.run('cheer');
    expect(degrees(clavicle.quaternion, rest)).toBeGreaterThan(8);
    expect(at(s.proxy.bones.handR).distanceTo(at(s.targets.handR))).toBeLessThan(0.02);
  });

  it('curls every finger toward the palm, mirrored left and right, with moved joints too', () => {
    const fist: HandPose = { curl: 0.7, spread: 0.3, thumb: 0.8 };
    for (const morph of [undefined, 'gender_female', 'gender_male']) {
      const s = setup('shipped', morph);
      const tips = [...s.named.values()].filter((o) => /_03_[lr]$/.test(o.name));
      const tipAt = (b: THREE.Object3D) => b.localToWorld(new THREE.Vector3(0, 0.02, 0));
      s.retarget.apply();
      s.root.updateMatrixWorld(true);
      const before = new Map(tips.map((t) => [t, tipAt(t)]));
      s.retarget.apply({ L: fist, R: fist });
      s.root.updateMatrixWorld(true);
      for (const t of tips) {
        const hand = s.named.get(t.name.endsWith('_l') ? 'hand_l' : 'hand_r')!;
        const closer = before.get(t)!.distanceTo(at(hand)) - tipAt(t).distanceTo(at(hand));
        expect(closer, `${morph} ${t.name}`).toBeGreaterThan(0.01);
        // The proxy's bind pose is symmetric, so the hands must mirror each other exactly.
        if (t.name.endsWith('_l')) {
          const twin = tipAt(s.named.get(t.name.replace(/_l$/, '_r'))!);
          expect(tipAt(t).multiply(new THREE.Vector3(-1, 1, 1)).distanceTo(twin), `${morph} ${t.name}`).toBeLessThan(0.001);
        }
      }
    }
  });
});
