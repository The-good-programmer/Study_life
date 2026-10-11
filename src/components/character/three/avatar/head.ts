import type { CharacterMood } from '../../../../types/character';
import { type Sdf, v3, ellipsoid, sphere, capsule, roundCone, smin, smax, len3 } from '../sdf/sdf';
import type { AvatarDims } from './anatomy';
import { HEAD_BONE_Z } from './rig';

/**
 * The head is sculpted to adult human proportions in its own unscaled frame
 * (origin at the head bone, +Y up, +Z forward), then scaled by
 * AvatarDims.headScale. In this frame the head is ~0.305 tall: chin at
 * y ≈ -0.036, eyes at the vertical midpoint, crown at y ≈ 0.272. The face
 * follows the classic thirds (hairline → brow → nose base → chin), the
 * eyes are one eye-width apart, and the ears span brow to nose base.
 */
export interface HeadLayout {
  eyeY: number;
  eyeX: number;
  eyeZ: number;
  eyeR: number;
  browY: number;
  /** Lip parting line at the centre of the mouth (neutral). */
  mouthY: number;
  /** Front of the lips at the centre of the mouth. */
  lipZ: number;
  noseTipZ: number;
  crownY: number;
  earY: number;
  earZ: number;
  /** Radius of a sphere that encloses the cranium, used to size hats & hair. */
  craniumR: number;
  craniumCentre: [number, number, number];
}

export function headLayout(d: AvatarDims): HeadLayout {
  return {
    eyeY: 0.118,
    eyeX: d.eyeSpacing,
    eyeZ: 0.0745,
    eyeR: d.eyeRadius,
    browY: 0.147,
    mouthY: 0.034,
    lipZ: 0.116,
    noseTipZ: 0.137,
    crownY: 0.272,
    earY: 0.104,
    earZ: -0.024,
    craniumR: 0.13,
    craniumCentre: [0, 0.146, -0.012],
  };
}

/** Eyeball centres in head space, [left (+X), right (-X)]. */
export function eyeCentres(d: AvatarDims): [number, number, number][] {
  const L = headLayout(d);
  return [1, -1].map((side) => [side * L.eyeX, L.eyeY, L.eyeZ] as [number, number, number]);
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// ─── Expressions that change the sculpt ─────────────────────────────────────

/** Mouth and eye shape for a mood (the head is meshed per mood). */
export interface FaceShape {
  /** Opening between the lips at the centre (0 = closed). */
  gap: number;
  /** How far each mouth corner rises (left = +X side). */
  liftL: number;
  liftR: number;
  /** Mouth width multiplier. */
  width: number;
  /** Lower-lid raise (radians of eye opening): the squint of a real smile. */
  squint: number;
  /** Cheeks lifted by the smile. */
  cheekRaise: number;
  teeth: 'none' | 'upper' | 'both';
}

export const FACE_SHAPES: Record<CharacterMood, FaceShape> = {
  happy: { gap: 0.0032, liftL: 0.0058, liftR: 0.0058, width: 1.08, squint: 0.08, cheekRaise: 0.0035, teeth: 'upper' },
  energetic: { gap: 0.0075, liftL: 0.0072, liftR: 0.0072, width: 1.13, squint: 0.11, cheekRaise: 0.0045, teeth: 'both' },
  focused: { gap: 0, liftL: -0.0006, liftR: -0.0006, width: 0.98, squint: 0.03, cheekRaise: 0, teeth: 'none' },
  proud: { gap: 0, liftL: 0.0052, liftR: 0.0008, width: 1.02, squint: 0.04, cheekRaise: 0.0015, teeth: 'none' },
  zen: { gap: 0, liftL: 0.0026, liftR: 0.0026, width: 1.0, squint: 0.02, cheekRaise: 0.001, teeth: 'none' },
  sleepy: { gap: 0.0042, liftL: -0.001, liftR: -0.001, width: 0.78, squint: 0, cheekRaise: 0, teeth: 'upper' },
};

// ─── Eye opening ─────────────────────────────────────────────────────────────

/**
 * The almond-shaped opening between the lids, in angles around the eyeball
 * centre: azimuth (0 = straight ahead) and elevation. `u` runs across the
 * opening from the inner corner (-1) to the outer corner (+1).
 */
export interface EyeAperture {
  /** Azimuth (toward the outer corner) of the opening's centre and half-span. */
  azMid: number;
  azHalf: number;
  /** Elevation of the upper and lower lid edges at u. */
  upper: (u: number) => number;
  lower: (u: number) => number;
}

export function eyeAperture(d: AvatarDims, squint = 0): EyeAperture {
  const open = 1 + 0.05 * d.lashWeight; // a touch more open on feminine faces
  const tilt = 0.05 + 0.03 * d.lashWeight; // outer corner sits higher
  const up = 0.44 * open;
  const lo = 0.5 - squint;
  return {
    azMid: 0.08,
    azHalf: 1.0,
    upper: (u) => tilt * u + up * Math.pow(Math.max(0, 1 - u * u), 0.62) * (1 - 0.12 * u),
    lower: (u) => tilt * u - lo * Math.pow(Math.max(0, 1 - u * u), 0.85) * (1 + 0.12 * u),
  };
}

/** Angular coordinates of a point relative to an eye: [u, elevation, radius]. */
export function eyeAngles(ap: EyeAperture, side: number, px: number, py: number, pz: number): [number, number, number] {
  const r = len3(px, py, pz) || 1e-9;
  const az = Math.atan2(side * px, pz);
  const el = Math.asin(Math.max(-1, Math.min(1, py / r)));
  return [(az - ap.azMid) / ap.azHalf, el, r];
}

/** Angular distance outside the opening (negative inside). */
export function apertureDistance(ap: EyeAperture, u: number, el: number): number {
  return Math.max(el - ap.upper(u), ap.lower(u) - el, (Math.abs(u) - 1) * ap.azHalf);
}

// ─── Sculpt ──────────────────────────────────────────────────────────────────

/**
 * The cranium, grown by t. Slightly narrower at the temples than at the
 * back, like a real skull. Hair and hats are built around this.
 */
export function cranium(d: AvatarDims, t = 0, dy = 0): Sdf {
  const e = ellipsoid(v3(0, 0.146 + dy, -0.012), d.headWidth + 0.004 + t, 0.126 + t, 0.12 + t);
  return (x, y, z) => e(x * (1 + 0.06 * smoothstep(-0.02, 0.11, z)), y, z);
}

/** Lips and mouth shape (head space) for a mood. */
function mouthParts(d: AvatarDims, shape: FaceShape) {
  const L = headLayout(d);
  const hw = d.mouthHalfWidth * shape.width;
  const full = d.lipFullness;
  const gap = shape.gap;
  const lift = (x: number) => (x > 0 ? shape.liftL : shape.liftR) * Math.pow(Math.min(Math.abs(x) / hw, 1), 2);
  const lineY = (x: number) => L.mouthY + lift(x);
  // Lips wrap around the dental arch.
  const archZ = (x: number) => L.lipZ - 0.004 - 0.019 * Math.pow(x / hw, 2);

  const N = 8;
  const upperSegs: Sdf[] = [];
  const lowerSegs: Sdf[] = [];
  const pu: [number, number, number, number][] = [];
  const pl: [number, number, number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const x = -hw * 0.97 + (2 * hw * 0.97 * i) / N;
    const f = Math.sqrt(Math.max(0, 1 - Math.pow(x / hw, 2)));
    // Cupid's bow: the upper lip is fullest just off-centre.
    const bow = 1 + 0.12 * Math.exp(-Math.pow((Math.abs(x) - 0.0075) / 0.006, 2));
    const ru = (0.0043 * f * bow + 0.0011) * full;
    const rl = (0.0058 * f + 0.0012) * full;
    const z = archZ(x);
    pu.push([x, lineY(x) + gap / 2 + ru * 0.8, z - ru * 0.25, ru]);
    pl.push([x, lineY(x) - gap / 2 - rl * 0.78, z - rl * 0.35 - 0.0006, rl]);
  }
  for (let i = 0; i < N; i++) {
    const [ax, ay, az, ar] = pu[i], [bx, by, bz, br] = pu[i + 1];
    upperSegs.push(roundCone(v3(ax, ay, az), v3(bx, by, bz), ar, br));
    const [cx, cy, cz, cr] = pl[i], [ex, ey, ez, er] = pl[i + 1];
    lowerSegs.push(roundCone(v3(cx, cy, cz), v3(ex, ey, ez), cr, er));
  }
  const chain = (segs: Sdf[]): Sdf => (x, y, z) => {
    let v = segs[0](x, y, z);
    for (let i = 1; i < segs.length; i++) v = smin(v, segs[i](x, y, z), 0.0025);
    return v;
  };
  const upper = chain(upperSegs);
  const lower = chain(lowerSegs);

  // The parting between the lips (a crease when closed), and the mouth
  // interior behind it when open.
  const halfGap = Math.max(gap / 2, 0.0006);
  const slit: Sdf = (x, y, z) => Math.max(
    Math.abs(y - lineY(x)) - halfGap,
    Math.abs(x) - hw * 1.005,
    archZ(x) - (gap > 0 ? 0.03 : 0.0065) - z
  );
  const cavity = gap > 0
    ? ellipsoid(v3(0, L.mouthY, L.lipZ - 0.024), hw * 0.88, gap * 0.5 + 0.007, 0.022)
    : null;

  return { upper, lower, slit, cavity, hw, lineY, archZ };
}

function earSdf(d: AvatarDims, side: 1 | -1): Sdf {
  const L = headLayout(d);
  const cx = d.headWidth - 0.006, cy = L.earY, cz = L.earZ;
  // Ear-local: X out from the head, Y up, Z forward.
  const outer = ellipsoid(v3(0.004, 0.002, 0), 0.0065, 0.035, 0.021);
  const bowl = ellipsoid(v3(0.0105, 0.001, 0.002), 0.0062, 0.026, 0.0145);
  const concha = ellipsoid(v3(0.008, -0.006, 0.006), 0.0055, 0.011, 0.0085);
  const antihelix = capsule(v3(0.0068, 0.018, -0.007), v3(0.0068, -0.009, -0.003), 0.0026);
  const lobe = ellipsoid(v3(0.004, -0.029, 0.004), 0.006, 0.0105, 0.0105);
  const tragus = ellipsoid(v3(0.0052, -0.007, 0.0175), 0.0038, 0.0058, 0.0038);
  const root = ellipsoid(v3(-0.004, 0, 0.004), 0.008, 0.026, 0.014);
  const flare = -0.26, tilt = -0.2;
  const cf = Math.cos(-flare), sf = Math.sin(-flare);
  const ct = Math.cos(-tilt), st = Math.sin(-tilt);
  return (x, y, z) => {
    // Mirror to the left ear, then undo the ear's rotation (flare, tilt).
    const dx = side * x - cx, dy = y - cy, dz = z - cz;
    const qx = dx * cf + dz * sf;
    const qz1 = -dx * sf + dz * cf;
    const qy = dy * ct - qz1 * st;
    const qz = dy * st + qz1 * ct;
    let e = smax(outer(qx, qy, qz), -bowl(qx, qy, qz), 0.0022);
    e = smin(e, antihelix(qx, qy, qz), 0.003);
    e = smax(e, -concha(qx, qy, qz), 0.002);
    e = smin(e, lobe(qx, qy, qz), 0.005);
    e = smin(e, tragus(qx, qy, qz), 0.002);
    return smin(e, root(qx, qy, qz), 0.004);
  };
}

/**
 * The upper neck in head space: lets the jaw blend into the neck. Kept just
 * inside the body's neck so only the fillet under the jaw shows.
 */
function neckStub(d: AvatarDims): Sdf {
  const s = d.headScale;
  const toLocal = (y: number, z: number) => v3(0, (y - d.headOffset[1]) / s, (z - d.headOffset[2]) / s);
  // Must match neckUpper in body.ts, in the head bone's frame.
  const a = toLocal(0.04 - (d.headY - d.neckY), 0.004 - HEAD_BONE_Z);
  const b = toLocal(0.035, 0.004);
  const r = (d.neckRadius * 0.93) / s;
  const neck = capsule(a, b, r);
  return (x, y, z) => smax(neck(x, y, z), -0.07 - y, 0.004);
}

/**
 * Head shape with no eye openings or mouth: the face's surface that brows,
 * beards and stubble follow.
 */
export function headBaseSdf(d: AvatarDims, shape: FaceShape = FACE_SHAPES.focused): Sdf {
  const L = headLayout(d);
  const W = d.headWidth;
  const jw = d.jawWidth;
  const ns = d.noseSize;
  const sculptCranium = cranium(d);

  const cheekY = 0.096 + shape.cheekRaise;
  const midface = ellipsoid(v3(0, 0.086, 0.04), W * 0.78, 0.056, 0.062);
  const cheekL = ellipsoid(v3(W * 0.6, cheekY, 0.046), 0.03, 0.019, 0.034);
  const cheekR = ellipsoid(v3(-W * 0.6, cheekY, 0.046), 0.03, 0.019, 0.034);
  // Soft fat pads under the cheekbones that a smile pushes up.
  const appleR0 = 0.019 + 0.003 * d.lashWeight; // fuller cheeks on feminine faces
  const appleL = ellipsoid(v3(0.038, 0.08 + shape.cheekRaise * 1.4, 0.076), appleR0, 0.017 + shape.cheekRaise, appleR0);
  const appleR = ellipsoid(v3(-0.038, 0.08 + shape.cheekRaise * 1.4, 0.076), appleR0, 0.017 + shape.cheekRaise, appleR0);
  const brow = ellipsoid(v3(0, L.browY, 0.088), 0.058, 0.01 + d.browRidge, 0.019);
  // Buccal fullness below the cheekbones (keeps the face from looking gaunt).
  const buccalL = ellipsoid(v3(0.046, 0.06, 0.054), 0.02, 0.022, 0.026);
  const buccalR = ellipsoid(v3(-0.046, 0.06, 0.054), 0.02, 0.022, 0.026);
  const glabella = ellipsoid(v3(0, 0.137, 0.097), 0.015, 0.013, 0.011);

  // Mandible: the jawline from the angle of the jaw to the chin, and the ramus.
  // Feminine faces: a higher, softer jaw angle, a shorter, more tapered
  // lower face and a smaller chin. `rise` lifts the chin (keeping the lower
  // third of the face about as long as the middle third).
  const fem = d.lashWeight;
  const rise = 0.006 + 0.006 * fem;
  const jaw: Sdf[] = [];
  const jr = 0.0115 - 0.002 * fem;
  for (const s of [1, -1]) {
    const gonion = v3(s * (jw - 0.011), 0.026 + 0.008 * fem, -0.028);
    const chinSide = v3(s * (0.017 - 0.002 * fem), -0.026 + rise, 0.082);
    const tmj = v3(s * (W - 0.02), 0.082, -0.022);
    jaw.push(roundCone(gonion, chinSide, jr, jr));
    jaw.push(roundCone(tmj, gonion, 0.014, jr));
  }
  // The lower face narrows toward the chin (a U from the front, a V on feminine faces).
  const lowerFaceE = ellipsoid(v3(0, 0.024 + rise * 0.5, 0.04), jw * 0.8, 0.054 - rise * 0.5, 0.058);
  const taper = 0.45 + 0.1 * fem;
  const lowerFace: Sdf = (x, y, z) => lowerFaceE(x / (1 - taper * smoothstep(0.06, -0.03 + rise, y)), y, z);
  const chinW = 0.016 + 0.007 * (1 - d.chinRound);
  const chin = ellipsoid(v3(0, -0.017 + rise, 0.09 - 0.003 * fem), chinW, 0.018 - 0.002 * fem, 0.016);
  const muzzle = ellipsoid(v3(0, 0.048, 0.084), 0.031, 0.031, 0.03);

  // Nose: bridge, tip, wings and the columella under the tip.
  const tipY = 0.077 + 0.004 * d.lashWeight; // a shorter nose on feminine faces
  const bridge = roundCone(v3(0, 0.128, 0.097), v3(0, tipY + 0.009, L.noseTipZ - 0.011 * ns), 0.0058 * ns, 0.0072 * ns);
  const tip = ellipsoid(v3(0, tipY, L.noseTipZ - 0.0095 * ns), 0.0095 * ns, 0.0088 * ns, 0.0095 * ns);
  // The base of the nose: one wedge the wings flare out of (not separate balls).
  const noseBase = ellipsoid(v3(0, 0.0715, 0.117), 0.0165 * ns, 0.0085 * ns, 0.0105 * ns);
  const alaL = ellipsoid(v3(0.0122 * ns, 0.071, 0.111), 0.0058 * ns, 0.0064 * ns, 0.0078 * ns);
  const alaR = ellipsoid(v3(-0.0122 * ns, 0.071, 0.111), 0.0058 * ns, 0.0064 * ns, 0.0078 * ns);
  const columella = capsule(v3(0, 0.07, L.noseTipZ - 0.012 * ns), v3(0, 0.0655, 0.113), 0.004 * ns);
  const nostrilL = ellipsoid(v3(0.0068 * ns, 0.065, 0.1195), 0.0032 * ns, 0.0016 * ns, 0.0048 * ns);
  const nostrilR = ellipsoid(v3(-0.0068 * ns, 0.065, 0.1195), 0.0032 * ns, 0.0016 * ns, 0.0048 * ns);
  // Philtrum: two soft ridges from the nose to the cupid's bow.
  const philL = capsule(v3(0.0042, 0.062, 0.1115), v3(0.0055, 0.05, 0.1135), 0.0013);
  const philR = capsule(v3(-0.0042, 0.062, 0.1115), v3(-0.0055, 0.05, 0.1135), 0.0013);

  const earL = earSdf(d, 1);
  const earR = earSdf(d, -1);
  const neck = neckStub(d);

  return (x, y, z) => {
    let h = smin(sculptCranium(x, y, z), midface(x, y, z), 0.032);
    h = smin(h, lowerFace(x, y, z), 0.03);
    for (let i = 0; i < jaw.length; i++) h = smin(h, jaw[i](x, y, z), 0.022);
    h = smin(h, chin(x, y, z), 0.018);
    h = smin(h, muzzle(x, y, z), 0.022);
    h = smin(h, Math.min(cheekL(x, y, z), cheekR(x, y, z)), 0.022);
    h = smin(h, Math.min(appleL(x, y, z), appleR(x, y, z)), 0.02);
    h = smin(h, Math.min(buccalL(x, y, z), buccalR(x, y, z)), 0.02);
    h = smin(h, brow(x, y, z), 0.024);
    h = smin(h, glabella(x, y, z), 0.012);
    h = smin(h, bridge(x, y, z), 0.012);
    h = smin(h, tip(x, y, z), 0.008);
    h = smin(h, noseBase(x, y, z), 0.008);
    h = smin(h, Math.min(alaL(x, y, z), alaR(x, y, z)), 0.0045);
    h = smin(h, columella(x, y, z), 0.004);
    h = smax(h, -Math.min(nostrilL(x, y, z), nostrilR(x, y, z)), 0.0018);
    h = smin(h, Math.min(philL(x, y, z), philR(x, y, z)), 0.006);
    if (Math.abs(x) > 0.05) h = smin(h, Math.min(earL(x, y, z), earR(x, y, z)), 0.0045);
    if (y < 0.07) h = smin(h, neck(x, y, z), 0.009);
    return h;
  };
}

/**
 * The finished head for a mood: base shape plus lids around the eyes
 * (with the opening the eyeball shows through) and sculpted lips.
 */
export function headSdf(d: AvatarDims, mood: CharacterMood): Sdf {
  const shape = FACE_SHAPES[mood] ?? FACE_SHAPES.focused;
  const base = headBaseSdf(d, shape);
  const R = d.eyeRadius;
  const ap = eyeAperture(d, shape.squint);
  const eyes = eyeCentres(d);

  // Each eye: a recess under the brow, the eyelid mound over the eyeball,
  // the opening, and clearance for the eyeball to turn.
  const sockets = eyes.map(([x, y, z]) => ellipsoid(v3(x, y + 0.16 * R, z - 0.18 * R), 1.3 * R, 1.08 * R, 1.16 * R));
  const lidMounds = eyes.map(([x, y, z]) => ellipsoid(v3(x, y, z), 1.18 * R, 1.12 * R, 1.12 * R));
  const clearances = eyes.map(([x, y, z]) => sphere(v3(x, y, z), 1.012 * R));
  const opening = (i: number): Sdf => {
    const [cx, cy, cz] = eyes[i];
    const side = i === 0 ? 1 : -1;
    return (x, y, z) => {
      const [u, el, r] = eyeAngles(ap, side, x - cx, y - cy, z - cz);
      // Only cuts through the lid (not on into the brow, nose or cheek).
      return Math.max(apertureDistance(ap, u, el) * r, 0.55 * R - r, r - 1.32 * R);
    };
  };
  const openings = [opening(0), opening(1)];

  const mouth = mouthParts(d, shape);

  return (x, y, z) => {
    let h = base(x, y, z);
    // Eyes (only evaluated near them).
    const side = x > 0 ? 0 : 1;
    const [ex, ey, ez] = eyes[side];
    if (len3(x - ex, y - ey, z - ez) < 3 * R) {
      h = smax(h, -sockets[side](x, y, z), 0.007);
      h = smin(h, lidMounds[side](x, y, z), 0.0045);
      h = smax(h, -openings[side](x, y, z), 0.0011);
      h = smax(h, -clearances[side](x, y, z), 0.0008);
    }
    // Mouth (only evaluated near it).
    if (y < 0.075 && y > -0.005 && z > 0.055 && Math.abs(x) < 0.05) {
      h = smin(h, mouth.upper(x, y, z), 0.0035);
      h = smin(h, mouth.lower(x, y, z), 0.0035);
      h = smax(h, -mouth.slit(x, y, z), 0.0016);
      if (mouth.cavity) h = smax(h, -mouth.cavity(x, y, z), 0.003);
    }
    return h;
  };
}

/**
 * Where a beard grows (head space): positive inside, as a distance to its
 * edge. Higher at the sides (sideburns), down over the jaw and under it,
 * clear of the lips and nose.
 */
export function beardZone(d: AvatarDims): Sdf {
  const L = headLayout(d);
  const mouth = ellipsoid(v3(0, L.mouthY, L.lipZ - 0.004), d.mouthHalfWidth * 1.2, 0.0115, 0.03);
  const nose = ellipsoid(v3(0, 0.075, 0.12), 0.025, 0.016, 0.03);
  return (x, y, z) => {
    // The cheek line: from the sideburns down to the corners of the mouth.
    const top = 0.062 + 0.026 * smoothstep(0.03, 0.08, Math.abs(x)) + 0.035 * smoothstep(0.04, 0.0, z);
    const inside = Math.min(top - y, z + 0.028, y + 0.05);
    return Math.min(inside, mouth(x, y, z), nose(x, y, z));
  };
}

/**
 * Per-vertex skin tint for the head (multiplied into the skin colour): lip
 * colour, warmth on the cheeks, nose and ears, darker lids and lash line,
 * on masculine faces a faint shave shadow, and optionally stubble.
 */
export function headTint(d: AvatarDims, mood: CharacterMood, stubble = false): (x: number, y: number, z: number) => [number, number, number] {
  const beard = stubble ? beardZone(d) : null;
  const shape = FACE_SHAPES[mood] ?? FACE_SHAPES.focused;
  const mouth = mouthParts(d, shape);
  const R = d.eyeRadius;
  const ap = eyeAperture(d, shape.squint);
  const eyes = eyeCentres(d);
  const L = headLayout(d);
  const fem = d.lashWeight;
  const masc = d.gender === 'male' ? 1 : 0;
  const lip: [number, number, number] = fem > 0.5 ? [0.86, 0.6, 0.63] : [0.9, 0.7, 0.69];
  const g = (x: number, y: number, z: number, cx: number, cy: number, cz: number, s: number) =>
    Math.exp(-((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2) / (2 * s * s));

  return (x, y, z) => {
    let r = 1, gr = 1, b = 1;
    const mul = (w: number, c: [number, number, number]) => {
      if (w <= 0) return;
      r *= 1 + (c[0] - 1) * w;
      gr *= 1 + (c[1] - 1) * w;
      b *= 1 + (c[2] - 1) * w;
    };

    // Lips, with a soft border.
    if (y < 0.075 && y > -0.005 && z > 0.075 && Math.abs(x) < 0.04) {
      const ld = Math.min(mouth.upper(x, y, z), mouth.lower(x, y, z));
      mul(smoothstep(0.0016, -0.0004, ld) * smoothstep(-0.012, -0.004, z - mouth.archZ(x)), lip);
      // Inside the mouth.
      const inside = smoothstep(0.0006, -0.0008, mouth.slit(x, y, z)) * smoothstep(0.0, -0.004, z - mouth.archZ(x) + 0.001);
      mul(inside, [0.42, 0.2, 0.22]);
    }

    // Warmth: cheeks, nose tip and wings, chin, ears.
    for (const s of [1, -1]) mul(g(x, y, z, s * 0.05, 0.084, 0.084, 0.019) * (0.55 + 0.45 * fem), [1, 0.9, 0.88]);
    mul(g(x, y, z, 0, 0.075, 0.127, 0.013), [1, 0.9, 0.88]);
    mul(g(x, y, z, 0, -0.016, 0.098, 0.014) * 0.6, [1, 0.93, 0.92]);
    if (Math.abs(x) > d.headWidth - 0.02) {
      mul(g(Math.abs(x), y, z, d.headWidth + 0.01, L.earY, L.earZ, 0.026), [0.97, 0.84, 0.82]);
    }

    // Eyes: darker, slightly purple lids; the lash line along the upper lid;
    // the pink inner corner.
    for (let i = 0; i < 2; i++) {
      const [ex, ey, ez] = eyes[i];
      const px = x - ex, py = y - ey, pz = z - ez;
      if (len3(px, py, pz) > 2.6 * R) continue;
      const side = i === 0 ? 1 : -1;
      const [u, el, rad] = eyeAngles(ap, side, px, py, pz);
      const above = el - ap.upper(u);
      const below = ap.lower(u) - el;
      const within = Math.abs(u) < 1.08 ? 1 : 0;
      mul(smoothstep(0.75, 0.05, above) * smoothstep(-0.1, 0.05, above) * within * 0.7, [0.88, 0.82, 0.86]);
      // Lash line: the rim of the upper lid (and a lighter one below).
      const rim = smoothstep(1.24 * R, 1.06 * R, rad) * within;
      mul(rim * smoothstep(0.1, 0.0, Math.abs(above - 0.015)), [0.3, 0.24, 0.24]);
      mul(rim * smoothstep(0.08, 0.0, Math.abs(below - 0.01)) * 0.55, [0.62, 0.52, 0.52]);
      mul(smoothstep(0.08, 0.32, below) * smoothstep(0.75, 0.3, below) * within * 0.5, [0.94, 0.9, 0.93]);
      mul(smoothstep(-0.78, -1.02, u) * smoothstep(1.3 * R, 1.0 * R, rad), [1, 0.62, 0.64]);
    }

    // Stubble: short hairs darken the skin, densest on the jaw and chin,
    // with a fine grain and soft edges.
    if (beard && y < 0.13) {
      const inside = beard(x, y, z);
      if (inside > 0) {
        const grain = (Math.sin(x * 12989.8 + y * 78233.1 + z * 37719.3) * 43758.5453) % 1;
        const w = smoothstep(0, 0.02, inside) * (0.6 + 0.4 * smoothstep(0.075, 0.03, y)) * (0.7 + 0.3 * Math.abs(grain));
        mul(w, [0.74, 0.72, 0.74]);
      }
    } else if (masc && y < 0.075) {
      // Shave shadow on masculine faces (jaw, chin, upper lip).
      const jawZone = smoothstep(0.075, 0.04, y) * smoothstep(-0.05, -0.02, z) * (1 - g(x, y, z, 0, 0.032, 0.114, 0.012));
      mul(jawZone * 0.85, [0.93, 0.92, 0.95]);
    }
    return [r, gr, b];
  };
}

export function headBounds(): { min: [number, number, number]; max: [number, number, number] } {
  return { min: [-0.15, -0.082, -0.16], max: [0.15, 0.29, 0.165] };
}

/**
 * Sphere-traces from (x, y, +front) along -Z to the surface and returns the
 * hit z (or null). Used to stick brows onto the face.
 */
export function traceFront(sdf: Sdf, x: number, y: number, front = 0.25): number | null {
  let z = front;
  for (let i = 0; i < 128; i++) {
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
