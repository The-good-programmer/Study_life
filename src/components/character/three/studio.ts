import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Character-showcase lighting: a warm key with soft shadows, a cool fill,
 * and two rim lights that trace the silhouette against a dark backdrop. The
 * environment map is kept dim so the key light, not flat ambient, shapes
 * the forms. Shared by the customizer canvas and the dev avatar lab.
 */
export function applyStudioLighting(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTexture = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.55;

  const lights = new THREE.Group();
  lights.name = 'StudioLights';

  lights.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2f45, 0.35));

  const key = new THREE.DirectionalLight(0xfff0de, 2.5);
  key.position.set(1.8, 3.2, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 9;
  key.shadow.camera.left = -1.1;
  key.shadow.camera.right = 1.1;
  key.shadow.camera.top = 2.1;
  key.shadow.camera.bottom = -0.3;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.025;
  key.target.position.set(0, 0.8, 0);
  lights.add(key, key.target);

  const fill = new THREE.DirectionalLight(0xc9d8ff, 0.6);
  fill.position.set(-2.6, 1.6, 1.8);
  fill.target.position.set(0, 0.9, 0);
  lights.add(fill, fill.target);

  const rimCool = new THREE.DirectionalLight(0xb7c8ff, 1.7);
  rimCool.position.set(-1.4, 2.6, -3);
  rimCool.target.position.set(0, 0.9, 0);
  lights.add(rimCool, rimCool.target);

  const rimWarm = new THREE.DirectionalLight(0xffd9b8, 0.9);
  rimWarm.position.set(2.2, 2.0, -2.4);
  rimWarm.target.position.set(0, 0.9, 0);
  lights.add(rimWarm, rimWarm.target);

  scene.add(lights);

  return {
    dispose() {
      scene.remove(lights);
      scene.environment = null;
      envTexture.dispose();
      room.dispose();
      pmrem.dispose();
      key.shadow.map?.dispose();
    },
  };
}
