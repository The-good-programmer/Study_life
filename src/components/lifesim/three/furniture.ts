import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {
  DesignAestheticStyle,
  DesignSlotType,
  HomeRoomId,
  RoomFurnitureItem,
} from '../../../types/lifeSim';
import * as T from './textures';

/**
 * Parametric 3D furniture library (real-world meters, front faces +Z).
 * Each equipped catalog item restyles its matching piece through the
 * item's design aesthetic, so purchases are visible in the 3D model.
 */

export type EquippedMap = Partial<Record<DesignSlotType, RoomFurnitureItem | null>>;

export interface SharedMaterials {
  /** Lamp shades / bulbs — emissive intensity is driven by time of day. */
  glow: THREE.MeshStandardMaterial;
}

interface Palette {
  wood: number;
  fabric: number;
  accent: number;
  metal: number;
  soft: number;
}

export const STYLE_PALETTES: Record<DesignAestheticStyle, Palette> = {
  Scandinavian: { wood: 0xd6b68a, fabric: 0xd8d3ca, accent: 0x7f9c96, metal: 0xe6e6e6, soft: 0xeeeae2 },
  'Dark Academia': { wood: 0x5b3a24, fabric: 0x2f4a3b, accent: 0x7d2a2a, metal: 0xb08d57, soft: 0xc9b99a },
  'Modern Lo-Fi': { wood: 0x3b3b42, fabric: 0x5a5f96, accent: 0xe08e66, metal: 0x232326, soft: 0x9aa0c8 },
  'Japanese Zen': { wood: 0xc6a47a, fabric: 0xe4dac8, accent: 0x6b7f4e, metal: 0x3a3a3a, soft: 0xd9cfb9 },
  'Industrial Chic': { wood: 0x6a4a33, fabric: 0x8a5a3b, accent: 0xc9a166, metal: 0x1f1f21, soft: 0xa69886 },
};

const paletteFor = (eq: EquippedMap, slot: DesignSlotType): Palette =>
  STYLE_PALETTES[eq[slot]?.brandStyle ?? 'Scandinavian'];

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

const mat = (color: number, roughness = 0.75, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

const fabric = (color: number) => mat(color, 0.95);
const wood = (color: number) => mat(color, 0.55);
const metal = (color: number) => mat(color, 0.35, 0.8);

const place = <T extends THREE.Object3D>(parent: THREE.Object3D, obj: T, x = 0, y = 0, z = 0): T => {
  obj.position.set(x, y, z);
  parent.add(obj);
  return obj;
};

const mesh = (geo: THREE.BufferGeometry, material: THREE.Material, cast = true) => {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
};

const box = (p: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) =>
  place(p, mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z);

const rbox = (p: THREE.Object3D, w: number, h: number, d: number, r: number, m: THREE.Material, x: number, y: number, z: number) => {
  const radius = Math.max(0.001, Math.min(r, Math.min(w, h, d) / 2 - 0.002));
  return place(p, mesh(new RoundedBoxGeometry(w, h, d, 3, radius), m), x, y, z);
};

const cyl = (p: THREE.Object3D, rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, seg = 24) =>
  place(p, mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m), x, y, z);

/** Organic foliage blob: an icosphere with jittered vertices. */
export const foliageGeometry = (radius: number, detail = 2, jitter = 0.18): THREE.BufferGeometry => {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(radius, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const s = 1 + (Math.random() - 0.5) * jitter * 2;
    pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s * 0.9, pos.getZ(i) * s);
  }
  g.computeVertexNormals();
  return g;
};

const at = <T extends THREE.Object3D>(obj: T, x: number, z: number, rotY = 0): T => {
  obj.position.set(x, 0, z);
  obj.rotation.y = rotY;
  return obj;
};

// ---------------------------------------------------------------------------
// Ambient Occlusion / Contact Shadow Helper (Phase 1 Photorealism)
// ---------------------------------------------------------------------------

let cachedShadowTex: THREE.Texture | null = null;
export const contactShadow = (
  parent: THREE.Object3D,
  w: number,
  d: number,
  x = 0,
  z = 0,
  opacity = 0.55
): THREE.Mesh => {
  if (!cachedShadowTex) {
    cachedShadowTex = T.contactShadowTexture();
  }
  const geo = new THREE.PlaneGeometry(w, d);
  const mat = new THREE.MeshBasicMaterial({
    map: cachedShadowTex,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.002, z);
  m.renderOrder = 1;
  parent.add(m);
  return m;
};

// ---------------------------------------------------------------------------
// Furniture pieces
// ---------------------------------------------------------------------------

function sofa(len: number, fab: number, accent: number, legs: number): THREE.Group {
  const g = new THREE.Group();
  contactShadow(g, len + 0.2, 1.15, 0, 0, 0.55);
  const f = fabric(fab);
  rbox(g, len, 0.4, 0.92, 0.06, f, 0, 0.26, 0);
  const n = Math.max(2, Math.round((len - 0.4) / 0.75));
  const cw = (len - 0.4) / n;
  for (let i = 0; i < n; i++) {
    rbox(g, cw - 0.03, 0.16, 0.66, 0.06, f, -len / 2 + 0.2 + cw * (i + 0.5), 0.54, 0.09);
    rbox(g, cw - 0.03, 0.46, 0.2, 0.08, f, -len / 2 + 0.2 + cw * (i + 0.5), 0.74, -0.33);
  }
  rbox(g, 0.2, 0.62, 0.92, 0.07, f, -len / 2 + 0.1, 0.37, 0);
  rbox(g, 0.2, 0.62, 0.92, 0.07, f, len / 2 - 0.1, 0.37, 0);
  const a = fabric(accent);
  rbox(g, 0.42, 0.38, 0.13, 0.06, a, -len / 2 + 0.45, 0.78, -0.18).rotation.z = 0.12;
  rbox(g, 0.42, 0.38, 0.13, 0.06, a, len / 2 - 0.45, 0.78, -0.18).rotation.z = -0.12;
  const lm = wood(legs);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.025, 0.02, 0.06, lm, sx * (len / 2 - 0.08), 0.03, sz * 0.38, 10);
  return g;
}

function armchair(fab: number, legs: number): THREE.Group {
  const g = new THREE.Group();
  contactShadow(g, 1.0, 1.0, 0, 0, 0.48);
  const f = fabric(fab);
  rbox(g, 0.78, 0.36, 0.8, 0.06, f, 0, 0.3, 0);
  rbox(g, 0.58, 0.14, 0.6, 0.05, f, 0, 0.53, 0.06);
  rbox(g, 0.78, 0.5, 0.16, 0.06, f, 0, 0.7, -0.32);
  rbox(g, 0.12, 0.52, 0.8, 0.05, f, -0.33, 0.38, 0);
  rbox(g, 0.12, 0.52, 0.8, 0.05, f, 0.33, 0.38, 0);
  const lm = wood(legs);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = cyl(g, 0.022, 0.016, 0.14, lm, sx * 0.32, 0.07, sz * 0.32, 10);
    leg.rotation.z = sx * 0.12;
  }
  return g;
}

function coffeeTable(w: number, d: number, top: number, legs: number): THREE.Group {
  const g = new THREE.Group();
  contactShadow(g, w + 0.15, d + 0.15, 0, 0, 0.42);
  rbox(g, w, 0.05, d, 0.02, wood(top), 0, 0.42, 0);
  box(g, w - 0.12, 0.02, d - 0.12, wood(top), 0, 0.14, 0);
  const lm = metal(legs);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.03, 0.4, 0.03, lm, sx * (w / 2 - 0.06), 0.2, sz * (d / 2 - 0.06));
  return g;
}

function rug(w: number, d: number, field: number, border: number): THREE.Group {
  const g = new THREE.Group();
  box(g, w, 0.012, d, fabric(border), 0, 0.006, 0).castShadow = false;
  box(g, w - 0.18, 0.014, d - 0.18, fabric(field), 0, 0.008, 0).castShadow = false;
  return g;
}

function floorLamp(metalColor: number, glow: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const m = metal(metalColor);
  cyl(g, 0.16, 0.17, 0.03, m, 0, 0.015, 0);
  cyl(g, 0.012, 0.012, 1.45, m, 0, 0.74, 0, 8);
  const shade = place(g, mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 28, 1, true), glow, false), 0, 1.5, 0);
  (shade.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  return g;
}

function deskLamp(metalColor: number, glow: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const m = metal(metalColor);
  cyl(g, 0.07, 0.08, 0.02, m, 0, 0.01, 0);
  const arm = cyl(g, 0.008, 0.008, 0.38, m, 0.04, 0.2, 0, 8);
  arm.rotation.z = -0.2;
  const shade = place(g, mesh(new THREE.ConeGeometry(0.07, 0.11, 20, 1, true), m), 0.1, 0.4, 0);
  shade.rotation.z = 0.9;
  place(g, mesh(new THREE.SphereGeometry(0.025, 12, 8), glow, false), 0.12, 0.37, 0);
  return g;
}

function plant(potColor: number, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const pot = mat(potColor, 0.6);
  cyl(g, 0.17 * scale, 0.13 * scale, 0.34 * scale, pot, 0, 0.17 * scale, 0);
  cyl(g, 0.155 * scale, 0.155 * scale, 0.02, mat(0x3b2a1e, 1), 0, 0.33 * scale, 0);
  const stem = mat(0x4b3a25, 0.9);
  cyl(g, 0.012 * scale, 0.016 * scale, 0.5 * scale, stem, 0, 0.58 * scale, 0, 6);
  const shades = [0x3f6d3a, 0x4f8244, 0x35602f, 0x5c8f4c];
  for (let i = 0; i < 6; i++) {
    const r = (0.16 + Math.random() * 0.08) * scale;
    const a = (i / 6) * Math.PI * 2;
    place(
      g,
      mesh(foliageGeometry(r, 1, 0.22), mat(shades[i % shades.length], 0.85)),
      Math.cos(a) * 0.12 * scale,
      (0.78 + Math.random() * 0.35) * scale,
      Math.sin(a) * 0.12 * scale,
    );
  }
  return g;
}

function artTexture(accent: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 180;
  const ctx = c.getContext('2d');
  if (ctx) {
    const base = new THREE.Color(accent);
    ctx.fillStyle = '#f2efe8';
    ctx.fillRect(0, 0, 256, 180);
    for (let i = 0; i < 5; i++) {
      const col = base.clone().offsetHSL((Math.random() - 0.5) * 0.15, 0, (Math.random() - 0.5) * 0.35);
      ctx.fillStyle = `#${col.getHexString()}`;
      ctx.globalAlpha = 0.85;
      if (i % 2 === 0) {
        ctx.beginPath();
        ctx.arc(40 + Math.random() * 176, 30 + Math.random() * 120, 20 + Math.random() * 40, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(Math.random() * 180, Math.random() * 120, 40 + Math.random() * 80, 20 + Math.random() * 50);
      }
    }
    ctx.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function wallArt(w: number, h: number, accent: number): THREE.Group {
  const g = new THREE.Group();
  box(g, w, h, 0.035, mat(0x1d1d1f, 0.5), 0, 0, 0);
  box(g, w - 0.06, h - 0.06, 0.01, new THREE.MeshStandardMaterial({ map: artTexture(accent), roughness: 0.9 }), 0, 0, 0.019);
  return g;
}

function desk(top: number, frame: number): THREE.Group {
  const g = new THREE.Group();
  contactShadow(g, 1.8, 0.9, 0, 0, 0.5);
  rbox(g, 1.6, 0.04, 0.72, 0.01, wood(top), 0, 0.74, 0);
  const fm = metal(frame);
  for (const sx of [-1, 1]) {
    box(g, 0.04, 0.72, 0.04, fm, sx * 0.76, 0.36, 0.3);
    box(g, 0.04, 0.72, 0.04, fm, sx * 0.76, 0.36, -0.3);
    box(g, 0.04, 0.04, 0.6, fm, sx * 0.76, 0.05, 0);
  }
  box(g, 0.42, 0.55, 0.62, wood(top), 0.5, 0.4, 0);
  for (let i = 0; i < 3; i++) box(g, 0.12, 0.012, 0.012, fm, 0.5, 0.25 + i * 0.18, 0.315);
  // Monitor
  const scr = mat(0x0b0d12, 0.25, 0.2, { emissive: 0x2c4a7a, emissiveIntensity: 0.55 });
  box(g, 0.08, 0.012, 0.18, fm, -0.15, 0.766, -0.2);
  box(g, 0.025, 0.24, 0.025, fm, -0.15, 0.88, -0.24);
  box(g, 0.66, 0.39, 0.025, mat(0x111214, 0.4), -0.15, 1.08, -0.22);
  box(g, 0.63, 0.36, 0.005, scr, -0.15, 1.08, -0.206);
  // Keyboard, laptop, notebook
  rbox(g, 0.42, 0.018, 0.14, 0.005, mat(0x2a2b2f, 0.6), -0.15, 0.769, 0.1);
  box(g, 0.32, 0.015, 0.22, mat(0xb9bcc2, 0.3, 0.7), 0.42, 0.768, 0.05);
  const lid = box(g, 0.32, 0.22, 0.01, mat(0xb9bcc2, 0.3, 0.7), 0.42, 0.87, -0.06);
  lid.rotation.x = -0.25;
  box(g, 0.18, 0.012, 0.24, mat(0xe8dfcc, 0.9), -0.6, 0.767, 0.12).rotation.y = 0.2;
  return g;
}

function officeChair(fab: number, frame: number): THREE.Group {
  const g = new THREE.Group();
  contactShadow(g, 0.7, 0.7, 0, 0, 0.45);
  const fm = metal(frame);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spoke = box(g, 0.3, 0.03, 0.04, fm, Math.cos(a) * 0.15, 0.07, Math.sin(a) * 0.15);
    spoke.rotation.y = -a;
    place(g, mesh(new THREE.SphereGeometry(0.03, 10, 8), mat(0x111111, 0.6)), Math.cos(a) * 0.29, 0.03, Math.sin(a) * 0.29);
  }
  cyl(g, 0.025, 0.025, 0.36, fm, 0, 0.26, 0, 10);
  const f = fabric(fab);
  rbox(g, 0.52, 0.08, 0.5, 0.035, f, 0, 0.48, 0);
  rbox(g, 0.48, 0.56, 0.07, 0.035, f, 0, 0.84, -0.25).rotation.x = -0.08;
  box(g, 0.03, 0.2, 0.03, fm, 0, 0.56, -0.24);
  return g;
}

function bookshelf(woodColor: number, w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  contactShadow(g, w + 0.15, 0.45, 0, 0, 0.55);
  const wm = wood(woodColor);
  const d = 0.34;
  box(g, 0.03, h, d, wm, -w / 2, h / 2, 0);
  box(g, 0.03, h, d, wm, w / 2, h / 2, 0);
  box(g, w, 0.02, d, wm, 0, h - 0.01, 0);
  box(g, w, 0.01, d, mat(0x2b2b2b, 0.9), 0, h / 2, -d / 2 + 0.005);
  const shelves = 5;
  const bookColors = [0x7d2a2a, 0x2f4a3b, 0x1e3557, 0xc9a166, 0xe8e0cf, 0x5a5f96, 0x8a5a3b, 0x3a3a3a];
  for (let s = 0; s < shelves; s++) {
    const y = 0.04 + (s * (h - 0.06)) / shelves;
    box(g, w, 0.025, d, wm, 0, y, 0);
    let x = -w / 2 + 0.05;
    while (x < w / 2 - 0.12) {
      if (Math.random() < 0.12) {
        x += 0.12;
        continue;
      }
      const bw = 0.025 + Math.random() * 0.03;
      const bh = 0.2 + Math.random() * 0.1;
      box(g, bw, bh, 0.22, mat(bookColors[Math.floor(Math.random() * bookColors.length)], 0.8), x + bw / 2, y + 0.0125 + bh / 2, 0.02);
      x += bw + 0.004;
    }
  }
  return g;
}

function bed(frame: number, duvet: number, pillow: number, accent: number): THREE.Group {
  const g = new THREE.Group();
  contactShadow(g, 2.15, 2.35, 0, 0.05, 0.62);
  const fm = wood(frame);
  rbox(g, 1.9, 0.3, 2.15, 0.03, fm, 0, 0.2, 0);
  rbox(g, 1.98, 1.05, 0.1, 0.03, fabric(accent), 0, 0.6, -1.06);
  rbox(g, 1.8, 0.24, 2.0, 0.07, fabric(0xf4f2ee), 0, 0.47, 0.02);
  rbox(g, 1.86, 0.08, 1.45, 0.04, fabric(duvet), 0, 0.6, 0.32);
  rbox(g, 1.88, 0.05, 0.42, 0.025, fabric(accent), 0, 0.66, 0.78);
  const pm = fabric(pillow);
  rbox(g, 0.66, 0.15, 0.42, 0.07, pm, -0.42, 0.68, -0.72).rotation.x = -0.25;
  rbox(g, 0.66, 0.15, 0.42, 0.07, pm, 0.42, 0.68, -0.72).rotation.x = -0.25;
  return g;
}

function nightstand(woodColor: number, metalColor: number, glow: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  contactShadow(g, 0.65, 0.55, 0, 0, 0.45);
  rbox(g, 0.5, 0.5, 0.4, 0.02, wood(woodColor), 0, 0.25, 0);
  box(g, 0.14, 0.012, 0.012, metal(metalColor), 0, 0.36, 0.205);
  const lamp = new THREE.Group();
  cyl(lamp, 0.06, 0.08, 0.26, mat(0xe9e4da, 0.5), 0, 0.13, 0);
  place(lamp, mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.18, 24, 1, true), glow, false), 0, 0.35, 0);
  place(g, lamp, 0, 0.5, -0.02);
  return g;
}

function wardrobe(woodColor: number, metalColor: number): THREE.Group {
  const g = new THREE.Group();
  contactShadow(g, 2.2, 0.75, 0, 0, 0.6);
  const wm = wood(woodColor);
  rbox(g, 2.0, 2.2, 0.6, 0.015, wm, 0, 1.1, 0);
  const seam = mat(0x1a1a1a, 0.9);
  for (const x of [-0.5, 0, 0.5]) box(g, 0.008, 2.12, 0.01, seam, x, 1.1, 0.301);
  const hm = metal(metalColor);
  for (const x of [-0.06, 0.06, -0.56, 0.56]) box(g, 0.015, 0.3, 0.025, hm, x, 1.1, 0.315);
  return g;
}

function dresser(woodColor: number, metalColor: number): THREE.Group {
  const g = new THREE.Group();
  contactShadow(g, 1.35, 0.55, 0, 0, 0.5);
  rbox(g, 1.2, 0.8, 0.45, 0.015, wood(woodColor), 0, 0.4, 0);
  const hm = metal(metalColor);
  for (let i = 0; i < 3; i++) box(g, 0.2, 0.012, 0.015, hm, 0, 0.17 + i * 0.25, 0.23);
  return g;
}

function bench(fab: number, legs: number): THREE.Group {
  const g = new THREE.Group();
  contactShadow(g, 1.45, 0.5, 0, 0, 0.45);
  rbox(g, 1.3, 0.14, 0.42, 0.05, fabric(fab), 0, 0.44, 0);
  const lm = wood(legs);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.04, 0.38, 0.04, lm, sx * 0.58, 0.19, sz * 0.16);
  return g;
}

function tvUnit(woodColor: number): THREE.Group {
  const g = new THREE.Group();
  contactShadow(g, 2.1, 0.55, 0, 0, 0.5);
  rbox(g, 1.9, 0.45, 0.42, 0.015, wood(woodColor), 0, 0.27, 0);
  for (const x of [-0.475, 0, 0.475]) box(g, 0.006, 0.4, 0.01, mat(0x1a1a1a, 0.9), x, 0.27, 0.211);
  box(g, 1.52, 0.86, 0.04, mat(0x0c0c0e, 0.2, 0.3), 0, 1.25, -0.12);
  box(g, 1.48, 0.82, 0.005, mat(0x05070b, 0.15, 0.1, { emissive: 0x1d2c44, emissiveIntensity: 0.6 }), 0, 1.25, -0.098);
  box(g, 0.6, 0.06, 0.12, mat(0x222222, 0.5), 0, 0.53, 0.05);
  return g;
}

function counterRun(len: number, cabinet: number, top: THREE.Material, uppers = false): THREE.Group {
  const g = new THREE.Group();
  contactShadow(g, len + 0.1, 0.75, 0, 0, 0.55);
  const cm = mat(cabinet, 0.5);
  box(g, len, 0.1, 0.55, mat(0x1b1b1d, 0.9), 0, 0.05, -0.02);
  box(g, len, 0.76, 0.6, cm, 0, 0.48, 0);
  const n = Math.max(1, Math.round(len / 0.6));
  const seam = mat(0x1c1c1c, 0.9);
  for (let i = 1; i < n; i++) box(g, 0.006, 0.72, 0.008, seam, -len / 2 + (len * i) / n, 0.48, 0.301);
  box(g, len + 0.02, 0.04, 0.64, top, 0, 0.88, 0.01);
  if (uppers) {
    box(g, len, 0.7, 0.35, cm, 0, 1.9, -0.13);
    for (let i = 1; i < n; i++) box(g, 0.006, 0.66, 0.008, seam, -len / 2 + (len * i) / n, 1.9, 0.046);
  }
  return g;
}

function sink(): THREE.Group {
  const g = new THREE.Group();
  box(g, 0.6, 0.012, 0.42, mat(0x9ea3a8, 0.25, 0.9), 0, 0.903, 0);
  box(g, 0.52, 0.01, 0.34, mat(0x55595e, 0.3, 0.8), 0, 0.909, 0);
  const tap = metal(0xc9ccd1);
  cyl(g, 0.018, 0.022, 0.32, tap, 0, 1.06, -0.18, 12);
  box(g, 0.025, 0.025, 0.18, tap, 0, 1.21, -0.1);
  return g;
}

function cooktop(): THREE.Group {
  const g = new THREE.Group();
  box(g, 0.6, 0.01, 0.52, mat(0x0a0a0b, 0.15, 0.2), 0, 0.905, 0);
  const ring = mat(0x3a3a3c, 0.4);
  for (const [x, z] of [[-0.15, -0.12], [0.15, -0.12], [-0.15, 0.12], [0.15, 0.12]]) {
    const r = place(g, mesh(new THREE.TorusGeometry(0.075, 0.006, 6, 28), ring, false), x, 0.912, z);
    r.rotation.x = Math.PI / 2;
  }
  // Range hood
  box(g, 0.7, 0.12, 0.45, mat(0xb5b8bd, 0.3, 0.85), 0, 1.75, -0.1);
  box(g, 0.28, 0.85, 0.24, mat(0xb5b8bd, 0.3, 0.85), 0, 2.22, -0.18);
  return g;
}

function fridge(): THREE.Group {
  const g = new THREE.Group();
  contactShadow(g, 1.0, 0.85, 0, 0, 0.58);
  rbox(g, 0.85, 2.0, 0.7, 0.02, mat(0xc5c8cc, 0.28, 0.75), 0, 1.0, 0);
  box(g, 0.84, 0.006, 0.01, mat(0x2a2a2a, 0.8), 0, 1.25, 0.351);
  const h = metal(0x8d9196);
  box(g, 0.025, 0.5, 0.03, h, -0.36, 1.6, 0.37);
  box(g, 0.025, 0.4, 0.03, h, -0.36, 0.9, 0.37);
  return g;
}

function stool(seat: number, frame: number): THREE.Group {
  const g = new THREE.Group();
  const fm = metal(frame);
  cyl(g, 0.17, 0.17, 0.05, fabric(seat), 0, 0.68, 0);
  cyl(g, 0.02, 0.02, 0.66, fm, 0, 0.33, 0, 10);
  cyl(g, 0.17, 0.19, 0.015, fm, 0, 0.008, 0);
  const ring = place(g, mesh(new THREE.TorusGeometry(0.13, 0.008, 6, 24), fm), 0, 0.28, 0);
  ring.rotation.x = Math.PI / 2;
  return g;
}

function diningTable(top: number, legs: number): THREE.Group {
  const g = new THREE.Group();
  contactShadow(g, 1.85, 1.15, 0, 0, 0.52);
  rbox(g, 1.6, 0.05, 0.9, 0.02, wood(top), 0, 0.75, 0);
  const lm = wood(legs);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const l = box(g, 0.05, 0.73, 0.05, lm, sx * 0.7, 0.365, sz * 0.36);
    l.rotation.z = sx * 0.04;
  }
  cyl(g, 0.12, 0.08, 0.04, mat(0xe7e2d8, 0.6), 0, 0.795, 0);
  return g;
}

function diningChair(woodColor: number, seat: number): THREE.Group {
  const g = new THREE.Group();
  contactShadow(g, 0.55, 0.55, 0, 0, 0.35);
  const wm = wood(woodColor);
  rbox(g, 0.44, 0.05, 0.44, 0.02, fabric(seat), 0, 0.46, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.035, 0.45, 0.035, wm, sx * 0.19, 0.225, sz * 0.19);
  for (const sx of [-1, 1]) box(g, 0.035, 0.45, 0.035, wm, sx * 0.19, 0.7, -0.19);
  rbox(g, 0.42, 0.14, 0.03, 0.012, wm, 0, 0.86, -0.19);
  return g;
}

function pendant(metalColor: number, glow: THREE.Material, drop: number, ceiling = 2.8): THREE.Group {
  const g = new THREE.Group();
  const m = metal(metalColor);
  cyl(g, 0.003, 0.003, drop, mat(0x111111, 0.8), 0, ceiling - drop / 2, 0, 4);
  const shade = place(g, mesh(new THREE.ConeGeometry(0.16, 0.2, 24, 1, true), m), 0, ceiling - drop - 0.06, 0);
  (shade.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  place(g, mesh(new THREE.SphereGeometry(0.045, 12, 8), glow, false), 0, ceiling - drop - 0.12, 0);
  return g;
}

function espressoMachine(body: number): THREE.Group {
  const g = new THREE.Group();
  rbox(g, 0.34, 0.36, 0.3, 0.03, mat(body, 0.3, 0.6), 0, 0.18, 0);
  box(g, 0.26, 0.04, 0.12, mat(0x1b1b1b, 0.5), 0, 0.03, 0.16);
  cyl(g, 0.03, 0.03, 0.06, metal(0x9a9da2), 0, 0.2, 0.17, 12);
  return g;
}

function lounger(frame: number, cushion: number): THREE.Group {
  const g = new THREE.Group();
  contactShadow(g, 0.85, 2.1, 0, 0, 0.48);
  const fm = wood(frame);
  box(g, 0.68, 0.06, 1.95, fm, 0, 0.28, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.05, 0.28, 0.05, fm, sx * 0.3, 0.14, sz * 0.9);
  const c = fabric(cushion);
  rbox(g, 0.62, 0.08, 1.3, 0.035, c, 0, 0.35, 0.3);
  const back = rbox(g, 0.62, 0.08, 0.7, 0.035, c, 0, 0.52, -0.6);
  back.rotation.x = 0.55;
  return g;
}

function bistroSet(frame: number, accent: number): THREE.Group {
  const g = new THREE.Group();
  contactShadow(g, 1.5, 0.95, 0, 0, 0.42);
  const fm = metal(frame);
  cyl(g, 0.34, 0.34, 0.025, mat(0xe9e5dc, 0.4), 0, 0.73, 0);
  cyl(g, 0.02, 0.02, 0.72, fm, 0, 0.36, 0, 10);
  cyl(g, 0.2, 0.22, 0.02, fm, 0, 0.01, 0);
  for (const sx of [-1, 1]) {
    const ch = diningChair(frame, accent);
    ch.position.set(sx * 0.62, 0, 0);
    ch.rotation.y = -sx * Math.PI / 2;
    g.add(ch);
  }
  return g;
}

function planter(len: number, woodColor: number): THREE.Group {
  const g = new THREE.Group();
  contactShadow(g, len + 0.15, 0.55, 0, 0, 0.48);
  box(g, len, 0.45, 0.4, wood(woodColor), 0, 0.225, 0);
  const shades = [0x3f6d3a, 0x4f8244, 0x6a9a52];
  const n = Math.round(len / 0.3);
  for (let i = 0; i < n; i++) {
    place(g, mesh(foliageGeometry(0.17 + Math.random() * 0.06, 1, 0.25), mat(shades[i % 3], 0.85)), -len / 2 + 0.15 + i * (len - 0.3) / Math.max(1, n - 1), 0.55, (Math.random() - 0.5) * 0.1);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Room compositions (house-local coordinates; floor at y = 0)
// ---------------------------------------------------------------------------

export interface FurnitureItemMeta {
  id: string;
  roomId: HomeRoomId;
  slotType: DesignSlotType;
  label: string;
  brandStyle?: DesignAestheticStyle;
}

function buildStudy(eq: EquippedMap, sh: SharedMaterials): THREE.Group {
  const g = new THREE.Group();
  const dk = paletteFor(eq, 'desk');
  const ch = paletteFor(eq, 'chair');
  const lt = paletteFor(eq, 'lighting');
  const sf = paletteFor(eq, 'shelf');
  const rg = paletteFor(eq, 'rug');
  const ar = paletteFor(eq, 'wall_art');
  const pl = paletteFor(eq, 'plant');

  if (eq.rug) {
    g.add(at(rug(2.6, 1.8, rg.soft, rg.accent), -4.2, -3.6));
  }

  if (eq.desk) {
    const d = desk(dk.wood, dk.metal);
    d.position.set(-4.6, 0, -6.45);
    d.userData = { id: 'study_desk', roomId: 'study', slotType: 'desk', label: 'Study Desk', brandStyle: eq.desk.brandStyle ?? 'Scandinavian' };
    g.add(d);
  }

  if (eq.lighting) {
    const dl = deskLamp(lt.metal, sh.glow);
    dl.position.set(-5.3, 0.76, -6.6);
    dl.userData = { id: 'study_lamp', roomId: 'study', slotType: 'lighting', label: 'Task Desk Lamp', brandStyle: eq.lighting.brandStyle ?? 'Scandinavian' };
    g.add(dl);
  }

  if (eq.chair) {
    const oc = officeChair(ch.fabric, ch.metal);
    oc.position.set(-4.75, 0, -5.65);
    oc.rotation.y = Math.PI + 0.25;
    oc.userData = { id: 'study_chair', roomId: 'study', slotType: 'chair', label: 'Ergonomic Desk Chair', brandStyle: eq.chair.brandStyle ?? 'Scandinavian' };
    g.add(oc);
  }

  // Starter campus twin bed in study/dorm room
  if (eq.bed) {
    const bd = paletteFor(eq, 'bed');
    const b = bed(bd.wood, bd.soft, 0xf3f1ec, bd.fabric);
    b.position.set(-6.15, 0, -2.1);
    b.rotation.y = Math.PI / 2;
    b.scale.set(0.85, 1, 0.85);
    b.userData = { id: 'study_bed', roomId: 'study', slotType: 'bed', label: 'Campus Twin Bed', brandStyle: eq.bed.brandStyle ?? 'Scandinavian' };
    g.add(b);
  }

  if (eq.shelf) {
    const bs = bookshelf(sf.wood, 1.8, 2.1);
    bs.position.set(-7.72, 0, -3.8);
    bs.rotation.y = Math.PI / 2;
    bs.userData = { id: 'study_shelf', roomId: 'study', slotType: 'shelf', label: 'Library Bookshelf', brandStyle: eq.shelf.brandStyle ?? 'Scandinavian' };
    g.add(bs);
  }

  if (eq.plant) {
    const p = plant(pl.accent, 1.15);
    p.position.set(-0.6, 0, -6.35);
    p.userData = { id: 'study_plant', roomId: 'study', slotType: 'plant', label: 'Foliage Planter', brandStyle: eq.plant.brandStyle ?? 'Scandinavian' };
    g.add(p);
  }

  if (eq.wall_art) {
    const art = wallArt(1.0, 0.7, ar.accent);
    art.position.set(-2.3, 1.6, -6.87);
    art.userData = { id: 'study_art', roomId: 'study', slotType: 'wall_art', label: 'Study Wall Art', brandStyle: eq.wall_art.brandStyle ?? 'Scandinavian' };
    g.add(art);
  }

  return g;
}

function buildBedroom(eq: EquippedMap, sh: SharedMaterials): THREE.Group {
  const g = new THREE.Group();
  const bd = paletteFor(eq, 'bed');
  const lt = paletteFor(eq, 'lighting');
  const sf = paletteFor(eq, 'shelf');
  const rg = paletteFor(eq, 'rug');
  const ar = paletteFor(eq, 'wall_art');
  const pl = paletteFor(eq, 'plant');

  if (eq.rug) {
    g.add(at(rug(2.8, 2.0, rg.soft, rg.accent), 4.5, -4.9));
  }

  if (eq.bed) {
    const b = bed(bd.wood, bd.soft, 0xf3f1ec, bd.fabric);
    b.position.set(4.5, 0, -5.8);
    b.userData = { id: 'bedroom_bed', roomId: 'bedroom', slotType: 'bed', label: 'Master Bed', brandStyle: eq.bed.brandStyle ?? 'Scandinavian' };
    g.add(b);
  }

  if (eq.shelf || eq.lighting) {
    for (const x of [3.12, 5.88]) {
      const ns = nightstand(bd.wood, lt.metal, sh.glow);
      ns.position.set(x, 0, -6.6);
      ns.userData = { id: `bedroom_nightstand_${x > 4 ? 'r' : 'l'}`, roomId: 'bedroom', slotType: 'shelf', label: 'Bedside Nightstand', brandStyle: eq.shelf?.brandStyle ?? 'Scandinavian' };
      g.add(ns);
    }
  }

  if (eq.chair) {
    const bn = bench(bd.accent, bd.wood);
    bn.position.set(4.5, 0, -4.35);
    bn.userData = { id: 'bedroom_bench', roomId: 'bedroom', slotType: 'chair', label: 'End-of-Bed Bench', brandStyle: eq.chair.brandStyle ?? 'Scandinavian' };
    g.add(bn);
  }

  if (eq.shelf) {
    const wr = wardrobe(sf.wood, sf.metal);
    wr.position.set(0.38, 0, -4.4);
    wr.rotation.y = Math.PI / 2;
    wr.userData = { id: 'bedroom_wardrobe', roomId: 'bedroom', slotType: 'shelf', label: 'Wardrobe Closet', brandStyle: eq.shelf.brandStyle ?? 'Scandinavian' };
    g.add(wr);
    const dr = dresser(sf.wood, sf.metal);
    dr.position.set(7.65, 0, -1.2);
    dr.rotation.y = -Math.PI / 2;
    dr.userData = { id: 'bedroom_dresser', roomId: 'bedroom', slotType: 'shelf', label: 'Bedroom Dresser', brandStyle: eq.shelf.brandStyle ?? 'Scandinavian' };
    g.add(dr);
  }

  if (eq.wall_art) {
    const art = wallArt(0.9, 0.65, ar.accent);
    art.position.set(7.87, 1.55, -1.2);
    art.rotation.y = -Math.PI / 2;
    art.userData = { id: 'bedroom_art', roomId: 'bedroom', slotType: 'wall_art', label: 'Bedroom Wall Art', brandStyle: eq.wall_art.brandStyle ?? 'Scandinavian' };
    g.add(art);
  }

  if (eq.plant) {
    const p = plant(pl.accent, 1.0);
    p.position.set(6.6, 0, -0.5);
    p.userData = { id: 'bedroom_plant', roomId: 'bedroom', slotType: 'plant', label: 'Bedroom Foliage', brandStyle: eq.plant.brandStyle ?? 'Scandinavian' };
    g.add(p);
  }

  return g;
}

function buildLiving(eq: EquippedMap, sh: SharedMaterials): THREE.Group {
  const g = new THREE.Group();
  const sfa = paletteFor(eq, 'sofa');
  const lt = paletteFor(eq, 'lighting');
  const sf = paletteFor(eq, 'shelf');
  const rg = paletteFor(eq, 'rug');
  const ar = paletteFor(eq, 'wall_art');
  const pl = paletteFor(eq, 'plant');

  if (eq.rug) {
    g.add(at(rug(3.2, 2.5, rg.soft, rg.accent), -4.4, 4.4));
  }

  if (eq.sofa) {
    const s = sofa(2.6, sfa.fabric, sfa.accent, sfa.wood);
    s.position.set(-6.95, 0, 4.4);
    s.rotation.y = Math.PI / 2;
    s.userData = { id: 'living_sofa', roomId: 'living', slotType: 'sofa', label: 'Lounge Sofa', brandStyle: eq.sofa.brandStyle ?? 'Scandinavian' };
    g.add(s);
    const ct = coffeeTable(1.1, 0.6, sfa.wood, sfa.metal);
    ct.position.set(-4.9, 0, 4.4);
    ct.rotation.y = Math.PI / 2;
    ct.userData = { id: 'living_table', roomId: 'living', slotType: 'sofa', label: 'Coffee Table', brandStyle: eq.sofa.brandStyle ?? 'Scandinavian' };
    g.add(ct);
  }

  if (eq.chair) {
    const ac = armchair(sfa.accent, sfa.wood);
    ac.position.set(-4.4, 0, 2.35);
    ac.rotation.y = 0.35;
    ac.userData = { id: 'living_armchair', roomId: 'living', slotType: 'chair', label: 'Accent Armchair', brandStyle: eq.chair.brandStyle ?? 'Scandinavian' };
    g.add(ac);
  }

  if (eq.shelf || eq.station) {
    const tv = tvUnit(sf.wood);
    tv.position.set(-0.3, 0, 4.4);
    tv.rotation.y = -Math.PI / 2;
    tv.userData = { id: 'living_tv', roomId: 'living', slotType: 'shelf', label: 'Media Console', brandStyle: (eq.shelf || eq.station)?.brandStyle ?? 'Scandinavian' };
    g.add(tv);
  }

  if (eq.lighting) {
    const fl = floorLamp(lt.metal, sh.glow);
    fl.position.set(-7.4, 0, 6.35);
    fl.userData = { id: 'living_lamp', roomId: 'living', slotType: 'lighting', label: 'Corner Arc Lamp', brandStyle: eq.lighting.brandStyle ?? 'Scandinavian' };
    g.add(fl);
  }

  if (eq.plant) {
    const p1 = plant(pl.accent, 1.25);
    p1.position.set(-7.35, 0, 0.6);
    p1.userData = { id: 'living_plant_1', roomId: 'living', slotType: 'plant', label: 'Corner Plant', brandStyle: eq.plant.brandStyle ?? 'Scandinavian' };
    g.add(p1);
    const p2 = plant(pl.accent, 0.9);
    p2.position.set(-0.55, 0, 6.4);
    p2.userData = { id: 'living_plant_2', roomId: 'living', slotType: 'plant', label: 'Accent Plant', brandStyle: eq.plant.brandStyle ?? 'Scandinavian' };
    g.add(p2);
  }

  if (eq.wall_art) {
    const art = wallArt(1.3, 0.8, ar.accent);
    art.position.set(-7.87, 1.6, 4.4);
    art.rotation.y = Math.PI / 2;
    art.userData = { id: 'living_art', roomId: 'living', slotType: 'wall_art', label: 'Living Canvas Art', brandStyle: eq.wall_art.brandStyle ?? 'Scandinavian' };
    g.add(art);
  }

  return g;
}

function buildKitchen(eq: EquippedMap, sh: SharedMaterials, counterTop: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const st = paletteFor(eq, 'station');
  const lt = paletteFor(eq, 'lighting');
  const ch = paletteFor(eq, 'chair');
  const pl = paletteFor(eq, 'plant');
  const cabinet = eq.station ? st.wood : 0xf1efea;

  const north = counterRun(5.9, cabinet, counterTop, false);
  north.position.set(4.95, 0, 0.42);
  g.add(north);
  for (const [x, len] of [[2.85, 1.7], [6.6, 2.6]] as const) {
    const up = new THREE.Group();
    box(up, len, 0.7, 0.35, mat(cabinet, 0.5), 0, 1.9, 0);
    up.position.set(x, 0, 0.25);
    g.add(up);
  }
  const ck = cooktop();
  ck.position.set(4.5, 0, 0.42);
  g.add(ck);
  const east = counterRun(3.85, cabinet, counterTop, false);
  east.position.set(7.58, 0, 2.68);
  east.rotation.y = -Math.PI / 2;
  g.add(east);
  const sk = sink();
  sk.position.set(7.58, 0, 2.5);
  sk.rotation.y = -Math.PI / 2;
  g.add(sk);
  const fr = fridge();
  fr.position.set(7.5, 0, 5.2);
  fr.rotation.y = -Math.PI / 2;
  fr.userData = { id: 'kitchen_fridge', roomId: 'kitchen', slotType: 'station', label: 'French Door Fridge', brandStyle: eq.station?.brandStyle ?? 'Scandinavian' };
  g.add(fr);

  if (eq.station) {
    const em = espressoMachine(st.metal === 0xe6e6e6 ? 0xb8bcc2 : st.metal);
    em.position.set(6.9, 0.9, 0.35);
    em.userData = { id: 'kitchen_espresso', roomId: 'kitchen', slotType: 'station', label: 'Espresso Bar', brandStyle: eq.station.brandStyle ?? 'Scandinavian' };
    g.add(em);
  }

  const island = counterRun(2.2, cabinet, counterTop, false);
  island.position.set(4.3, 0, 2.75);
  island.userData = { id: 'kitchen_island', roomId: 'kitchen', slotType: 'station', label: 'Kitchen Island', brandStyle: eq.station?.brandStyle ?? 'Scandinavian' };
  g.add(island);

  if (eq.chair) {
    for (const x of [3.6, 4.3, 5.0]) {
      const s = stool(ch.fabric, ch.metal);
      s.position.set(x, 0, 3.45);
      g.add(s);
    }
  }

  if (eq.lighting) {
    for (const x of [3.75, 4.85]) {
      const pd = pendant(lt.metal, sh.glow, 0.9);
      pd.position.set(x, 0, 2.75);
      g.add(pd);
    }
  }

  const dt = diningTable(st.wood === 0xf1efea ? 0xc8a77d : st.wood, 0x3a2a1e);
  dt.position.set(2.5, 0, 5.4);
  dt.userData = { id: 'kitchen_diningtable', roomId: 'kitchen', slotType: 'station', label: 'Dining Table', brandStyle: eq.station?.brandStyle ?? 'Scandinavian' };
  g.add(dt);

  if (eq.chair) {
    for (const x of [2.05, 2.95]) {
      const a = diningChair(0x3a2a1e, ch.fabric);
      a.position.set(x, 0, 4.72);
      g.add(a);
      const b = diningChair(0x3a2a1e, ch.fabric);
      b.position.set(x, 0, 6.08);
      b.rotation.y = Math.PI;
      g.add(b);
    }
  }

  if (eq.plant) {
    const p = plant(pl.accent, 0.55);
    p.position.set(2.4, 0.9, 0.35);
    p.userData = { id: 'kitchen_plant', roomId: 'kitchen', slotType: 'plant', label: 'Herb Planter', brandStyle: eq.plant.brandStyle ?? 'Scandinavian' };
    g.add(p);
  }

  return g;
}

function buildBalcony(eq: EquippedMap): THREE.Group {
  const g = new THREE.Group();
  const ch = paletteFor(eq, 'chair');
  const pl = paletteFor(eq, 'plant');

  if (eq.chair) {
    let lIdx = 0;
    for (const x of [-6.9, -5.8]) {
      const l = lounger(0x8b6a4a, ch.soft);
      l.position.set(x, 0, 8.85);
      l.userData = { id: `balcony_lounger_${++lIdx}`, roomId: 'balcony', slotType: 'chair', label: 'Poolside Lounger', brandStyle: eq.chair.brandStyle ?? 'Scandinavian' };
      g.add(l);
    }
    const bs = bistroSet(ch.metal === 0xe6e6e6 ? 0x2a2a2a : ch.metal, ch.accent);
    bs.position.set(-2.2, 0, 8.7);
    bs.userData = { id: 'balcony_bistro', roomId: 'balcony', slotType: 'chair', label: 'Outdoor Bistro Set', brandStyle: eq.chair.brandStyle ?? 'Scandinavian' };
    g.add(bs);
  }

  if (eq.plant) {
    const pr = planter(2.2, 0x6b5039);
    pr.position.set(-3.9, 0, 10.15);
    pr.userData = { id: 'balcony_planter', roomId: 'balcony', slotType: 'plant', label: 'Terrace Garden Box', brandStyle: eq.plant.brandStyle ?? 'Scandinavian' };
    g.add(pr);
    const p = plant(pl.accent, 1.1);
    p.position.set(0.5, 0, 7.5);
    p.userData = { id: 'balcony_plant', roomId: 'balcony', slotType: 'plant', label: 'Balcony Shrub', brandStyle: eq.plant.brandStyle ?? 'Scandinavian' };
    g.add(p);
  }

  return g;
}

export function buildRoomFurniture(
  roomId: HomeRoomId,
  equipped: EquippedMap,
  shared: SharedMaterials,
  counterTop: THREE.Material,
  rotations: Record<string, number> = {},
  isUnlocked = true,
): THREE.Group {
  if (!isUnlocked) {
    return new THREE.Group();
  }

  let g: THREE.Group;
  switch (roomId) {
    case 'study':
      g = buildStudy(equipped, shared);
      break;
    case 'bedroom':
      g = buildBedroom(equipped, shared);
      break;
    case 'living':
      g = buildLiving(equipped, shared);
      break;
    case 'kitchen':
      g = buildKitchen(equipped, shared, counterTop);
      break;
    case 'balcony':
      g = buildBalcony(equipped);
      break;
    default:
      return new THREE.Group();
  }
  // Apply dynamic interactive rotations from 3D selection gizmo
  g.children.forEach((child) => {
    if (child.userData?.id && rotations[child.userData.id] !== undefined) {
      child.rotation.y += rotations[child.userData.id];
    }
  });
  return g;
}
