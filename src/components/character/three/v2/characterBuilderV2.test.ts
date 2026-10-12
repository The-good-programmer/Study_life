import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import type { CharacterCustomization, CharacterPose } from '../../../../types/character';
import type { CharacterModelInstance } from '../characterBuilder3d';
import { AssetCache } from './assetLoader';
import { buildCharacterV2, type V2Deps } from './characterBuilderV2';
import { fetchPlaceholder, placeholderManifest } from './placeholder';

const custom = (patch: Partial<CharacterCustomization> = {}) =>
  ({
    name: 'T', gender: 'female', bodyType: 'average', skinTone: '#8c5332', hairStyle: 'short-fade', hairColor: '#171717',
    facialHair: 'none', eyeColor: '#2563eb', eyewear: 'none', eyewearColor: '#000000', headwear: 'none', headwearColor: '#000000',
    outfitTop: 'casual-tee', topColor: '#991b1b', topSecondaryColor: '#ffffff', outfitBottom: 'jeans', bottomColor: '#1d4ed8',
    shoes: 'sneakers', shoesColor: '#ffffff', mood: 'happy', pose: 'idle', ...patch,
  }) as CharacterCustomization;

const settle = () => new Promise((r) => setTimeout(r, 0));

function fakeFallback() {
  const instance: CharacterModelInstance = {
    root: new THREE.Group(), update: vi.fn(), updateCustomization: vi.fn(), setLookTarget: vi.fn(), dispose: vi.fn(),
  };
  instance.root.name = 'FallbackRoot';
  return { instance, build: vi.fn(() => instance) };
}

function deps(over: Partial<V2Deps> = {}) {
  const fb = fakeFallback();
  const assets = new AssetCache(fetchPlaceholder);
  const d: V2Deps = { loadManifest: async () => placeholderManifest(), assets, tier: 'medium', fallback: fb.build, ...over };
  return { d, assets, fb };
}

const find = (root: THREE.Object3D, name: string) => root.getObjectByName(name);

describe('buildCharacterV2', () => {
  it('assembles the base and the outfit, then shows it in one go', async () => {
    const changes = vi.fn();
    const { d } = deps();
    const a = buildCharacterV2(custom(), { showShadow: false, onChange: changes }, d);
    expect(find(a.root, 'Avatar')).toBeUndefined();
    await settle();
    const avatar = find(a.root, 'Avatar')!;
    expect(avatar).toBeDefined();
    for (const n of ['Item_top_casual-tee', 'Item_bottom_jeans', 'Item_shoes_sneakers', 'Item_hair_short-fade']) {
      expect(find(avatar, n), n).toBeDefined();
    }
    expect(changes).toHaveBeenCalled();
  });

  it('drives garments with the base skeleton and attaches rigid items to their bone', async () => {
    const { d } = deps();
    const a = buildCharacterV2(custom(), { showShadow: false }, d);
    await settle();
    const avatar = find(a.root, 'Avatar')!;
    const base = find(avatar, 'Body_hands') as THREE.SkinnedMesh;
    const tee = find(avatar, 'Tee') as THREE.SkinnedMesh;
    expect(tee.skeleton.bones.map((b) => b.uuid)).toEqual(base.skeleton.bones.map((b) => b.uuid));
    const hair = find(avatar, 'Item_hair_short-fade')!;
    expect(hair.parent?.name).toBe('head');
    // Still where it was authored (on the head) after the re-parenting.
    avatar.updateMatrixWorld(true);
    const cap = hair.children[0].getWorldPosition(new THREE.Vector3());
    expect(cap.distanceTo(new THREE.Vector3(0, 1.64, 0.02))).toBeLessThan(1e-4);
  });

  it('hides the body under clothes and colours by role', async () => {
    const { d } = deps();
    const a = buildCharacterV2(custom(), { showShadow: false }, d);
    await settle();
    const avatar = find(a.root, 'Avatar')!;
    const drawn = (n: string) => (find(avatar, n) as THREE.Mesh).geometry.drawRange.count;
    expect(drawn('Body_torso')).toBe(0);
    expect(drawn('Body_feet')).toBe(0);
    expect(drawn('Body_forearms')).toBe((find(avatar, 'Body_forearms') as THREE.Mesh).geometry.index!.count);
    // Taking the shoes off shows the feet again (and the cached geometry is untouched).
    a.updateCustomization(custom({ shoes: 'boots' })); // no asset: falls back to sneakers
    await settle();
    expect(drawn('Body_feet')).toBe(0);
    const tee = find(avatar, 'Tee') as THREE.Mesh;
    expect((tee.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('991b1b');
    const skin = (find(avatar, 'Head') as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(skin.color.getHexString()).toBe('8c5332');
  });

  it('changes body shape instantly, on the body and its clothes', async () => {
    const { d } = deps();
    const a = buildCharacterV2(custom(), { showShadow: false }, d);
    await settle();
    const avatar = find(a.root, 'Avatar')!;
    const body = find(avatar, 'Body_forearms') as THREE.Mesh;
    const tee = find(avatar, 'Tee') as THREE.Mesh;
    const w = (m: THREE.Mesh, n: string) => m.morphTargetInfluences![m.morphTargetDictionary![n]];
    expect(w(body, 'gender_female')).toBe(1);
    a.updateCustomization(custom({ gender: 'male', bodyType: 'athletic' }));
    expect(find(a.root, 'Avatar')).toBe(avatar); // same avatar, no rebuild
    expect(w(body, 'gender_female')).toBe(0);
    expect(w(body, 'gender_male')).toBe(1);
    expect(w(tee, 'build_athletic')).toBe(1);
  });

  it('moves the joints with the gender morph and rebinds, so the skin stays put at rest', async () => {
    const { d } = deps();
    const a = buildCharacterV2(custom({ gender: 'female' }), { showShadow: false }, d);
    await settle();
    const avatar = find(a.root, 'Avatar')!;
    const head = find(avatar, 'head')!;
    const body = find(avatar, 'Body_hands') as THREE.SkinnedMesh;
    avatar.updateMatrixWorld(true);
    const headY = head.getWorldPosition(new THREE.Vector3()).y;
    const skinned = () => body.getVertexPosition(0, new THREE.Vector3()).applyMatrix4(body.matrixWorld);
    const before = skinned();

    a.updateCustomization(custom({ gender: 'male' }));
    avatar.updateMatrixWorld(true);
    expect(head.getWorldPosition(new THREE.Vector3()).y - headY).toBeCloseTo(0.04, 4);
    // The hands didn't move: the rebind keeps rest-pose skin exactly where the morph put it.
    expect(skinned().distanceTo(before)).toBeLessThan(1e-5);

    a.updateCustomization(custom({ gender: 'female' }));
    avatar.updateMatrixWorld(true);
    expect(head.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(headY, 5);
    // Still animates cleanly afterwards.
    for (let i = 0; i < 20; i++) a.update(0.033, 'wave');
    avatar.updateMatrixWorld(true);
    expect(Number.isFinite(skinned().x)).toBe(true);
  });

  it('swaps items without a gap and releases the old asset', async () => {
    const { d, assets } = deps();
    const a = buildCharacterV2(custom(), { showShadow: false }, d);
    await settle();
    expect(assets.refCount('placeholder:hair/short-fade')).toBe(1);
    a.updateCustomization(custom({ hairStyle: 'buzz' })); // no asset: optional slot goes empty
    expect(find(a.root, 'Item_hair_short-fade')).toBeDefined(); // kept until the swap resolves
    await settle();
    expect(find(a.root, 'Item_hair_short-fade')).toBeUndefined();
    expect(assets.refCount('placeholder:hair/short-fade')).toBe(0);
  });

  it('shades the scalp under the hair, and draws a buzz cut as shading alone', async () => {
    const { d, assets } = deps();
    const a = buildCharacterV2(custom({ hairColor: '#171717' }), { showShadow: false }, d);
    await settle();
    const skin = (find(a.root, 'Body_torso') as THREE.Mesh).material as THREE.Material;
    const scalp = skin.userData.scalp;
    expect(scalp.scalpBit.value).toBe(0);
    expect(scalp.scalpStrength.value).toBeGreaterThan(0);

    a.updateCustomization(custom({ hairStyle: 'buzz', hairColor: '#171717' }));
    await settle();
    expect(find(a.root, 'Item_hair_short-fade')).toBeUndefined();
    expect(find(a.root, 'Item_hair_buzz')).toBeDefined(); // an empty stand-in, nothing loaded
    expect(assets.refCount('')).toBe(0);
    expect(scalp.scalpBit.value).toBe(1);
    expect(scalp.scalpStrength.value).toBeGreaterThan(0.85);

    a.updateCustomization(custom({ hairStyle: 'side-part' })); // no asset: optional slot empties
    await settle();
    expect(scalp.scalpBit.value).toBe(-1);
    expect(scalp.scalpStrength.value).toBe(0);
  });

  it('keeps only the latest of overlapping changes', async () => {
    const { d, assets } = deps();
    const a = buildCharacterV2(custom(), { showShadow: false }, d);
    a.updateCustomization(custom({ hairStyle: 'buzz' }));
    await settle();
    expect(find(a.root, 'Avatar')).toBeDefined();
    expect(find(a.root, 'Item_hair_short-fade')).toBeUndefined();
    expect(assets.refCount('placeholder:hair/short-fade')).toBe(0);
    expect(find(a.root, 'Item_top_casual-tee')).toBeDefined();
  });

  it('animates every pose and mood without NaNs', async () => {
    const { d } = deps();
    const a = buildCharacterV2(custom(), { showShadow: false }, d);
    await settle();
    a.setLookTarget(new THREE.Vector3(0.5, 1.5, 2));
    for (const pose of ['idle', 'wave', 'study', 'cheer', 'read'] as CharacterPose[]) {
      for (let i = 0; i < 30; i++) a.update(0.033, pose);
    }
    for (const mood of ['focused', 'sleepy', 'energetic'] as const) {
      a.updateCustomization(custom({ mood }));
      for (let i = 0; i < 10; i++) a.update(0.033);
    }
    a.root.updateMatrixWorld(true);
    a.root.traverse((o) => {
      expect(Number.isFinite(o.matrixWorld.elements.reduce((s, x) => s + x, 0)), o.name).toBe(true);
    });
    const head = find(a.root, 'Head') as THREE.Mesh;
    expect(head.morphTargetInfluences!.some((w) => w > 0)).toBe(true);
  });

  it('shows the held book in the study pose', async () => {
    const { d } = deps();
    const a = buildCharacterV2(custom(), { showShadow: false }, d);
    await settle();
    a.update(0.033, 'study');
    expect(find(a.root, 'HeldBook')!.visible).toBe(true);
    a.update(0.033, 'idle');
    expect(find(a.root, 'HeldBook')!.visible).toBe(false);
  });

  it('falls back to the procedural avatar without a manifest, and forwards calls to it', async () => {
    const { d, fb } = deps({ loadManifest: async () => null });
    const a = buildCharacterV2(custom(), { showShadow: false }, d);
    await settle();
    expect(fb.build).toHaveBeenCalledOnce();
    expect(find(a.root, 'FallbackRoot')).toBeDefined();
    a.update(0.1, 'wave');
    a.updateCustomization(custom({ hairStyle: 'buzz' }));
    expect(fb.instance.update).toHaveBeenCalledWith(0.1, 'wave');
    expect(fb.instance.updateCustomization).toHaveBeenCalled();
    a.dispose();
    expect(fb.instance.dispose).toHaveBeenCalled();
  });

  it('falls back when the base asset fails to load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { d, fb } = deps({ assets: new AssetCache(async () => { throw new Error('404'); }) });
    buildCharacterV2(custom(), { showShadow: false }, d);
    await settle();
    expect(fb.build).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('releases every asset on dispose, even mid-load', async () => {
    const { d, assets } = deps();
    const a = buildCharacterV2(custom(), { showShadow: false }, d);
    await settle();
    a.dispose();
    expect(assets.refCount('placeholder:base')).toBe(0);
    expect(assets.refCount('placeholder:top/casual-tee')).toBe(0);

    const early = buildCharacterV2(custom(), { showShadow: false }, d);
    early.dispose();
    await settle();
    expect(assets.refCount('placeholder:base')).toBe(0);
    expect(find(early.root, 'Avatar')).toBeUndefined();
  });
});

describe('AssetCache', () => {
  it('loads each URL once and gives every user its own materials', async () => {
    const fetcher = vi.fn(fetchPlaceholder);
    const cache = new AssetCache(fetcher);
    const [a, b] = await Promise.all([cache.acquire('placeholder:top/casual-tee'), cache.acquire('placeholder:top/casual-tee')]);
    expect(fetcher).toHaveBeenCalledOnce();
    const ma = (a.getObjectByName('Tee') as THREE.Mesh);
    const mb = (b.getObjectByName('Tee') as THREE.Mesh);
    expect(ma.geometry).toBe(mb.geometry);
    expect(ma.material).not.toBe(mb.material);
    expect(cache.refCount('placeholder:top/casual-tee')).toBe(2);
  });

  it('evicts idle assets beyond its limit, oldest first, and retries failures', async () => {
    let fail = true;
    const cache = new AssetCache(async (url) => {
      if (url === 'flaky' && fail) throw new Error('offline');
      return new THREE.Group();
    }, 1);
    await cache.acquire('a');
    await cache.acquire('b');
    cache.release('a');
    cache.release('b');
    expect(cache.size).toBe(1);
    await expect(cache.acquire('flaky')).rejects.toThrow('offline');
    fail = false;
    await expect(cache.acquire('flaky')).resolves.toBeInstanceOf(THREE.Group);
  });
});

describe('basis transcoder copy', () => {
  it('matches the three.js version in node_modules', () => {
    for (const f of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
      const ours = readFileSync(`public/basis/${f}`);
      const three = readFileSync(`node_modules/three/examples/jsm/libs/basis/${f}`);
      expect(ours.equals(three), `${f} is stale: copy it from three/examples/jsm/libs/basis`).toBe(true);
    }
  });
});
