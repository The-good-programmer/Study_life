import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Shadow-map texels the key light's filter spans (r186's PCF filter softens over shadow.radius texels). */
const SHADOW_SOFTNESS = 3;

/**
 * Character-showcase lighting: a near-neutral key with soft shadows, a cool
 * fill, and two rim lights that trace the silhouette against a dark
 * backdrop. The environment map is kept dim so the key light, not flat
 * ambient, shapes the forms. Shared by the customizer canvas, portraits and
 * the dev avatar lab.
 *
 * Tone mapping is Khronos PBR Neutral: it leaves colours below the
 * highlights as they are, so a skin, hair or clothing swatch reads as
 * itself on the avatar (ACES desaturates and lightens skin). The key light
 * is set so a key-lit cheek renders about at the chosen skin swatch.
 */
export function applyStudioLighting(scene: THREE.Scene, renderer: THREE.WebGLRenderer, opts: { shadowMapSize?: number } = {}) {
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTexture = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.5;

  const lights = new THREE.Group();
  lights.name = 'StudioLights';

  lights.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2f45, 0.35));

  const key = new THREE.DirectionalLight(0xfff4e8, 2.6);
  key.position.set(1.8, 3.2, 2.6);
  key.castShadow = true;
  const mapSize = opts.shadowMapSize ?? 2048;
  key.shadow.mapSize.setScalar(mapSize);
  const cam = key.shadow.camera;
  cam.near = 1;
  cam.far = 7.5;
  cam.left = -1.1;
  cam.right = 1.1;
  cam.top = 2.1;
  cam.bottom = -0.3;
  // The avatar shadows itself, so the biases must keep lit skin acne-free at
  // every map size: offsets scale with the size of a shadow-map texel.
  const texel = (cam.top - cam.bottom) / mapSize;
  key.shadow.radius = SHADOW_SOFTNESS;
  key.shadow.normalBias = texel * (1 + SHADOW_SOFTNESS);
  key.shadow.bias = -texel / (cam.far - cam.near);
  key.target.position.set(0, 0.8, 0);
  lights.add(key, key.target);

  const fill = new THREE.DirectionalLight(0xd6e2ff, 0.6);
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
