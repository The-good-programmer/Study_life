import { type Sdf, v3, ellipsoid, sphere, capsule, smin, smax } from '../sdf/sdf';
import { type AvatarDims, EYE_DEPTH } from './anatomy';

/**
 * Key landmarks of the head, in the head bone's local frame (origin at the
 * top of the neck, +Y up, +Z forward). Face features are placed from these.
 */
export interface HeadLayout {
  eyeY: number;
  eyeX: number;
  eyeZ: number;
  eyeR: number;
  browY: number;
  mouthY: number;
  noseTipZ: number;
  crownY: number;
  /** Radius of a sphere that encloses the cranium, used to size hats & hair. */
  craniumR: number;
  craniumCentre: [number, number, number];
}

export function headLayout(d: AvatarDims): HeadLayout {
  return {
    eyeY: 0.119,
    eyeX: d.eyeSpacing,
    eyeZ: 0.087,
    eyeR: d.eyeRadius,
    browY: 0.166,
    mouthY: 0.062,
    noseTipZ: 0.128,
    crownY: 0.27,
    craniumR: 0.13,
    craniumCentre: [0, 0.146, -0.012],
  };
}

/** Head shape without eye sockets (used to place the eyes on the surface). */
export function headBaseSdf(d: AvatarDims): Sdf {
  const L = headLayout(d);
  // Stylized proportions: a large cranium over a small, soft lower face.
  const cranium = ellipsoid(v3(0, 0.146, -0.012), d.headWidth + 0.004, 0.126, 0.12);
  const face = ellipsoid(v3(0, 0.104, 0.022), d.headWidth * 0.84, 0.084, 0.098);
  const jaw = ellipsoid(v3(0, 0.066, 0.03), d.jawWidth * 0.9, d.jawLength * 0.86, 0.08);
  const chin = ellipsoid(v3(0, 0.04, 0.068), 0.026 + d.chinRound * 0.008, 0.021, 0.024);
  const cheekL = ellipsoid(v3(0.048, 0.09, 0.064), 0.034, 0.026, 0.032);
  const cheekR = ellipsoid(v3(-0.048, 0.09, 0.064), 0.034, 0.026, 0.032);
  const brow = ellipsoid(v3(0, 0.152, 0.088), 0.082, 0.012 + d.browRidge, 0.03);
  const ns = d.noseSize;
  const nose = ellipsoid(v3(0, 0.099, L.noseTipZ - 0.01 * ns), 0.0145 * ns, 0.016 * ns, 0.016 * ns);
  const nostrilL = sphere(v3(0.011 * ns, 0.093, L.noseTipZ - 0.02 * ns), 0.0085 * ns);
  const nostrilR = sphere(v3(-0.011 * ns, 0.093, L.noseTipZ - 0.02 * ns), 0.0085 * ns);
  const bridge = capsule(v3(0, 0.138, 0.104), v3(0, 0.106, L.noseTipZ - 0.016 * ns), 0.0062 * ns);

  // Ears with an inner fold.
  const earX = d.headWidth - 0.004;
  const earL = ellipsoid(v3(earX, 0.118, -0.01), 0.015, 0.03, 0.021);
  const earR = ellipsoid(v3(-earX, 0.118, -0.01), 0.015, 0.03, 0.021);
  const earCupL = ellipsoid(v3(earX + 0.011, 0.118, -0.006), 0.009, 0.019, 0.012);
  const earCupR = ellipsoid(v3(-earX - 0.011, 0.118, -0.006), 0.009, 0.019, 0.012);

  return (x, y, z) => {
    let h = smin(cranium(x, y, z), face(x, y, z), 0.03);
    h = smin(h, jaw(x, y, z), 0.035);
    h = smin(h, chin(x, y, z), 0.02);
    h = smin(h, Math.min(cheekL(x, y, z), cheekR(x, y, z)), 0.026);
    h = smin(h, brow(x, y, z), 0.022);
    h = smin(h, bridge(x, y, z), 0.012);
    h = smin(h, nose(x, y, z), 0.01);
    h = smin(h, Math.min(nostrilL(x, y, z), nostrilR(x, y, z)), 0.006);
    const ears = Math.min(
      smax(earL(x, y, z), -earCupL(x, y, z), 0.004),
      smax(earR(x, y, z), -earCupR(x, y, z), 0.004)
    );
    return smin(h, ears, 0.007);
  };
}

/** Final head shape: the base with shallow sockets where the eyeballs sit. */
export function headSdf(d: AvatarDims, eyeCentres: [number, number, number][]): Sdf {
  const base = headBaseSdf(d);
  // Sockets match the flattened eyeballs.
  // Wide enough that the eyelids (not the socket rim) frame the eye opening.
  const sockets = eyeCentres.map(([x, y, z]) => ellipsoid(v3(x, y, z), d.eyeRadius * 1.2, d.eyeRadius * 1.22, d.eyeRadius * EYE_DEPTH * 1.15));
  return (x, y, z) => {
    let h = base(x, y, z);
    for (const s of sockets) h = smax(h, -s(x, y, z), 0.008);
    return h;
  };
}

export function headBounds(): { min: [number, number, number]; max: [number, number, number] } {
  return { min: [-0.15, -0.01, -0.16], max: [0.15, 0.29, 0.16] };
}

/**
 * Sphere-traces from (x, y, +front) along -Z to the surface and returns the
 * hit z (or null). Used to stick eyes, brows and mouth onto the face.
 */
export function traceFront(sdf: Sdf, x: number, y: number, front = 0.25): number | null {
  let z = front;
  for (let i = 0; i < 96; i++) {
    const dist = sdf(x, y, z);
    if (dist < 0.0002) return z;
    z -= Math.max(dist * 0.9, 0.0004);
    if (z < -0.2) return null;
  }
  return null;
}

/** Outward unit normal of the field at a point (central differences). */
export function sdfNormal(sdf: Sdf, x: number, y: number, z: number, e = 0.001): [number, number, number] {
  const nx = sdf(x + e, y, z) - sdf(x - e, y, z);
  const ny = sdf(x, y + e, z) - sdf(x, y - e, z);
  const nz = sdf(x, y, z + e) - sdf(x, y, z - e);
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}
