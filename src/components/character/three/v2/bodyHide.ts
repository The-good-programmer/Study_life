import * as THREE from 'three';

/** Name of the body's per-vertex hide mask (glTF `_HIDE`, see manifest.ts). */
export const HIDE_ATTRIBUTE = '_hide';

interface Entry {
  geometry: THREE.BufferGeometry;
  hide: ArrayLike<number>;
  source: ArrayLike<number>;
  index: THREE.BufferAttribute;
}

/**
 * Hides what the worn clothes cover, so nothing pokes through when the body
 * bends: skin under clothes, and inner garments under outer ones (a shoe's
 * collar under jeans). Each vertex carries a bit mask (`_hide`) of the items
 * it sits under; a triangle is dropped when all three of its vertices are
 * under a worn item. Each avatar gets its own index on top of the shared
 * vertex data, rewritten in place (no reallocation) when the outfit changes.
 *
 * `minHidden` is how many of a triangle's vertices must be covered to drop
 * it: 3 for skin (never open a hole in the body), 2 for garments, whose
 * edges may poke through between covered vertices.
 */
export class BodyHider {
  private entries: Entry[] = [];
  private minHidden: number;

  constructor(root: THREE.Object3D, minHidden = 3) {
    this.minHidden = minHidden;
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const src = mesh.isMesh ? mesh.geometry : null;
      const hide = src?.getAttribute(HIDE_ATTRIBUTE);
      if (!src || !hide) return;
      const geometry = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(src.attributes)) geometry.setAttribute(name, attr);
      geometry.morphAttributes = src.morphAttributes;
      geometry.morphTargetsRelative = src.morphTargetsRelative;
      geometry.boundingBox = src.boundingBox;
      geometry.boundingSphere = src.boundingSphere;
      const source = src.index ? src.index.array : Uint32Array.from({ length: hide.count }, (_, i) => i);
      const index = new THREE.BufferAttribute(new Uint32Array(source.length), 1);
      index.setUsage(THREE.DynamicDrawUsage);
      geometry.setIndex(index);
      mesh.geometry = geometry;
      this.entries.push({ geometry, hide: hide.array, source, index });
    });
    this.apply(0);
  }

  /** Shows only triangles not fully covered by the items in `mask` (OR of hide bits). */
  apply(mask: number) {
    for (const { geometry, hide, source, index } of this.entries) {
      const out = index.array as Uint32Array;
      let n = 0;
      for (let t = 0; t < source.length; t += 3) {
        const a = source[t], b = source[t + 1], c = source[t + 2];
        if (mask && (hide[a] & mask ? 1 : 0) + (hide[b] & mask ? 1 : 0) + (hide[c] & mask ? 1 : 0) >= this.minHidden) continue;
        out[n++] = a;
        out[n++] = b;
        out[n++] = c;
      }
      geometry.setDrawRange(0, n);
      index.needsUpdate = true;
    }
  }

  get isEmpty() {
    return this.entries.length === 0;
  }

  /** Triangles currently drawn, per masked mesh (for tests and the dev HUD). */
  visibleTriangles() {
    return this.entries.map((e) => e.geometry.drawRange.count / 3);
  }

  dispose() {
    for (const e of this.entries) e.geometry.dispose();
    this.entries = [];
  }
}

export const hideMask = (bits: (number | undefined)[]) =>
  bits.reduce<number>((m, b) => (b === undefined ? m : m | (1 << b)), 0);
