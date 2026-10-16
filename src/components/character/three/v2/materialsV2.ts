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

/** The part of a material name before the first separator (`hair` for `hair.001`). */
const prefixOf = (materialName: string) => materialName.split(/[_.\s-]/)[0];

export function roleOf(materialName: string): MaterialRole | null {
  const prefix = prefixOf(materialName);
  return prefix in MATERIAL_ROLES ? (prefix as MaterialRole) : null;
}

/**
 * Hair, brows, lashes and beard cards: textures with see-through strands,
 * drawn in the opaque pass with alpha-to-coverage (MSAA resolves the
 * strand edges, so nothing needs sorting). GLTFLoader imports them as
 * blended materials with depth writes off; they need depth writes in the
 * opaque pass, or skin drawn after them covers them.
 */
const CARD_PREFIXES = new Set(['hair', 'brow', 'facialHair', 'lash']);

/** Roles drawn as strands: they get an anisotropic, hair-like highlight. */
const STRAND_ROLES = new Set<MaterialRole>(['hair', 'facialHair']);

/** Small details that would only add shadow-map noise (and the eyes, whose cornea would shade the iris). */
const NO_SHADOW_CAST = new Set(['brow', 'lash', 'eye', 'iris']);

/**
 * Anisotropic filtering for colour and normal maps, so cloth and skin stay
 * sharp at grazing angles. three.js clamps it to what the GPU supports.
 */
export const TEXTURE_ANISOTROPY = 8;

/**
 * One-time setup when an asset joins an avatar. Returns the material to use,
 * which may be a replacement (hair and skin are upgraded to physical
 * materials); calling it again on its result is a no-op.
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
  if (CARD_PREFIXES.has(prefixOf(m.name))) {
    out.transparent = false;
    out.depthWrite = true;
    out.alphaToCoverage = true;
    // A threshold makes three.js sharpen the coverage into a crisp,
    // antialiased cut there: strands keep their shape on hair. Brows and
    // lashes are soft strokes, so they keep the raw alpha (soft edges).
    out.alphaTest = role && STRAND_ROLES.has(role) ? HAIR_ALPHA_CUTOFF : 0;
    out.side = THREE.DoubleSide;
  }
  filterTextures(out);
  out.userData.prepared = true;
  return out;
}

/**
 * Shadow flags for one avatar mesh: everything receives shadows (so the
 * avatar shades itself: hair on the forehead, arms on the torso), and all
 * but tiny details and the eyes cast them.
 */
export function setShadowFlags(mesh: THREE.Mesh) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mesh.receiveShadow = true;
  mesh.castShadow = !mats.some((m) => NO_SHADOW_CAST.has(prefixOf(m.name)));
}

function filterTextures(m: THREE.Material) {
  const std = m as THREE.MeshStandardMaterial;
  for (const tex of [std.map, std.normalMap]) {
    if (!tex || tex.anisotropy >= TEXTURE_ANISOTROPY) continue;
    tex.anisotropy = TEXTURE_ANISOTROPY;
    tex.needsUpdate = true; // the setting is applied on upload
  }
}

/** Where hair's alpha-to-coverage cut sits (see prepareMaterial). */
const HAIR_ALPHA_CUTOFF = 0.5;

/** Coily hair scatters light every way: no long highlight along the strands. */
const isCoily = (materialName: string) => /afro|coil|curl/i.test(materialName);

/**
 * Hair shading: real hair reads through a narrow highlight band running
 * across the strands (anisotropic specular) and a soft sheen at grazing
 * angles, both in the hair's own hue (see tintHair), so dark hair stays
 * dark. Coily hair is rougher and nearly isotropic.
 *
 * Without stored tangents, three.js derives the strand direction per
 * triangle from the UVs, which shades every card facet differently (a scaly
 * look). Instead, a smooth, procedural strand direction is used: strands fall
 * down and back from the crown, following the head as it moves.
 */
function hairMaterial(src: THREE.MeshStandardMaterial): THREE.MeshPhysicalMaterial {
  const coily = isCoily(src.name);
  const hair = new THREE.MeshPhysicalMaterial({
    name: src.name,
    map: src.map,
    color: src.color,
    normalMap: src.normalMap,
    roughness: coily ? 0.72 : 0.46,
    metalness: 0,
    anisotropy: coily ? 0.05 : 0.6,
    specularIntensity: coily ? 0.4 : 0.6,
    sheen: 1,
    sheenRoughness: coily ? 0.6 : 0.4,
    // The studio environment is a bright white room: on hair its reflection
    // reads as a grey film over dark colours.
    envMapIntensity: 0.5,
  });
  hair.userData = { ...src.userData };
  hair.onBeforeCompile = (shader) => {
    shader.vertexShader = [
      'varying vec3 vHairFlow;',
      shader.vertexShader.replace(
        '#include <defaultnormal_vertex>',
        [
          '#include <defaultnormal_vertex>',
          // Down and back in the avatar's bind space (it faces +Z), then skinned like a tangent.
          '\tvec3 hairFlow = vec3( 0.0, -0.93, -0.37 );',
          '\t#ifdef USE_SKINNING',
          '\t\thairFlow = ( skinMatrix * vec4( hairFlow, 0.0 ) ).xyz;',
          '\t#endif',
          '\tvHairFlow = ( modelViewMatrix * vec4( hairFlow, 0.0 ) ).xyz;',
        ].join('\n')
      ),
    ].join('\n');
    shader.fragmentShader = [
      'varying vec3 vHairFlow;',
      shader.fragmentShader.replace(
        '#include <lights_physical_fragment>',
        [
          '#include <lights_physical_fragment>',
          '#ifdef USE_ANISOTROPY',
          // The strand direction on this surface; the rough axis (T) runs across the strands.
          '\tvec3 hairAlong = vHairFlow - normal * dot( vHairFlow, normal );',
          '\tif ( dot( hairAlong, hairAlong ) > 1e-8 ) {',
          '\t\tmaterial.anisotropyB = normalize( hairAlong );',
          '\t\tmaterial.anisotropyT = cross( material.anisotropyB, normal );',
          '\t}',
          '#endif',
          // Strand detail in the highlight: painted strands catch the light, the gaps between them
          // less. Without it, dark hair (whose texture barely shows) shades like a smooth helmet.
          '#ifdef USE_MAP',
          '\tfloat hairStrand = clamp( 4.0 * dot( sampledDiffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ), 0.3, 1.8 );',
          '\tmaterial.specularColor *= hairStrand;',
          '\tmaterial.specularColorBlended *= hairStrand;',
          '#endif',
        ].join('\n')
      ),
    ].join('\n');
  };
  hair.customProgramCacheKey = () => 'avatar-hair';
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
  shortHairs: { value: THREE.Texture };
}

/**
 * Skin as a physical material: a soft sheen in the skin's own colour (peach
 * fuzz; see tintSkin), a faint second specular lobe (the skin's oily layer,
 * as a low clearcoat) and tiled micro-normals for pores. The subsurface look
 * comes from the shader patch in addScalpShading (wrapped diffuse lighting).
 * Specular stays low at grazing angles too: a strong white Fresnel rim is
 * what makes skin read as plastic.
 */
function skinMaterial(src: THREE.MeshStandardMaterial): THREE.MeshPhysicalMaterial {
  const skin = new THREE.MeshPhysicalMaterial({
    name: src.name,
    map: src.map,
    color: src.color,
    roughness: 0.5,
    metalness: 0,
    specularIntensity: 0.45,
    sheen: 1,
    sheenRoughness: 0.6,
    clearcoat: 0.08,
    clearcoatRoughness: 0.38,
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
  poreTexture = tilingTexture(data, size);
  poreTexture.repeat.set(72, 72);
  return poreTexture;
}

let shortHairTexture: THREE.DataTexture | null = null;

/** How often the short-hair mask repeats across the body's UV atlas (a tile is about 2.5 cm of skin). */
const SHORT_HAIR_REPEAT = 40;

/**
 * A small tiling mask of short, soft-edged hairs (1 on a hair, 0 between),
 * drawn procedurally. The skin shader breaks stubble, beards and the scalp
 * under a hairstyle into hairs with it. Being a mipmapped texture, it fades
 * to its average with distance instead of shimmering like per-pixel noise.
 */
export function shortHairs(): THREE.DataTexture {
  if (shortHairTexture) return shortHairTexture;
  const size = 128;
  const cover = new Float32Array(size * size);
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const wrap = (v: number) => ((v % size) + size) % size;
  for (let i = 0; i < 900; i++) {
    const cx = rand() * size, cy = rand() * size;
    // Facial hair grows down the face, which is +U on the body's UV atlas.
    const angle = (rand() - 0.5) * 0.8;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const half = 2.5 + rand() * 3;
    const radius = 0.55 + rand() * 0.35;
    const reach = Math.ceil(half + radius + 1);
    for (let y = Math.floor(cy) - reach; y <= Math.floor(cy) + reach; y++) {
      for (let x = Math.floor(cx) - reach; x <= Math.floor(cx) + reach; x++) {
        const px = x + 0.5 - cx, py = y + 0.5 - cy;
        const t = Math.max(-half, Math.min(half, px * dx + py * dy));
        const d = Math.hypot(px - t * dx, py - t * dy);
        // An antialiased stroke that thins towards its tip.
        const r = radius * (1 - (0.4 * (t + half)) / (2 * half));
        const k = wrap(y) * size + wrap(x);
        cover[k] = Math.max(cover[k], Math.min(1, Math.max(0, r + 0.5 - d)));
      }
    }
  }
  const data = new Uint8Array(size * size * 4);
  for (let k = 0; k < size * size; k++) data.fill(Math.round(cover[k] * 255), k * 4, k * 4 + 4);
  shortHairTexture = tilingTexture(data, size);
  return shortHairTexture;
}

/** A repeating, mipmapped data texture (mipmaps average detail away with distance). */
function tilingTexture(data: Uint8Array, size: number) {
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = TEXTURE_ANISOTROPY;
  tex.needsUpdate = true;
  return tex;
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

/**
 * Tints the scalp under the worn hairstyle with the hair colour, so the
 * hairline fades into the hair instead of meeting it at a hard edge, and so
 * a buzz cut can be shading alone. Facial hair (stubble, goatee, beard) is
 * a second, independent channel on the same mask. The body carries a
 * `_scalp` bit mask (one bit per hairstyle or face region, see manifest.ts);
 * each bit is interpolated across a triangle, which softens edges over about
 * a centimetre. Both tints are broken into short hairs (see shortHairs).
 */
function addScalpShading(m: THREE.Material) {
  const uniforms: ScalpUniforms = {
    scalpBit: { value: -1 },
    scalpColor: { value: new THREE.Color() },
    scalpStrength: { value: 0 },
    beardBit: { value: -1 },
    beardColor: { value: new THREE.Color() },
    beardStrength: { value: 0 },
    shortHairs: { value: shortHairs() },
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
      'uniform sampler2D shortHairs;',
      'varying float vScalp;',
      'varying float vBeard;',
      // Hairs take the full tint; the skin between them less, the less dense the growth (stubble vs beard).
      'float hairTint( float strength, float hairs ) { return strength * mix( 0.75 * strength, 1.0, hairs ); }',
      shader.fragmentShader.replace(
        '#include <map_fragment>',
        [
          '#include <map_fragment>',
          '\tfloat hairs = 1.0;',
          '\t#ifdef USE_MAP',
          `\t\thairs = texture2D( shortHairs, vMapUv * ${SHORT_HAIR_REPEAT.toFixed(1)} ).r;`,
          '\t#endif',
          '\tdiffuseColor.rgb = mix( diffuseColor.rgb, scalpColor, vScalp * hairTint( scalpStrength, hairs ) );',
          '\tdiffuseColor.rgb = mix( diffuseColor.rgb, beardColor, vBeard * hairTint( beardStrength, hairs ) );',
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
      if (!role || !hex || !std.color) continue;
      std.color.set(hex);
      tintLayers(m, role);
    }
  });
}

/** Brows read a little darker than the hair (thin strokes look lighter than they are). */
const BROW_SHADE = 0.8;
/** Skin's sheen (peach fuzz) in the skin's own colour: a fixed grey one looks ashy on dark tones. */
const SKIN_SHEEN = 0.35;
/** How far hair's highlight is whitened from the hair's hue (real highlights are partly uncoloured). */
const HAIR_HIGHLIGHT_WHITE = 0.4;
const HAIR_SHEEN = 0.5;
const WHITE = new THREE.Color(1, 1, 1);

/** Colours that follow a material's base colour once it is set. */
function tintLayers(m: THREE.Material, role: MaterialRole) {
  const p = m as THREE.MeshPhysicalMaterial;
  if (role === 'brow') p.color.multiplyScalar(BROW_SHADE);
  if (!p.isMeshPhysicalMaterial) return;
  if (role === 'skin') p.sheenColor.copy(p.color).multiplyScalar(SKIN_SHEEN);
  if (STRAND_ROLES.has(role)) {
    // The highlight takes the hair's hue at full brightness; the sheen its actual colour, so dark hair stays dark.
    const peak = Math.max(p.color.r, p.color.g, p.color.b, 1e-4);
    p.specularColor.setRGB(p.color.r / peak, p.color.g / peak, p.color.b / peak).lerp(WHITE, HAIR_HIGHLIGHT_WHITE);
    p.sheenColor.copy(p.color).multiplyScalar(HAIR_SHEEN);
  }
}

function colourFor(role: MaterialRole, c: CharacterCustomization): string | null {
  if (role === 'facialHair') return c.facialHairColor ?? c.hairColor;
  const v = c[MATERIAL_ROLES[role]];
  return typeof v === 'string' && v ? v : null;
}
