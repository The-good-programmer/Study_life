import * as THREE from 'three';
import type { OutfitBottom, OutfitTop, Shoes } from '../../../../types/character';
import {
  type Sdf, v3, ellipsoid, roundCone, capsule, roundBox, smin, smax,
} from '../sdf/sdf';
import type { AvatarDims } from './anatomy';
import { type AvatarRig, type BoneName, bonePoint } from './rig';
import { type BodyPart, type Region, composeBody, cutAlongBone } from './body';
import { withWhiteColors } from './geometry';

/** Everything needed to mesh, skin and dress one garment. */
export interface GarmentSpec {
  sdf: Sdf;
  min: [number, number, number];
  max: [number, number, number];
  /** Parts used to compute skin weights (body parts plus garment extras). */
  weightParts: BodyPart[];
  /**
   * Colour zone at a point (0, 1 or 2). Return a continuous value (e.g. a
   * distance to the boundary mapped around 0.5) so boundaries render smooth.
   */
  materialOf?: (x: number, y: number, z: number) => number;
  /** Rigid details (buttons, drawstrings...) to attach to bones. */
  details?: GarmentDetail[];
}

export interface GarmentDetail {
  bone: BoneName;
  object: THREE.Object3D;
}

/**
 * Zone 1 inside (signed distance d < 0), zone 0 outside, ramping over `soft`
 * metres. The ramp must span more than a mesh cell (~1 cm on garments) or the
 * boundary snaps to triangle edges; the shader re-sharpens it to a clean line.
 */
const zoneFromDistance = (d: number, soft = 0.018) => Math.min(1, Math.max(0, 0.5 - d / soft));

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/**
 * Thickens a garment near an edge (distance to the cut < width): a rib band.
 * Cuts are infinite planes, so `near` (if given) limits the band to the body
 * region the edge belongs to; it should be <= 0 there and grow away from it.
 */
function withBand(base: Sdf, edgeDist: Sdf, width: number, bulge: number, near?: Sdf): Sdf {
  return (x, y, z) => {
    const e = Math.abs(edgeDist(x, y, z));
    if (e >= width * 1.6) return base(x, y, z);
    let amount = 1 - smoothstep(width * 0.7, width * 1.6, e);
    if (near) amount *= 1 - smoothstep(0, 0.02, near(x, y, z));
    return base(x, y, z) - bulge * amount;
  };
}

/** Distance from a point to the closest part of a region (for material zones). */
function regionDistance(parts: BodyPart[], region: Region): Sdf {
  const list = parts.filter((p) => p.region === region).map((p) => p.sdf);
  return (x, y, z) => {
    let d = Infinity;
    for (const s of list) {
      const v = s(x, y, z);
      if (v < d) d = v;
    }
    return d;
  };
}

const UPPER_BODY_ONLY = ['neckLower', 'neckUpper'];
const LOWER_BODY_EXCLUDE = ['ribcage', 'trapL', 'trapR', 'neckLower', 'neckUpper', 'bustL', 'bustR', 'pecL', 'pecR'];

/** Rigid mesh helper for garment details. */
function detail(bone: BoneName, geo: THREE.BufferGeometry, mat: THREE.Material, pos: THREE.Vector3, rot?: THREE.Euler): GarmentDetail {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  if (rot) mesh.rotation.copy(rot);
  mesh.castShadow = true;
  return { bone, object: mesh };
}

/** Converts a bind-pose world point into a bone's local frame. */
function toBoneLocal(rig: AvatarRig, bone: BoneName, p: THREE.Vector3) {
  return rig.bones[bone].worldToLocal(p.clone());
}

// ─── Tops ────────────────────────────────────────────────────────────────────

interface TopStyle {
  inflate: number;
  hemY: number;
  sleeve: 'short' | 'long';
  neck: 'crew' | 'v' | 'collar' | 'hood' | 'lapel';
  loose?: number; // extra looseness toward the hem
  coatLength?: number; // y of a long coat hem (lab coat)
}

const TOP_STYLES: Record<OutfitTop, TopStyle> = {
  'casual-tee': { inflate: 0.009, hemY: 0.79, sleeve: 'short', neck: 'crew' },
  sweater: { inflate: 0.011, hemY: 0.79, sleeve: 'long', neck: 'crew', loose: 0.004 },
  hoodie: { inflate: 0.012, hemY: 0.775, sleeve: 'long', neck: 'hood', loose: 0.006 },
  'button-down': { inflate: 0.0095, hemY: 0.765, sleeve: 'long', neck: 'collar', loose: 0.003 },
  'varsity-jacket': { inflate: 0.014, hemY: 0.8, sleeve: 'long', neck: 'collar', loose: 0.005 },
  'lab-coat': { inflate: 0.012, hemY: 0.78, sleeve: 'long', neck: 'lapel', coatLength: 0.4 },
};

/**
 * Builds the top garment. Material slots: 0 = primary, 1 = secondary
 * (trims, varsity sleeves, the shirt under a lab coat).
 */
export function buildTopSpec(
  top: OutfitTop,
  rig: AvatarRig,
  d: AvatarDims,
  parts: BodyPart[],
  detailMats: { secondary: THREE.Material; button: THREE.Material; gold: THREE.Material }
): GarmentSpec {
  const st = TOP_STYLES[top] ?? TOP_STYLES['casual-tee'];
  const sleeveCut = (s: 'L' | 'R') =>
    st.sleeve === 'short'
      ? cutAlongBone(rig, `upperArm${s}`, d.upperArmLen * 0.5)
      : cutAlongBone(rig, `forearm${s}`, d.forearmLen - 0.014);
  const hemY = st.hemY;
  const hemCut: Sdf = (_x, y) => hemY - y;
  const looseTowardHem: Sdf = (_x, y) => (st.loose ?? 0) * smoothstep(d.chestY, hemY, y);

  let body = composeBody(parts, {
    regions: ['torso', 'armL', 'armR'],
    exclude: UPPER_BODY_ONLY,
    inflate: st.inflate,
    regionInflate: { torso: looseTowardHem, armL: (st.loose ?? 0) * 0.4, armR: (st.loose ?? 0) * 0.4 },
    clip: { torso: hemCut, armL: sleeveCut('L'), armR: sleeveCut('R') },
    clipRound: 0.005,
  });

  const extraParts: BodyPart[] = [];

  // Long coat body below the waist (lab coat), following the hips.
  if (st.coatLength) {
    const coatTop = v3(0, d.waistY + 0.02, -0.006);
    const coatBottom = v3(0, st.coatLength, -0.01);
    const skirt = roundCone(coatBottom, coatTop, d.hipHalfWidth + 0.075, d.waistHalfWidth + 0.03);
    const squashed: Sdf = (x, y, z) => skirt(x, y, z * 1.25) / 1.12;
    const coatHem: Sdf = (_x, y) => st.coatLength! + 0.01 - y;
    const skirtClipped: Sdf = (x, y, z) => smax(squashed(x, y, z), coatHem(x, y, z), 0.006);
    const upper = body;
    body = (x, y, z) => smin(upper(x, y, z), skirtClipped(x, y, z), 0.03);
    extraParts.push({ name: 'coatSkirt', bone: 'hips', region: 'torso', sdf: squashed });
  }

  // Neckline openings.
  const neckAxisTop = v3(0, d.neckY + 0.2, -0.008);
  const neckAxisBottom = v3(0, d.neckY - 0.07, 0);
  // Openings hug the neck so there is no gap to look down into.
  const neckHole = capsule(neckAxisBottom, neckAxisTop, d.neckRadius + 0.005);
  const vHole = roundCone(v3(0, d.chestY - 0.005, d.chestDepth + 0.04), v3(0, d.neckY + 0.04, 0.02), 0.012, d.neckRadius + 0.016);
  // (The lab coat's V is painted as a colour zone over a closed front.)
  const opening = st.neck === 'v' ? vHole : neckHole;
  const withNeck: Sdf = (x, y, z) => smax(body(x, y, z), -opening(x, y, z), 0.008);

  // Rib bands at the hem, cuffs and neckline, each kept to its own region.
  const armL = regionDistance(parts, 'armL');
  const armR = regionDistance(parts, 'armR');
  const torsoOnly = regionDistance(parts, 'torso');
  const nearTorso: Sdf = (x, y, z) => torsoOnly(x, y, z) - Math.min(armL(x, y, z), armR(x, y, z));
  const nearArm = (arm: Sdf): Sdf => (x, y, z) => arm(x, y, z) - torsoOnly(x, y, z);
  let shaped: Sdf = withBand(withNeck, hemCut, 0.014, 0.004, nearTorso);
  shaped = withBand(shaped, sleeveCut('L'), 0.013, 0.0035, nearArm(armL));
  shaped = withBand(shaped, sleeveCut('R'), 0.013, 0.0035, nearArm(armR));
  shaped = withBand(shaped, opening, 0.012, st.neck === 'crew' ? 0.004 : 0.002);

  // Collars, hoods and lapels.
  if (st.neck === 'collar') {
    const collar = roundCone(v3(0, d.neckY - 0.03, -0.004), v3(0, d.neckY + 0.012, -0.012), d.neckRadius + 0.024, d.neckRadius + 0.017);
    const collarShell: Sdf = (x, y, z) => {
      const c = collar(x, y, z);
      const ring = Math.max(c, -(c + 0.007)); // hollow ring
      const front = z > 0.02 && Math.abs(x) < 0.012 ? 1 : 0; // collar opening at the front
      return front ? Math.max(ring, 0.004) : ring;
    };
    const base = shaped;
    shaped = (x, y, z) => Math.min(base(x, y, z), collarShell(x, y, z));
    extraParts.push({ name: 'collar', bone: 'chest', region: 'torso', sdf: collar });
  }
  if (st.neck === 'hood') {
    const hood = ellipsoid(v3(0, d.neckY + 0.005, -0.085), 0.115, 0.07, 0.065);
    const hoodInner = ellipsoid(v3(0, d.neckY + 0.025, -0.07), 0.08, 0.05, 0.045);
    const base = shaped;
    shaped = (x, y, z) => smin(base(x, y, z), smax(hood(x, y, z), -hoodInner(x, y, z), 0.01), 0.02);
    extraParts.push({ name: 'hood', bone: 'chest', region: 'torso', sdf: hood });
  }
  if (st.neck === 'lapel') {
    // Folded lapels: a raised band along each edge of the V opening.
    const base = shaped;
    shaped = (x, y, z) => {
      const b = base(x, y, z);
      if (z <= 0 || y < d.waistY - 0.04) return b;
      const halfV = 0.012 + Math.max(0, y - (d.waistY - 0.03)) * 0.26;
      const fromEdge = Math.abs(x) - halfV;
      const band = 1 - smoothstep(0.004, 0.03, Math.abs(fromEdge - 0.014));
      return b - 0.004 * band * smoothstep(d.waistY - 0.04, d.waistY, y);
    };
  }

  // Kangaroo pocket on hoodies: a slightly raised panel that follows the body.
  if (top === 'hoodie') {
    const base = shaped;
    const py = d.waistY - 0.03;
    shaped = (x, y, z) => {
      const b = base(x, y, z);
      if (z <= 0) return b;
      const inX = 1 - smoothstep(0.075, 0.09, Math.abs(x) + Math.max(0, y - py) * 0.35);
      const inY = smoothstep(py - 0.06, py - 0.05, y) * (1 - smoothstep(py + 0.035, py + 0.045, y));
      return b - 0.0035 * inX * inY;
    };
  }

  // Material zones.
  const armDistL = armL;
  const armDistR = armR;
  const torsoDist = torsoOnly;
  let materialOf: GarmentSpec['materialOf'];
  // Signed distance to "on an arm" (negative on the sleeves).
  const sleeveSide = (x: number, y: number, z: number) =>
    Math.min(armDistL(x, y, z), armDistR(x, y, z)) - torsoDist(x, y, z) + 0.01;
  if (top === 'varsity-jacket') {
    // Contrast sleeves and hem band.
    materialOf = (x, y, z) => Math.max(zoneFromDistance(sleeveSide(x, y, z)), zoneFromDistance(y - (hemY + 0.028)));
  } else if (top === 'sweater' || top === 'hoodie') {
    // Ribbed cuffs and hem in the secondary colour.
    materialOf = (x, y, z) => {
      const onArm = sleeveSide(x, y, z) < 0;
      const cuff = Math.max(sleeveCut('L')(x, y, z), sleeveCut('R')(x, y, z)) + 0.022;
      return onArm ? zoneFromDistance(-cuff) : zoneFromDistance(y - (hemY + 0.022));
    };
  } else if (top === 'lab-coat') {
    // Shirt showing in a V between the open lapels.
    materialOf = (x, y, z) => {
      if (z <= 0) return 0;
      const halfV = 0.012 + Math.max(0, y - (d.waistY - 0.03)) * 0.26;
      return y < d.waistY - 0.03 ? 0 : zoneFromDistance(Math.abs(x) - halfV);
    };
  }

  // Rigid details.
  const details: GarmentDetail[] = [];
  if (top === 'button-down' || top === 'varsity-jacket') {
    const buttonGeo = new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 14);
    buttonGeo.rotateX(Math.PI / 2);
    const count = top === 'button-down' ? 5 : 5;
    for (let i = 0; i < count; i++) {
      const y = d.neckY - 0.045 - i * ((d.neckY - 0.06 - hemY) / count);
      const z = frontSurfaceZ(shaped, 0, y);
      if (z === null) continue;
      const bone: BoneName = y > d.chestY ? 'chest' : y > d.waistY ? 'spine' : 'hips';
      // Contrast buttons: gold snaps on varsity jackets, accent colour on shirts.
      details.push(detail(bone, buttonGeo, top === 'varsity-jacket' ? detailMats.gold : detailMats.secondary,
        toBoneLocal(rig, bone, new THREE.Vector3(0, y, z + 0.0012))));
    }
  }
  if (top === 'hoodie') {
    const cordGeo = withWhiteColors(new THREE.CapsuleGeometry(0.0024, 0.075, 4, 8));
    for (const side of [1, -1]) {
      const x = side * 0.028;
      const y = d.neckY - 0.065;
      const z = frontSurfaceZ(shaped, x, y);
      if (z === null) continue;
      details.push(detail('chest', cordGeo, detailMats.secondary, toBoneLocal(rig, 'chest', new THREE.Vector3(x, y, z + 0.004)), new THREE.Euler(0.12, 0, 0)));
    }
  }

  return {
    sdf: shaped,
    min: [-0.47, st.coatLength ? st.coatLength - 0.03 : hemY - 0.06, -0.24],
    max: [0.47, d.neckY + 0.1, 0.24],
    weightParts: [...parts.filter((p) => !UPPER_BODY_ONLY.includes(p.name) && (p.region === 'torso' || p.region === 'armL' || p.region === 'armR')), ...extraParts],
    materialOf,
    details,
  };
}

// ─── Bottoms ─────────────────────────────────────────────────────────────────

export function buildBottomSpec(
  bottom: OutfitBottom,
  shoes: Shoes,
  rig: AvatarRig,
  d: AvatarDims,
  parts: BodyPart[]
): GarmentSpec {
  const waistTop = d.waistY + 0.012;
  const waistCut: Sdf = (_x, y) => y - waistTop;
  // Kept a few millimetres inside every top so overlapping layers never fight.
  const inflate = 0.0055;
  const extraParts: BodyPart[] = [];

  const legLength = (s: 'L' | 'R') => {
    if (bottom === 'shorts') return cutAlongBone(rig, `thigh${s}`, d.thighLen * 0.82);
    if (bottom === 'pleated-skirt') return cutAlongBone(rig, `thigh${s}`, -1); // no legs
    const bootTop = shoes === 'boots' ? 0.085 : 0.012;
    return cutAlongBone(rig, `shin${s}`, d.shinLen - bootTop);
  };

  // Straight trouser legs: loosen toward the hem so they don't cling to the calf.
  const legLoose = (amount: number): Sdf => (_x, y) => amount * smoothstep(d.hipJointY, 0.2, y);
  const looseness = bottom === 'joggers' ? 0.012 : bottom === 'jeans' ? 0.007 : bottom === 'shorts' ? 0.016 : 0.005;

  let sdf: Sdf;
  if (bottom === 'pleated-skirt') {
    const hips = composeBody(parts, {
      regions: ['torso'],
      exclude: LOWER_BODY_EXCLUDE,
      inflate,
      clip: { torso: waistCut },
    });
    // A pleated cone from the waist to just above the knee.
    const top = v3(0, waistTop - 0.01, 0);
    const hemY = d.hipJointY - d.thighLen * 0.62;
    // A-line flare with soft box pleats that open toward the hem.
    const cone = roundCone(v3(0, hemY, -0.012), top, d.hipHalfWidth + 0.1, d.waistHalfWidth + 0.016);
    const skirt: Sdf = (x, y, z) => {
      const ang = Math.atan2(x, z);
      const open = smoothstep(waistTop - 0.03, hemY, y);
      const pleat = 0.009 * 0.5 * (1 - Math.cos(ang * 16)) * open;
      const c = cone(x, y, z * 1.1) / 1.05 - pleat;
      return smax(c, hemY - y, 0.006);
    };
    sdf = (x, y, z) => smin(hips(x, y, z), skirt(x, y, z), 0.025);
    extraParts.push({ name: 'skirt', bone: 'hips', region: 'torso', sdf: (x, y, z) => cone(x, y, z * 1.1) });
  } else {
    sdf = composeBody(parts, {
      regions: ['torso', 'legL', 'legR'],
      exclude: LOWER_BODY_EXCLUDE,
      inflate,
      regionInflate: { legL: legLoose(looseness), legR: legLoose(looseness) },
      clip: { torso: waistCut, legL: legLength('L'), legR: legLength('R') },
      clipRound: 0.004,
    });
    // Elastic cuffs on joggers, turn-ups on shorts.
    const legL = regionDistance(parts, 'legL');
    const legR = regionDistance(parts, 'legR');
    const onLeg = (leg: Sdf, other: Sdf): Sdf => (x, y, z) => leg(x, y, z) - other(x, y, z);
    if (bottom === 'joggers') {
      sdf = withBand(sdf, legLength('L'), 0.016, -0.004, onLeg(legL, legR));
      sdf = withBand(sdf, legLength('R'), 0.016, -0.004, onLeg(legR, legL));
    } else {
      sdf = withBand(sdf, legLength('L'), 0.01, 0.002, onLeg(legL, legR));
      sdf = withBand(sdf, legLength('R'), 0.01, 0.002, onLeg(legR, legL));
    }
  }
  // Waistband.
  sdf = withBand(sdf, waistCut, 0.018, 0.003);

  // Every top covers the waistband (none are tucked in), so no belt details.
  const details: GarmentDetail[] = [];

  return {
    sdf,
    min: [-0.3, 0.05, -0.24],
    max: [0.3, waistTop + 0.04, 0.24],
    weightParts: [...parts.filter((p) => p.region === 'torso' || p.region === 'legL' || p.region === 'legR'), ...extraParts],
    details,
  };
}

// ─── Shoes ───────────────────────────────────────────────────────────────────

/**
 * Shoe in the foot bone's local frame: origin at the ankle, toes toward +Z,
 * sole resting on y = -ankleY (the floor). Material slots: 0 = upper,
 * 1 = sole, 2 = accent (laces, stripes, straps).
 */
export function shoeSpec(shoes: Shoes, d: AvatarDims): { sdf: Sdf; materialOf: (x: number, y: number, z: number) => number; min: [number, number, number]; max: [number, number, number] } {
  const floor = -d.ankleY;
  const soleH = shoes === 'running' ? 0.032 : shoes === 'boots' ? 0.03 : shoes === 'loafers' ? 0.016 : 0.026;
  const len = 0.118; // toe distance in front of the ankle
  const heel = 0.05; // heel distance behind the ankle
  const halfW = 0.044;

  // Sole bottom sits 1 mm above the floor so meshing tolerance never dips below it.
  const sole = roundBox(v3(0, floor + 0.001 + soleH / 2, (len - heel) / 2), halfW, soleH / 2, (len + heel) / 2, Math.min(0.012, soleH / 2 - 0.001));
  const toeBox = ellipsoid(v3(0, floor + soleH + 0.012, len * 0.62), halfW * 0.92, 0.032, len * 0.42);
  const midFoot = ellipsoid(v3(0, floor + soleH + 0.03, len * 0.15), halfW * 0.98, 0.045, 0.08);
  const heelCup = ellipsoid(v3(0, floor + soleH + 0.032, -heel * 0.45), halfW * 0.92, 0.05, 0.055);
  const shaftTop = shoes === 'boots' ? 0.085 : shoes === 'loafers' ? -0.035 : -0.006;
  const collar = roundCone(v3(0, floor + soleH + 0.02, -0.008), v3(0, shaftTop, -0.012), 0.05, d.ankleRadius + 0.012);

  const upper: Sdf = (x, y, z) => {
    let u = smin(toeBox(x, y, z), midFoot(x, y, z), 0.03);
    u = smin(u, heelCup(x, y, z), 0.025);
    u = smin(u, collar(x, y, z), 0.02);
    // Never below the top of the sole (the floor stays at y = -ankleY).
    u = smax(u, floor + soleH * 0.6 - y, 0.004);
    // Opening for the ankle.
    return smax(u, -(Math.hypot(x, z + 0.008) - (d.ankleRadius + 0.004)) - Math.max(0, shaftTop - 0.01 - y) * 10, 0.004);
  };
  const laces = shoes === 'loafers'
    ? roundBox(v3(0, floor + soleH + 0.046, len * 0.4), 0.024, 0.004, 0.016, 0.003)
    : capsule(v3(0, floor + soleH + 0.06, 0.012), v3(0, floor + soleH + 0.036, len * 0.55), 0.0075);

  const sdf: Sdf = (x, y, z) => {
    let s = Math.min(sole(x, y, z), upper(x, y, z) + 0.0005);
    s = smin(s, laces(x, y, z), 0.004);
    return s;
  };
  // Zones: 0 upper, 1 sole, 2 accent (laces, running stripe). Continuous values
  // around each boundary keep colour edges smooth.
  const materialOf = (x: number, y: number, z: number) => {
    const sole = zoneFromDistance(y - (floor + soleH + 0.001), 0.008);
    let accent = zoneFromDistance(laces(x, y, z) - 0.003, 0.008);
    if (shoes === 'running') {
      const stripe = Math.max(Math.abs(Math.abs(x) - halfW * 0.9) - 0.008, y - (floor + soleH + 0.035), -0.02 - z);
      accent = Math.max(accent, zoneFromDistance(stripe, 0.008));
    }
    return accent > 0.5 ? 1 + accent : sole;
  };
  return {
    sdf,
    materialOf,
    min: [-0.07, floor - 0.01, -heel - 0.03],
    max: [0.07, Math.max(shaftTop, 0) + 0.04, len + 0.03],
  };
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/** z of the front surface of a field at (x, y), tracing from the front. */
export function frontSurfaceZ(sdf: Sdf, x: number, y: number, front = 0.35): number | null {
  let z = front;
  for (let i = 0; i < 120; i++) {
    const dist = sdf(x, y, z);
    if (dist < 0.0003) return z;
    z -= Math.max(dist * 0.9, 0.0005);
    if (z < -0.3) return null;
  }
  return null;
}

/** Bind-pose world position of a bone (re-exported for builders). */
export { bonePoint };
