import { describe, it, expect } from 'vitest';
import { meshSdf } from './surfaceNets';
import { sphere, capsule, smoothUnion, v3, roundCone, ellipsoid } from './sdf';

function faceNormalsPointOutward(mesh: ReturnType<typeof meshSdf>, centre: [number, number, number]) {
  const { positions: p, indices } = mesh;
  let outward = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (p[a] + p[b] + p[c]) / 3 - centre[0];
    const my = (p[a + 1] + p[b + 1] + p[c + 1]) / 3 - centre[1];
    const mz = (p[a + 2] + p[b + 2] + p[c + 2]) / 3 - centre[2];
    if (nx * mx + ny * my + nz * mz > 0) outward++;
  }
  return outward / (indices.length / 3);
}

/** Every edge of a closed (watertight) mesh is shared by exactly two triangles. */
function isWatertight(indices: Uint32Array) {
  const edges = new Map<string, number>();
  for (let t = 0; t < indices.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = indices[t + e], b = indices[t + ((e + 1) % 3)];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  for (const count of edges.values()) if (count !== 2) return false;
  return true;
}

describe('meshSdf (surface nets)', () => {
  it('meshes a sphere: vertices on the surface, outward faces, watertight', () => {
    const r = 0.1;
    const mesh = meshSdf(sphere(v3(0, 0, 0), r), { min: [-0.15, -0.15, -0.15], max: [0.15, 0.15, 0.15], cellSize: 0.01 });

    expect(mesh.indices.length).toBeGreaterThan(300);
    for (let v = 0; v < mesh.positions.length; v += 3) {
      const d = Math.hypot(mesh.positions[v], mesh.positions[v + 1], mesh.positions[v + 2]);
      expect(Math.abs(d - r)).toBeLessThan(0.001);
      // Normal points away from the centre.
      const dot = (mesh.normals[v] * mesh.positions[v] + mesh.normals[v + 1] * mesh.positions[v + 1] + mesh.normals[v + 2] * mesh.positions[v + 2]) / d;
      expect(dot).toBeGreaterThan(0.99);
    }
    expect(faceNormalsPointOutward(mesh, [0, 0, 0])).toBe(1);
    expect(isWatertight(mesh.indices)).toBe(true);
  });

  it('meshes an off-centre blended shape without holes', () => {
    const shape = smoothUnion(
      0.03,
      capsule(v3(0.2, 0.1, 0), v3(0.2, 0.5, 0), 0.05),
      sphere(v3(0.2, 0.55, 0.02), 0.08),
      roundCone(v3(0.2, 0.1, 0), v3(0.35, -0.1, 0.05), 0.05, 0.03),
      ellipsoid(v3(0.2, 0.3, 0.05), 0.06, 0.03, 0.05)
    );
    const mesh = meshSdf(shape, { min: [0, -0.2, -0.15], max: [0.45, 0.7, 0.2], cellSize: 0.008 });
    expect(mesh.indices.length).toBeGreaterThan(1000);
    expect(isWatertight(mesh.indices)).toBe(true);
    for (let i = 0; i < mesh.positions.length; i++) expect(Number.isFinite(mesh.positions[i])).toBe(true);
  });
});
