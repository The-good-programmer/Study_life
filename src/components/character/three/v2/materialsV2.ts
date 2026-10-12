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
  if (role === 'skin') {
    out = skinMaterial(m as THREE.MeshStandardMaterial);
    addScalpShading(out);
  }
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
  beardBit: { value: number };
  beardColor: { value: THREE.Color };
  beardStrength: { value: number };
}

/**
 * Tints the scalp under the worn hairstyle with the hair colour, so the
 * hairline fades into the hair instead of meeting it at a hard edge, and so
 * a buzz cut can be shading alone. Facial hair (stubble, goatee, beard) is
 * a second, independent channel on the same mask. The body carries a
 * `_scalp` bit mask (one bit per hairstyle or face region, see manifest.ts);
 * each bit is interpolated across a triangle, which softens edges over about
 * a centimetre.
 */
/**
 * Skin as a physical material: a soft sheen (peach fuzz), a faint second
 * specular lobe (the skin's oily layer, as a low clearcoat) and tiled
 * micro-normals for pores. The subsurface look comes from the shader patch
 * in addScalpShading (wrapped diffuse lighting).
 */
function skinMaterial(src: THREE.MeshStandardMaterial): THREE.MeshPhysicalMaterial {
  const skin = new THREE.MeshPhysicalMaterial({
    name: src.name,
    map: src.map,
    color: src.color,
    roughness: 0.52,
    metalness: 0,
    specularIntensity: 0.55,
    sheen: 0.22,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color(0.32, 0.27, 0.24),
    clearcoat: 0.06,
    clearcoatRoughness: 0.42,
    normalMap: poreNormals(),
    normalScale: new THREE.Vector2(0.07, 0.07),
  });
  skin.userData = { ...src.userData };
  src.dispose();
  return skin;
}

let poreTexture: THREE.DataTexture | null = null;

/**
 * A small tiling normal map of skin micro-relief (pores and fine creases),
 * generated from value noise so no texture has to be downloaded. Repeated
 * across the body's UV atlas, each tile covers a few centimetres of skin.
 */
export function poreNormals(): THREE.DataTexture {
  if (poreTexture) return poreTexture;
  const size = 128;
  const height = new Float32Array(size * size);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const [cells, amp] of [[32, 1], [64, 0.5]] as const) {
    const grid = Float32Array.from({ length: cells * cells }, rand);
    const step = size / cells;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const gx = x / step, gy = y / step;
        const x0 = Math.floor(gx) % cells, y0 = Math.floor(gy) % cells;
        const x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
        const fx = gx - Math.floor(gx), fy = gy - Math.floor(gy);
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const top = grid[y0 * cells + x0] * (1 - sx) + grid[y0 * cells + x1] * sx;
        const bot = grid[y1 * cells + x0] * (1 - sx) + grid[y1 * cells + x1] * sx;
        height[y * size + x] += amp * (top * (1 - sy) + bot * sy);
      }
    }
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const h = (dx: number, dy: number) => height[((y + dy + size) % size) * size + ((x + dx + size) % size)];
      const nx = h(-1, 0) - h(1, 0), ny = h(0, -1) - h(0, 1), nz = 0.5;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  poreTexture = new THREE.DataTexture(data, size, size);
  poreTexture.wrapS = poreTexture.wrapT = THREE.RepeatWrapping;
  poreTexture.repeat.set(72, 72);
  poreTexture.generateMipmaps = true;
  poreTexture.minFilter = THREE.LinearMipmapLinearFilter;
  poreTexture.magFilter = THREE.LinearFilter;
  poreTexture.needsUpdate = true;
  return poreTexture;
}

/** Three.js's direct diffuse term, swapped for wrapped (subsurface-like) lighting on skin. */
const LAMBERT_DIRECT = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );';
const WRAPPED_DIRECT = [
  '// Skin scatters light under its surface: red wraps furthest past the',
  '// terminator, then green, then blue (a warm, soft shadow edge).',
  'float skinNL = dot( geometryNormal, directLight.direction );',
  'vec3 skinWrap = vec3( 0.42, 0.2, 0.12 );',
  'vec3 skinIrradiance = saturate( ( vec3( skinNL ) + skinWrap ) / ( 1.0 + skinWrap ) ) * directLight.color;',
  'reflectedLight.directDiffuse += skinIrradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );',
].join('\n\t');

function addScalpShading(m: THREE.Material) {
  const uniforms: ScalpUniforms = {
    scalpBit: { value: -1 },
    scalpColor: { value: new THREE.Color() },
    scalpStrength: { value: 0 },
    beardBit: { value: -1 },
    beardColor: { value: new THREE.Color() },
    beardStrength: { value: 0 },
  };
  m.userData.scalp = uniforms;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    if (THREE.ShaderChunk.lights_physical_pars_fragment.includes(LAMBERT_DIRECT)) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_physical_pars_fragment>',
        THREE.ShaderChunk.lights_physical_pars_fragment.replace(LAMBERT_DIRECT, WRAPPED_DIRECT)
      );
    }
    shader.vertexShader = [
      'attribute float _scalp;',
      'uniform float scalpBit;',
      'uniform float beardBit;',
      'varying float vScalp;',
      'varying float vBeard;',
      'float maskBit( float bit ) { return bit < 0.0 ? 0.0 : mod( floor( _scalp / exp2( bit ) ), 2.0 ); }',
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n\tvScalp = maskBit( scalpBit );\n\tvBeard = maskBit( beardBit );'
      ),
    ].join('\n');
    shader.fragmentShader = [
      'uniform vec3 scalpColor;',
      'uniform float scalpStrength;',
      'uniform vec3 beardColor;',
      'uniform float beardStrength;',
      'varying float vScalp;',
      'varying float vBeard;',
      shader.fragmentShader.replace(
        '#include <map_fragment>',
        [
          '#include <map_fragment>',
          // Per-texel grain breaks the tint into short hairs instead of a flat wash.
          '\tfloat grain = 1.0;',
          '\t#ifdef USE_MAP',
          '\t\tgrain = mix( 0.5, 1.0, fract( sin( dot( floor( vMapUv * 2048.0 ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) );',
          '\t#endif',
          '\tdiffuseColor.rgb = mix( diffuseColor.rgb, scalpColor, vScalp * scalpStrength * grain );',
          '\tdiffuseColor.rgb = mix( diffuseColor.rgb, beardColor, vBeard * beardStrength * grain );',
        ].join('\n')
      ),
    ].join('\n');
  };
  m.customProgramCacheKey = () => 'avatar-skin';
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

/** Shades facial-hair region `bit` (-1: none) in the facial hair colour. */
export function setBeard(root: THREE.Object3D, bit: number, hex: string, strength: number) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const u = m.userData.scalp as ScalpUniforms | undefined;
      if (!u) continue;
      u.beardBit.value = bit;
      u.beardColor.value.set(hex).multiplyScalar(0.7);
      u.beardStrength.value = bit < 0 ? 0 : strength;
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
