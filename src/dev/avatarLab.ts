/**
 * Dev-only avatar lab (served at /avatar-lab.html by the Vite dev server; not
 * part of the production build). Renders one avatar full-screen so details
 * can be inspected. Query params: view=face|head|head3q|headSide|torso|full|side|back|three,
 * pose, mood, plus any CharacterCustomization field (e.g. hairStyle=bob-cut).
 * Renderer: v2 (asset-based) by default, avatar=v1 for the procedural one, placeholder=1 to run v2 on
 * the procedural stand-in mannequin, compare=1 for v1 (left) beside v2 (right).
 * window.lab.set({...}) updates the avatar live.
 *
 * The HUD's second line is for device testing (e.g. a phone on the LAN):
 * frame rate, slowest frame, quality tier, render size, GPU and how much
 * avatar data was downloaded. Rendering follows the device's quality tier
 * like the app does.
 */
import * as THREE from 'three';
import { buildCharacter3D, type CharacterModelInstance } from '../components/character/three/characterBuilder3d';
import { buildAvatar } from '../components/character/three/buildAvatar';
import { buildCharacterV2 } from '../components/character/three/v2/characterBuilderV2';
import { AssetCache } from '../components/character/three/v2/assetLoader';
import { fetchPlaceholder, placeholderManifest } from '../components/character/three/v2/placeholder';
import { getQualityTier, getTierSettings } from '../components/character/three/v2/quality';
import { applyStudioLighting } from '../components/character/three/studio';
import { characterService } from '../services/characterService';
import type { CharacterCustomization, CharacterPose } from '../types/character';

const params = new URLSearchParams(location.search);
const custom: CharacterCustomization = { ...characterService.getCharacter() };
for (const [k, v] of params) if (k in custom) (custom as unknown as Record<string, string>)[k] = v;

type Vec3 = [number, number, number];

/**
 * Camera views. Head views are relative to eye height (y = 0 at the eyes),
 * which differs between v1 and v2 and between body shapes; the others are
 * relative to the floor and frame the whole figure.
 */
const HEAD_VIEWS: Record<string, { pos: Vec3; target: Vec3 }> = {
  face: { pos: [0, 0.01, 0.42], target: [0, -0.01, 0] },
  head: { pos: [0, 0.01, 0.75], target: [0, -0.03, 0] },
  head3q: { pos: [0.42, 0.02, 0.6], target: [0, -0.02, 0.01] },
  headSide: { pos: [0.72, 0.01, 0.02], target: [0, -0.02, 0.01] },
};
const BODY_VIEWS: Record<string, { pos: Vec3; target: Vec3 }> = {
  torso: { pos: [0, 1.38, 1.8], target: [0, 1.28, 0] },
  full: { pos: [0, 1.0, 3.7], target: [0, 0.9, 0] },
  side: { pos: [3.7, 1.0, 0], target: [0, 0.9, 0] },
  back: { pos: [0, 1.05, -3.7], target: [0, 0.9, 0] },
  three: { pos: [1.6, 1.35, 2.7], target: [0, 0.92, 0] },
};

const stage = document.getElementById('stage')!;
const tier = getQualityTier();
const tierSettings = getTierSettings(tier);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, tierSettings.maxPixelRatio));
renderer.setSize(innerWidth, innerHeight);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111827);
applyStudioLighting(scene, renderer, { shadowMapSize: tierSettings.shadowMapSize });

const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 50);
const initialView = params.get('view') ?? 'full';
/** Set once the camera is placed by hand (lab.look/lab.view), so loading doesn't move it back. */
let cameraPlaced = false;

/** Eye height of the avatar on the right (the head bone sits about 5 cm below the eyes). */
function eyeHeight() {
  const head = avatar.root.getObjectByName('head');
  return head ? head.getWorldPosition(new THREE.Vector3()).y + 0.05 : 1.6;
}

function frame(name: string) {
  const head = HEAD_VIEWS[name];
  const v = head ?? BODY_VIEWS[name] ?? BODY_VIEWS.full;
  const dy = head ? eyeHeight() : 0;
  camera.position.set(v.pos[0], v.pos[1] + dy, v.pos[2]);
  camera.lookAt(v.target[0], v.target[1] + dy, v.target[2]);
}

const ground = new THREE.Mesh(new THREE.CircleGeometry(3, 64), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const compare = params.has('compare');
const buildV2 = (c: CharacterCustomization) =>
  params.has('placeholder')
    ? buildCharacterV2(c, { showShadow: true }, {
      loadManifest: async () => placeholderManifest(),
      assets: new AssetCache(fetchPlaceholder),
      tier: getQualityTier(),
      fallback: buildCharacter3D,
    })
    : buildCharacterV2(c, { showShadow: true });

const t0 = performance.now();
const avatars: CharacterModelInstance[] = compare
  ? [buildCharacter3D(custom, { showShadow: true }), buildV2(custom)]
  : [params.has('placeholder') ? buildV2(custom) : buildAvatar(custom, { showShadow: true })];
const buildMs = performance.now() - t0;
avatars.forEach((a, i) => {
  if (compare) a.root.position.x = i === 0 ? -0.45 : 0.45;
  scene.add(a.root);
});
const avatar = avatars[avatars.length - 1];
frame(initialView);
let pose = (params.get('pose') as CharacterPose) || custom.pose;

// Geometry is meshed in workers: report when the avatar actually appears.
const hud = document.getElementById('hud')!;
const readyPoll = setInterval(() => {
  if (avatars.some((a) => !a.root.getObjectByName('Avatar'))) return;
  clearInterval(readyPoll);
  let tris = 0;
  avatar.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry.index) tris += m.geometry.index.count / 3;
  });
  hudLoad.textContent = `main thread ${buildMs.toFixed(0)} ms · ready after ${(performance.now() - t0).toFixed(0)} ms · ${Math.round(tris / 1000)}k tris · ${custom.gender}/${custom.bodyType}/${custom.hairStyle}/${custom.outfitTop}`;
  // The eyes' height is known now: frame head views on them.
  if (!cameraPlaced) frame(initialView);
  renderer.render(scene, camera);
}, 20);
const hudLoad = hud.appendChild(document.createElement('div'));
const hudLive = hud.appendChild(document.createElement('div'));
hudLive.className = 'live';

const gl = renderer.getContext();
const gpuInfo = gl.getExtension('WEBGL_debug_renderer_info');
const gpu = String(gpuInfo ? gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));

/** Avatar files fetched by this page (encoded size, so cached files still count). */
function avatarBytes() {
  return (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
    .filter((e) => new URL(e.name).pathname.startsWith('/avatar/'))
    .reduce((sum, e) => sum + (e.encodedBodySize || e.transferSize || 0), 0);
}

// Frame stats over a rolling two-second window.
let frames = 0;
let worst = 0;
let windowStart = performance.now();
let lastFrame = windowStart;
function sampleFrame(now: number) {
  frames++;
  worst = Math.max(worst, now - lastFrame);
  lastFrame = now;
  if (now - windowStart < 2000) return;
  const fps = (frames * 1000) / (now - windowStart);
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  hudLive.textContent = `${fps.toFixed(0)} fps · slowest frame ${worst.toFixed(0)} ms · tier ${tier} · ${size.x}×${size.y} px · ${(avatarBytes() / 1e6).toFixed(2)} MB avatar data · ${gpu}`;
  frames = 0;
  worst = 0;
  windowStart = now;
}

const timer = new THREE.Timer();
timer.connect(document); // no time jump after the tab was hidden
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.1);
  for (const a of avatars) a.update(dt, pose);
  renderer.render(scene, camera);
  sampleFrame(performance.now());
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

(window as unknown as { lab: unknown }).lab = {
  avatar,
  THREE,
  // For console experiments (tone mapping, lights, materials).
  renderer,
  scene,
  camera,
  set: (patch: Partial<CharacterCustomization>) => {
    Object.assign(custom, patch);
    const s = performance.now();
    for (const a of avatars) a.updateCustomization({ ...custom });
    return `${(performance.now() - s).toFixed(0)} ms`;
  },
  /** Advances the animation n steps and renders now (rAF pauses in background tabs). */
  tick: (n = 60, p?: CharacterPose) => {
    if (p) pose = p;
    for (let i = 0; i < n; i++) for (const a of avatars) a.update(0.05, pose);
    renderer.render(scene, camera);
    return pose;
  },
  view: (name: string) => {
    cameraPlaced = true;
    frame(name);
    renderer.render(scene, camera);
  },
  /** Free camera: lab.look([x, y, z], [tx, ty, tz]). */
  look: (pos: Vec3, target: Vec3) => {
    cameraPlaced = true;
    camera.position.set(...pos);
    camera.lookAt(...target);
    renderer.render(scene, camera);
  },
  /** Shows or hides meshes by name (e.g. 'Top', 'Hair_buzz'). */
  show: (name: string, visible: boolean) => {
    for (const a of avatars) {
      a.root.traverse((o) => {
        if (o.name === name) o.visible = visible;
      });
    }
    renderer.render(scene, camera);
  },
};
