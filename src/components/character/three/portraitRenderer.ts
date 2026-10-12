import * as THREE from 'three';
import type { CharacterCustomization } from '../../../types/character';
import { buildAvatar } from './buildAvatar';
import { applyStudioLighting } from './studio';

/**
 * Renders a head-and-shoulders portrait of the avatar offscreen and returns
 * it as an image data URL (for the avatar badge, see portraitStore.ts). Uses
 * the same builder and studio lighting as the 3D views, and frees its WebGL
 * context afterwards.
 */
export async function renderPortrait(custom: CharacterCustomization, size = 256, timeoutMs = 15000): Promise<string> {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  const scene = new THREE.Scene();
  const studio = applyStudioLighting(scene, renderer, { shadowMapSize: 512 });
  const camera = new THREE.PerspectiveCamera(24, 1, 0.05, 20);
  const avatar = buildAvatar(custom, { showShadow: false, showPedestal: false });
  scene.add(avatar.root);
  try {
    const start = performance.now();
    while (!avatar.root.getObjectByName('Avatar')) {
      if (performance.now() - start > timeoutMs) throw new Error('avatar did not load in time');
      await new Promise((r) => setTimeout(r, 50));
    }
    // Let the face settle into its mood and the body into its idle pose.
    for (let i = 0; i < 30; i++) avatar.update(0.05, 'idle');
    avatar.root.updateMatrixWorld(true);
    const head = avatar.root.getObjectByName('head');
    const face = head ? head.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 1.5, 0);
    face.y += 0.05;
    camera.position.set(face.x + 0.12, face.y + 0.03, face.z + 0.9);
    camera.lookAt(face.x, face.y - 0.04, face.z);
    renderer.render(scene, camera);
    return canvas.toDataURL('image/webp', 0.85);
  } finally {
    avatar.dispose();
    studio.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
