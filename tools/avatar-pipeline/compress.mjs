/**
 * Second pipeline step: compresses the glTF files build_avatar.py exported
 * (tools/avatar-pipeline/.build) into public/avatar, and writes the manifest
 * there with the compressed sizes.
 *
 *   npm run avatar:compress
 *
 * Geometry and morph targets are quantized (KHR_mesh_quantization) and
 * meshopt-compressed (EXT_meshopt_compression); morph targets that only move
 * part of a mesh (the face units) become sparse. The runtime's GLTFLoader
 * already has the meshopt decoder. The body's `_HIDE` bit mask is left as
 * exact floats: quantizing it would corrupt the bits.
 *
 * Output files are named by content hash (`base.1a2b3c4d.glb`), so browsers
 * and the service worker can cache them forever and a re-export still
 * reaches users; files no longer referenced are deleted.
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, quantize, reorder, sparse } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '.build');
const OUT = path.resolve(here, '..', '..', 'public', 'avatar');
const URL_PREFIX = '/avatar/';

// Every standard attribute, but never application-specific ones like _HIDE.
const QUANTIZED = /^(POSITION|NORMAL|TANGENT|TEXCOORD_\d+|JOINTS_\d+|WEIGHTS_\d+|COLOR_\d+)$/;

// Material names carry the colour role (iris_, skin_, ...; see materialsV2.ts),
// so materials are never merged: the eye's sclera and iris share a texture and
// settings, and merging them by content dropped the iris's eye colour.
// Identical textures and geometry still are.
const DEDUP_TYPES = [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE, PropertyType.SKIN];

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

async function compress(rel) {
  const doc = await io.read(path.join(SRC, rel));
  await doc.transform(
    dedup({ propertyTypes: DEDUP_TYPES }),
    prune(),
    sparse({ ratio: 1 / 3 }),
    reorder({ encoder: MeshoptEncoder, target: 'size' }),
    quantize({
      pattern: QUANTIZED,
      patternTargets: QUANTIZED,
      quantizePosition: 14,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
      quantizeWeight: 8,
    }),
  );
  doc.createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const bytes = await io.writeBinary(doc);
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
  const hashedRel = rel.replace(/\.glb$/, `.${hash}.glb`);
  const out = path.join(OUT, hashedRel);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, bytes);
  written.add(path.resolve(out));
  const before = (await stat(path.join(SRC, rel))).size;
  console.log(`${hashedRel.padEnd(40)} ${(before / 1e6).toFixed(2)} MB -> ${(bytes.byteLength / 1e6).toFixed(2)} MB`);
  return { rel: hashedRel, bytes: bytes.byteLength };
}

const written = new Set();

/** Every .glb under dir, recursively. */
async function glbFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await glbFiles(p)));
    else if (e.name.endsWith('.glb')) out.push(path.resolve(p));
  }
  return out;
}

/** Compresses every file an asset entry lists and records the new sizes. */
async function compressEntry(entry) {
  for (const [tier, url] of Object.entries(entry.files)) {
    const result = await compress(url.slice(URL_PREFIX.length));
    entry.files[tier] = URL_PREFIX + result.rel;
    (entry.bytes ??= {})[tier] = result.bytes;
  }
}

const manifest = JSON.parse(await readFile(path.join(SRC, 'manifest.json'), 'utf8'));
await compressEntry(manifest.base);
for (const items of Object.values(manifest.items)) {
  for (const entry of Object.values(items)) await compressEntry(entry);
}
await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
for (const stale of (await glbFiles(OUT)).filter((f) => !written.has(f))) {
  await rm(stale);
  console.log(`removed ${path.relative(OUT, stale)}`);
}

const tiers = new Set([manifest.base, ...Object.values(manifest.items).flatMap((i) => Object.values(i))].flatMap((e) => Object.keys(e.bytes ?? {})));
for (const tier of tiers) {
  const total = [manifest.base, ...Object.values(manifest.items).flatMap((i) => Object.values(i))]
    .reduce((sum, e) => sum + (e.bytes?.[tier] ?? 0), 0);
  console.log(`${tier}: ${(total / 1e6).toFixed(2)} MB for the base and every item`);
}
