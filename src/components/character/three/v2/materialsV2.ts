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

/** Roles drawn as strands: they get an anisotropic, hair-like highlight. */
const STRAND_ROLES = new Set<MaterialRole>(['hair', 'facialHair']);

/**
 * One-time setup when an asset joins an avatar. Returns the material to use,
 * which may be a replacement (hair is upgraded to a physical material);
 * calling it again on its result is a no-op.
 */
export function prepareMaterial(m: THREE.Material): THREE.Material {
  if (m.userData.prepared) return m;
  const role = roleOf(m.name);
  let out = m;
  if (role && STRAND_ROLES.has(role)) out = hairMaterial(m as THREE.MeshStandardMaterial);
  if (role && CARD_ROLES.has(role)) {
    // Alpha-to-coverage (with MSAA) gives soft, order-independent strand edges.
    out.transparent = false;
    out.alphaToCoverage = true;
    out.alphaTest = 0.02;
    out.side = THREE.DoubleSide;
  }
  out.userData.prepared = true;
  return out;
}

/**
 * Hair shading: real hair reads through a highlight stretched along the
 * strands (anisotropic specular) and a soft sheen at grazing angles. The
 * asset textures run strands along V, so the anisotropy is turned 90° from
 * the U-aligned tangent three.js derives from the UVs.
 */
function hairMaterial(src: THREE.MeshStandardMaterial): THREE.MeshPhysicalMaterial {
  const hair = new THREE.MeshPhysicalMaterial({
    name: src.name,
    map: src.map,
    color: src.color,
    normalMap: src.normalMap,
    roughness: 0.42,
    metalness: 0,
    anisotropy: 0.85,
    anisotropyRotation: Math.PI / 2,
    specularIntensity: 0.7,
    sheen: 0.35,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(0.35, 0.33, 0.3),
  });
  hair.userData = { ...src.userData };
  src.dispose();
  return hair;
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
