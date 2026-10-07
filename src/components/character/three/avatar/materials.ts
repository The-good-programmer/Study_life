import * as THREE from 'three';
import type { CharacterCustomization } from '../../../../types/character';
import { getEyeTexture } from './face';

export interface AvatarMaterials {
  skin: THREE.MeshPhysicalMaterial;
  lid: THREE.MeshPhysicalMaterial;
  hair: THREE.MeshPhysicalMaterial;
  brow: THREE.MeshStandardMaterial;
  facialHair: THREE.MeshPhysicalMaterial;
  eye: THREE.MeshPhysicalMaterial;
  lash: THREE.MeshStandardMaterial;
  /** Tops: zone 0 = main colour, zone 1 = secondary (trims, varsity sleeves). */
  top: THREE.MeshPhysicalMaterial;
  /** Secondary colour as a plain material, for details like drawstrings. */
  topSecondary: THREE.MeshPhysicalMaterial;
  bottom: THREE.MeshPhysicalMaterial;
  /** Shoes: zone 0 = upper, zone 1 = sole, zone 2 = accent. */
  shoes: THREE.MeshPhysicalMaterial;
  button: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  glasses: THREE.MeshStandardMaterial;
  lens: THREE.MeshPhysicalMaterial;
  headwear: THREE.MeshPhysicalMaterial;
  halo: THREE.MeshStandardMaterial;
  bookCover: THREE.MeshStandardMaterial;
  bookPages: THREE.MeshStandardMaterial;
  ribbon: THREE.MeshStandardMaterial;
  applyColors: (c: CharacterCustomization) => void;
  dispose: () => void;
}

/** Cloth: soft diffuse with a sheen highlight at grazing angles. */
function fabric(roughness = 0.88, sheen = 0.6): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({ roughness, metalness: 0, sheen, sheenRoughness: 0.72 });
}

/**
 * Lets one material show up to three colours, chosen per vertex by a `zone`
 * attribute (0, 1, 2). The zone is interpolated across triangles and
 * thresholded with a smoothstep, so colour boundaries cut cleanly through the
 * mesh instead of following its triangles. Meshes without the attribute
 * read zone 0 (WebGL's default), i.e. the material's own colour.
 */
function makeZoned(mat: THREE.MeshPhysicalMaterial, zone1: THREE.Color, zone2: THREE.Color) {
  const uniforms = { zoneColor1: { value: zone1 }, zoneColor2: { value: zone2 } };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.zoneColor1 = uniforms.zoneColor1;
    shader.uniforms.zoneColor2 = uniforms.zoneColor2;
    shader.vertexShader = 'attribute float zone;\nvarying float vZone;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n\tvZone = zone;'
    );
    shader.fragmentShader = 'uniform vec3 zoneColor1;\nuniform vec3 zoneColor2;\nvarying float vZone;\n' + shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      [
        'vec3 zoned = mix( diffuse, zoneColor1, smoothstep( 0.4, 0.6, vZone ) );',
        'zoned = mix( zoned, zoneColor2, smoothstep( 1.4, 1.6, vZone ) );',
        'vec4 diffuseColor = vec4( zoned, opacity );',
      ].join('\n\t')
    );
  };
  mat.customProgramCacheKey = () => 'avatar-zoned';
}

const lighten = (hex: string, amount: number) => new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), amount);
const luminance = (hex: string) => {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};

/**
 * Fabric base colour, with near-white capped so it keeps its shading instead
 * of clipping to flat white under the tone mapper.
 */
function fabricColor(hex: string): THREE.Color {
  const c = new THREE.Color(hex);
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return lum > 0.72 ? c.multiplyScalar(0.72 / lum) : c;
}

/** Lip tint: the skin tone pulled toward a warm rose. */
export function lipColorFor(c: CharacterCustomization): string {
  const rose = c.gender === 'female' ? '#c2566b' : '#b0645a';
  return new THREE.Color(c.skinTone).lerp(new THREE.Color(rose), 0.5).getStyle();
}

export function createAvatarMaterials(initial: CharacterCustomization): AvatarMaterials {
  const skin = new THREE.MeshPhysicalMaterial({
    roughness: 0.6,
    metalness: 0,
    sheen: 0.45,
    sheenRoughness: 0.55,
  });
  const hair = new THREE.MeshPhysicalMaterial({
    roughness: 0.62,
    metalness: 0,
    sheen: 0.3,
    sheenRoughness: 0.45,
  });
  const facialHair = hair.clone();
  // Brows: matte, a little darker than the hair (thin strokes read too light otherwise).
  const brow = new THREE.MeshStandardMaterial({ roughness: 0.85 });

  const topSecondaryColor = new THREE.Color();
  const soleColor = new THREE.Color();
  const accentColor = new THREE.Color();
  const top = fabric();
  makeZoned(top, topSecondaryColor, topSecondaryColor);
  const shoes = new THREE.MeshPhysicalMaterial({ roughness: 0.55, sheen: 0.35, sheenRoughness: 0.6 });
  makeZoned(shoes, soleColor, accentColor);

  const m = {
    skin,
    lid: skin.clone(),
    hair,
    brow,
    facialHair,
    eye: new THREE.MeshPhysicalMaterial({
      map: getEyeTexture(initial.eyeColor),
      roughness: 0.32,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
    }),
    lash: new THREE.MeshStandardMaterial({ color: 0x1c1416, roughness: 0.75 }),
    top,
    topSecondary: fabric(),
    bottom: fabric(0.9, 0.5),
    shoes,
    button: new THREE.MeshStandardMaterial({ color: 0xf2efe9, roughness: 0.35 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe0b04a, roughness: 0.28, metalness: 0.9 }),
    glasses: new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.5 }),
    lens: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
      roughness: 0.05,
      clearcoat: 1,
      depthWrite: false,
    }),
    headwear: fabric(0.8, 0.5),
    halo: new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xfbbf24, emissiveIntensity: 1.4, roughness: 0.4 }),
    bookCover: new THREE.MeshStandardMaterial({ color: 0x2f5fd0, roughness: 0.55 }),
    bookPages: new THREE.MeshStandardMaterial({ color: 0xfbf6ea, roughness: 0.9 }),
    ribbon: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 }),
  };

  const applyColors = (c: CharacterCustomization) => {
    m.skin.color.set(c.skinTone);
    m.skin.sheenColor.copy(lighten(c.skinTone, 0.55)).lerp(new THREE.Color('#ff9e8a'), 0.25);
    m.lid.color.set(c.skinTone).multiplyScalar(0.93).lerp(new THREE.Color('#b0645a'), 0.05);
    m.lid.sheenColor.copy(m.skin.sheenColor);
    m.hair.color.set(c.hairColor);
    m.hair.sheenColor.copy(lighten(c.hairColor, 0.25));
    m.brow.color.set(c.facialHairColor || c.hairColor).multiplyScalar(0.8);
    m.facialHair.color.set(c.facialHairColor || c.hairColor);
    m.facialHair.sheenColor.copy(lighten(c.facialHairColor || c.hairColor, 0.3));

    // A lab coat is always white; its secondary zone is the shirt underneath.
    const mainTop = c.outfitTop === 'lab-coat' ? '#f4f6f8' : c.topColor;
    m.top.color.copy(fabricColor(mainTop));
    m.top.sheenColor.copy(lighten(mainTop, 0.3)).multiplyScalar(0.7);
    topSecondaryColor.copy(fabricColor(c.topSecondaryColor));
    m.topSecondary.color.copy(topSecondaryColor);
    m.topSecondary.sheenColor.copy(lighten(c.topSecondaryColor, 0.3)).multiplyScalar(0.7);
    m.bottom.color.copy(fabricColor(c.bottomColor));
    m.bottom.sheenColor.copy(lighten(c.bottomColor, 0.25)).multiplyScalar(0.7);

    m.shoes.color.set(c.shoesColor);
    m.shoes.sheenColor.copy(lighten(c.shoesColor, 0.4));
    const dressShoe = c.shoes === 'loafers' || c.shoes === 'boots';
    soleColor.set(dressShoe ? '#2a1d16' : '#ecebe7');
    accentColor.set(luminance(c.shoesColor) > 0.6 ? c.topColor : '#f8fafc');

    m.glasses.color.set(c.eyewearColor);
    m.glasses.metalness = c.eyewear === 'wireframe' || c.eyewear === 'round' ? 0.85 : 0.1;
    m.glasses.roughness = c.eyewear === 'thick-frame' ? 0.4 : 0.25;
    m.lens.color.set(c.eyewear === 'sunglasses' ? '#111827' : '#ffffff');
    m.lens.opacity = c.eyewear === 'sunglasses' ? 0.82 : 0.16;
    m.headwear.color.set(c.headwearColor);
    m.headwear.sheenColor.copy(lighten(c.headwearColor, 0.4));
  };

  // Materials on sculpted meshes multiply in their baked ambient occlusion.
  for (const mat of [m.skin, m.hair, m.facialHair, m.top, m.topSecondary, m.bottom, m.shoes, m.headwear]) {
    mat.vertexColors = true;
  }
  applyColors(initial);

  return {
    ...m,
    applyColors,
    dispose: () => {
      for (const mat of Object.values(m)) mat.dispose();
    },
  };
}
