import * as THREE from 'three';
import type {
  BodyType, CharacterGender, FacialHair, HairStyle, Headwear, OutfitBottom, OutfitTop, Shoes,
} from '../../../../types/character';
import { getAvatarDims, EYE_DEPTH, type AvatarDims } from './anatomy';
import { buildRig, type AvatarRig } from './rig';
import { buildBodyParts, composeBody, type BodyPart } from './body';
import { handSdf, handBounds } from './hands';
import { headBaseSdf, headSdf, headBounds, headLayout, traceFront } from './head';
import { buildTopSpec, buildBottomSpec, shoeSpec } from './clothing';
import { hairMeshSpec, type HairPart } from './hair';
import { headwearMeshSpec, facialHairMeshSpec, type HeadwearPart } from './accessories';
import { runMeshSpec, type MeshSpec } from './meshSpec';
import type { GeometryPayload } from './geometry';

// Mesh resolutions (metres per cell), tuned for a ~150k-triangle avatar.
const BODY_CELL = 0.011;
const HEAD_CELL = 0.0048;
const HAND_CELL = 0.003;
const GARMENT_CELL = 0.0098;
const SHOE_CELL = 0.0045;

interface Shape { gender: CharacterGender; bodyType: BodyType }

/**
 * A serialisable request for one piece of avatar geometry. Jobs are pure
 * functions of their fields, so results can be cached by key and computed in
 * a Web Worker.
 */
export type GeometryJob =
  | ({ kind: 'body' } & Shape)
  | ({ kind: 'bodyCull'; top: OutfitTop; bottom: OutfitBottom; boots: boolean } & Shape)
  | ({ kind: 'hand'; side: 'L' | 'R' } & Shape)
  | ({ kind: 'head' } & Shape)
  | ({ kind: 'top'; top: OutfitTop } & Shape)
  | ({ kind: 'bottom'; bottom: OutfitBottom; boots: boolean } & Shape)
  | ({ kind: 'shoe'; shoes: Shoes } & Shape)
  | ({ kind: 'hair'; style: HairStyle; part: HairPart; under: Headwear } & Shape)
  | ({ kind: 'headwear'; headwear: Headwear; hair: HairStyle; part: HeadwearPart } & Shape)
  | ({ kind: 'facialHair'; style: FacialHair } & Shape);

/** Geometry payload, or (for bodyCull) a triangle index list. */
export type JobResult = { payload: GeometryPayload } | { indices: Uint32Array };

export function jobKey(job: GeometryJob): string {
  // Stable key: fields in a fixed (sorted) order.
  const fields = job as unknown as Record<string, unknown>;
  return Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('|');
}

// ─── Per-shape context (memoised in each thread) ─────────────────────────────

interface ShapeContext {
  dims: AvatarDims;
  rig: AvatarRig;
  parts: BodyPart[];
}

const contexts = new Map<string, ShapeContext>();
export function shapeContext(gender: CharacterGender, bodyType: BodyType): ShapeContext {
  const key = `${gender}|${bodyType}`;
  let ctx = contexts.get(key);
  if (!ctx) {
    const dims = getAvatarDims(gender, bodyType);
    const rig = buildRig(dims);
    ctx = { dims, rig, parts: buildBodyParts(rig, dims) };
    contexts.set(key, ctx);
  }
  return ctx;
}

/** Eyeball centres on the face surface, slightly sunk into their sockets. */
export function eyeCentres(d: AvatarDims): [number, number, number][] {
  const L = headLayout(d);
  const base = headBaseSdf(d);
  return [1, -1].map((side) => {
    const x = side * L.eyeX;
    const z = traceFront(base, x, L.eyeY) ?? L.eyeZ + L.eyeR;
    // Eyes are flattened to EYE_DEPTH; sink them so ~40% of that depth shows.
    return [x, L.eyeY, z - L.eyeR * EYE_DEPTH * 0.6] as [number, number, number];
  });
}

// Garment specs build small detail meshes; the worker only needs the fields.
const placeholder = new THREE.MeshBasicMaterial();
const detailPlaceholders = { secondary: placeholder, button: placeholder, gold: placeholder };

// The body mesh is reused by every bodyCull job for the same shape.
const bodyPayloads = new Map<string, GeometryPayload>();

function bodySpec(ctx: ShapeContext): MeshSpec {
  return {
    sdf: composeBody(ctx.parts),
    min: [-0.47, 0.06, -0.2],
    max: [0.47, 1.32, 0.2],
    cellSize: BODY_CELL,
    ao: { distance: 0.06 },
    skin: { parts: ctx.parts, boneIndex: ctx.rig.boneIndex },
  };
}

function bodyPayload(ctx: ShapeContext): GeometryPayload {
  const key = `${ctx.dims.gender}|${ctx.dims.bodyType}`;
  let p = bodyPayloads.get(key);
  if (!p) {
    p = runMeshSpec(bodySpec(ctx));
    bodyPayloads.set(key, p);
  }
  return p;
}

/** Produces the geometry (or index list) for a job. Pure and DOM-free. */
export function runGeometryJob(job: GeometryJob): JobResult {
  const ctx = shapeContext(job.gender, job.bodyType);
  const { dims: d, rig, parts } = ctx;

  switch (job.kind) {
    case 'body': {
      // Copy: the cached arrays may be transferred (and detached) by the worker.
      const p = bodyPayload(ctx);
      return { payload: clonePayload(p) };
    }

    case 'bodyCull': {
      // Keep skin triangles that are not buried under the outfit.
      const body = bodyPayload(ctx);
      const top = buildTopSpec(job.top, rig, d, parts, detailPlaceholders).sdf;
      const bottom = buildBottomSpec(job.bottom, job.boots ? 'boots' : 'sneakers', rig, d, parts).sdf;
      const pos = body.positions;
      const keep = new Uint8Array(pos.length / 3);
      for (let v = 0; v < keep.length; v++) {
        const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
        keep[v] = top(x, y, z) > -0.0045 && bottom(x, y, z) > -0.0045 ? 1 : 0;
      }
      const idx = body.indices;
      const kept: number[] = [];
      for (let t = 0; t < idx.length; t += 3) {
        if (keep[idx[t]] || keep[idx[t + 1]] || keep[idx[t + 2]]) kept.push(idx[t], idx[t + 1], idx[t + 2]);
      }
      return { indices: new Uint32Array(kept) };
    }

    case 'hand': {
      const b = handBounds(d);
      return { payload: runMeshSpec({ sdf: handSdf(d, job.side === 'L' ? 1 : -1), ...b, cellSize: HAND_CELL, ao: { distance: 0.014 } }) };
    }

    case 'head':
      return {
        payload: runMeshSpec({ sdf: headSdf(d, eyeCentres(d)), ...headBounds(), cellSize: HEAD_CELL, ao: { distance: 0.02, strength: 0.75 } }),
      };

    case 'top': {
      const spec = buildTopSpec(job.top, rig, d, parts, detailPlaceholders);
      return {
        payload: runMeshSpec({
          sdf: spec.sdf, min: spec.min, max: spec.max, cellSize: GARMENT_CELL, ao: { distance: 0.06 },
          materialOf: spec.materialOf, skin: { parts: spec.weightParts, boneIndex: rig.boneIndex },
        }),
      };
    }

    case 'bottom': {
      const spec = buildBottomSpec(job.bottom, job.boots ? 'boots' : 'sneakers', rig, d, parts);
      return {
        payload: runMeshSpec({
          sdf: spec.sdf, min: spec.min, max: spec.max, cellSize: GARMENT_CELL, ao: { distance: 0.06 },
          materialOf: spec.materialOf, skin: { parts: spec.weightParts, boneIndex: rig.boneIndex },
        }),
      };
    }

    case 'shoe': {
      const spec = shoeSpec(job.shoes, d);
      return { payload: runMeshSpec({ ...spec, cellSize: SHOE_CELL, ao: { distance: 0.02 } }) };
    }

    case 'hair':
      return { payload: runMeshSpec(hairMeshSpec(job.style, job.part, d, job.under)) };

    case 'headwear':
      return { payload: runMeshSpec(headwearMeshSpec(job.headwear, job.part, job.hair, d)) };

    case 'facialHair': {
      const spec = facialHairMeshSpec(job.style, d);
      if (!spec) throw new Error('No geometry for facial hair "none"');
      return { payload: runMeshSpec(spec) };
    }
  }
}

function clonePayload(p: GeometryPayload): GeometryPayload {
  return {
    positions: p.positions.slice(),
    normals: p.normals.slice(),
    indices: p.indices.slice(),
    color: p.color?.slice(),
    skinIndex: p.skinIndex?.slice(),
    skinWeight: p.skinWeight?.slice(),
    zone: p.zone?.slice(),
  };
}
