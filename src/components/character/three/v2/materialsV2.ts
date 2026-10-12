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
  if (role === 'skin') addScalpShading(out);
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

interface ScalpUniforms {
  scalpBit: { value: number };
  scalpColor: { value: THREE.Color };
  scalpStrength: { value: number };
}

/**
 * Tints the scalp under the worn hairstyle with the hair colour, so the
 * hairline fades into the hair instead of meeting it at a hard edge, and so
 * a buzz cut can be shading alone. The body carries a `_scalp` bit mask (one
 * bit per hairstyle, see manifest.ts); the bit is interpolated across each
 * triangle, which softens the edge over about a centimetre.
 */
function addScalpShading(m: THREE.Material) {
  const uniforms: ScalpUniforms = {
    scalpBit: { value: -1 },
    scalpColor: { value: new THREE.Color() },
    scalpStrength: { value: 0 },
  };
  m.userData.scalp = uniforms;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = [
      'attribute float _scalp;',
      'uniform float scalpBit;',
      'varying float vScalp;',
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n\tvScalp = scalpBit < 0.0 ? 0.0 : mod( floor( _scalp / exp2( scalpBit ) ), 2.0 );'
      ),
    ].join('\n');
    shader.fragmentShader = [
      'uniform vec3 scalpColor;',
      'uniform float scalpStrength;',
      'varying float vScalp;',
      shader.fragmentShader.replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n\tdiffuseColor.rgb = mix( diffuseColor.rgb, scalpColor, vScalp * scalpStrength );'
      ),
    ].join('\n');
  };
  m.customProgramCacheKey = () => 'avatar-skin-scalp';
}

/** Shades the scalp under hairstyle `bit` (-1: none) in the hair colour. */
export function setScalp(root: THREE.Object3D, bit: number, hairHex: string, strength: number) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const u = m.userData.scalp as ScalpUniforms | undefined;
      if (!u) continue;
      u.scalpBit.value = bit;
      // Hair over skin reads darker than the hair itself.
      u.scalpColor.value.set(hairHex).multiplyScalar(0.7);
      u.scalpStrength.value = bit < 0 ? 0 : strength;
    }
  });
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
