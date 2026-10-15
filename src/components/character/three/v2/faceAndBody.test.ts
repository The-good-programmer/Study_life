import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { CharacterMood } from '../../../../types/character';
import { ARKIT_SHAPES, FaceController, MOOD_PRESETS } from './expressions';
import { applyBodyShape, bodyMorphWeights } from './bodyShape';
import { tierFromSignals, TIER_SETTINGS } from './quality';
import {
  applyRoleColors, poreNormals, prepareMaterial, roleOf, setShadowFlags, shortHairs, TEXTURE_ANISOTROPY,
} from './materialsV2';

function morphMesh(names: string[]) {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
  mesh.morphTargetDictionary = Object.fromEntries(names.map((n, i) => [n, i]));
  mesh.morphTargetInfluences = names.map(() => 0);
  return mesh;
}

describe('facial expressions', () => {
  it('builds every mood from valid ARKit shapes with weights in [0, 1]', () => {
    for (const [mood, preset] of Object.entries(MOOD_PRESETS)) {
      expect(Object.keys(preset).length, mood).toBeGreaterThan(0);
      for (const [shape, w] of Object.entries(preset)) {
        expect(ARKIT_SHAPES as readonly string[], `${mood}.${shape}`).toContain(shape);
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(1);
      }
    }
  });

  it('eases toward a mood and writes the weights into the mesh', () => {
    const mesh = morphMesh(['mouthSmileLeft', 'mouthSmileRight', 'jawOpen']);
    const face = new FaceController();
    face.setMeshes(mesh);
    face.setMood('happy');
    face.update(0.016);
    const early = mesh.morphTargetInfluences![0];
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(MOOD_PRESETS.happy.mouthSmileLeft!);
    for (let i = 0; i < 60; i++) face.update(0.016);
    expect(mesh.morphTargetInfluences![0]).toBeCloseTo(MOOD_PRESETS.happy.mouthSmileLeft!, 3);
    face.setMood('energetic' as CharacterMood);
    for (let i = 0; i < 60; i++) face.update(0.016);
    expect(mesh.morphTargetInfluences![2]).toBeCloseTo(MOOD_PRESETS.energetic.jawOpen!, 3);
  });

  it('blinks on its own, closing fully and reopening', () => {
    const mesh = morphMesh(['eyeBlinkLeft', 'eyeBlinkRight']);
    const face = new FaceController();
    face.setMeshes(mesh);
    face.setMood('focused');
    let max = 0;
    for (let i = 0; i < 600; i++) {
      face.update(1 / 60);
      max = Math.max(max, mesh.morphTargetInfluences![0]);
    }
    expect(max).toBeGreaterThan(0.95);
    // Never stuck closed: within a blink's length it is open again.
    let open = false;
    for (let i = 0; i < 30 && !open; i++) {
      face.update(1 / 60);
      open = mesh.morphTargetInfluences![0] < 0.05;
    }
    expect(open).toBe(true);
  });
});

describe('body shape', () => {
  it('maps gender and build onto the shared morphs, neutral for non-binary average', () => {
    expect(bodyMorphWeights('nonbinary', 'average')).toEqual({ gender_male: 0, gender_female: 0, build_slender: 0, build_athletic: 0 });
    expect(bodyMorphWeights('female', 'athletic')).toEqual({ gender_male: 0, gender_female: 1, build_slender: 0, build_athletic: 1 });
  });

  it('sets the same weights on the body and its garments', () => {
    const group = new THREE.Group();
    const body = morphMesh(['gender_male', 'gender_female', 'build_slender', 'build_athletic', 'jawOpen']);
    const tee = morphMesh(['build_athletic', 'gender_male']);
    group.add(body, tee);
    applyBodyShape(group, bodyMorphWeights('male', 'athletic'));
    expect(body.morphTargetInfluences).toEqual([1, 0, 0, 1, 0]);
    expect(tee.morphTargetInfluences).toEqual([1, 1]);
  });
});

describe('quality tiers', () => {
  it('detects phones and weak devices', () => {
    expect(tierFromSignals({ coarsePointer: false, cores: 12, memoryGb: 16 })).toBe('high');
    expect(tierFromSignals({ coarsePointer: true, cores: 8, memoryGb: 8 })).toBe('medium');
    expect(tierFromSignals({ coarsePointer: false, cores: 4 })).toBe('medium');
    expect(tierFromSignals({ coarsePointer: true, cores: 8, memoryGb: 2 })).toBe('low');
    expect(tierFromSignals({ coarsePointer: false, cores: 12, override: 'low' })).toBe('low');
    expect(tierFromSignals({ coarsePointer: true, cores: 2, override: 'nonsense' })).toBe('low');
  });

  it('only runs screen-space AO on the high tier', () => {
    expect(TIER_SETTINGS.high.ambientOcclusion).toBe(true);
    expect(TIER_SETTINGS.medium.ambientOcclusion).toBe(false);
    expect(TIER_SETTINGS.medium.maxPixelRatio).toBeLessThan(TIER_SETTINGS.high.maxPixelRatio);
  });
});

describe('material roles', () => {
  it('reads the role from the material name prefix', () => {
    expect(roleOf('topSecondary_sleeves')).toBe('topSecondary');
    expect(roleOf('top_body')).toBe('top');
    expect(roleOf('hair.001')).toBe('hair');
    expect(roleOf('shoes_sole')).toBe('shoes');
    expect(roleOf('metal_buckle')).toBeNull();
  });

  it('colours role materials from the customization and leaves others alone', () => {
    const top = new THREE.MeshStandardMaterial({ name: 'top_body' });
    const sleeve = new THREE.MeshStandardMaterial({ name: 'topSecondary_sleeve' });
    const buckle = new THREE.MeshStandardMaterial({ name: 'metal_buckle', color: 0x123456 });
    const beard = new THREE.MeshStandardMaterial({ name: 'facialHair_cards' });
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BufferGeometry(), [top, sleeve, buckle]), new THREE.Mesh(new THREE.BufferGeometry(), beard));
    applyRoleColors(g, { topColor: '#ff0000', topSecondaryColor: '#00ff00', hairColor: '#0000ff' } as never);
    expect(top.color.getHexString()).toBe('ff0000');
    expect(sleeve.color.getHexString()).toBe('00ff00');
    expect(buckle.color.getHex()).toBe(0x123456);
    expect(beard.color.getHexString()).toBe('0000ff'); // no facialHairColor: follows the hair
  });

  it('draws brows and lashes in the opaque pass with soft alpha-to-coverage and depth writes', () => {
    // GLTFLoader imports them as blended materials without depth writes.
    for (const name of ['brow_001', 'lash_01']) {
      const card = new THREE.MeshStandardMaterial({ name, transparent: true, depthWrite: false });
      expect(prepareMaterial(card)).toBe(card);
      expect(card.alphaToCoverage).toBe(true);
      expect(card.transparent).toBe(false);
      // Without depth writes, skin drawn later in the opaque pass covered the brows.
      expect(card.depthWrite).toBe(true);
      // No threshold: three.js would sharpen the coverage into a hard edge.
      expect(card.alphaTest).toBe(0);
    }
  });

  it('upgrades skin to a physical material with pores, sheen and subsurface lighting', () => {
    const map = new THREE.Texture();
    const src = new THREE.MeshStandardMaterial({ name: 'skin_body', map });
    const skin = prepareMaterial(src) as THREE.MeshPhysicalMaterial;
    expect(skin.isMeshPhysicalMaterial).toBe(true);
    expect(skin.map).toBe(map);
    expect(skin.normalMap).toBe(poreNormals());
    expect(skin.sheen).toBeGreaterThan(0);
    expect(skin.userData.scalp).toBeDefined();
    // The shader patch swaps three.js's Lambert term for wrapped lighting.
    const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <map_fragment>\n#include <lights_physical_pars_fragment>' };
    skin.onBeforeCompile(shader as never, undefined as never);
    expect(shader.fragmentShader).toContain('skinWrap');
    expect(shader.fragmentShader).not.toContain('#include <lights_physical_pars_fragment>');
    // Facial hair and the scalp are broken into hairs by a filtered texture, not per-pixel noise.
    expect(shader.uniforms).toHaveProperty('shortHairs.value', shortHairs());
    expect(shader.fragmentShader).toContain('texture2D( shortHairs');
    expect(prepareMaterial(skin)).toBe(skin);
  });

  it('upgrades hair to an anisotropic physical material, once', () => {
    const map = new THREE.Texture();
    const src = new THREE.MeshStandardMaterial({ name: 'hair_short01', map, transparent: true, depthWrite: false });
    const hair = prepareMaterial(src) as THREE.MeshPhysicalMaterial;
    expect(hair.isMeshPhysicalMaterial).toBe(true);
    expect(hair.name).toBe('hair_short01');
    expect(hair.map).toBe(map);
    expect(hair.anisotropy).toBeGreaterThan(0.5);
    expect(hair.alphaToCoverage).toBe(true);
    expect(hair.depthWrite).toBe(true);
    expect(hair.alphaTest).toBe(0.5);
    expect(prepareMaterial(hair)).toBe(hair);
    // A smooth strand direction replaces the per-triangle one three.js derives from the UVs.
    const shader = {
      uniforms: {},
      vertexShader: '#include <defaultnormal_vertex>',
      fragmentShader: '#include <lights_physical_fragment>',
    };
    hair.onBeforeCompile(shader as never, undefined as never);
    expect(shader.vertexShader).toContain('vHairFlow =');
    expect(shader.fragmentShader).toContain('material.anisotropyT =');
    // Still coloured by role afterwards.
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BufferGeometry(), hair));
    applyRoleColors(g, { hairColor: '#66391a' } as never);
    expect(hair.color.getHexString()).toBe('66391a');
  });

  it('keeps coily hair nearly isotropic', () => {
    const afro = prepareMaterial(new THREE.MeshStandardMaterial({ name: 'hair_afro01' })) as THREE.MeshPhysicalMaterial;
    expect(afro.anisotropy).toBeLessThan(0.1);
    expect(afro.roughness).toBeGreaterThan(0.6);
  });

  it('tints sheen and highlights from the chosen colours', () => {
    const hair = prepareMaterial(new THREE.MeshStandardMaterial({ name: 'hair_short04' })) as THREE.MeshPhysicalMaterial;
    const skin = prepareMaterial(new THREE.MeshStandardMaterial({ name: 'skin_body' })) as THREE.MeshPhysicalMaterial;
    const brow = prepareMaterial(new THREE.MeshStandardMaterial({ name: 'brow_001' })) as THREE.MeshStandardMaterial;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BufferGeometry(), [hair, skin, brow]));

    applyRoleColors(g, { hairColor: '#171717', skinTone: '#321d13' } as never);
    // Black hair: no light sheen washing it out; dark skin: no grey (ashy) sheen.
    expect(Math.max(hair.sheenColor.r, hair.sheenColor.g, hair.sheenColor.b)).toBeLessThan(0.01);
    expect(Math.max(skin.sheenColor.r, skin.sheenColor.g, skin.sheenColor.b)).toBeLessThan(0.02);
    expect(skin.sheenColor.r).toBeGreaterThan(skin.sheenColor.b);
    // Brows: the hair colour, a little darker.
    expect(brow.color.r).toBeLessThan(hair.color.r);

    applyRoleColors(g, { hairColor: '#963d1e', skinTone: '#e5b88f' } as never);
    // Auburn's highlight is coppery, at full brightness.
    expect(hair.specularColor.r).toBeCloseTo(1, 5);
    expect(hair.specularColor.r).toBeGreaterThan(hair.specularColor.g);
    expect(hair.specularColor.g).toBeGreaterThan(hair.specularColor.b);
  });

  it('filters colour and normal maps anisotropically', () => {
    const map = new THREE.Texture();
    const normalMap = new THREE.Texture();
    prepareMaterial(new THREE.MeshStandardMaterial({ name: 'top_body', map, normalMap }));
    expect(map.anisotropy).toBe(TEXTURE_ANISOTROPY);
    expect(normalMap.anisotropy).toBe(TEXTURE_ANISOTROPY);
    expect(poreNormals().anisotropy).toBe(TEXTURE_ANISOTROPY);
  });

  it('makes the avatar shade itself, without shadows from tiny details or the eyes', () => {
    const mesh = (name: string) => new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ name }));
    for (const name of ['skin_body', 'hair_short04', 'top_body', 'brow_001', 'lash_01', 'eye_cornea']) {
      const m = mesh(name);
      setShadowFlags(m);
      expect(m.receiveShadow, name).toBe(true);
      expect(m.castShadow, name).toBe(!/^(brow|lash|eye)/.test(name));
    }
  });

  it('draws a tiling, mipmapped short-hair mask with partial coverage', () => {
    const tex = shortHairs();
    expect(tex).toBe(shortHairs());
    expect(tex.wrapS).toBe(THREE.RepeatWrapping);
    expect(tex.generateMipmaps).toBe(true);
    const { data, width, height } = tex.image as { data: Uint8Array; width: number; height: number };
    let sum = 0;
    for (let i = 0; i < width * height; i++) sum += data[i * 4];
    const mean = sum / (width * height * 255);
    // Hairs with skin between them: its average (what distance shows) is a partial tint.
    expect(mean).toBeGreaterThan(0.25);
    expect(mean).toBeLessThan(0.7);
  });
});
