import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import type { CharacterMood } from '../../../../types/character';
import type { Sdf } from '../sdf/sdf';
import { type AvatarDims, EYE_DEPTH } from './anatomy';
import { type HeadLayout, traceFront } from './head';

// ─── Geometry helpers ────────────────────────────────────────────────────────

/**
 * A tube whose radius follows radius(t) for t in [0, 1], closed at both ends.
 * Used for brows and lash lines, which taper toward their tips.
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

/** Smooth 0 → 1 → 0 profile with rounded ends, scaled by a taper. */
const capped = (t: number, taperTo = 0.55) => {
  const ends = Math.pow(Math.max(Math.sin(Math.PI * Math.min(Math.max(t, 0), 1)), 0), 0.45);
  return ends * (1 - (1 - taperTo) * t);
};

// ─── Textures ────────────────────────────────────────────────────────────────

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d')! };
}

const eyeTextureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Equirectangular eyeball texture (512×256) with the iris centred on the
 * sphere's forward direction (u = 0.25, v = 0.5). Painted catch-lights give
 * the eyes life even under flat lighting.
 */
export function getEyeTexture(irisHex: string): THREE.CanvasTexture {
  const cached = eyeTextureCache.get(irisHex);
  if (cached) return cached;
  const { canvas, ctx } = makeCanvas(512, 256);
  // Sclera with a soft shadow toward the edges.
  const sclera = ctx.createRadialGradient(128, 128, 20, 128, 128, 200);
  sclera.addColorStop(0, '#ffffff');
  sclera.addColorStop(0.55, '#f6f3f1');
  sclera.addColorStop(1, '#d9d0cc');
  ctx.fillStyle = sclera;
  ctx.fillRect(0, 0, 512, 256);

  const cx = 128, cy = 130, irisR = 60, pupilR = 25;
  const iris = new THREE.Color(irisHex);
  const light = iris.clone().lerp(new THREE.Color('#ffffff'), 0.35).getStyle();
  const dark = iris.clone().multiplyScalar(0.45).getStyle();
  const g = ctx.createRadialGradient(cx, cy + 10, pupilR * 0.6, cx, cy, irisR);
  g.addColorStop(0, light);
  g.addColorStop(0.55, iris.getStyle());
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
  ctx.fill();
  // Fine radial fibres.
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1.5;
  for (let a = 0; a < 48; a++) {
    const ang = (a / 48) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * pupilR * 1.1, cy + Math.sin(ang) * pupilR * 1.1);
    ctx.lineTo(cx + Math.cos(ang) * irisR * 0.86, cy + Math.sin(ang) * irisR * 0.86);
    ctx.stroke();
  }
  // Limbal ring.
  ctx.strokeStyle = 'rgba(10,10,20,0.55)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, irisR - 2, 0, Math.PI * 2);
  ctx.stroke();
  // Pupil.
  ctx.fillStyle = '#08080c';
  ctx.beginPath();
  ctx.arc(cx, cy, pupilR, 0, Math.PI * 2);
  ctx.fill();
  // Catch-lights.
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.ellipse(cx - 21, cy - 21, 13, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(cx + 19, cy + 20, 5.5, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  eyeTextureCache.set(irisHex, tex);
  return tex;
}

type MouthShape = 'smile' | 'grin' | 'line' | 'smirk' | 'gentle' | 'o';

const mouthTextureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Mouth decal (512×256 canvas covering 6 × 3 cm of the face). Open mouths
 * get a dark interior, upper teeth and a tongue; closed ones a soft line.
 */
function getMouthTexture(shape: MouthShape, lipHex: string): THREE.CanvasTexture {
  const key = `${shape}|${lipHex}`;
  const cached = mouthTextureCache.get(key);
  if (cached) return cached;
  const { canvas, ctx } = makeCanvas(512, 256);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = new THREE.Color(lipHex).multiplyScalar(0.55).getStyle();

  const openMouth = (w: number, top: number, depth: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(256 - w, top);
    ctx.quadraticCurveTo(256, top + 14, 256 + w, top);
    ctx.bezierCurveTo(256 + w * 0.85, top + depth * 1.05, 256 - w * 0.85, top + depth * 1.05, 256 - w, top);
    ctx.closePath();
    ctx.fillStyle = '#4a1820';
    ctx.fill();
    ctx.clip();
    // Tongue
    ctx.fillStyle = '#d85a64';
    ctx.beginPath();
    ctx.ellipse(256, top + depth * 0.95, w * 0.55, depth * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    // Upper teeth
    ctx.fillStyle = '#fbfaf7';
    ctx.beginPath();
    ctx.ellipse(256, top - 6, w * 0.82, depth * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = line;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(256 - w, top);
    ctx.quadraticCurveTo(256, top + 14, 256 + w, top);
    ctx.bezierCurveTo(256 + w * 0.85, top + depth * 1.05, 256 - w * 0.85, top + depth * 1.05, 256 - w, top);
    ctx.closePath();
    ctx.stroke();
  };

  const stroke = (draw: () => void, width = 11) => {
    ctx.strokeStyle = line;
    ctx.lineWidth = width;
    ctx.beginPath();
    draw();
    ctx.stroke();
  };

  switch (shape) {
    case 'smile':
      openMouth(92, 92, 82);
      break;
    case 'grin':
      openMouth(122, 84, 108);
      break;
    case 'line':
      stroke(() => {
        ctx.moveTo(196, 132);
        ctx.quadraticCurveTo(256, 136, 316, 130);
      }, 10);
      break;
    case 'smirk':
      stroke(() => {
        ctx.moveTo(180, 128);
        ctx.bezierCurveTo(225, 150, 290, 146, 338, 110);
      });
      break;
    case 'gentle':
      stroke(() => {
        ctx.moveTo(186, 116);
        ctx.quadraticCurveTo(256, 172, 326, 116);
      });
      break;
    case 'o':
      ctx.fillStyle = '#4a1820';
      ctx.beginPath();
      ctx.ellipse(256, 130, 26, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = line;
      ctx.lineWidth = 5;
      ctx.stroke();
      break;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  mouthTextureCache.set(key, tex);
  return tex;
}

let blushTexture: THREE.CanvasTexture | null = null;
function getBlushTexture(): THREE.CanvasTexture {
  if (blushTexture) return blushTexture;
  const { canvas, ctx } = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,110,120,0.55)');
  g.addColorStop(0.6, 'rgba(255,110,120,0.18)');
  g.addColorStop(1, 'rgba(255,110,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  blushTexture = new THREE.CanvasTexture(canvas);
  blushTexture.colorSpace = THREE.SRGBColorSpace;
  return blushTexture;
}

// ─── Expressions ─────────────────────────────────────────────────────────────

interface Expression {
  lid: number; // 0 = open, 1 = closed (resting lid position)
  browLift: number; // metres
  browTilt: number; // + raises the inner end
  mouth: MouthShape;
  blush: number;
}

const EXPRESSIONS: Record<CharacterMood, Expression> = {
  happy: { lid: 0, browLift: 0.003, browTilt: 0.003, mouth: 'smile', blush: 0.75 },
  energetic: { lid: -0.04, browLift: 0.006, browTilt: 0.002, mouth: 'grin', blush: 0.9 },
  focused: { lid: 0.16, browLift: -0.002, browTilt: -0.005, mouth: 'line', blush: 0.25 },
  proud: { lid: 0.12, browLift: 0.002, browTilt: -0.001, mouth: 'smirk', blush: 0.5 },
  zen: { lid: 0.94, browLift: 0.001, browTilt: 0.002, mouth: 'gentle', blush: 0.55 },
  sleepy: { lid: 0.45, browLift: -0.001, browTilt: 0.004, mouth: 'o', blush: 0.4 },
};

// ─── Face assembly ───────────────────────────────────────────────────────────

export interface FaceMaterials {
  skin: THREE.Material;
  /** Eyelids: skin a touch darker, so the eye reads clearly. */
  lid: THREE.Material;
  hair: THREE.Material;
  eye: THREE.MeshPhysicalMaterial;
  lash: THREE.Material;
}

export interface FaceRig {
  group: THREE.Group;
  /** Eyelid pivots: rotation.x 0 = open; LID_CLOSED = shut. */
  lids: THREE.Object3D[];
  /** Eyeballs, rotated to look around. */
  eyeballs: THREE.Object3D[];
  restLid: number;
  dispose: () => void;
}

/** Lid rotation that brings the lid edge (0.6 rad up) down past the iris. */
export const LID_CLOSED = 1.38;

/**
 * Builds eyes, lids, lashes, brows, mouth and blush for a head. `headMesh`
 * is the meshed head (in head-local space) that decals project onto.
 */
export function buildFace(
  d: AvatarDims,
  layout: HeadLayout,
  baseSdf: Sdf,
  headMesh: THREE.Mesh,
  eyeCentres: [number, number, number][],
  mood: CharacterMood,
  lipHex: string,
  mats: FaceMaterials
): FaceRig {
  const group = new THREE.Group();
  group.name = 'Face';
  const expr = EXPRESSIONS[mood] ?? EXPRESSIONS.happy;
  const owned: THREE.BufferGeometry[] = [];
  const ownedMats: THREE.Material[] = [];
  const lids: THREE.Object3D[] = [];
  const eyeballs: THREE.Object3D[] = [];
  const R = d.eyeRadius;

  // Eyes
  const eyeGeo = new THREE.SphereGeometry(R, 40, 24);
  const lidOpenEdge = 0.6; // elevation (rad) of the upper-lid edge when open
  const lidGeo = new THREE.SphereGeometry(R * 1.025, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2 - lidOpenEdge);
  // Lower lid: covers the eye below ~-0.78 rad, just under the iris.
  const lowerLidGeo = new THREE.SphereGeometry(R * 1.02, 36, 8, 0, Math.PI * 2, Math.PI / 2 + 0.86, Math.PI / 2 - 0.86);
  owned.push(eyeGeo, lidGeo, lowerLidGeo);

  eyeCentres.forEach(([x, y, z], i) => {
    const side = i === 0 ? 1 : -1;
    const eyeRoot = new THREE.Group();
    eyeRoot.position.set(x, y, z);
    // Turn each eye slightly outward, following the curve of the face, and
    // flatten it front-to-back: large stylized eyes without a goggle bulge.
    eyeRoot.rotation.y = side * 0.16;
    eyeRoot.scale.set(0.94, 1.08, EYE_DEPTH);
    group.add(eyeRoot);

    const eyeball = new THREE.Mesh(eyeGeo, mats.eye);
    eyeRoot.add(eyeball);
    eyeballs.push(eyeball);

    const lowerLid = new THREE.Mesh(lowerLidGeo, mats.lid);
    lowerLid.rotation.x = -0.06;
    eyeRoot.add(lowerLid);

    const lid = new THREE.Group();
    eyeRoot.add(lid);
    lids.push(lid);
    lid.add(new THREE.Mesh(lidGeo, mats.lid));

    // Lash line along the lid edge, with a small wing at the outer corner.
    const lashPts: THREE.Vector3[] = [];
    const span = 1.3;
    for (let k = 0; k <= 10; k++) {
      const az = -span + (2 * span * k) / 10; // around the eye, 0 = front
      const outer = side * az > 0 ? Math.max(0, (side * az) / span) : 0;
      const el = lidOpenEdge + 0.02 + outer * outer * 0.12 * d.lashWeight;
      const rr = R * (1.035 + outer * 0.06 * d.lashWeight);
      lashPts.push(new THREE.Vector3(
        Math.sin(az) * Math.cos(el) * rr,
        Math.sin(el) * rr,
        Math.cos(az) * Math.cos(el) * rr
      ));
    }
    if (side < 0) lashPts.reverse(); // always run inner → outer
    // A bold upper lash line gives stylized eyes their definition.
    const lashR = 0.0032 + 0.0012 * d.lashWeight;
    const lashGeo = taperedTube(lashPts, (t) => lashR * (0.55 + 0.6 * Math.sin(Math.PI * t) + 0.25 * t) * capped(t, 1), 32, 8);
    owned.push(lashGeo);
    lid.add(new THREE.Mesh(lashGeo, mats.lash));
  });

  // Brows: tapered strokes that hug the brow, inner end thicker.
  const browThick = d.gender === 'male' ? 0.0052 : d.gender === 'female' ? 0.0038 : 0.0045;
  for (const side of [1, -1]) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8; // 0 = inner end, 1 = outer end
      const x = side * (layout.eyeX - 0.017 + t * 0.042);
      const arch = Math.sin(t * Math.PI) * 0.006;
      const y = layout.eyeY + R + 0.013 + expr.browLift + arch + (1 - t) * expr.browTilt - t * 0.004;
      const z = traceFront(baseSdf, x, y);
      if (z !== null) pts.push(new THREE.Vector3(x, y, z + browThick * 0.6));
    }
    if (pts.length >= 4) {
      const geo = taperedTube(pts, (t) => browThick * capped(t, 0.5), 24, 8);
      owned.push(geo);
      const brow = new THREE.Mesh(geo, mats.hair);
      brow.name = 'Brow';
      group.add(brow);
    }
  }

  // Decals are projected onto a stand-in of the head mesh at the origin, so
  // their vertices come out in head-local space (the real head mesh sits
  // under a posed, scaled bone).
  const localHead = new THREE.Mesh(headMesh.geometry);
  localHead.updateMatrixWorld(true);
  const addDecal = (map: THREE.Texture, x: number, y: number, w: number, h: number, opacity = 1, depth = 0.05) => {
    const z = traceFront(baseSdf, x, y);
    if (z === null) return;
    const geo = new DecalGeometry(
      localHead,
      new THREE.Vector3(x, y, z),
      new THREE.Euler(0, Math.atan2(x, 0.12) * 0.8, 0),
      new THREE.Vector3(w, h, depth)
    );
    const mat = new THREE.MeshStandardMaterial({
      map,
      transparent: true,
      opacity,
      roughness: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
    owned.push(geo);
    ownedMats.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2;
    group.add(mesh);
  };

  addDecal(getMouthTexture(expr.mouth, lipHex), 0, layout.mouthY, 0.078, 0.039);
  if (expr.blush > 0) {
    for (const side of [1, -1]) {
      addDecal(getBlushTexture(), side * 0.058, layout.eyeY - 0.034, 0.042, 0.03, expr.blush, 0.06);
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
