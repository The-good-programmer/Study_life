import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import type { CharacterMood } from '../../../../types/character';
import type { AvatarDims } from './anatomy';
import {
  type EyeAperture, FACE_SHAPES, eyeAperture, eyeCentres, headBaseSdf, headLayout, traceFront,
} from './head';

// ─── Geometry helpers ────────────────────────────────────────────────────────

/**
 * A tube whose radius follows radius(t) for t in [0, 1], closed at both ends.
 * Used for glasses frames and other thin, tapering parts.
 */
export function taperedTube(
  points: THREE.Vector3[],
  radius: (t: number) => number,
  tubularSegments = 24,
  radialSegments = 8
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, p);
    const r = Math.max(radius(t), 1e-5);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let j = 0; j <= radialSegments; j++) {
      const a = (j / radialSegments) * Math.PI * 2;
      const nx = Math.cos(a) * N.x + Math.sin(a) * B.x;
      const ny = Math.cos(a) * N.y + Math.sin(a) * B.y;
      const nz = Math.cos(a) * N.z + Math.sin(a) * B.z;
      pos.push(p.x + nx * r, p.y + ny * r, p.z + nz * r);
      nor.push(nx, ny, nz);
    }
  }
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = (i + 1) * (radialSegments + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/** A point on a sphere of radius r around an eye, from aperture coordinates. */
function eyePoint(ap: EyeAperture, side: number, u: number, el: number, r: number): THREE.Vector3 {
  const az = ap.azMid + u * ap.azHalf;
  return new THREE.Vector3(side * Math.sin(az) * Math.cos(el) * r, Math.sin(el) * r, Math.cos(az) * Math.cos(el) * r);
}

/**
 * A patch of a sphere around the eye: u across the eye (inner → outer
 * corner), elevation from lo(u) to hi(u). Optional per-vertex RGBA.
 */
function spherePatch(
  ap: EyeAperture, side: number, r: number,
  uRange: [number, number], lo: (u: number) => number, hi: (u: number) => number,
  segU: number, segV: number,
  rgba?: (u: number, el: number) => [number, number, number, number]
): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segU; i++) {
    const u = uRange[0] + ((uRange[1] - uRange[0]) * i) / segU;
    for (let j = 0; j <= segV; j++) {
      const el = lo(u) + ((hi(u) - lo(u)) * j) / segV;
      const p = eyePoint(ap, side, u, el, r);
      pos.push(p.x, p.y, p.z);
      p.normalize();
      nor.push(p.x, p.y, p.z);
      if (rgba) col.push(...rgba(u, el));
    }
  }
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * (segV + 1) + j;
      const b = (i + 1) * (segV + 1) + j;
      // Wind so the outside faces out for both eyes.
      if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
      else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (rgba) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  return g;
}

/**
 * A strip of lash "cards" along a lid edge: rows from root (v = 0) to tip
 * (v = 1), curving away from the eye. Rendered with a lash texture.
 */
function lashStrip(
  ap: EyeAperture, side: number, R: number, uRange: [number, number],
  edge: (u: number) => number, length: (u: number) => number, upward: number
): THREE.BufferGeometry {
  const seg = 28;
  const rows = [0, 0.45, 1];
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const up = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const u = uRange[0] + ((uRange[1] - uRange[0]) * i) / seg;
    const el = edge(u);
    const root = eyePoint(ap, side, u, el, 1.1 * R);
    const n = root.clone().normalize();
    up.copy(eyePoint(ap, side, u, el + 0.01, 1)).sub(eyePoint(ap, side, u, el, 1)).normalize().multiplyScalar(Math.sign(upward));
    const len = length(u);
    const curl = Math.abs(upward);
    for (const t of rows) {
      // Out from the lid, curling away from the eye toward the tip.
      const p = root.clone()
        .addScaledVector(n, len * t * (1 - 0.35 * curl * t))
        .addScaledVector(up, len * (0.25 + 0.6 * curl * t) * t);
      pos.push(p.x, p.y, p.z);
      uv.push((u - uRange[0]) / (uRange[1] - uRange[0]), t);
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < rows.length - 1; j++) {
      const a = i * rows.length + j;
      const b = (i + 1) * rows.length + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Eyeball with the clear cornea bulging over the iris. */
function eyeballGeometry(R: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(R, 56, 36);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(pos, i).normalize();
    const theta = Math.acos(Math.min(1, n.z)); // angle from straight ahead
    const bump = theta < 0.58 ? 0.055 * R * Math.pow(1 - (theta / 0.58) ** 2, 1.5) : 0;
    pos.setXYZ(i, n.x * (R + bump), n.y * (R + bump), n.z * (R + bump));
  }
  g.computeVertexNormals();
  return g;
}

// ─── Textures ────────────────────────────────────────────────────────────────

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d')! };
}

/** Deterministic pseudo-random numbers, so textures are identical every build. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const eyeTextureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Equirectangular eyeball texture (1024×512) with the iris centred on the
 * sphere's forward direction (u = 0.25, v = 0.5): a slightly warm sclera with
 * faint vessels toward the corners, a fibrous iris with a darker limbal ring
 * and a lighter collarette, and the pupil. Highlights come from the lights.
 */
export function getEyeTexture(irisHex: string): THREE.CanvasTexture {
  const cached = eyeTextureCache.get(irisHex);
  if (cached) return cached;
  const W = 1024, H = 512;
  const { canvas, ctx } = makeCanvas(W, H);
  const pxPerRad = W / (Math.PI * 2);
  const cx = W / 4, cy = H / 2;
  const rand = rng(irisHex.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));

  // Sclera: off-white, warmer and darker away from the cornea.
  const sclera = ctx.createRadialGradient(cx, cy, pxPerRad * 0.4, cx, cy, pxPerRad * 1.6);
  sclera.addColorStop(0, '#f1ebe6');
  sclera.addColorStop(0.45, '#e9ddd6');
  sclera.addColorStop(1, '#c9aaa2');
  ctx.fillStyle = sclera;
  ctx.fillRect(0, 0, W, H);
  // Vessels, mostly at the inner and outer corners.
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const sideAng = rand() < 0.5 ? 0 : Math.PI;
    let a = sideAng + (rand() - 0.5) * 1.2;
    let r = pxPerRad * (1.25 + rand() * 0.25);
    let x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.8;
    ctx.strokeStyle = `rgba(190, 70, 70, ${0.08 + rand() * 0.12})`;
    ctx.lineWidth = 0.8 + rand() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      r -= pxPerRad * (0.06 + rand() * 0.05);
      a += (rand() - 0.5) * 0.25;
      x = cx + Math.cos(a) * r;
      y = cy + Math.sin(a) * r * 0.8;
      ctx.lineTo(x, y);
      if (r < pxPerRad * 0.62) break;
    }
    ctx.stroke();
  }

  const irisR = pxPerRad * 0.54;
  const pupilR = irisR * 0.36;
  const iris = new THREE.Color(irisHex);
  const hsl = { h: 0, s: 0, l: 0 };
  iris.getHSL(hsl);
  const tone = (dl: number, ds = 0) =>
    new THREE.Color().setHSL(hsl.h, Math.min(1, Math.max(0, hsl.s + ds)), Math.min(0.95, Math.max(0.03, hsl.l + dl))).getStyle();

  // Base iris and fibres.
  const base = ctx.createRadialGradient(cx, cy, pupilR, cx, cy, irisR);
  base.addColorStop(0, tone(0.08, -0.1));
  base.addColorStop(0.35, tone(0.02));
  base.addColorStop(0.8, tone(-0.06));
  base.addColorStop(1, tone(-0.2));
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < 360; i++) {
    const ang = rand() * Math.PI * 2;
    const r0 = pupilR * (1 + rand() * 0.2);
    const r1 = irisR * (0.75 + rand() * 0.25);
    const light = rand() < 0.5;
    ctx.strokeStyle = light ? `rgba(255,255,255,${0.04 + rand() * 0.08})` : `rgba(0,0,0,${0.05 + rand() * 0.1})`;
    ctx.lineWidth = 0.8 + rand() * 1.6;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
    const bend = (rand() - 0.5) * 0.12;
    ctx.quadraticCurveTo(
      cx + Math.cos(ang + bend) * (r0 + r1) / 2, cy + Math.sin(ang + bend) * (r0 + r1) / 2,
      cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1
    );
    ctx.stroke();
  }
  // Crypts: small dark flecks in the mid iris.
  for (let i = 0; i < 40; i++) {
    const ang = rand() * Math.PI * 2;
    const r = irisR * (0.5 + rand() * 0.3);
    ctx.fillStyle = `rgba(0,0,0,${0.06 + rand() * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 2 + rand() * 4, 1 + rand() * 2, ang, 0, Math.PI * 2);
    ctx.fill();
  }
  // Collarette: a lighter, warmer ring around the pupil.
  ctx.strokeStyle = `rgba(255, 220, 170, 0.16)`;
  ctx.lineWidth = irisR * 0.09;
  ctx.beginPath();
  ctx.arc(cx, cy, pupilR * 1.45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // Limbal ring: dark, soft-edged.
  const limbus = ctx.createRadialGradient(cx, cy, irisR * 0.82, cx, cy, irisR * 1.08);
  limbus.addColorStop(0, 'rgba(10, 8, 12, 0)');
  limbus.addColorStop(0.65, 'rgba(10, 8, 12, 0.55)');
  limbus.addColorStop(1, 'rgba(10, 8, 12, 0)');
  ctx.fillStyle = limbus;
  ctx.beginPath();
  ctx.arc(cx, cy, irisR * 1.08, 0, Math.PI * 2);
  ctx.fill();
  // Pupil with a soft edge.
  const pupil = ctx.createRadialGradient(cx, cy, pupilR * 0.85, cx, cy, pupilR * 1.12);
  pupil.addColorStop(0, '#050506');
  pupil.addColorStop(1, 'rgba(5, 5, 6, 0)');
  ctx.fillStyle = pupil;
  ctx.beginPath();
  ctx.arc(cx, cy, pupilR * 1.12, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  eyeTextureCache.set(irisHex, tex);
  return tex;
}

let lashTexture: THREE.CanvasTexture | null = null;

/** Alpha texture of individual curved lashes (root at the bottom). */
export function getLashTexture(): THREE.CanvasTexture {
  if (lashTexture) return lashTexture;
  const { canvas, ctx } = makeCanvas(512, 128);
  const rand = rng(91);
  ctx.lineCap = 'round';
  // The lash line: dense at the roots.
  const root = ctx.createLinearGradient(0, 128, 0, 96);
  root.addColorStop(0, 'rgba(255,255,255,1)');
  root.addColorStop(0.5, 'rgba(255,255,255,0.85)');
  root.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = root;
  ctx.fillRect(0, 96, 512, 32);
  for (let i = 0; i < 260; i++) {
    const x = 6 + rand() * 500;
    const len = 50 + rand() * 70;
    const lean = (rand() - 0.5) * 26;
    const w = 1.4 + rand() * 1.4;
    // Tapered stroke: several passes, thinner toward the tip.
    for (let k = 0; k < 4; k++) {
      const f = 1 - k / 4;
      ctx.strokeStyle = `rgba(255,255,255,${0.85 * (0.4 + 0.6 * f)})`;
      ctx.lineWidth = w * f;
      ctx.beginPath();
      ctx.moveTo(x, 128);
      ctx.quadraticCurveTo(x + lean * 0.3, 128 - len * 0.55, x + lean, 128 - len * (0.55 + 0.45 * f));
      ctx.stroke();
    }
  }
  lashTexture = new THREE.CanvasTexture(canvas);
  lashTexture.colorSpace = THREE.SRGBColorSpace;
  lashTexture.anisotropy = 4;
  return lashTexture;
}

const browTextureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Brow made of individual hairs (white on transparent; the material colours
 * it). The inner end is fuller with hairs growing upward; toward the tail
 * they lie flat and point outward. `mirror` flips it for the right brow.
 */
function getBrowTexture(weight: number, mirror: boolean): THREE.CanvasTexture {
  const key = `${weight.toFixed(2)}|${mirror}`;
  const cached = browTextureCache.get(key);
  if (cached) return cached;
  const W = 512, H = 160;
  const { canvas, ctx } = makeCanvas(W, H);
  const rand = rng(17 + Math.round(weight * 100));
  ctx.lineCap = 'round';
  if (mirror) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
  // Brow shape: centre line and thickness along t (0 = inner, 1 = tail).
  // Feminine brows arch higher and are finer; masculine ones are flatter and fuller.
  const arch = 0.3 - 0.14 * weight;
  const peak = 0.66 + 0.06 * weight;
  const centreY = (t: number) => H * (0.6 - arch * Math.sin(Math.min(t / peak, 1) * Math.PI * 0.5) + (arch + 0.06) * Math.max(0, t - peak) / (1 - peak));
  const thick = (t: number) => H * (0.18 + 0.2 * weight) * (1 - 0.68 * t) * (t < 0.08 ? 0.6 + 5 * t : 1);
  const count = Math.round(420 + 520 * weight);
  for (let i = 0; i < count; i++) {
    const t = Math.pow(rand(), 0.9);
    const x = 30 + t * (W - 60);
    const y = centreY(t) + (rand() - 0.5) * thick(t);
    // Hairs point up and out at the inner end, outward along the brow after.
    const ang = -Math.PI / 2 * (1 - smooth(0, 0.3, t)) + (-0.18 + (rand() - 0.5) * 0.35) * smooth(0, 0.3, t) + (rand() - 0.5) * 0.3;
    const len = 18 + rand() * 18;
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + rand() * 0.4})`;
    ctx.lineWidth = 1.6 + rand() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.6, y + Math.sin(ang) * len * 0.6 - 2, x + Math.cos(ang + 0.15) * len, y + Math.sin(ang + 0.15) * len);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  browTextureCache.set(key, tex);
  return tex;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

let teethTexture: THREE.CanvasTexture | null = null;
/** Teeth along an arch (u across), with soft gaps between them. */
function getTeethTexture(): THREE.CanvasTexture {
  if (teethTexture) return teethTexture;
  const { canvas, ctx } = makeCanvas(512, 64);
  ctx.fillStyle = '#f3eee4';
  ctx.fillRect(0, 0, 512, 64);
  // Tooth edges, from the centre outward: incisors, canines, premolars.
  const edges = [0, 0.065, 0.12, 0.17, 0.225, 0.285, 0.35, 0.42, 0.5];
  for (const e of edges) {
    for (const s of [1, -1]) {
      const x = 256 + s * e * 512;
      const g = ctx.createLinearGradient(x - 6, 0, x + 6, 0);
      g.addColorStop(0, 'rgba(120, 100, 90, 0)');
      g.addColorStop(0.5, 'rgba(120, 100, 90, 0.55)');
      g.addColorStop(1, 'rgba(120, 100, 90, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 6, 0, 12, 64);
    }
  }
  const shade = ctx.createLinearGradient(0, 0, 512, 0);
  shade.addColorStop(0, 'rgba(60, 40, 40, 0.6)');
  shade.addColorStop(0.3, 'rgba(60, 40, 40, 0)');
  shade.addColorStop(0.7, 'rgba(60, 40, 40, 0)');
  shade.addColorStop(1, 'rgba(60, 40, 40, 0.6)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 512, 64);
  teethTexture = new THREE.CanvasTexture(canvas);
  teethTexture.colorSpace = THREE.SRGBColorSpace;
  return teethTexture;
}

// ─── Expressions ─────────────────────────────────────────────────────────────

interface Expression {
  lid: number; // 0 = open, 1 = closed (resting upper-lid position)
  browLift: number; // head-space units
  browTilt: number; // radians; + raises the inner end
}

const EXPRESSIONS: Record<CharacterMood, Expression> = {
  happy: { lid: 0.04, browLift: 0.0015, browTilt: 0.02 },
  energetic: { lid: 0, browLift: 0.004, browTilt: 0.03 },
  focused: { lid: 0.14, browLift: -0.0015, browTilt: -0.06 },
  proud: { lid: 0.12, browLift: 0.001, browTilt: -0.02 },
  zen: { lid: 0.96, browLift: 0.0005, browTilt: 0.02 },
  sleepy: { lid: 0.5, browLift: -0.0005, browTilt: 0.06 },
};

// ─── Face assembly ───────────────────────────────────────────────────────────

export interface FaceMaterials {
  /** Eyelids: skin a touch darker. */
  lid: THREE.Material;
  /** Brow colour (shared, so hair-colour changes apply live). */
  brow: THREE.MeshStandardMaterial;
  eye: THREE.MeshPhysicalMaterial;
  lash: THREE.Material;
}

export interface FaceRig {
  group: THREE.Group;
  /** Upper-lid pivots: rotation.x 0 = open; LID_CLOSED = shut. */
  lids: THREE.Object3D[];
  /** Eyeballs, rotated to look around. */
  eyeballs: THREE.Object3D[];
  restLid: number;
  dispose: () => void;
}

/** Upper-lid rotation that brings its edge down to the lower lid. */
export const LID_CLOSED = 1.0;

/**
 * Builds eyes, lids, lashes, brows and teeth for a head. `headMesh` is the
 * meshed head (in head space) that the brows are projected onto.
 */
export function buildFace(d: AvatarDims, mood: CharacterMood, headMesh: THREE.Mesh, mats: FaceMaterials): FaceRig {
  const group = new THREE.Group();
  group.name = 'Face';
  const expr = EXPRESSIONS[mood] ?? EXPRESSIONS.happy;
  const shape = FACE_SHAPES[mood] ?? FACE_SHAPES.happy;
  const layout = headLayout(d);
  const owned: THREE.BufferGeometry[] = [];
  const ownedMats: THREE.Material[] = [];
  const lids: THREE.Object3D[] = [];
  const eyeballs: THREE.Object3D[] = [];
  const R = d.eyeRadius;
  const ap = eyeAperture(d, shape.squint);

  const eyeGeo = eyeballGeometry(R);
  owned.push(eyeGeo);
  const shadowMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
  ownedMats.push(shadowMat);

  eyeCentres(d).forEach(([x, y, z], i) => {
    const side = i === 0 ? 1 : -1;
    const eyeRoot = new THREE.Group();
    eyeRoot.position.set(x, y, z);
    group.add(eyeRoot);

    const eyeball = new THREE.Mesh(eyeGeo, mats.eye);
    eyeRoot.add(eyeball);
    eyeballs.push(eyeball);

    // Soft shadow the lids and lashes cast on the eye, so it sits in the
    // head instead of glowing.
    const shadowGeo = spherePatch(
      ap, side, 1.068 * R, [-1.05, 1.05], (u) => ap.lower(u) - 0.06, (u) => ap.upper(u) + 0.06, 40, 16,
      (u, el) => {
        const top = Math.exp(-Math.max(0, ap.upper(u) - el) / 0.16) * 0.62;
        const bottom = Math.exp(-Math.max(0, el - ap.lower(u)) / 0.08) * 0.22;
        const corner = smooth(0.55, 1, Math.abs(u)) * 0.35;
        return [0.09, 0.05, 0.05, Math.min(0.85, top + bottom + corner)];
      }
    );
    owned.push(shadowGeo);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.renderOrder = 2;
    eyeRoot.add(shadow);

    // Upper lid: hidden inside the lid mound when open, it slides down over
    // the eye to blink. Lashes ride on its edge.
    const lid = new THREE.Group();
    eyeRoot.add(lid);
    lids.push(lid);
    const lidEdge = (u: number) => ap.upper(Math.max(-1, Math.min(1, u))) + 0.02;
    const lidGeo = spherePatch(ap, side, 1.075 * R, [-1.35, 1.35], lidEdge, () => Math.PI / 2 + 1.1, 40, 14);
    const marginPts: THREE.Vector3[] = [];
    for (let k = 0; k <= 24; k++) {
      const u = -1.1 + (2.2 * k) / 24;
      marginPts.push(eyePoint(ap, side, u, lidEdge(u) + 0.03, 1.08 * R));
    }
    const marginGeo = taperedTube(marginPts, () => 0.045 * R, 48, 6);
    owned.push(lidGeo, marginGeo);
    lid.add(new THREE.Mesh(lidGeo, mats.lid), new THREE.Mesh(marginGeo, mats.lid));

    const lw = 0.85 + 0.4 * d.lashWeight;
    const upperLash = lashStrip(
      ap, side, R, [-0.97, 0.99], (u) => ap.upper(u) + 0.012,
      (u) => R * lw * (0.28 + 0.22 * smooth(-0.6, 0.75, u)) * (0.35 + 0.65 * Math.sqrt(Math.max(0, 1 - u * u))),
      0.9
    );
    const lowerLash = lashStrip(
      ap, side, R, [-0.55, 0.96], (u) => ap.lower(u) - 0.01,
      (u) => R * lw * 0.12 * (0.3 + 0.7 * Math.sqrt(Math.max(0, 1 - u * u))),
      -0.3
    );
    owned.push(upperLash, lowerLash);
    const upperLashMesh = new THREE.Mesh(upperLash, mats.lash);
    upperLashMesh.renderOrder = 3;
    lid.add(upperLashMesh);
    const lowerLashMesh = new THREE.Mesh(lowerLash, mats.lash);
    lowerLashMesh.renderOrder = 3;
    eyeRoot.add(lowerLashMesh);
  });

  // Brows: hair-textured decals that follow the brow ridge.
  const base = headBaseSdf(d, shape);
  const localHead = new THREE.Mesh(headMesh.geometry);
  localHead.updateMatrixWorld(true);
  const browWeight = d.gender === 'male' ? 1 : d.gender === 'female' ? 0.2 : 0.6;
  for (const side of [1, -1]) {
    const x = side * (layout.eyeX + 0.004);
    const y = layout.eyeY + 1.55 * R + expr.browLift;
    const zHit = traceFront(base, x, y);
    if (zHit === null) continue;
    const geo = new DecalGeometry(
      localHead,
      new THREE.Vector3(x, y, zHit),
      new THREE.Euler(-0.15, side * 0.42, side * (-expr.browTilt - 0.02)),
      new THREE.Vector3(0.056, 0.021, 0.04)
    );
    const mat = new THREE.MeshStandardMaterial({
      map: getBrowTexture(browWeight, side < 0),
      transparent: true,
      roughness: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
    mat.color = mats.brow.color; // shared, so hair-colour changes apply live
    owned.push(geo);
    ownedMats.push(mat);
    const brow = new THREE.Mesh(geo, mat);
    brow.name = 'Brow';
    brow.renderOrder = 2;
    group.add(brow);
  }

  // Teeth, seen when the lips part.
  if (shape.teeth !== 'none') {
    const teethMat = new THREE.MeshStandardMaterial({ map: getTeethTexture(), roughness: 0.32, side: THREE.DoubleSide });
    ownedMats.push(teethMat);
    const hw = d.mouthHalfWidth * shape.width;
    const ra = hw * 1.02;
    const frontZ = layout.lipZ - 0.0105;
    const rows: Array<[number, number]> = [[layout.mouthY + shape.gap / 2 + 0.0035, 0.0085]];
    if (shape.teeth === 'both') rows.push([layout.mouthY - shape.gap / 2 - 0.0028, 0.0068]);
    for (const [cy, h] of rows) {
      const geo = new THREE.CylinderGeometry(ra, ra * 0.97, h, 32, 1, true, -1.05, 2.1);
      owned.push(geo);
      const teeth = new THREE.Mesh(geo, teethMat);
      teeth.name = 'Teeth';
      teeth.position.set(0, cy, frontZ - ra);
      group.add(teeth);
    }
  }

  return {
    group,
    lids,
    eyeballs,
    restLid: expr.lid,
    dispose: () => {
      owned.forEach((g) => g.dispose());
      ownedMats.forEach((m) => m.dispose());
    },
  };
}
