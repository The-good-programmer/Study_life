/**
 * Signed distance field (SDF) primitives and operators used to sculpt the
 * avatar. Every shape is a function (x, y, z) => signed distance in metres:
 * negative inside, positive outside. Shapes are combined with smooth unions
 * so the body reads as one continuous, sculpted surface.
 */

export type Sdf = (x: number, y: number, z: number) => number;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Math.hypot is notoriously slow in V8; these are hot paths. */
export const len3 = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z);
export const len2 = (x: number, y: number) => Math.sqrt(x * x + y * y);

// ─── Primitives ──────────────────────────────────────────────────────────────

export function sphere(c: Vec3, r: number): Sdf {
  return (x, y, z) => len3(x - c.x, y - c.y, z - c.z) - r;
}

/**
 * Ellipsoid (Inigo Quilez's bound-corrected approximation). Accurate near the
 * surface, which is all the mesher and the smooth unions need.
 */
export function ellipsoid(c: Vec3, rx: number, ry: number, rz: number): Sdf {
  return (x, y, z) => {
    const px = (x - c.x) / rx;
    const py = (y - c.y) / ry;
    const pz = (z - c.z) / rz;
    const k0 = len3(px, py, pz);
    const k1 = len3(px / rx, py / ry, pz / rz);
    return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
  };
}

/** Capsule with a different radius at each end (a "round cone"). */
export function roundCone(a: Vec3, b: Vec3, ra: number, rb: number): Sdf {
  const bax = b.x - a.x;
  const bay = b.y - a.y;
  const baz = b.z - a.z;
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = ra - rb;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  return (x, y, z) => {
    const pax = x - a.x;
    const pay = y - a.y;
    const paz = z - a.z;
    const yy = pax * bax + pay * bay + paz * baz;
    const zz = yy - l2;
    const qx = pax * l2 - bax * yy;
    const qy = pay * l2 - bay * yy;
    const qz = paz * l2 - baz * yy;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = yy * yy * l2;
    const z2 = zz * zz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - ra;
  };
}

export function capsule(a: Vec3, b: Vec3, r: number): Sdf {
  return roundCone(a, b, r, r);
}

/** Axis-aligned rounded box centred at c with half-extents (hx, hy, hz). */
export function roundBox(c: Vec3, hx: number, hy: number, hz: number, r: number): Sdf {
  return (x, y, z) => {
    const qx = Math.abs(x - c.x) - hx + r;
    const qy = Math.abs(y - c.y) - hy + r;
    const qz = Math.abs(z - c.z) - hz + r;
    const ox = Math.max(qx, 0);
    const oy = Math.max(qy, 0);
    const oz = Math.max(qz, 0);
    return len3(ox, oy, oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
  };
}

/** Torus lying in the XZ plane (ring around the Y axis), centred at c. */
export function torusY(c: Vec3, major: number, minor: number): Sdf {
  return (x, y, z) => {
    const q = len2(x - c.x, z - c.z) - major;
    return len2(q, y - c.y) - minor;
  };
}

/** Signed distance to the plane through p with normal n (positive on the n side). */
export function plane(p: Vec3, n: Vec3): Sdf {
  const len = Math.hypot(n.x, n.y, n.z);
  const nx = n.x / len;
  const ny = n.y / len;
  const nz = n.z / len;
  return (x, y, z) => (x - p.x) * nx + (y - p.y) * ny + (z - p.z) * nz;
}

// ─── Operators ───────────────────────────────────────────────────────────────

/** Polynomial smooth minimum: blends two surfaces within distance k. */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = clamp01(0.5 + (0.5 * (b - a)) / k);
  return b + (a - b) * h - k * h * (1 - h);
}

/** Smooth maximum (smooth intersection / subtraction). */
export function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k);
}

export function union(...shapes: Sdf[]): Sdf {
  return (x, y, z) => {
    let d = Infinity;
    for (let i = 0; i < shapes.length; i++) {
      const v = shapes[i](x, y, z);
      if (v < d) d = v;
    }
    return d;
  };
}

export function smoothUnion(k: number, ...shapes: Sdf[]): Sdf {
  return (x, y, z) => {
    let d = shapes[0](x, y, z);
    for (let i = 1; i < shapes.length; i++) d = smin(d, shapes[i](x, y, z), k);
    return d;
  };
}

/** a with b carved out, blended over k. */
export function smoothSubtract(a: Sdf, b: Sdf, k: number): Sdf {
  return (x, y, z) => smax(a(x, y, z), -b(x, y, z), k);
}

export function intersect(a: Sdf, b: Sdf, k = 0): Sdf {
  return (x, y, z) => (k > 0 ? smax(a(x, y, z), b(x, y, z), k) : Math.max(a(x, y, z), b(x, y, z)));
}

/** Grows (positive t) or shrinks a shape uniformly. Used to make clothing shells. */
export function inflate(a: Sdf, t: number): Sdf {
  return (x, y, z) => a(x, y, z) - t;
}

/** Mirrors a shape across the YZ plane (x = 0), giving a symmetric pair. */
export function mirrorX(a: Sdf): Sdf {
  return (x, y, z) => a(Math.abs(x), y, z);
}

/** Evaluates shape in a frame rotated by `angle` around the Y axis about pivot. */
export function rotateY(a: Sdf, pivot: Vec3, angle: number): Sdf {
  const c = Math.cos(-angle);
  const s = Math.sin(-angle);
  return (x, y, z) => {
    const dx = x - pivot.x;
    const dz = z - pivot.z;
    return a(pivot.x + dx * c + dz * s, y, pivot.z - dx * s + dz * c);
  };
}

/** Evaluates shape in a frame rotated by `angle` around the X axis about pivot. */
export function rotateX(a: Sdf, pivot: Vec3, angle: number): Sdf {
  const c = Math.cos(-angle);
  const s = Math.sin(-angle);
  return (x, y, z) => {
    const dy = y - pivot.y;
    const dz = z - pivot.z;
    return a(x, pivot.y + dy * c - dz * s, pivot.z + dy * s + dz * c);
  };
}

/** Evaluates shape in a frame rotated by `angle` around the Z axis about pivot. */
export function rotateZ(a: Sdf, pivot: Vec3, angle: number): Sdf {
  const c = Math.cos(-angle);
  const s = Math.sin(-angle);
  return (x, y, z) => {
    const dx = x - pivot.x;
    const dy = y - pivot.y;
    return a(pivot.x + dx * c - dy * s, pivot.y + dx * s + dy * c, z);
  };
}
