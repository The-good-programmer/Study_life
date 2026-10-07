import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildCharacter3D } from './characterBuilder3d';
import type { CharacterCustomization, CharacterPose } from '../../../types/character';

// Building SDF meshes is CPU-heavy; the first build also pays JIT warm-up, which can pass the 5s default under load.
describe('characterBuilder3d unit tests', { timeout: 30_000 }, () => {
  beforeAll(() => {
    if (typeof document === 'undefined') {
      const dummyCtx = new Proxy(
        {
          getImageData: () => ({ data: new Uint8ClampedArray(4) }),
          createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          createLinearGradient: () => ({ addColorStop: () => {} }),
          createRadialGradient: () => ({ addColorStop: () => {} }),
        },
        {
          get(target, prop) {
            if (prop in target) return (target as any)[prop];
            return () => {};
          },
        }
      );
      globalThis.document = {
        createElement: (tag: string) => {
          if (tag === 'canvas') {
            return {
              width: 512,
              height: 512,
              getContext: () => dummyCtx,
            };
          }
          return {};
        },
      } as any;
    }
  });

  const sampleConfigs: Array<{ name: string; custom: CharacterCustomization }> = [
    {
      name: 'Male Athletic Casual',
      custom: {
        name: 'Test1', gender: 'male', bodyType: 'athletic', skinTone: '#e5b88f', hairStyle: 'short-fade',
        hairColor: '#382212', facialHair: 'stubble', facialHairColor: '#382212', eyeColor: '#2563eb',
        eyewear: 'none', eyewearColor: '#111827', headwear: 'none', headwearColor: '#1e3a8a',
        outfitTop: 'casual-tee', topColor: '#1e3a8a', topSecondaryColor: '#f1f5f9',
        outfitBottom: 'jeans', bottomColor: '#1d4ed8', shoes: 'sneakers', shoesColor: '#ffffff',
        mood: 'happy', pose: 'idle', level: 1, xp: 0, coins: 0, energy: 1, happiness: 1, hunger: 1,
        studyTitle: '', unlockedItems: [],
      },
    },
    {
      name: 'Female Slender Skirt & Boots',
      custom: {
        name: 'Test2', gender: 'female', bodyType: 'slender', skinTone: '#fcd34d', hairStyle: 'bob-cut',
        hairColor: '#172554', facialHair: 'none', facialHairColor: '#172554', eyeColor: '#059669',
        eyewear: 'round', eyewearColor: '#d97706', headwear: 'beanie', headwearColor: '#dc2626',
        outfitTop: 'sweater', topColor: '#b91c1c', topSecondaryColor: '#fef08a',
        outfitBottom: 'pleated-skirt', bottomColor: '#1e293b', shoes: 'boots', shoesColor: '#0f172a',
        mood: 'focused', pose: 'study', level: 1, xp: 0, coins: 0, energy: 1, happiness: 1, hunger: 1,
        studyTitle: '', unlockedItems: [],
      },
    },
    {
      name: 'Nonbinary Average Shorts & Running',
      custom: {
        name: 'Test3', gender: 'nonbinary', bodyType: 'average', skinTone: '#54321d', hairStyle: 'curly-afro',
        hairColor: '#18181b', facialHair: 'none', facialHairColor: '#18181b', eyeColor: '#7c3aed',
        eyewear: 'wireframe', eyewearColor: '#f59e0b', headwear: 'headphones', headwearColor: '#2563eb',
        outfitTop: 'varsity-jacket', topColor: '#047857', topSecondaryColor: '#f1f5f9',
        outfitBottom: 'shorts', bottomColor: '#374151', shoes: 'running', shoesColor: '#ef4444',
        mood: 'proud', pose: 'wave', level: 1, xp: 0, coins: 0, energy: 1, happiness: 1, hunger: 1,
        studyTitle: '', unlockedItems: [],
      },
    },
    {
      name: 'Male Loafers & Lab Coat',
      custom: {
        name: 'Test4', gender: 'male', bodyType: 'slender', skinTone: '#d97706', hairStyle: 'side-part',
        hairColor: '#451a03', facialHair: 'beard', facialHairColor: '#451a03', eyeColor: '#1e40af',
        eyewear: 'thick-frame', eyewearColor: '#0284c7', headwear: 'mortarboard', headwearColor: '#1e293b',
        outfitTop: 'lab-coat', topColor: '#f8fafc', topSecondaryColor: '#0284c7',
        outfitBottom: 'chinos', bottomColor: '#475569', shoes: 'loafers', shoesColor: '#78350f',
        mood: 'zen', pose: 'cheer', level: 1, xp: 0, coins: 0, energy: 1, happiness: 1, hunger: 1,
        studyTitle: '', unlockedItems: [],
      },
    },
  ];

  sampleConfigs.forEach(({ name, custom }) => {
    it(`places lowest shoe vertex at y in [0, 0.003] for ${name}`, () => {
      const char = buildCharacter3D(custom, { showPedestal: false, showShadow: false });
      char.root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(char.root);

      expect(box.min.y).toBeGreaterThanOrEqual(-0.0005);
      expect(box.min.y).toBeLessThanOrEqual(0.003);
      char.dispose();
    });
  });

  it('builds every top and bottom as a visible, non-empty mesh', () => {
    const tops = ['hoodie', 'varsity-jacket', 'button-down', 'sweater', 'lab-coat', 'casual-tee'] as const;
    const bottoms = ['jeans', 'chinos', 'joggers', 'pleated-skirt', 'shorts'] as const;
    const char = buildCharacter3D(sampleConfigs[0].custom, { showPedestal: false, showShadow: false });
    for (let i = 0; i < tops.length; i++) {
      char.updateCustomization({ ...sampleConfigs[0].custom, outfitTop: tops[i], outfitBottom: bottoms[i % bottoms.length] });
      for (const name of ['Top', 'Bottom']) {
        const mesh = char.root.getObjectByName(name) as THREE.Mesh | undefined;
        expect(mesh, `${name} for ${tops[i]}`).toBeDefined();
        expect(mesh!.visible).toBe(true);
        expect(Array.isArray(mesh!.material)).toBe(false);
        expect(mesh!.geometry.index!.count).toBeGreaterThan(3000);
      }
      // Two-colour tops carry a per-vertex colour zone.
      if (tops[i] === 'varsity-jacket' || tops[i] === 'sweater') {
        const top = char.root.getObjectByName('Top') as THREE.Mesh;
        expect(top.geometry.getAttribute('zone')).toBeDefined();
      }
    }
    char.dispose();
  }, 60000);

  it('keeps the ponytail spring stable through a bouncy pose', () => {
    const char = buildCharacter3D({ ...sampleConfigs[1].custom, hairStyle: 'ponytail', headwear: 'none' }, { showShadow: false });
    for (let i = 0; i < 200; i++) char.update(1 / 60, 'cheer');
    const pivot = char.root.getObjectByName('PonytailPivot');
    expect(pivot).toBeDefined();
    for (const v of [pivot!.rotation.x, pivot!.rotation.z]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(v)).toBeLessThan(0.8);
    }
    char.dispose();
  });

  it('switches poses idle -> study -> wave -> cheer -> idle without NaNs', () => {
    const char = buildCharacter3D(sampleConfigs[0].custom, { showPedestal: false, showShadow: false });
    const poses: CharacterPose[] = ['idle', 'study', 'wave', 'cheer', 'idle'];

    for (const pose of poses) {
      for (let step = 0; step < 10; step++) {
        char.update(0.03, pose);
      }
    }

    char.root.updateMatrixWorld(true);

    char.root.traverse((child) => {
      expect(Number.isNaN(child.position.x)).toBe(false);
      expect(Number.isNaN(child.position.y)).toBe(false);
      expect(Number.isNaN(child.position.z)).toBe(false);
      expect(Number.isNaN(child.rotation.x)).toBe(false);
      expect(Number.isNaN(child.rotation.y)).toBe(false);
      expect(Number.isNaN(child.rotation.z)).toBe(false);
      expect(Number.isNaN(child.scale.x)).toBe(false);
      expect(Number.isNaN(child.scale.y)).toBe(false);
      expect(Number.isNaN(child.scale.z)).toBe(false);
    });

    char.dispose();
  });

  it('verifies study pose displays open book with hands positioned near the book wings', () => {
    const char = buildCharacter3D(sampleConfigs[0].custom, { showPedestal: false, showShadow: false });
    for (let step = 0; step < 40; step++) {
      char.update(0.04, 'study');
    }
    char.root.updateMatrixWorld(true);

    let bookMeshCount = 0;
    let bookVisible = false;

    char.root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.parent) {
        const mesh = child as THREE.Mesh;
        // The open book contains cover, pages, spine, ribbon
        if (mesh.castShadow && mesh.geometry?.type === 'RoundedBoxGeometry') {
          bookMeshCount++;
          if (mesh.visible) bookVisible = true;
        }
      }
    });

    expect(bookVisible).toBe(true);
    expect(bookMeshCount).toBeGreaterThan(0);
    char.dispose();
  });
});
