import type { Sdf } from '../sdf/sdf';
import { meshSdf } from '../sdf/surfaceNets';
import { buildPayload, type GeometryPayload } from './geometry';
import { computeSkinWeights, type BodyPart } from './body';
import type { BoneName } from './rig';

/**
 * Everything needed to turn a sculpted shape into geometry. Producing the
 * payload is pure and DOM-free, so it can run in a Web Worker.
 */
export interface MeshSpec {
  sdf: Sdf;
  min: [number, number, number];
  max: [number, number, number];
  cellSize: number;
  ao?: { distance: number; strength?: number };
  /** Per-vertex colour zone (see makeZoned in materials.ts). */
  materialOf?: (x: number, y: number, z: number) => number;
  /** Skin to the avatar skeleton using these tagged parts. */
  skin?: { parts: BodyPart[]; boneIndex: Record<BoneName, number> };
}

export function runMeshSpec(spec: MeshSpec): GeometryPayload {
  const data = meshSdf(spec.sdf, { min: spec.min, max: spec.max, cellSize: spec.cellSize, ao: spec.ao });
  return buildPayload(data, {
    materialOf: spec.materialOf,
    skin: spec.skin ? computeSkinWeights(data.positions, spec.skin.parts, spec.skin.boneIndex) : undefined,
  });
}
