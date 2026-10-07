import * as THREE from 'three';
import {
  type Sdf, type Vec3, v3, smin, smax, roundCone, ellipsoid, sphere,
} from '../sdf/sdf';
import type { AvatarDims } from './anatomy';
import { type AvatarRig, type BoneName, bonePoint } from './rig';

export type Region = 'torso' | 'armL' | 'armR' | 'legL' | 'legR';

/** One sculpted volume, tagged with the bone that moves it. */
export interface BodyPart {
  name: string;
  bone: BoneName;
  region: Region;
  sdf: Sdf;
  /** Bounding sphere [cx, cy, cz, r], used to skip far-away parts. */
  bound?: [number, number, number, number];
}

interface Prim {
  sdf: Sdf;
  bound: [number, number, number, number];
}

// Primitive constructors that also record a bounding sphere.
const E = (c: Vec3, rx: number, ry: number, rz: number): Prim => ({
  sdf: ellipsoid(c, rx, ry, rz),
  bound: [c.x, c.y, c.z, Math.max(rx, ry, rz)],
});
const S = (c: Vec3, r: number): Prim => ({ sdf: sphere(c, r), bound: [c.x, c.y, c.z, r] });
const RC = (a: Vec3, b: Vec3, ra: number, rb: number): Prim => ({
  sdf: roundCone(a, b, ra, rb),
  bound: [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2,
    Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2) / 2 + Math.max(ra, rb)],
});
const C = (a: Vec3, b: Vec3, r: number): Prim => RC(a, b, r, r);

const toV = (p: THREE.Vector3): Vec3 => v3(p.x, p.y, p.z);

/**
 * Sculpted body volumes in the bind (A-) pose. Hands, head and feet are
 * separate rigid meshes (see hands.ts, head.ts, clothing shoes) so they can be
 * meshed at a finer resolution; the arms end at the wrist and the legs at the
 * ankle, where those meshes overlap them.
 */
export function buildBodyParts(rig: AvatarRig, d: AvatarDims): BodyPart[] {
  const parts: BodyPart[] = [];
  const add = (name: string, bone: BoneName, region: Region, prim: Prim) =>
    parts.push({ name, bone, region, sdf: prim.sdf, bound: prim.bound });

  // ── Torso ────────────────────────────────────────────────────────────────
  add('pelvis', 'hips', 'torso', E(v3(0, d.pelvisY + 0.005, -0.004), d.hipHalfWidth, 0.1, 0.098));
  add('abdomen', 'spine', 'torso', E(v3(0, d.waistY + 0.01, 0.004), d.waistHalfWidth, 0.1, 0.09));
  // A tall ribcage that flows into the waist (a short one leaves an underbust crease).
  add('ribcage', 'chest', 'torso', E(v3(0, d.chestY + 0.012, 0), d.chestHalfWidth, 0.148, d.chestDepth));
  // Trapezius slope from neck base to each shoulder.
  const shoulderL = bonePoint(rig, 'upperArmL');
  const shoulderR = bonePoint(rig, 'upperArmR');
  const neckBase = v3(0, d.shoulderY + 0.012, -0.012);
  add('trapL', 'chest', 'torso', C(neckBase, v3(shoulderL.x * 0.82, shoulderL.y + 0.006, -0.01), d.shoulderRadius * 0.82));
  add('trapR', 'chest', 'torso', C(neckBase, v3(shoulderR.x * 0.82, shoulderR.y + 0.006, -0.01), d.shoulderRadius * 0.82));
  // Neck: lower half follows the neck bone, upper half the head (hidden in the head mesh).
  const neckTop = bonePoint(rig, 'head', 0, 0.035, 0.004);
  const neckMid = bonePoint(rig, 'neck', 0, 0.04, 0.004);
  add('neckLower', 'neck', 'torso', RC(v3(0, d.neckY - 0.04, -0.008), toV(neckMid), d.neckRadius * 1.12, d.neckRadius));
  add('neckUpper', 'head', 'torso', C(toV(neckMid), toV(neckTop), d.neckRadius));
  for (const side of [1, -1]) {
    add(side > 0 ? 'gluteL' : 'gluteR', 'hips', 'torso',
      E(v3(side * 0.062, d.pelvisY - 0.022, -0.052), 0.072, 0.075, d.glute));
    if (d.bust > 0) {
      add(side > 0 ? 'bustL' : 'bustR', 'chest', 'torso',
        E(v3(side * 0.058, d.chestY + 0.005, d.chestDepth * 0.62), 0.058 * d.bust + 0.01, 0.052 * d.bust + 0.008, 0.045 * d.bust));
    }
  }

  // ── Arms (A-pose) ────────────────────────────────────────────────────────
  for (const s of ['L', 'R'] as const) {
    const region: Region = s === 'L' ? 'armL' : 'armR';
    const shoulder = bonePoint(rig, `upperArm${s}`);
    const elbow = bonePoint(rig, `forearm${s}`);
    const wrist = bonePoint(rig, `hand${s}`);
    const bicep = bonePoint(rig, `upperArm${s}`, 0, -d.upperArmLen * 0.42, 0.006);
    add(`deltoid${s}`, `upperArm${s}`, region, S(toV(bonePoint(rig, `upperArm${s}`, 0, -0.014, 0)), d.shoulderRadius * 0.9));
    add(`upperArm${s}`, `upperArm${s}`, region, RC(toV(shoulder), toV(elbow), d.upperArmRadius * 0.95, d.upperArmRadius * 0.8));
    add(`bicep${s}`, `upperArm${s}`, region, E(toV(bicep), d.upperArmRadius * 0.92, d.upperArmLen * 0.3, d.upperArmRadius * 0.95));
    add(`forearm${s}`, `forearm${s}`, region, RC(toV(elbow), toV(wrist), d.forearmRadius, d.wristRadius));
    add(`forearmMuscle${s}`, `forearm${s}`, region,
      E(toV(bonePoint(rig, `forearm${s}`, 0, -d.forearmLen * 0.28, 0.004)), d.forearmRadius * 1.05, d.forearmLen * 0.3, d.forearmRadius));
  }

  // ── Legs ─────────────────────────────────────────────────────────────────
  for (const s of ['L', 'R'] as const) {
    const region: Region = s === 'L' ? 'legL' : 'legR';
    const side = s === 'L' ? 1 : -1;
    const hip = bonePoint(rig, `thigh${s}`);
    const knee = bonePoint(rig, `shin${s}`);
    const ankle = bonePoint(rig, `foot${s}`);
    // Clean tapered legs: thigh into knee into shin, with a soft calf.
    add(`thigh${s}`, `thigh${s}`, region,
      RC(v3(hip.x + side * 0.008, hip.y + 0.02, hip.z - 0.004), toV(knee), d.thighRadius * 0.94, d.kneeRadius * 0.92));
    add(`knee${s}`, `shin${s}`, region, S(toV(bonePoint(rig, `shin${s}`, 0, -0.008, 0.002)), d.kneeRadius * 0.88));
    add(`shin${s}`, `shin${s}`, region, RC(toV(knee), toV(ankle), d.kneeRadius * 0.86, d.ankleRadius));
    add(`calf${s}`, `shin${s}`, region,
      E(toV(bonePoint(rig, `shin${s}`, 0, -d.shinLen * 0.3, -0.014)), d.calfRadius * 0.9, d.shinLen * 0.26, d.calfRadius * 0.85));
  }

  return parts;
}

// ─── Composition ─────────────────────────────────────────────────────────────

export interface ComposeOptions {
  /** Which regions to include (default: all). */
  regions?: Region[];
  /** Uniform outward offset, e.g. for a clothing shell. */
  inflate?: number;
  /** Extra per-region offset (e.g. looser trouser legs). */
  regionInflate?: Partial<Record<Region, Sdf | number>>;
  /** Per-region clip: the shape keeps only where clip(p) <= 0. */
  clip?: Partial<Record<Region, Sdf>>;
  /** Rounding of clipped edges. */
  clipRound?: number;
  /** Parts to leave out by name. */
  exclude?: string[];
  kTorso?: number;
  kLimb?: number;
  kAttach?: number;
}

/**
 * Combines parts into one field: parts blend smoothly within the torso and
 * within each limb, and each limb blends into the torso, but limbs never blend
 * into each other (so thighs and arms keep a clean separation).
 */
export function composeBody(parts: BodyPart[], o: ComposeOptions = {}): Sdf {
  const regions: Region[] = o.regions ?? ['torso', 'armL', 'armR', 'legL', 'legR'];
  const kTorso = o.kTorso ?? 0.06;
  const kLimb = o.kLimb ?? 0.03;
  const kAttach = o.kAttach ?? 0.032;
  const inflate = o.inflate ?? 0;
  const clipRound = o.clipRound ?? 0.004;
  const exclude = new Set(o.exclude ?? []);

  interface Item { sdf: Sdf; cx: number; cy: number; cz: number; r: number }
  const group = (region: Region): Item[] =>
    parts
      .filter((p) => p.region === region && !exclude.has(p.name))
      .map((p) => {
        const b = p.bound ?? [0, 0, 0, Infinity];
        return { sdf: p.sdf, cx: b[0], cy: b[1], cz: b[2], r: b[3] };
      });
  const torso = group('torso');
  const limbs = (['armL', 'armR', 'legL', 'legR'] as Region[])
    .filter((r) => regions.includes(r))
    .map((r) => ({ region: r, items: group(r) }))
    .filter((l) => l.items.length > 0);
  const hasTorso = regions.includes('torso') && torso.length > 0;

  const offsetFor = (region: Region): Sdf | number => o.regionInflate?.[region] ?? 0;
  const evalOffset = (off: Sdf | number, x: number, y: number, z: number) =>
    typeof off === 'number' ? off : off(x, y, z);

  /**
   * Smooth union of a group. A part whose bounding sphere is more than k
   * beyond the current distance cannot change the result, so it is skipped.
   */
  const blend = (items: Item[], k: number, x: number, y: number, z: number) => {
    let d = Infinity;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const dx = x - it.cx, dy = y - it.cy, dz = z - it.cz;
      const lower = Math.sqrt(dx * dx + dy * dy + dz * dz) - it.r;
      if (lower > d + k) continue;
      const v = it.sdf(x, y, z);
      d = d === Infinity ? v : smin(d, v, k);
    }
    return d;
  };
  const clipped = (region: Region, d: number, x: number, y: number, z: number) => {
    const c = o.clip?.[region];
    return c ? smax(d, c(x, y, z), clipRound) : d;
  };

  return (x, y, z) => {
    let torsoD = Infinity;
    if (hasTorso) {
      torsoD = blend(torso, kTorso, x, y, z);
      if (torsoD !== Infinity) {
        torsoD = clipped('torso', torsoD - inflate - evalOffset(offsetFor('torso'), x, y, z), x, y, z);
      }
    }
    let d = torsoD;
    for (const limb of limbs) {
      let ld = blend(limb.items, kLimb, x, y, z);
      if (ld === Infinity) continue;
      ld = clipped(limb.region, ld - inflate - evalOffset(offsetFor(limb.region), x, y, z), x, y, z);
      const attached = torsoD !== Infinity ? smin(torsoD, ld, kAttach) : ld;
      if (attached < d) d = attached;
    }
    // Far from every part: return a safe, finite distance for the mesher.
    return d === Infinity ? 1 : d;
  };
}

// ─── Skinning ────────────────────────────────────────────────────────────────

/**
 * Bone weights from proximity to the tagged parts: each bone takes the
 * closest of its parts, weighted by exp(-(d - dMin) / falloff), so joints
 * (where two parts overlap) blend smoothly. The four strongest bones are kept.
 */
export function computeSkinWeights(
  positions: Float32Array,
  parts: BodyPart[],
  boneIndex: Record<BoneName, number>,
  falloff = 0.016
): { skinIndex: Uint16Array; skinWeight: Float32Array } {
  const count = positions.length / 3;
  const skinIndex = new Uint16Array(count * 4);
  const skinWeight = new Float32Array(count * 4);
  const boneOf = parts.map((p) => boneIndex[p.bone]);
  const boneCount = Object.keys(boneIndex).length;
  const best = new Float32Array(boneCount);

  for (let v = 0; v < count; v++) {
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    best.fill(Infinity);
    let dMin = Infinity;
    for (let i = 0; i < parts.length; i++) {
      const dist = parts[i].sdf(x, y, z);
      const b = boneOf[i];
      if (dist < best[b]) best[b] = dist;
      if (dist < dMin) dMin = dist;
    }
    // Pick the four bones with the highest weight.
    const top: { b: number; w: number }[] = [];
    for (let b = 0; b < boneCount; b++) {
      if (best[b] === Infinity) continue;
      const w = Math.exp(-(best[b] - dMin) / falloff);
      if (w < 0.01) continue;
      top.push({ b, w });
    }
    top.sort((a, c) => c.w - a.w);
    const kept = top.slice(0, 4);
    const total = kept.reduce((s, t) => s + t.w, 0) || 1;
    for (let k = 0; k < 4; k++) {
      skinIndex[v * 4 + k] = kept[k]?.b ?? 0;
      skinWeight[v * 4 + k] = kept[k] ? kept[k].w / total : 0;
    }
  }
  return { skinIndex, skinWeight };
}

/** Plane helper: keeps the side where (p - point)·normal <= 0. */
export function keepBelow(point: Vec3, normal: Vec3): Sdf {
  const len = Math.hypot(normal.x, normal.y, normal.z);
  const nx = normal.x / len, ny = normal.y / len, nz = normal.z / len;
  return (x, y, z) => (x - point.x) * nx + (y - point.y) * ny + (z - point.z) * nz;
}

/**
 * Clip that cuts a limb perpendicular to its bone at a fraction along it,
 * keeping the part nearer the body (e.g. a sleeve or trouser hem).
 */
export function cutAlongBone(rig: AvatarRig, bone: BoneName, lengthAlong: number): Sdf {
  const p = bonePoint(rig, bone, 0, -lengthAlong, 0);
  const q = bonePoint(rig, bone, 0, -lengthAlong - 0.01, 0);
  return keepBelow(toV(p), v3(q.x - p.x, q.y - p.y, q.z - p.z));
}
