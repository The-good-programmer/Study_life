import * as THREE from 'three';
import type { MeshData } from '../sdf/surfaceNets';

/**
 * Builds a BufferGeometry from mesher output. When `materialOf` is given, each
 * vertex gets a `zone` attribute (0, 1, 2) that zoned materials use to pick a
 * colour, so one mesh can carry e.g. contrast sleeves with clean boundaries.
 */
export function toGeometry(
  data: MeshData,
  opts: {
    materialOf?: (x: number, y: number, z: number) => number;
    skin?: { skinIndex: Uint16Array; skinWeight: Float32Array };
  } = {}
): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  if (data.ao) {
    // Ambient occlusion baked as a (grey) vertex colour, multiplied into the diffuse.
    const colors = new Float32Array(data.ao.length * 3);
    for (let i = 0; i < data.ao.length; i++) {
      // Slightly warm the occluded areas, like light bouncing between surfaces.
      const a = data.ao[i];
      colors[i * 3] = a;
      colors[i * 3 + 1] = a * (0.94 + 0.06 * a);
      colors[i * 3 + 2] = a * (0.9 + 0.1 * a);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  if (opts.skin) {
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(opts.skin.skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(opts.skin.skinWeight, 4));
  }
  if (opts.materialOf) {
    const p = data.positions;
    const zone = new Float32Array(p.length / 3);
    for (let v = 0; v < zone.length; v++) zone[v] = opts.materialOf(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]);
    g.setAttribute('zone', new THREE.BufferAttribute(zone, 1));
  }
  g.setIndex(new THREE.BufferAttribute(data.indices, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/**
 * Gives a non-sculpted geometry a white vertex colour, so it renders
 * correctly with materials that multiply in baked occlusion.
 */
export function withWhiteColors<T extends THREE.BufferGeometry>(geo: T): T {
  const count = geo.getAttribute('position').count;
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
  return geo;
}

/**
 * A copy of `source` that shares its vertex attributes but keeps only the
 * triangles for which keep(vertex) holds for at least one corner. Used to
 * drop skin hidden under clothing (fewer triangles, no poke-through).
 */
export function filterTriangles(
  source: THREE.BufferGeometry,
  keepVertex: (x: number, y: number, z: number) => boolean
): THREE.BufferGeometry {
  const pos = source.getAttribute('position') as THREE.BufferAttribute;
  const index = source.getIndex()!;
  const keep = new Uint8Array(pos.count);
  for (let v = 0; v < pos.count; v++) keep[v] = keepVertex(pos.getX(v), pos.getY(v), pos.getZ(v)) ? 1 : 0;
  const kept: number[] = [];
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t), b = index.getX(t + 1), c = index.getX(t + 2);
    if (keep[a] || keep[b] || keep[c]) kept.push(a, b, c);
  }
  const g = new THREE.BufferGeometry();
  for (const name of Object.keys(source.attributes)) g.setAttribute(name, source.getAttribute(name));
  g.setIndex(kept);
  g.boundingBox = source.boundingBox;
  g.boundingSphere = source.boundingSphere;
  return g;
}

/**
 * Reference-counted cache for generated geometry. Entries no longer in use
 * are kept (up to `idleLimit`) so switching back to a previous outfit or
 * body is instant, then disposed oldest-first.
 */
export class GeometryCache<T extends { dispose(): void }> {
  private entries = new Map<string, { value: T; refs: number; lastUsed: number }>();
  private clock = 0;
  private idleLimit: number;

  constructor(idleLimit = 40) {
    this.idleLimit = idleLimit;
  }

  acquire(key: string, create: () => T): T {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { value: create(), refs: 0, lastUsed: 0 };
      this.entries.set(key, entry);
    }
    entry.refs++;
    entry.lastUsed = ++this.clock;
    return entry.value;
  }

  release(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.refs = Math.max(0, entry.refs - 1);
    entry.lastUsed = ++this.clock;
    this.evict();
  }

  private evict() {
    const idle = [...this.entries.entries()].filter(([, e]) => e.refs === 0);
    if (idle.length <= this.idleLimit) return;
    idle.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (const [key, e] of idle.slice(0, idle.length - this.idleLimit)) {
      e.value.dispose();
      this.entries.delete(key);
    }
  }
}
