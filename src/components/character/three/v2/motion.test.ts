import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { CharacterCustomization } from '../../../../types/character';
import { AvatarAnimator, EYE_RANGE, type AnimatorTargets } from '../avatar/animator';
import { getAvatarDims } from '../avatar/anatomy';
import { buildRig } from '../avatar/rig';
import { AssetCache } from './assetLoader';
import { buildCharacterV2 } from './characterBuilderV2';
import { ARKIT_SHAPES, FaceController, gazeWeights, MOOD_PRESETS, type ArkitShape } from './expressions';
import { fetchPlaceholder, placeholderManifest } from './placeholder';

const weight = (w: Float32Array, n: ArkitShape) => w[ARKIT_SHAPES.indexOf(n)];

describe('gaze blend shapes', () => {
  it('maps eye rotations onto the ARKit eye-look shapes', () => {
    const w = gazeWeights(EYE_RANGE.side / 2, EYE_RANGE.side / 2, EYE_RANGE.down / 2, new Float32Array(ARKIT_SHAPES.length));
    // Looking to the avatar's left: the left eye turns out, the right eye in (toward the nose).
    expect(weight(w, 'eyeLookOutLeft')).toBeCloseTo(0.5);
    expect(weight(w, 'eyeLookInRight')).toBeCloseTo(0.5);
    expect(weight(w, 'eyeLookInLeft')).toBe(0);
    expect(weight(w, 'eyeLookOutRight')).toBe(0);
    expect(weight(w, 'eyeLookDownLeft')).toBeCloseTo(0.5);
    expect(weight(w, 'eyeLookUpRight')).toBe(0);
    gazeWeights(-1, -1, -1, w);
    expect(weight(w, 'eyeLookInLeft')).toBe(1);
    expect(weight(w, 'eyeLookOutRight')).toBe(1);
    expect(weight(w, 'eyeLookUpLeft')).toBe(1);
    expect(weight(w, 'eyeLookDownLeft')).toBe(0);
  });

  it("adds the gaze to the mood's own eye shapes and lowers the lids when looking down", () => {
    const names = ['eyeLookDownLeft', 'eyeLookUpLeft', 'eyeBlinkLeft'];
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
    mesh.morphTargetDictionary = Object.fromEntries(names.map((n, i) => [n, i]));
    mesh.morphTargetInfluences = names.map(() => 0);
    const face = new FaceController();
    face.setMeshes(mesh);
    face.setMood('proud'); // looks down a little by itself
    face.snap();
    face.setGaze(0, 0, EYE_RANGE.down / 2);
    let lid = 1;
    for (let i = 0; i < 300; i++) {
      face.update(1 / 60);
      lid = Math.min(lid, mesh.morphTargetInfluences[2]);
    }
    expect(mesh.morphTargetInfluences[0]).toBeCloseTo(MOOD_PRESETS.proud.eyeLookDownLeft! + 0.5, 3);
    expect(mesh.morphTargetInfluences[1]).toBe(0);
    expect(lid).toBeGreaterThan(0.05); // drooped even between blinks
    face.setGaze(0, 0, 0);
    face.update(1 / 60);
    expect(mesh.morphTargetInfluences[0]).toBeCloseTo(MOOD_PRESETS.proud.eyeLookDownLeft!, 3);
  });
});

function rig() {
  const dims = getAvatarDims('nonbinary', 'average');
  const r = buildRig(dims);
  const world = new THREE.Group();
  world.add(r.root);
  const book = new THREE.Group();
  const prop = new THREE.Group();
  prop.position.set(0, -0.066, 0.25);
  book.add(prop);
  r.bones.chest.add(book);
  const targets: AnimatorTargets = {
    bones: r.bones, bodyGroup: new THREE.Group(), lids: [], eyeballs: [], restLid: 0, book,
    restHipsX: 0, upperArmLen: dims.upperArmLen, forearmLen: dims.forearmLen,
    eyeCentres: [new THREE.Vector3(0.03, 0.07, 0.08), new THREE.Vector3(-0.03, 0.07, 0.08)],
  };
  return { r, world, targets, book, prop };
}

/** The head's turn to the left, about the vertical (radians). */
const headYaw = (head: THREE.Object3D) => {
  const f = new THREE.Vector3(0, 0, 1).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()));
  return Math.atan2(f.x, f.z);
};

describe('AvatarAnimator gaze and book', () => {
  it('looks down at the book while reading, with the lids following', () => {
    const { targets } = rig();
    const anim = new AvatarAnimator();
    for (let i = 0; i < 40; i++) anim.update(0.05, 'study', targets);
    expect(anim.gaze.pitch).toBeGreaterThan(0.1);
    for (let i = 0; i < 40; i++) anim.update(0.05, 'idle', targets);
    expect(Math.abs(anim.gaze.pitch)).toBeLessThan(0.12 + 0.05); // level, give or take a saccade
  });

  it('leads with the eyes toward a look target and lets the head follow', () => {
    const { r, targets } = rig();
    const anim = new AvatarAnimator();
    for (let i = 0; i < 20; i++) anim.update(0.05, 'idle', targets);
    const look = new THREE.Vector3(2, 1.3, 2); // ahead and to the avatar's left, at head height
    const rest = headYaw(r.bones.head);
    for (let i = 0; i < 3; i++) anim.update(0.05, 'idle', targets, look);
    const early = { head: headYaw(r.bones.head) - rest, eyes: anim.gaze.yawL };
    expect(early.eyes).toBeGreaterThan(early.head);
    expect(early.eyes).toBeGreaterThan(0.2);
    for (let i = 0; i < 60; i++) anim.update(0.05, 'idle', targets, look);
    const late = { head: headYaw(r.bones.head) - rest, eyes: anim.gaze.yawL };
    expect(late.head).toBeGreaterThan(0.25);
    expect(late.eyes).toBeLessThan(early.eyes); // the eyes recentre as the head comes round
    // Both eyes converge on the target: the right eye turns further left than the left eye.
    expect(anim.gaze.yawR).toBeGreaterThan(anim.gaze.yawL);
  });

  it('grows the book into the hands with the pose blend and shrinks it on the way out', () => {
    const { targets, book, prop } = rig();
    const anim = new AvatarAnimator();
    anim.update(0.05, 'idle', targets);
    expect(book.visible).toBe(false);
    anim.update(0.05, 'study', targets);
    expect(book.visible).toBe(true);
    expect(prop.scale.x).toBeLessThan(0.2);
    for (let i = 0; i < 10; i++) anim.update(0.05, 'study', targets);
    expect(prop.scale.x).toBeCloseTo(1);
    anim.update(0.05, 'idle', targets);
    expect(book.visible).toBe(true);
    expect(prop.scale.x).toBeLessThan(1);
    for (let i = 0; i < 4; i++) anim.update(0.05, 'idle', targets);
    expect(book.visible).toBe(false);
  });

  it('carries the pose over to a rebuilt rig instead of starting from the bind pose', () => {
    const a = rig();
    const anim = new AvatarAnimator();
    for (let i = 0; i < 40; i++) anim.update(0.05, 'wave', a.targets);
    const b = rig();
    anim.restore(b.targets);
    for (const n of ['upperArmR', 'forearmR', 'handR', 'spine'] as const) {
      expect(b.r.bones[n].quaternion.angleTo(a.r.bones[n].quaternion), n).toBeLessThan(1e-6);
    }
  });
});

const custom = (patch: Partial<CharacterCustomization> = {}) =>
  ({
    name: 'T', gender: 'female', bodyType: 'average', skinTone: '#8c5332', hairStyle: 'short-fade', hairColor: '#171717',
    facialHair: 'none', eyeColor: '#2563eb', eyewear: 'none', eyewearColor: '#000000', headwear: 'none', headwearColor: '#000000',
    outfitTop: 'casual-tee', topColor: '#991b1b', topSecondaryColor: '#ffffff', outfitBottom: 'jeans', bottomColor: '#1d4ed8',
    shoes: 'sneakers', shoesColor: '#ffffff', mood: 'happy', pose: 'idle', ...patch,
  }) as CharacterCustomization;

describe('v2 avatar motion', () => {
  it('keeps the arms where they were when the body shape changes (no flick to the bind pose)', async () => {
    const a = buildCharacterV2(custom(), { showShadow: false }, {
      loadManifest: async () => placeholderManifest(), assets: new AssetCache(fetchPlaceholder), tier: 'medium', fallback: () => { throw new Error('no fallback'); },
    });
    await new Promise((r) => setTimeout(r, 0));
    for (let i = 0; i < 40; i++) a.update(0.05, 'idle');
    const hand = a.root.getObjectByName('hand_l')!;
    a.root.updateMatrixWorld(true);
    const before = hand.getWorldPosition(new THREE.Vector3());
    a.updateCustomization(custom({ gender: 'male', bodyType: 'athletic' }));
    a.root.updateMatrixWorld(true);
    expect(hand.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBeLessThan(0.01);
    a.update(1 / 60, 'idle');
    a.root.updateMatrixWorld(true);
    expect(hand.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBeLessThan(0.01);
    a.dispose();
  });
});
