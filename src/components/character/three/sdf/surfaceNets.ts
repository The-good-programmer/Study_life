import type { Sdf } from './sdf';

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  /** Per-vertex ambient occlusion in [0, 1] (1 = fully open), if requested. */
  ao?: Float32Array;
}

export interface MeshOptions {
  /** World-space bounds to mesh. The shape must lie strictly inside them. */
  min: [number, number, number];
  max: [number, number, number];
  /** Grid spacing in metres. Smaller is smoother and slower. */
  cellSize: number;
  /** Newton steps that pull each vertex onto the true surface (default 1). */
  projectionSteps?: number;
  /**
   * Bake ambient occlusion by sampling a field along each normal. `sdf`
   * defaults to the meshed shape; pass a larger scene field to also catch
   * occlusion from neighbouring shapes.
   */
  ao?: { sdf?: Sdf; distance?: number; strength?: number };
}

const BLOCK = 4; // cells per side of a coarse block used to skip empty space

/**
 * Converts a signed distance field into a smooth triangle mesh using naive
 * surface nets. Empty space is skipped with a coarse block test so only the
 * thin band around the surface is sampled at full resolution; vertices are
 * then projected onto the surface and given analytic (gradient) normals.
 */
export function meshSdf(sdf: Sdf, opts: MeshOptions): MeshData {
  const h = opts.cellSize;
  const [x0, y0, z0] = opts.min;
  const nx = Math.ceil((opts.max[0] - x0) / h) + 1;
  const ny = Math.ceil((opts.max[1] - y0) / h) + 1;
  const nz = Math.ceil((opts.max[2] - z0) / h) + 1;
  const sx = 1;
  const sy = nx;
  const sz = nx * ny;

  const values = new Float32Array(nx * ny * nz).fill(NaN);
  const sample = (i: number, j: number, k: number) => {
    const idx = i * sx + j * sy + k * sz;
    let v = values[idx];
    if (v !== v) {
      v = sdf(x0 + i * h, y0 + j * h, z0 + k * h);
      values[idx] = v;
    }
    return v;
  };

  // 1. Coarse pass: find blocks whose centre is close enough to hold surface.
  const bx = Math.ceil((nx - 1) / BLOCK);
  const by = Math.ceil((ny - 1) / BLOCK);
  const bz = Math.ceil((nz - 1) / BLOCK);
  const reach = Math.sqrt(3) * (BLOCK / 2) * h * 1.6 + h;
  const activeBlocks: number[] = [];
  for (let bk = 0; bk < bz; bk++) {
    for (let bj = 0; bj < by; bj++) {
      for (let bi = 0; bi < bx; bi++) {
        const cx = x0 + (bi + 0.5) * BLOCK * h;
        const cy = y0 + (bj + 0.5) * BLOCK * h;
        const cz = z0 + (bk + 0.5) * BLOCK * h;
        if (Math.abs(sdf(cx, cy, cz)) <= reach) activeBlocks.push(bi, bj, bk);
      }
    }
  }

  // 2. Fine pass: one vertex per cell that the surface crosses.
  const cellCount = (nx - 1) * (ny - 1) * (nz - 1);
  const cellVertex = new Int32Array(cellCount).fill(-1);
  const cx1 = nx - 1;
  const cxy1 = (nx - 1) * (ny - 1);
  const pos: number[] = [];
  const corner = new Float32Array(8);

  const cornerOffsets = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
    [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ];
  const edges = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];

  for (let b = 0; b < activeBlocks.length; b += 3) {
    const iStart = activeBlocks[b] * BLOCK;
    const jStart = activeBlocks[b + 1] * BLOCK;
    const kStart = activeBlocks[b + 2] * BLOCK;
    const iEnd = Math.min(iStart + BLOCK, nx - 1);
    const jEnd = Math.min(jStart + BLOCK, ny - 1);
    const kEnd = Math.min(kStart + BLOCK, nz - 1);
    for (let k = kStart; k < kEnd; k++) {
      for (let j = jStart; j < jEnd; j++) {
        for (let i = iStart; i < iEnd; i++) {
          let mask = 0;
          for (let c = 0; c < 8; c++) {
            const o = cornerOffsets[c];
            const v = sample(i + o[0], j + o[1], k + o[2]);
            corner[c] = v;
            if (v < 0) mask |= 1 << c;
          }
          if (mask === 0 || mask === 255) continue;

          let ax = 0, ay = 0, az = 0, n = 0;
          for (let e = 0; e < 12; e++) {
            const [ca, cb] = edges[e];
            const va = corner[ca];
            const vb = corner[cb];
            if ((va < 0) === (vb < 0)) continue;
            const t = va / (va - vb);
            const oa = cornerOffsets[ca];
            const ob = cornerOffsets[cb];
            ax += oa[0] + (ob[0] - oa[0]) * t;
            ay += oa[1] + (ob[1] - oa[1]) * t;
            az += oa[2] + (ob[2] - oa[2]) * t;
            n++;
          }
          cellVertex[i + j * cx1 + k * cxy1] = pos.length / 3;
          pos.push(x0 + (i + ax / n) * h, y0 + (j + ay / n) * h, z0 + (k + az / n) * h);
        }
      }
    }
  }

  // 3. Faces: every grid edge with a sign change becomes a quad of the four
  //    cells that share it.
  const idx: number[] = [];
  const cellAt = (i: number, j: number, k: number) =>
    i < 0 || j < 0 || k < 0 || i >= nx - 1 || j >= ny - 1 || k >= nz - 1
      ? -1
      : cellVertex[i + j * cx1 + k * cxy1];

  const pushQuad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    // Split along the shorter diagonal for better-shaped triangles.
    const dAC = dist2(pos, a, c);
    const dBD = dist2(pos, b, d);
    if (dAC <= dBD) {
      if (flip) idx.push(a, c, b, a, d, c);
      else idx.push(a, b, c, a, c, d);
    } else {
      if (flip) idx.push(a, d, b, b, d, c);
      else idx.push(a, b, d, b, c, d);
    }
  };

  for (let b = 0; b < activeBlocks.length; b += 3) {
    const iStart = activeBlocks[b] * BLOCK;
    const jStart = activeBlocks[b + 1] * BLOCK;
    const kStart = activeBlocks[b + 2] * BLOCK;
    const iEnd = Math.min(iStart + BLOCK, nx - 1);
    const jEnd = Math.min(jStart + BLOCK, ny - 1);
    const kEnd = Math.min(kStart + BLOCK, nz - 1);
    for (let k = kStart; k < kEnd; k++) {
      for (let j = jStart; j < jEnd; j++) {
        for (let i = iStart; i < iEnd; i++) {
          if (cellVertex[i + j * cx1 + k * cxy1] < 0) continue;
          const inside = values[i * sx + j * sy + k * sz] < 0;
          // Edge along +x from grid point (i, j, k)... handled from the cell
          // whose minimum corner is that point; neighbours in -y/-z share it.
          if (j > 0 && k > 0) {
            const vb = values[(i + 1) * sx + j * sy + k * sz];
            if (vb === vb && (vb < 0) !== inside) {
              pushQuad(cellAt(i, j - 1, k - 1), cellAt(i, j, k - 1), cellAt(i, j, k), cellAt(i, j - 1, k), !inside);
            }
          }
          if (i > 0 && k > 0) {
            const vb = values[i * sx + (j + 1) * sy + k * sz];
            if (vb === vb && (vb < 0) !== inside) {
              pushQuad(cellAt(i - 1, j, k - 1), cellAt(i - 1, j, k), cellAt(i, j, k), cellAt(i, j, k - 1), !inside);
            }
          }
          if (i > 0 && j > 0) {
            const vb = values[i * sx + j * sy + (k + 1) * sz];
            if (vb === vb && (vb < 0) !== inside) {
              pushQuad(cellAt(i - 1, j - 1, k), cellAt(i, j - 1, k), cellAt(i, j, k), cellAt(i - 1, j, k), !inside);
            }
          }
        }
      }
    }
  }

  // 4. Project vertices onto the surface and compute gradient normals. The
  //    gradient uses the tetrahedral 4-sample stencil (cheaper than 6).
  const positions = new Float32Array(pos);
  const normals = new Float32Array(positions.length);
  const steps = opts.projectionSteps ?? 1;
  const e = h * 0.35;
  for (let v = 0; v < positions.length; v += 3) {
    let px = positions[v];
    let py = positions[v + 1];
    let pz = positions[v + 2];
    let gx = 0, gy = 0, gz = 1;
    for (let s = 0; s <= steps; s++) {
      const a = sdf(px + e, py - e, pz - e);
      const b = sdf(px - e, py - e, pz + e);
      const c = sdf(px - e, py + e, pz - e);
      const dd = sdf(px + e, py + e, pz + e);
      gx = a - b - c + dd;
      gy = -a - b + c + dd;
      gz = -a + b - c + dd;
      const len = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
      gx /= len; gy /= len; gz /= len;
      if (s === steps) break;
      const dist = sdf(px, py, pz);
      // Clamp the step so a poorly-behaved field can never fling a vertex away.
      const step = Math.max(-h, Math.min(h, dist));
      px -= gx * step;
      py -= gy * step;
      pz -= gz * step;
    }
    positions[v] = px;
    positions[v + 1] = py;
    positions[v + 2] = pz;
    normals[v] = gx;
    normals[v + 1] = gy;
    normals[v + 2] = gz;
  }

  return {
    positions,
    normals,
    indices: new Uint32Array(idx),
    ao: opts.ao ? bakeOcclusion(positions, normals, opts.ao.sdf ?? sdf, opts.ao.distance ?? 0.03, opts.ao.strength ?? 1) : undefined,
  };
}

/**
 * Classic SDF ambient occlusion: step out along the normal and measure how
 * much closer the surrounding surface is than the step distance.
 */
function bakeOcclusion(p: Float32Array, n: Float32Array, sdf: Sdf, distance: number, strength: number): Float32Array {
  const out = new Float32Array(p.length / 3);
  const STEPS = 5;
  for (let v = 0; v < out.length; v++) {
    const x = p[v * 3], y = p[v * 3 + 1], z = p[v * 3 + 2];
    const nx = n[v * 3], ny = n[v * 3 + 1], nz = n[v * 3 + 2];
    let occ = 0;
    let w = 1;
    for (let i = 1; i <= STEPS; i++) {
      const h = (distance * i) / STEPS;
      const d = sdf(x + nx * h, y + ny * h, z + nz * h);
      occ += w * Math.max(0, h - d);
      w *= 0.62;
    }
    const a = 1 - (strength * occ * 2.6) / distance;
    out[v] = a < 0.3 ? 0.3 : a > 1 ? 1 : a;
  }
  return out;
}

function dist2(p: number[], a: number, b: number) {
  const dx = p[a * 3] - p[b * 3];
  const dy = p[a * 3 + 1] - p[b * 3 + 1];
  const dz = p[a * 3 + 2] - p[b * 3 + 2];
  return dx * dx + dy * dy + dz * dz;
}
