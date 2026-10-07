import { type Sdf, v3, ellipsoid, roundCone, smin } from '../sdf/sdf';
import type { AvatarDims } from './anatomy';

/** Stylized hands read better slightly larger than life. */
const HAND_SCALE = 1.2;

/**
 * A relaxed stylized hand in the hand bone's local frame: origin at the
 * wrist, fingers toward -Y, thumb toward +Z (forward). `side` is +1 for the
 * left hand and -1 for the right; the palm faces the body (-side * X).
 */
export function handSdf(d: AvatarDims, side: 1 | -1): Sdf {
  const s = (d.wristRadius / 0.026) * HAND_SCALE; // scale with the forearm
  const palmIn = -side; // direction the palm faces, along X

  const wrist = ellipsoid(v3(0, -0.006 * s, 0), 0.0165 * s, 0.016 * s, 0.024 * s);
  const palm = ellipsoid(v3(palmIn * 0.001, -0.044 * s, 0.002 * s), 0.0158 * s, 0.04 * s, 0.035 * s);
  const thenar = ellipsoid(v3(palmIn * 0.006 * s, -0.034 * s, 0.022 * s), 0.0125 * s, 0.022 * s, 0.014 * s);

  // Fingers: index (front) to little finger (back), slightly curled toward the palm.
  const fingerZ = [0.0245, 0.0082, -0.0082, -0.0238];
  const fingerLen = [0.044, 0.049, 0.046, 0.036];
  const fingerR = [0.0079, 0.0081, 0.0077, 0.0068];
  const fingers: Sdf[] = fingerZ.map((z, i) => {
    const len = fingerLen[i] * s;
    const r = fingerR[i] * s;
    const knuckle = v3(0, -0.076 * s, z * s);
    const mid = v3(palmIn * 0.004 * s, knuckle.y - len * 0.55, z * s);
    const tip = v3(palmIn * 0.013 * s, knuckle.y - len, z * s * 0.96);
    const a = roundCone(knuckle, mid, r, r * 0.95);
    const b = roundCone(mid, tip, r * 0.95, r * 0.86);
    return (x, y, zz) => Math.min(a(x, y, zz), b(x, y, zz));
  });

  const thumbBase = v3(palmIn * 0.004 * s, -0.024 * s, 0.03 * s);
  const thumbMid = v3(palmIn * 0.01 * s, -0.048 * s, 0.045 * s);
  const thumbTip = v3(palmIn * 0.019 * s, -0.066 * s, 0.048 * s);
  const thumbA = roundCone(thumbBase, thumbMid, 0.0102 * s, 0.0092 * s);
  const thumbB = roundCone(thumbMid, thumbTip, 0.0092 * s, 0.0082 * s);

  return (x, y, z) => {
    let core = smin(wrist(x, y, z), palm(x, y, z), 0.012);
    core = smin(core, thenar(x, y, z), 0.01);
    // Fingers join the palm smoothly but stay separate from each other.
    let f = Infinity;
    for (let i = 0; i < fingers.length; i++) {
      const fd = smin(core, fingers[i](x, y, z), 0.007);
      if (fd < f) f = fd;
    }
    const thumb = Math.min(thumbA(x, y, z), thumbB(x, y, z));
    return Math.min(f, smin(core, thumb, 0.009));
  };
}

/** Bounds of the hand in its local frame, for meshing. */
export function handBounds(d: AvatarDims): { min: [number, number, number]; max: [number, number, number] } {
  const s = (d.wristRadius / 0.026) * HAND_SCALE;
  return { min: [-0.035 * s, -0.135 * s, -0.045 * s], max: [0.035 * s, 0.02 * s, 0.07 * s] };
}
