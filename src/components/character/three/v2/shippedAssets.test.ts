import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { NodeIO, type Document, type Material } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import type { AssetRef, AvatarManifest } from './manifest';
import { roleOf, type MaterialRole } from './materialsV2';

/**
 * Checks the avatar assets the app actually ships (public/avatar, built by
 * tools/avatar-pipeline): every listed file is there, the eyes keep the
 * material the eye colour tints, tinted textures are neutral and equally
 * bright (so a swatch looks the same on every item), socks are light, strand
 * cards are cutouts, and the bit masks survive being stored as floats.
 */
const PUBLIC = 'public';
const manifest = JSON.parse(readFileSync(`${PUBLIC}/avatar/manifest.json`, 'utf8')) as AvatarManifest;
const assets: [string, AssetRef][] = [
  ['base', manifest.base],
  ...Object.entries(manifest.items).flatMap(([slot, items]) =>
    Object.entries(items ?? {}).map(([id, entry]): [string, AssetRef] => [`${slot}/${id}`, entry])),
];

/** Mean sRGB brightness each tinted role's texture is normalised to (see build_avatar.py). */
const BRIGHTNESS: Partial<Record<MaterialRole, [number, number]>> = {
  skin: [0.74, 0.86], top: [0.74, 0.86], bottom: [0.74, 0.86], shoes: [0.74, 0.86],
  hair: [0.66, 0.84], brow: [0.66, 0.84],
};
const CARDS = new Set<MaterialRole>(['hair', 'brow']);

const docs = new Map<string, Document>();

beforeAll(async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  for (const [name, ref] of assets) {
    const url = ref.files.medium;
    if (url && existsSync(PUBLIC + url)) docs.set(name, await io.read(PUBLIC + url));
  }
}, 30_000);

interface Stats { mean: number; channels: number[]; saturation: number; clipped: number }

/** Brightness and colourfulness of a texture; cards count each texel by its alpha. */
async function textureStats(image: Uint8Array, byAlpha: boolean): Promise<Stats> {
  const data = await sharp(Buffer.from(image)).ensureAlpha().raw().toBuffer();
  let weight = 0, saturation = 0, clipped = 0;
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    const a = byAlpha ? data[i + 3] : 255;
    if (!a) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b);
    weight += a;
    sum[0] += r * a;
    sum[1] += g * a;
    sum[2] += b * a;
    saturation += (max - Math.min(r, g, b)) * a;
    if (max >= 254) clipped += a;
  }
  saturation /= 255;
  const channels = sum.map((c) => c / weight / 255);
  return { mean: (channels[0] + channels[1] + channels[2]) / 3, channels, saturation: saturation / weight, clipped: clipped / weight };
}

const materialsOf = (doc: Document) => doc.getRoot().listMaterials();

/** Vertices drawn with each material. */
function vertexCounts(doc: Document) {
  const counts = new Map<Material, number>();
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const m = prim.getMaterial();
      if (m) counts.set(m, (counts.get(m) ?? 0) + (prim.getAttribute('POSITION')?.getCount() ?? 0));
    }
  }
  return counts;
}

// Decoding every texture takes a few seconds on a busy CI machine.
describe('shipped avatar assets', { timeout: 30_000 }, () => {
  it('has every file the manifest lists, at the listed size', () => {
    for (const [name, ref] of assets) {
      for (const [tier, url] of Object.entries(ref.files)) {
        expect(existsSync(PUBLIC + url), `${name} (${tier}): ${url}`).toBe(true);
        expect(statSync(PUBLIC + url).size, `${name} (${tier}) size`).toBe(ref.bytes?.[tier as keyof typeof ref.bytes]);
      }
    }
    expect(docs.size).toBe(assets.filter(([, ref]) => ref.files.medium).length);
  });

  it('keeps the iris material the eye colour tints, with a light grey iris', async () => {
    const base = docs.get('base')!;
    const iris = materialsOf(base).find((m) => roleOf(m.getName()) === 'iris');
    expect(iris, 'an iris_* material on the base').toBeDefined();
    const prims = base.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).filter((p) => p.getMaterial() === iris);
    expect(prims.length).toBeGreaterThan(0);
    // Sample the texture under the iris faces' UV centres.
    const texture = iris!.getBaseColorTexture()!;
    const { data, info } = await sharp(Buffer.from(texture.getImage()!)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let n = 0, lum = 0, sat = 0;
    for (const prim of prims) {
      const uv = prim.getAttribute('TEXCOORD_0')!;
      const index = prim.getIndices()!;
      const t = [0, 0];
      for (let i = 0; i < index.getCount(); i += 3) {
        let u = 0, v = 0;
        for (let k = 0; k < 3; k++) {
          uv.getElement(index.getScalar(i + k), t);
          u += t[0] / 3;
          v += t[1] / 3;
        }
        const x = Math.min(info.width - 1, Math.floor(u * info.width));
        const y = Math.min(info.height - 1, Math.floor(v * info.height));
        const o = (y * info.width + x) * 4;
        const rgb = [data[o], data[o + 1], data[o + 2]].map((c) => c / 255);
        lum += (rgb[0] + rgb[1] + rgb[2]) / 3;
        sat += Math.max(...rgb) - Math.min(...rgb);
        n++;
      }
    }
    expect(sat / n, 'iris saturation').toBeLessThan(0.05);
    expect(lum / n, 'iris brightness').toBeGreaterThan(0.35);
  });

  it('makes tinted textures neutral, unclipped and equally bright per role', async () => {
    const problems: string[] = [];
    for (const [name, doc] of docs) {
      for (const m of materialsOf(doc)) {
        const role = roleOf(m.getName());
        const band = role ? BRIGHTNESS[role] : undefined;
        const image = m.getBaseColorTexture()?.getImage();
        if (!role || !band || !image) continue;
        const s = await textureStats(image, CARDS.has(role));
        const label = `${name} ${m.getName()}: mean ${s.mean.toFixed(3)}, saturation ${s.saturation.toFixed(3)}, clipped ${(s.clipped * 100).toFixed(1)}%`;
        // Skin keeps its local warmth (lips, cheeks) but must average out grey.
        const colourful = role === 'skin'
          ? s.saturation > 0.08 || Math.max(...s.channels) - Math.min(...s.channels) > 0.03
          : s.saturation > 0.03;
        if (s.mean < band[0] || s.mean > band[1] || colourful || s.clipped > 0.08) problems.push(label);
      }
    }
    expect(problems).toEqual([]);
  });

  it('draws hair and brows as alpha cutouts (blended cards skip depth writes)', () => {
    for (const [name, doc] of docs) {
      for (const m of materialsOf(doc)) {
        const role = roleOf(m.getName());
        if (role && CARDS.has(role)) expect(m.getAlphaMode(), `${name} ${m.getName()}`).toBe('MASK');
      }
    }
  });

  it('gives shoes light socks and tints the rest of the shoe', async () => {
    for (const [name, doc] of docs) {
      if (!name.startsWith('shoes/')) continue;
      const counts = vertexCounts(doc);
      const total = [...counts.values()].reduce((a, b) => a + b, 0);
      const shoe = [...counts].filter(([m]) => roleOf(m.getName()) === 'shoes').reduce((a, [, n]) => a + n, 0);
      expect(shoe / total, `${name}: share of vertices tinted with the shoe colour`).toBeGreaterThan(0.6);
      for (const m of counts.keys()) {
        if (!m.getName().startsWith('socks')) continue;
        const s = await textureStats(m.getBaseColorTexture()!.getImage()!, false);
        expect(s.mean, `${name} socks brightness`).toBeGreaterThan(0.8);
        expect(s.saturation, `${name} socks saturation`).toBeLessThan(0.03);
      }
    }
  });

  it('stores hide and scalp masks as exact float bit sets the manifest knows', () => {
    const entries = Object.values(manifest.items).flatMap((items) => Object.values(items ?? {}));
    const known = {
      _HIDE: new Set(entries.flatMap((e) => (e.hideBit === undefined ? [] : [e.hideBit]))),
      _SCALP: new Set(entries.flatMap((e) => [e.scalpBit, e.beardBit].filter((b): b is number => b !== undefined))),
    };
    let checked = 0;
    for (const [name, doc] of docs) {
      for (const prim of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
        for (const semantic of ['_HIDE', '_SCALP'] as const) {
          const attr = prim.getAttribute(semantic);
          if (!attr) continue;
          checked++;
          // A float stores an integer exactly only within 24 significant bits.
          expect(attr.getComponentType(), `${name} ${semantic} is float`).toBe(5126);
          expect(attr.getNormalized()).toBe(false);
          let used = 0;
          for (const v of attr.getArray()!) {
            if (!Number.isInteger(v) || v < 0 || v >= 2 ** 31) throw new Error(`${name} ${semantic}: bad mask value ${v}`);
            used |= v;
          }
          if (!used) continue;
          const highest = 31 - Math.clz32(used);
          const lowest = 31 - Math.clz32(used & -used);
          expect(highest - lowest, `${name} ${semantic}: bits ${lowest}..${highest}`).toBeLessThan(24);
          for (let bit = lowest; bit <= highest; bit++) {
            if (used & (1 << bit)) expect(known[semantic].has(bit), `${name} ${semantic} bit ${bit}`).toBe(true);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
