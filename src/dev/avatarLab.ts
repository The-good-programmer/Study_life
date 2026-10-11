/**
 * Dev-only avatar lab (served at /avatar-lab.html by the Vite dev server; not
 * part of the production build). Renders one avatar full-screen so details
 * can be inspected. Query params: view=face|torso|full|side|back,
 * pose, mood, plus any CharacterCustomization field (e.g. hairStyle=bob-cut).
 * window.lab.set({...}) updates the avatar live.
 */
import * as THREE from 'three';
import { buildCharacter3D } from '../components/character/three/characterBuilder3d';
import { applyStudioLighting } from '../components/character/three/studio';
import { characterService } from '../services/characterService';
import type { CharacterCustomization, CharacterPose } from '../types/character';

const params = new URLSearchParams(location.search);
const custom: CharacterCustomization = { ...characterService.getCharacter() };
for (const [k, v] of params) if (k in custom) (custom as unknown as Record<string, string>)[k] = v;

const VIEWS: Record<string, { pos: [number, number, number]; target: [number, number, number] }> = {
  face: { pos: [0, 1.5, 0.42], target: [0, 1.49, 0] },
  head: { pos: [0, 1.5, 0.7], target: [0, 1.49, 0] },
  head3q: { pos: [0.42, 1.52, 0.56], target: [0, 1.49, 0.01] },
  headSide: { pos: [0.7, 1.5, 0.02], target: [0, 1.49, 0.01] },
  torso: { pos: [0, 1.3, 1.7], target: [0, 1.2, 0] },
  full: { pos: [0, 0.95, 3.2], target: [0, 0.84, 0] },
  side: { pos: [3.0, 1.0, 0], target: [0, 0.84, 0] },
  back: { pos: [0, 1.05, -3.2], target: [0, 0.86, 0] },
  three: { pos: [1.5, 1.3, 2.5], target: [0, 0.92, 0] },
};

const stage = document.getElementById('stage')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111827);
applyStudioLighting(scene, renderer);

const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 50);
const view = VIEWS[params.get('view') ?? 'full'] ?? VIEWS.full;
camera.position.set(...view.pos);
camera.lookAt(...view.target);

const ground = new THREE.Mesh(new THREE.CircleGeometry(3, 64), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const t0 = performance.now();
const avatar = buildCharacter3D(custom, { showShadow: true });
const buildMs = performance.now() - t0;
scene.add(avatar.root);
let pose = (params.get('pose') as CharacterPose) || custom.pose;

// Geometry is meshed in workers: report when the avatar actually appears.
const hud = document.getElementById('hud')!;
const readyPoll = setInterval(() => {
  if (!avatar.root.getObjectByName('Avatar')) return;
  clearInterval(readyPoll);
  let tris = 0;
  avatar.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry.index) tris += m.geometry.index.count / 3;
  });
  hud.textContent = `main thread ${buildMs.toFixed(0)} ms · ready after ${(performance.now() - t0).toFixed(0)} ms · ${Math.round(tris / 1000)}k tris · ${custom.gender}/${custom.bodyType}/${custom.hairStyle}/${custom.outfitTop}`;
  renderer.render(scene, camera);
}, 20);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  avatar.update(clock.getDelta(), pose);
  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

(window as unknown as { lab: unknown }).lab = {
  avatar,
  THREE,
  set: (patch: Partial<CharacterCustomization>) => {
    Object.assign(custom, patch);
    const s = performance.now();
    avatar.updateCustomization({ ...custom });
    return `${(performance.now() - s).toFixed(0)} ms`;
  },
  /** Advances the animation n steps and renders now (rAF pauses in background tabs). */
  tick: (n = 60, p?: CharacterPose) => {
    if (p) pose = p;
    for (let i = 0; i < n; i++) avatar.update(0.05, pose);
    renderer.render(scene, camera);
    return pose;
  },
  view: (name: string) => {
    const v = VIEWS[name];
    camera.position.set(...v.pos);
    camera.lookAt(...v.target);
    renderer.render(scene, camera);
  },
  /** Free camera: lab.look([x, y, z], [tx, ty, tz]). */
  look: (pos: [number, number, number], target: [number, number, number]) => {
    camera.position.set(...pos);
    camera.lookAt(...target);
    renderer.render(scene, camera);
  },
  /** Shows or hides meshes by name (e.g. 'Top', 'Hair_buzz'). */
  show: (name: string, visible: boolean) => {
    avatar.root.traverse((o) => {
      if (o.name === name) o.visible = visible;
    });
    renderer.render(scene, camera);
  },
};
