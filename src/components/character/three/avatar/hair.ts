import * as THREE from 'three';
import type { HairStyle } from '../../../../types/character';
import {
  type Sdf, v3, ellipsoid, roundCone, capsule, torusY, smin, smax,
} from '../sdf/sdf';
import type { AvatarDims } from './anatomy';
import type { MeshSpec } from './meshSpec';

const HAIR_CELL = 0.0044;
const BOUNDS = { min: [-0.21, -0.2, -0.26] as [number, number, number], max: [0.21, 0.36, 0.2] as [number, number, number] };

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/**
 * How far hair extends above and around the cranium for each style, so hats
 * can sit on top of the hair rather than inside it.
 */
export function hairVolume(style: HairStyle): { lift: number; grow: number } {
  switch (style) {
    case 'curly-afro': return { lift: 0.05, grow: 0.06 };
    case 'spiky': return { lift: 0.022, grow: 0.016 };
    case 'side-part':
    case 'short-fade': return { lift: 0.022, grow: 0.014 };
    case 'bob-cut':
    case 'long-wavy': return { lift: 0.02, grow: 0.022 };
    case 'ponytail': return { lift: 0.012, grow: 0.012 };
    case 'buzz':
    default: return { lift: 0.004, grow: 0.004 };
  }
}

/** Cranium grown by t (approximate offset of the head ellipsoid). */
function skull(d: AvatarDims, t: number, dy = 0): Sdf {
  // Must match the cranium in head.ts.
  return ellipsoid(v3(0, 0.146 + dy, -0.012), d.headWidth + 0.004 + t, 0.126 + t, 0.12 + t);
}

/** Leaves the face, ears and neck clear. `fringeY` lets bangs cover the forehead. */
function hairMasks(d: AvatarDims, opts: { fringeY?: number; nape?: number; coverEars?: boolean } = {}): Sdf {
  const face = ellipsoid(v3(0, 0.098, 0.112), 0.1, 0.128, 0.098);
  const earL = ellipsoid(v3(d.headWidth, 0.115, -0.01), 0.026, 0.038, 0.032);
  const earR = ellipsoid(v3(-d.headWidth, 0.115, -0.01), 0.026, 0.038, 0.032);
  const nape = opts.nape ?? 0.07;
  return (x, y, z) => {
    // Positive where hair is allowed: outside the face, ears and below the hairline.
    let allow = face(x, y, z);
    if (opts.fringeY !== undefined && y > opts.fringeY) allow = Math.max(allow, y - opts.fringeY);
    if (!opts.coverEars) allow = Math.min(allow, Math.min(earL(x, y, z), earR(x, y, z)));
    // Hairline at the sides and back: higher in front of the ears.
    const lowY = nape + 0.045 * smoothstep(-0.04, 0.05, z);
    allow = Math.min(allow, y - lowY);
    return allow;
  };
}

// Hair flows outward from a crown point at the top-back of the head.
const CROWN_AXIS = new THREE.Vector3(0, 0.95, -0.32).normalize();
const AXIS_U = new THREE.Vector3(1, 0, 0);
const AXIS_V = new THREE.Vector3().crossVectors(CROWN_AXIS, AXIS_U).normalize();
const HEAD_CENTRE = new THREE.Vector3(0, 0.146, -0.012);

/** Angle of a point around the crown axis: constant along lines of hair flow. */
function flowAngle(x: number, y: number, z: number) {
  const px = x - HEAD_CENTRE.x, py = y - HEAD_CENTRE.y, pz = z - HEAD_CENTRE.z;
  const u = px * AXIS_U.x + py * AXIS_U.y + pz * AXIS_U.z;
  const v = px * AXIS_V.x + py * AXIS_V.y + pz * AXIS_V.z;
  return Math.atan2(u, v);
}

/**
 * Surface detail that follows the hair flow: broad sculpted clumps (the
 * stylized-game look) plus faint fine strands.
 */
const strands = (amp: number, freq: number): Sdf => (x, y, z) => {
  const a = flowAngle(x, y, z);
  const clump = Math.sin(a * 11 + 0.6 * Math.sin(a * 5));
  return amp * 1.6 * clump * Math.abs(clump) + amp * 0.3 * Math.sin(a * freq * 1.2);
};

/**
 * Hair hugging the skull with the given thickness. It thins out over the
 * last ~2 cm before the hairline so the edge reads as hair, not a headband.
 */
function shell(d: AvatarDims, thickness: (x: number, y: number, z: number) => number, masks: Sdf, groove = 0.0012): Sdf {
  const base = skull(d, 0);
  const lines = strands(groove, 64);
  return (x, y, z) => {
    const m = masks(x, y, z);
    const taper = 0.2 + 0.8 * smoothstep(0, 0.022, m);
    const hair = base(x, y, z) - thickness(x, y, z) * taper + lines(x, y, z) * taper;
    return smax(hair, -m, 0.004);
  };
}

function styleSdf(style: HairStyle, d: AvatarDims): Sdf {
  switch (style) {
    case 'buzz':
      return shell(d, () => 0.0035, hairMasks(d, { nape: 0.08 }), 0.0004);

    case 'short-fade': {
      const masks = hairMasks(d, { nape: 0.085 });
      const quiff = ellipsoid(v3(0, 0.248, 0.04), 0.055, 0.024, 0.045);
      // Short sides, volume on top, thin at the front hairline (no bowl overhang).
      const base = shell(d, (_x, y, z) => 0.004 + 0.017 * smoothstep(0.1, 0.26, y) * (1 - 0.65 * smoothstep(0.03, 0.11, z)), masks);
      // A few fringe locks sweeping across the forehead break up the silhouette.
      const locks = [
        roundCone(v3(-0.03, 0.245, 0.075), v3(0.03, 0.205, 0.112), 0.016, 0.004),
        roundCone(v3(0.0, 0.25, 0.07), v3(0.055, 0.212, 0.1), 0.015, 0.004),
        roundCone(v3(-0.055, 0.235, 0.07), v3(-0.012, 0.2, 0.113), 0.014, 0.0035),
      ];
      return (x, y, z) => {
        let h = smin(base(x, y, z), smax(quiff(x, y, z), -masks(x, y, z), 0.006), 0.02);
        for (const l of locks) h = smin(h, l(x, y, z), 0.01);
        return h;
      };
    }

    case 'side-part': {
      const masks = hairMasks(d, { nape: 0.08 });
      const sweep = ellipsoid(v3(-0.03, 0.245, 0.04), 0.08, 0.032, 0.065);
      const part = capsule(v3(0.042, 0.27, 0.09), v3(0.05, 0.27, -0.06), 0.004);
      const base = shell(d, (_x, y, z) => 0.006 + 0.015 * smoothstep(0.1, 0.25, y) * (1 - 0.55 * smoothstep(0.03, 0.11, z)), masks);
      return (x, y, z) => {
        const h = smin(base(x, y, z), smax(sweep(x, y, z), -masks(x, y, z), 0.006), 0.025);
        return smax(h, -part(x, y, z), 0.004);
      };
    }

    case 'spiky': {
      const masks = hairMasks(d, { nape: 0.085 });
      const base = shell(d, (_x, y) => 0.006 + 0.01 * smoothstep(0.12, 0.2, y), masks, 0.0008);
      const spikes: Sdf[] = [];
      const centre = new THREE.Vector3(0, 0.142, -0.012);
      const dirs = [
        [0, 1, 0.55], [0.5, 0.9, 0.35], [-0.5, 0.9, 0.35], [0.3, 1, -0.2], [-0.3, 1, -0.2],
        [0, 0.85, -0.6], [0.7, 0.6, -0.15], [-0.7, 0.6, -0.15], [0.15, 1, 0.15], [-0.2, 0.95, 0.05],
      ];
      for (const [dx, dy, dz] of dirs) {
        const dir = new THREE.Vector3(dx, dy, dz).normalize();
        const start = centre.clone().addScaledVector(dir, 0.1);
        const tip = centre.clone().addScaledVector(dir, 0.165).add(new THREE.Vector3(0, 0, -0.02));
        spikes.push(roundCone(v3(start.x, start.y, start.z), v3(tip.x, tip.y, tip.z), 0.024, 0.004));
      }
      return (x, y, z) => {
        let h = base(x, y, z);
        for (const s of spikes) h = smin(h, s(x, y, z), 0.012);
        return smax(h, -masks(x, y, z), 0.005);
      };
    }

    case 'curly-afro': {
      const masks = hairMasks(d, { nape: 0.07, coverEars: true });
      const volume = ellipsoid(v3(0, 0.168, -0.022), d.headWidth + 0.062, 0.162, 0.168);
      const face = ellipsoid(v3(0, 0.07, 0.13), 0.1, 0.13, 0.1);
      return (x, y, z) => {
        const curls = 0.0075 * (Math.sin(x * 95) * Math.sin(y * 95 + 1.3) * Math.sin(z * 95 + 2.1)) +
          0.004 * Math.sin(x * 190 + y * 170) * Math.sin(z * 180);
        let h = volume(x, y, z) + curls;
        h = smax(h, -face(x, y, z), 0.02);
        return smax(h, -masks(x, y, z) - 0.02, 0.01);
      };
    }

    case 'bob-cut': {
      const masks = hairMasks(d, { fringeY: 0.168, nape: 0.035, coverEars: true });
      const cap = skull(d, 0.02);
      // A rounded, mushroom-like bob that curves back in toward the jaw.
      const volume = ellipsoid(v3(0, 0.14, -0.014), d.headWidth + 0.034, 0.152, 0.146);
      const lines = strands(0.0008, 60);
      return (x, y, z) => {
        const tuck = 0.012 * smoothstep(0.11, 0.05, y);
        let h = smin(cap(x, y, z), volume(x, y, z) + tuck, 0.03) + lines(x, y, z);
        // Clean bottom edge (the masks give the straight fringe).
        h = smax(h, 0.045 - y - 0.012 * smoothstep(0.08, 0.13, Math.hypot(x, z)), 0.008);
        return smax(h, -masks(x, y, z), 0.006);
      };
    }

    case 'long-wavy': {
      const masks = hairMasks(d, { fringeY: 0.19, nape: -0.06, coverEars: true });
      const cap = skull(d, 0.018);
      const curtain = roundCone(v3(0, -0.07, -0.06), v3(0, 0.2, -0.015), d.headWidth + 0.016, d.headWidth + 0.02);
      const sweep = ellipsoid(v3(0.035, 0.21, 0.07), 0.07, 0.03, 0.05);
      const lines = strands(0.0012, 70);
      return (x, y, z) => {
        const wave = 0.007 * Math.sin(y * 55 + Math.atan2(x, z) * 3) * smoothstep(0.15, 0.0, y);
        let c = curtain(x, y, z) - wave;
        // Below the jaw the hair falls behind the shoulders (faded in smoothly).
        const behind = smoothstep(0.08, 0.02, y);
        c = smax(c, z + 0.035 - (y - 0.05) * 0.3 - (1 - behind) * 0.5, 0.02);
        let h = smin(cap(x, y, z), c, 0.03);
        h = smin(h, sweep(x, y, z), 0.02) + lines(x, y, z);
        h = smax(h, -0.09 - y, 0.01); // tips
        return smax(h, -masks(x, y, z), 0.006);
      };
    }

    case 'ponytail':
    default:
      // Sleek cap; the tail itself is a separate swaying mesh.
      return shell(d, (_x, y) => 0.008 + 0.006 * smoothstep(0.12, 0.22, y), hairMasks(d, { nape: 0.075 }), 0.0014);
  }
}

/** The ponytail tail in a frame pivoting at the hair tie. */
function ponytailSdf(): Sdf {
  const a = roundCone(v3(0, 0, 0), v3(0, -0.035, -0.045), 0.024, 0.03);
  const b = roundCone(v3(0, -0.035, -0.045), v3(0, -0.12, -0.05), 0.03, 0.022);
  const c = roundCone(v3(0, -0.12, -0.05), v3(0, -0.2, -0.03), 0.022, 0.006);
  const lines = strands(0.0012, 40);
  return (x, y, z) => smin(smin(a(x, y, z), b(x, y, z), 0.02), c(x, y, z), 0.02) + lines(x, y, z);
}

const tieMaterial = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5 });

export const PONYTAIL_PIVOT = new THREE.Vector3(0, 0.168, -0.128);

/** Separately meshed pieces of a hairstyle. */
export type HairPart = 'main' | 'ponytail-tail' | 'ponytail-tie';

export function hairParts(style: HairStyle): HairPart[] {
  return style === 'ponytail' ? ['main', 'ponytail-tail', 'ponytail-tie'] : ['main'];
}

/** What to mesh for one piece of a hairstyle (head-bone space). */
export function hairMeshSpec(style: HairStyle, part: HairPart, d: AvatarDims): MeshSpec {
  if (part === 'ponytail-tail') {
    return { sdf: ponytailSdf(), min: [-0.05, -0.23, -0.1], max: [0.05, 0.04, 0.04], cellSize: 0.0038, ao: { distance: 0.02 } };
  }
  if (part === 'ponytail-tie') {
    return { sdf: torusY(v3(0, 0, 0), 0.02, 0.007), min: [-0.04, -0.02, -0.04], max: [0.04, 0.02, 0.04], cellSize: 0.002 };
  }
  // Big volumes need fewer cells per centimetre to look smooth.
  const cell = style === 'curly-afro' || style === 'long-wavy' || style === 'bob-cut' ? HAIR_CELL * 1.3 : HAIR_CELL;
  return { sdf: styleSdf(style, d), ...BOUNDS, cellSize: cell, ao: { distance: 0.025 } };
}

/** Assembles a hairstyle (child of the head) from its meshed parts. */
export function assembleHair(
  style: HairStyle,
  geos: Partial<Record<HairPart, THREE.BufferGeometry>>,
  material: THREE.Material
): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `Hair_${style}`;
  const mesh = new THREE.Mesh(geos.main, material);
  mesh.castShadow = true;
  group.add(mesh);

  if (style === 'ponytail' && geos['ponytail-tail'] && geos['ponytail-tie']) {
    const pivot = new THREE.Group();
    pivot.name = 'PonytailPivot';
    pivot.position.copy(PONYTAIL_PIVOT);
    const tail = new THREE.Mesh(geos['ponytail-tail'], material);
    tail.castShadow = true;
    pivot.add(tail);
    const tie = new THREE.Mesh(geos['ponytail-tie'], tieMaterial);
    tie.rotation.x = Math.PI / 2 - 0.5;
    tie.position.set(0, -0.006, -0.01);
    pivot.add(tie);
    group.add(pivot);
  }
  return group;
}
