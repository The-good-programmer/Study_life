import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BoneName } from '../avatar/rig';
import type { AssetFetcher } from './assetLoader';
import type { AvatarManifest, ItemEntry } from './manifest';

/**
 * A procedural stand-in for the real v2 assets: a capsule mannequin built the
 * way the pipeline's glTF exports will be (T-pose bind, Blender-style bone
 * axes with +Y along each bone, extra clavicle and spine bones, `Body_*`
 * regions, body-shape and ARKit morphs, role-named materials, garments
 * skinned to a copy of the skeleton). Dev and tests only: it lets the whole
 * v2 runtime run before any art exists. Not imported by the app.
 */

interface BoneSpec { name: string; parent: string | null; head: [number, number, number]; tail: [number, number, number] }

const side = (s: 1 | -1, n: string) => `${n}_${s === 1 ? 'l' : 'r'}`;

const BONES: BoneSpec[] = [
  { name: 'pelvis', parent: null, head: [0, 0.93, 0], tail: [0, 1.02, 0] },
  { name: 'spine_01', parent: 'pelvis', head: [0, 1.02, 0], tail: [0, 1.14, 0] },
  { name: 'spine_02', parent: 'spine_01', head: [0, 1.14, 0], tail: [0, 1.27, 0] },
  { name: 'spine_03', parent: 'spine_02', head: [0, 1.27, 0], tail: [0, 1.44, 0] },
  { name: 'neck_01', parent: 'spine_03', head: [0, 1.44, 0.005], tail: [0, 1.53, 0.015] },
  { name: 'head', parent: 'neck_01', head: [0, 1.53, 0.015], tail: [0, 1.73, 0.015] },
  ...([1, -1] as const).flatMap((s): BoneSpec[] => [
    { name: side(s, 'clavicle'), parent: 'spine_03', head: [s * 0.02, 1.4, 0.02], tail: [s * 0.17, 1.41, -0.01] },
    { name: side(s, 'upperarm'), parent: side(s, 'clavicle'), head: [s * 0.17, 1.41, -0.01], tail: [s * 0.45, 1.41, -0.01] },
    { name: side(s, 'lowerarm'), parent: side(s, 'upperarm'), head: [s * 0.45, 1.41, -0.01], tail: [s * 0.7, 1.41, -0.01] },
    { name: side(s, 'hand'), parent: side(s, 'lowerarm'), head: [s * 0.7, 1.41, -0.01], tail: [s * 0.88, 1.41, -0.01] },
    { name: side(s, 'thigh'), parent: 'pelvis', head: [s * 0.09, 0.91, 0], tail: [s * 0.09, 0.5, 0.005] },
    { name: side(s, 'calf'), parent: side(s, 'thigh'), head: [s * 0.09, 0.5, 0.005], tail: [s * 0.09, 0.08, -0.01] },
    { name: side(s, 'foot'), parent: side(s, 'calf'), head: [s * 0.09, 0.08, -0.01], tail: [s * 0.09, 0.02, 0.16] },
  ]),
];

export const PLACEHOLDER_BONE_MAP: Record<BoneName, string> = {
  hips: 'pelvis', spine: 'spine_01', chest: 'spine_03', neck: 'neck_01', head: 'head',
  upperArmL: 'upperarm_l', forearmL: 'lowerarm_l', handL: 'hand_l',
  upperArmR: 'upperarm_r', forearmR: 'lowerarm_r', handR: 'hand_r',
  thighL: 'thigh_l', shinL: 'calf_l', footL: 'foot_l',
  thighR: 'thigh_r', shinR: 'calf_r', footR: 'foot_r',
};

const _up = new THREE.Vector3(0, 1, 0);

/** A skeleton whose bones point +Y along themselves, like a Blender glTF export. */
function buildSkeleton() {
  const armature = new THREE.Group();
  armature.name = 'Armature';
  const bones = new Map<string, THREE.Bone>();
  const world = new Map<string, THREE.Quaternion>();
  for (const b of BONES) {
    const bone = new THREE.Bone();
    bone.name = b.name;
    const head = new THREE.Vector3(...b.head);
    const dir = new THREE.Vector3(...b.tail).sub(head).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(_up, dir);
    world.set(b.name, q);
    if (b.parent) {
      const parent = BONES.find((p) => p.name === b.parent)!;
      const pq = world.get(b.parent)!;
      bone.position.copy(head.sub(new THREE.Vector3(...parent.head)).applyQuaternion(pq.clone().invert()));
      bone.quaternion.copy(pq.clone().invert().multiply(q));
      bones.get(b.parent)!.add(bone);
    } else {
      bone.position.copy(head);
      bone.quaternion.copy(q);
      armature.add(bone);
    }
    bones.set(b.name, bone);
  }
  armature.updateMatrixWorld(true);
  const order = BONES.map((b) => bones.get(b.name)!);
  return { armature, bones, skeleton: new THREE.Skeleton(order) };
}

type Shape = { male: number; female: number; slender: number; athletic: number };
const SHAPES: Record<string, Shape> = {
  gender_male: { male: 1, female: 0, slender: 0, athletic: 0 },
  gender_female: { male: 0, female: 1, slender: 0, athletic: 0 },
  build_slender: { male: 0, female: 0, slender: 1, athletic: 0 },
  build_athletic: { male: 0, female: 0, slender: 0, athletic: 1 },
};

/** Radius scale for a segment under a body shape (hips and chest differ by gender). */
function radiusScale(bone: string, s: Shape) {
  let k = 1 + 0.12 * s.athletic - 0.1 * s.slender;
  if (bone === 'pelvis' || bone.startsWith('thigh')) k += 0.1 * s.female - 0.03 * s.male;
  if (bone === 'spine_03' || bone.startsWith('upperarm')) k += 0.08 * s.male - 0.04 * s.female;
  return k;
}

/**
 * Capsules around the given bones, rigidly skinned, with body-shape morphs
 * (radial growth about each bone's axis). `inflate` sizes garments over skin.
 */
function segments(names: string[], radius: (bone: string) => number, inflate: number) {
  const parts = names.map((name) => {
    const spec = BONES.find((b) => b.name === name)!;
    const head = new THREE.Vector3(...spec.head);
    const tail = new THREE.Vector3(...spec.tail);
    const len = head.distanceTo(tail);
    const r = radius(name) + inflate;
    const geo = new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 0.6), 6, 16);
    const q = new THREE.Quaternion().setFromUnitVectors(_up, tail.clone().sub(head).normalize());
    const mid = head.clone().add(tail).multiplyScalar(0.5);
    const local = geo.attributes.position.array.slice() as Float32Array;
    geo.applyQuaternion(q).translate(mid.x, mid.y, mid.z);
    const n = geo.attributes.position.count;
    const boneIndex = BONES.findIndex((b) => b.name === name);
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 === 0 ? boneIndex : 0)), 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
    geo.morphAttributes.position = Object.values(SHAPES).map((shape) => {
      const k = radiusScale(name, shape);
      const out = new Float32Array(n * 3);
      const v = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        // Scale x/z (radial in the capsule's own frame), keep the length.
        v.set(local[i * 3] * k, local[i * 3 + 1], local[i * 3 + 2] * k).applyQuaternion(q).add(mid);
        v.toArray(out, i * 3);
      }
      return new THREE.Float32BufferAttribute(out, 3);
    });
    return geo;
  });
  return mergeGeometries(parts)!;
}

function skinnedMesh(geo: THREE.BufferGeometry, material: THREE.Material, name: string, skel: ReturnType<typeof buildSkeleton>) {
  const mesh = new THREE.SkinnedMesh(geo, material);
  mesh.name = name;
  mesh.morphTargetDictionary = Object.fromEntries(Object.keys(SHAPES).map((k, i) => [k, i]));
  mesh.morphTargetInfluences = Object.keys(SHAPES).map(() => 0);
  skel.armature.add(mesh);
  mesh.bind(skel.skeleton, new THREE.Matrix4());
  return mesh;
}

const BODY_RADIUS: Record<string, number> = {
  pelvis: 0.13, spine_01: 0.12, spine_02: 0.13, spine_03: 0.14, neck_01: 0.05,
  upperarm: 0.045, lowerarm: 0.037, hand: 0.03, thigh: 0.072, calf: 0.05, foot: 0.04,
  clavicle: 0.035,
};
const bodyRadius = (bone: string) => BODY_RADIUS[bone] ?? BODY_RADIUS[bone.replace(/_[lr]$/, '')] ?? 0.04;
const bothSides = (n: string) => [side(1, n), side(-1, n)];

const REGIONS: Record<string, string[]> = {
  torso: ['pelvis', 'spine_01', 'spine_02', 'spine_03', ...bothSides('clavicle')],
  neck: ['neck_01'],
  upperArms: bothSides('upperarm'),
  forearms: bothSides('lowerarm'),
  hands: bothSides('hand'),
  thighs: bothSides('thigh'),
  shins: bothSides('calf'),
  feet: bothSides('foot'),
};

const mat = (name: string, color: number, extra: THREE.MeshPhysicalMaterialParameters = {}) => {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.7, ...extra });
  m.name = name;
  return m;
};

/** The base: body regions, a head with ARKit morphs, eyes. */
export function placeholderBase(): THREE.Group {
  const skel = buildSkeleton();
  const skin = mat('skin_body', 0xd9d9d9, { roughness: 0.55, sheen: 0.3 });
  for (const [region, bones] of Object.entries(REGIONS)) {
    skinnedMesh(segments(bones, bodyRadius, 0), skin, `Body_${region}`, skel);
  }

  // Head: rigid on the head bone, with a few ARKit shapes.
  const headBone = skel.bones.get('head')!;
  const centre = new THREE.Vector3(0, 1.625, 0.03);
  const headGeo = new THREE.SphereGeometry(0.095, 32, 24).scale(0.82, 1.08, 0.95).translate(centre.x, centre.y, centre.z);
  const p = headGeo.attributes.position;
  const shape = (fn: (v: THREE.Vector3) => void) => {
    const out = new Float32Array(p.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      fn(v);
      v.toArray(out, i * 3);
    }
    return new THREE.Float32BufferAttribute(out, 3);
  };
  const arkit = {
    jawOpen: shape((v) => { if (v.y < centre.y - 0.03 && v.z > centre.z) v.y -= 0.025 * Math.min(1, (centre.y - 0.03 - v.y) / 0.04); }),
    mouthSmileLeft: shape((v) => { if (v.x > 0 && v.y < centre.y - 0.02 && v.z > centre.z + 0.05) v.y += 0.01; }),
    mouthSmileRight: shape((v) => { if (v.x < 0 && v.y < centre.y - 0.02 && v.z > centre.z + 0.05) v.y += 0.01; }),
  };
  headGeo.morphAttributes.position = Object.values(arkit);
  const head = new THREE.Mesh(headGeo, skin);
  head.name = 'Head';
  head.morphTargetDictionary = Object.fromEntries(Object.keys(arkit).map((k, i) => [k, i]));
  head.morphTargetInfluences = Object.keys(arkit).map(() => 0);
  // Authored in bind (world) space; re-express under the head bone.
  head.applyMatrix4(headBone.matrixWorld.clone().invert());
  headBone.add(head);

  const sclera = mat('eye_sclera', 0xf4f1ea, { roughness: 0.2, clearcoat: 1 });
  const iris = mat('iris_main', 0x8a8a8a, { roughness: 0.3 });
  for (const s of [1, -1]) {
    const eye = new THREE.Group();
    eye.name = s === 1 ? 'Eye_L' : 'Eye_R';
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), sclera);
    const irisDisc = new THREE.Mesh(new THREE.CircleGeometry(0.0058, 20), iris);
    irisDisc.position.z = 0.0118;
    eye.add(ball, irisDisc);
    eye.position.set(s * 0.032, 1.64, 0.105).applyMatrix4(headBone.matrixWorld.clone().invert());
    headBone.add(eye);
  }
  return skel.armature;
}

/** A skinned garment over the given bones, on its own copy of the skeleton. */
function garment(bones: string[], inflate: number, material: THREE.Material, name: string) {
  const skel = buildSkeleton();
  skinnedMesh(segments(bones, bodyRadius, inflate), material, name, skel);
  return skel.armature;
}

const ITEMS: Record<string, { build: () => THREE.Object3D; entry: Omit<ItemEntry, 'files'> }> = {
  'top/casual-tee': {
    build: () => garment([...REGIONS.torso, ...bothSides('upperarm')], 0.008, mat('top_body', 0xdddddd, { roughness: 0.9, sheen: 0.6 }), 'Tee'),
    entry: { hides: ['torso', 'upperArms'] },
  },
  'bottom/jeans': {
    build: () => garment(['pelvis', ...REGIONS.thighs, ...REGIONS.shins], 0.009, mat('bottom_denim', 0xdddddd, { roughness: 0.85 }), 'Jeans'),
    entry: { hides: ['thighs', 'shins'] },
  },
  'shoes/sneakers': {
    build: () => garment(REGIONS.feet, 0.012, mat('shoes_upper', 0xdddddd, { roughness: 0.6 }), 'Sneakers'),
    entry: { hides: ['feet'] },
  },
  'hair/short-fade': {
    build: () => {
      const g = new THREE.Group();
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(0.86, 1.05, 0.98),
        mat('hair_cap', 0xdddddd, { roughness: 0.5 })
      );
      cap.position.set(0, 1.64, 0.02);
      g.add(cap);
      return g;
    },
    entry: { attach: 'head' },
  },
};

/** A manifest describing the placeholder assets (URLs use a `placeholder:` scheme). */
export function placeholderManifest(): AvatarManifest {
  const items: AvatarManifest['items'] = {};
  for (const [key, { entry }] of Object.entries(ITEMS)) {
    const [slot, id] = key.split('/') as [keyof AvatarManifest['items'], string];
    (items[slot] ??= {})[id] = { ...entry, files: { medium: `placeholder:${key}` } };
  }
  return { version: 1, base: { files: { medium: 'placeholder:base' } }, boneMap: PLACEHOLDER_BONE_MAP, items };
}

export const fetchPlaceholder: AssetFetcher = async (url) => {
  const key = url.replace(/^placeholder:/, '');
  if (key === 'base') return placeholderBase();
  const item = ITEMS[key];
  if (!item) throw new Error(`no placeholder asset ${url}`);
  return item.build();
};
