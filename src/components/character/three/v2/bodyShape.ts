import type * as THREE from 'three';
import type { BodyType, CharacterGender } from '../../../../types/character';

/**
 * Body-shape morph targets shared by the base body and every skinned garment
 * (see manifest.ts). All zero is the neutral, average-build body, which is
 * also what non-binary uses.
 */
export const BODY_MORPHS = ['gender_male', 'gender_female', 'build_slender', 'build_athletic'] as const;
export type BodyMorph = (typeof BODY_MORPHS)[number];

export function bodyMorphWeights(gender: CharacterGender, bodyType: BodyType): Record<BodyMorph, number> {
  return {
    gender_male: gender === 'male' ? 1 : 0,
    gender_female: gender === 'female' ? 1 : 0,
    build_slender: bodyType === 'slender' ? 1 : 0,
    build_athletic: bodyType === 'athletic' ? 1 : 0,
  };
}

/**
 * Sets the body-shape weights on every mesh under root that has them, so the
 * body and its clothes change shape together (no re-meshing or reloading).
 */
export function applyBodyShape(root: THREE.Object3D, weights: Record<BodyMorph, number>) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const dict = mesh.morphTargetDictionary;
    if (!dict || !mesh.morphTargetInfluences) return;
    for (const name of BODY_MORPHS) {
      const i = dict[name];
      if (i !== undefined) mesh.morphTargetInfluences[i] = weights[name];
    }
  });
}
