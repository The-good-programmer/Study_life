import * as THREE from 'three';
import type { CharacterCustomization } from '../../../../types/character';

/**
 * Colour roles, keyed by the prefix of a glTF material's name (e.g.
 * `top_body`, `topSecondary_sleeves`, `hair_cards`). Assets are authored
 * with neutral (light grey) base colours; the customization's colour
 * multiplies in. Materials without a known prefix keep their own colours.
 */
export const MATERIAL_ROLES = {
  skin: 'skinTone',
  iris: 'eyeColor',
  hair: 'hairColor',
  brow: 'hairColor',
  facialHair: 'facialHairColor',
  top: 'topColor',
  topSecondary: 'topSecondaryColor',
  bottom: 'bottomColor',
  shoes: 'shoesColor',
  headwear: 'headwearColor',
  eyewear: 'eyewearColor',
} as const satisfies Record<string, keyof CharacterCustomization>;

export type MaterialRole = keyof typeof MATERIAL_ROLES;

export function roleOf(materialName: string): MaterialRole | null {
  const prefix = materialName.split(/[_.\s-]/)[0];
  return prefix in MATERIAL_ROLES ? (prefix as MaterialRole) : null;
}

/** Card-based hair, brows, lashes and beards: soft edges without sorting. */
const CARD_ROLES = new Set<MaterialRole>(['hair', 'brow', 'facialHair']);

/** One-time per-material setup when an asset joins an avatar. */
export function prepareMaterial(m: THREE.Material) {
  const role = roleOf(m.name);
  if (role && CARD_ROLES.has(role)) {
    // Alpha-to-coverage (with MSAA) gives soft, order-independent strand edges.
    m.transparent = false;
    m.alphaToCoverage = true;
    m.alphaTest = 0.02;
    m.side = THREE.DoubleSide;
  }
}

/** Sets every role-coloured material under root from the customization. */
export function applyRoleColors(root: THREE.Object3D, c: CharacterCustomization) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const role = roleOf(m.name);
      const hex = role ? colourFor(role, c) : null;
      const std = m as THREE.MeshStandardMaterial;
      if (hex && std.color) std.color.set(hex);
    }
  });
}

function colourFor(role: MaterialRole, c: CharacterCustomization): string | null {
  if (role === 'facialHair') return c.facialHairColor ?? c.hairColor;
  const v = c[MATERIAL_ROLES[role]];
  return typeof v === 'string' && v ? v : null;
}
