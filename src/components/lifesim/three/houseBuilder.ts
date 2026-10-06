import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { HomeRoomId, HousingTier } from '../../../types/lifeSim';
import { foliageGeometry } from './furniture';
import * as T from './textures';

/**
 * Architectural model of the home: real-world scale (1 unit = 1 m),
 * 2.8 m ceilings, walls with true window/door openings, gable roof,
 * terrace, pool, carport, street and landscaping.
 */

export type WallFinishId = 'white_modern' | 'exposed_brick' | 'cedar_slats' | 'concrete_loft';
export type FloorFinishId = 'honey_parquet' | 'white_marble' | 'charcoal_slate' | 'wool_carpet';

export const WALL_HEIGHT = 2.8;
export const FLOOR_LEVEL = 0.18;
const EXT_T = 0.22;
const INT_T = 0.12;

export interface RoomRect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export const ROOM_LAYOUT: Record<HomeRoomId, RoomRect> = {
  study: { x0: -8, x1: 0, z0: -7, z1: 0 },
  bedroom: { x0: 0, x1: 8, z0: -7, z1: 0 },
  living: { x0: -8, x1: 0, z0: 0, z1: 7 },
  kitchen: { x0: 0, x1: 8, z0: 0, z1: 7 },
  balcony: { x0: -8, x1: 1, z0: 7, z1: 10.5 },
};

export const roomCenter = (id: HomeRoomId): THREE.Vector3 => {
  const r = ROOM_LAYOUT[id];
  return new THREE.Vector3((r.x0 + r.x1) / 2, FLOOR_LEVEL, (r.z0 + r.z1) / 2);
};

export const roomArea = (id: HomeRoomId): number => {
  const r = ROOM_LAYOUT[id];
  return (r.x1 - r.x0) * (r.z1 - r.z0);
};

// ---------------------------------------------------------------------------
// Geometry helpers with world-scaled UVs (1 UV unit = 1 meter)
// ---------------------------------------------------------------------------

/** BoxGeometry whose UVs are expressed in meters, offset by the box's local min corner. */
export function worldBox(w: number, h: number, d: number, ox = 0, oy = 0, oz = 0): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // Face order: +x, -x, +y, -y, +z, -z (4 vertices each)
  const map: [number, number, number, number][] = [
    [d, h, oz, oy],
    [d, h, -(oz + d), oy],
    [w, d, ox, oz],
    [w, d, ox, oz],
    [w, h, ox, oy],
    [w, h, -(ox + w), oy],
  ];
  for (let f = 0; f < 6; f++) {
    const [su, sv, ou, ov] = map[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * su + ou, uv.getY(i) * sv + ov);
    }
  }
  return g;
}

/** Horizontal plane (XZ) with meter UVs; returned mesh already lies flat. */
function worldPlane(w: number, d: number, m: THREE.Material, cx: number, y: number, cz: number): THREE.Mesh {
  const g = new THREE.PlaneGeometry(w, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w + cx - w / 2, uv.getY(i) * d - cz - d / 2);
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(cx, y, cz);
  mesh.receiveShadow = true;
  return mesh;
}

const shadowed = <T extends THREE.Mesh>(m: T, cast = true): T => {
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
};

const addBox = (
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  m: THREE.Material | THREE.Material[],
  x: number,
  y: number,
  z: number,
  cast = true,
) => {
  const mesh = shadowed(new THREE.Mesh(worldBox(w, h, d, x - w / 2, y - h / 2, z - d / 2), m), cast);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
};

const withRepeat = (tex: THREE.Texture, tileMeters: number) => {
  tex.repeat.set(1 / tileMeters, 1 / tileMeters);
  return tex;
};

// ---------------------------------------------------------------------------
// Material library
// ---------------------------------------------------------------------------

export interface MaterialLibrary {
  exteriorWall: THREE.MeshStandardMaterial;
  interiorWall: THREE.MeshStandardMaterial;
  wallCap: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  frame: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  floor: THREE.MeshStandardMaterial;
  kitchenFloor: THREE.MeshStandardMaterial;
  counterTop: THREE.MeshStandardMaterial;
  deck: THREE.MeshStandardMaterial;
  plinth: THREE.MeshStandardMaterial;
  grass: THREE.MeshStandardMaterial;
  paving: THREE.MeshStandardMaterial;
  asphalt: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  brick: THREE.MeshStandardMaterial;
  water: THREE.MeshPhysicalMaterial;
  poolTile: THREE.MeshStandardMaterial;
  doorWood: THREE.MeshStandardMaterial;
  hedge: THREE.MeshStandardMaterial;
  glow: THREE.MeshStandardMaterial;
  highlight: THREE.MeshBasicMaterial;
  waterTexture: THREE.Texture;
  waterNormalTexture: THREE.Texture;
  setWallFinish: (id: WallFinishId) => void;
  setFloorFinish: (id: FloorFinishId) => void;
  setNight: (amount: number) => void;
  dispose: () => void;
}

export function createMaterialLibrary(): MaterialLibrary {
  const textures: THREE.Texture[] = [];
  const track = <X extends THREE.Texture>(t: X) => {
    textures.push(t);
    return t;
  };

  const wallTex: Record<WallFinishId, { map: THREE.Texture; bump?: THREE.Texture; bumpScale?: number; roughness: number }> = {
    white_modern: {
      map: track(withRepeat(T.paint('#eeebe5'), T.TEXTURE_TILE_METERS.paint)),
      bump: track(withRepeat(T.plasterBump(), T.TEXTURE_TILE_METERS.paint)),
      bumpScale: 0.008,
      roughness: 0.9,
    },
    exposed_brick: {
      map: track(withRepeat(T.brick(), T.TEXTURE_TILE_METERS.brick)),
      bump: track(withRepeat(T.brickBump(), T.TEXTURE_TILE_METERS.brick)),
      bumpScale: 0.045,
      roughness: 0.95,
    },
    cedar_slats: {
      map: track(withRepeat(T.cedar(), T.TEXTURE_TILE_METERS.cedar)),
      bump: track(withRepeat(T.woodPlanksBump(10), T.TEXTURE_TILE_METERS.cedar)),
      bumpScale: 0.035,
      roughness: 0.7,
    },
    concrete_loft: {
      map: track(withRepeat(T.concrete(), T.TEXTURE_TILE_METERS.concrete)),
      bump: track(withRepeat(T.concreteBump(), T.TEXTURE_TILE_METERS.concrete)),
      bumpScale: 0.025,
      roughness: 0.85,
    },
  };
  const floorTex: Record<FloorFinishId, { map: THREE.Texture; bump?: THREE.Texture; bumpScale?: number; roughness: number }> = {
    honey_parquet: {
      map: track(withRepeat(T.woodPlanks(32, 52, 50), T.TEXTURE_TILE_METERS.wood)),
      bump: track(withRepeat(T.woodPlanksBump(8), T.TEXTURE_TILE_METERS.wood)),
      bumpScale: 0.025,
      roughness: 0.45,
    },
    white_marble: {
      map: track(withRepeat(T.marble(), T.TEXTURE_TILE_METERS.marble)),
      roughness: 0.16,
    },
    charcoal_slate: {
      map: track(withRepeat(T.slate(), T.TEXTURE_TILE_METERS.slate)),
      bump: track(withRepeat(T.slateBump(), T.TEXTURE_TILE_METERS.slate)),
      bumpScale: 0.035,
      roughness: 0.55,
    },
    wool_carpet: {
      map: track(withRepeat(T.carpet(), T.TEXTURE_TILE_METERS.carpet)),
      roughness: 0.98,
    },
  };

  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  const waterTexture = track(withRepeat(T.water(), T.TEXTURE_TILE_METERS.water));
  const waterNormalTexture = track(withRepeat(T.waterNormal(), T.TEXTURE_TILE_METERS.water));

  const initialWall = wallTex.white_modern;
  const initialFloor = floorTex.honey_parquet;

  const lib: MaterialLibrary = {
    exteriorWall: std({
      map: track(withRepeat(T.paint('#f4f2ee'), 2)),
      bumpMap: track(withRepeat(T.plasterBump(), 2)),
      bumpScale: 0.008,
      roughness: 0.92,
    }),
    interiorWall: std({
      map: initialWall.map,
      bumpMap: initialWall.bump,
      bumpScale: initialWall.bumpScale ?? 0,
      roughness: initialWall.roughness,
    }),
    wallCap: std({ color: 0x3b3f45, roughness: 0.8 }),
    trim: std({ color: 0xf7f6f3, roughness: 0.6 }),
    frame: std({ color: 0x2a2d33, roughness: 0.45, metalness: 0.4 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xebf5fa,
      roughness: 0.04,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      reflectivity: 0.8,
      envMapIntensity: 1.5,
    }),
    floor: std({
      map: initialFloor.map,
      bumpMap: initialFloor.bump,
      bumpScale: initialFloor.bumpScale ?? 0,
      roughness: initialFloor.roughness,
    }),
    kitchenFloor: std({
      map: track(withRepeat(T.ceramicTile(), T.TEXTURE_TILE_METERS.tile)),
      bumpMap: track(withRepeat(T.slateBump(), T.TEXTURE_TILE_METERS.tile)),
      bumpScale: 0.02,
      roughness: 0.35,
    }),
    counterTop: std({ map: track(withRepeat(T.marble(), 1.2)), roughness: 0.18 }),
    deck: std({
      map: track(withRepeat(T.woodPlanks(28, 30, 42, 10, 0.55), T.TEXTURE_TILE_METERS.deck)),
      bumpMap: track(withRepeat(T.woodPlanksBump(10), T.TEXTURE_TILE_METERS.deck)),
      bumpScale: 0.035,
      roughness: 0.78,
    }),
    plinth: std({ color: 0x75777a, roughness: 0.9 }),
    grass: std({ map: track(withRepeat(T.grass(), T.TEXTURE_TILE_METERS.grass)), roughness: 1 }),
    paving: std({
      map: track(withRepeat(T.paving(), T.TEXTURE_TILE_METERS.paving)),
      bumpMap: track(withRepeat(T.pavingBump(), T.TEXTURE_TILE_METERS.paving)),
      bumpScale: 0.04,
      roughness: 0.85,
    }),
    asphalt: std({ map: track(withRepeat(T.asphalt(), T.TEXTURE_TILE_METERS.asphalt)), roughness: 0.95 }),
    roof: std({
      map: track(withRepeat(T.roofShingles(), T.TEXTURE_TILE_METERS.roof)),
      bumpMap: track(withRepeat(T.brickBump(), T.TEXTURE_TILE_METERS.roof)),
      bumpScale: 0.03,
      roughness: 0.85,
    }),
    brick: std({
      map: track(withRepeat(T.brick(), 1)),
      bumpMap: track(withRepeat(T.brickBump(), 1)),
      bumpScale: 0.045,
      roughness: 0.95,
    }),
    water: new THREE.MeshPhysicalMaterial({
      map: waterTexture,
      normalMap: waterNormalTexture,
      normalScale: new THREE.Vector2(0.35, 0.35),
      color: 0x38bdf8,
      roughness: 0.08,
      metalness: 0.05,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
      envMapIntensity: 1.2,
    }),
    poolTile: std({ color: 0x3fa7c9, roughness: 0.4 }),
    doorWood: std({ map: track(withRepeat(T.woodPlanks(25, 40, 30, 4, 0.1), 2)), roughness: 0.55 }),
    hedge: std({ color: 0x3d6634, roughness: 1 }),
    glow: std({ color: 0xfff3dc, emissive: 0xffd9a0, emissiveIntensity: 0.35, roughness: 0.6, side: THREE.DoubleSide }),
    highlight: new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0, depthWrite: false }),
    waterTexture,
    waterNormalTexture,
    setWallFinish: (id) => {
      const entry = wallTex[id];
      lib.interiorWall.map = entry.map;
      lib.interiorWall.bumpMap = entry.bump ?? null;
      lib.interiorWall.bumpScale = entry.bumpScale ?? 0;
      lib.interiorWall.roughness = entry.roughness;
      lib.interiorWall.needsUpdate = true;
    },
    setFloorFinish: (id) => {
      const entry = floorTex[id];
      lib.floor.map = entry.map;
      lib.floor.bumpMap = entry.bump ?? null;
      lib.floor.bumpScale = entry.bumpScale ?? 0;
      lib.floor.roughness = entry.roughness;
      lib.floor.needsUpdate = true;
    },
    setNight: (n) => {
      lib.glow.emissiveIntensity = 0.35 + n * 2.4;
      lib.glass.emissiveIntensity = n * 0.55;
      lib.glass.opacity = 0.35 + n * 0.25;
    },
    dispose: () => {
      textures.forEach((t) => t.dispose());
      Object.values(lib).forEach((v) => {
        if (v instanceof THREE.Material) v.dispose();
      });
    },
  };
  lib.glow.userData.shared = true;
  return lib;
}

// ---------------------------------------------------------------------------
// Walls with openings
// ---------------------------------------------------------------------------

type OpeningKind = 'window' | 'glassdoor' | 'door' | 'opening';

interface Opening {
  /** World coordinate along the wall axis (x for E-W walls, z for N-S walls). */
  at: number;
  width: number;
  bottom: number;
  top: number;
  kind: OpeningKind;
}

interface WallSpec {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  thickness: number;
  height: number;
  /** +1: local +Z face is exterior, -1: local -Z face is exterior, 0: interior wall */
  outside: 1 | -1 | 0;
  openings: Opening[];
  fixtures?: boolean;
}

function buildWall(lib: MaterialLibrary, spec: WallSpec): THREE.Group {
  const { x0, z0, x1, z1, thickness: t, height, outside } = spec;
  const dx = x1 - x0;
  const dz = z1 - z0;
  const L = Math.hypot(dx, dz);
  const alongX = Math.abs(dx) > Math.abs(dz);
  const g = new THREE.Group();
  g.position.set(x0, 0, z0);
  g.rotation.y = -Math.atan2(dz, dx);

  const ext = lib.exteriorWall;
  const int = lib.interiorWall;
  const pz = outside === 1 ? ext : int;
  const nz = outside === -1 ? ext : int;
  const ends = outside === 0 ? int : ext;
  const mats = (topIsCap: boolean) => [ends, ends, topIsCap ? lib.wallCap : lib.trim, int, pz, nz];

  const piece = (s: number, e: number, y0: number, y1: number, cap: boolean) => {
    if (e - s < 0.005 || y1 - y0 < 0.005) return;
    const w = e - s;
    const h = y1 - y0;
    const m = shadowed(new THREE.Mesh(worldBox(w, h, t, s, y0, -t / 2), mats(cap)));
    m.position.set(s + w / 2, y0 + h / 2, 0);
    g.add(m);
  };

  const local = spec.openings
    .map((o) => ({ ...o, at: (alongX ? o.at - x0 : o.at - z0) * (alongX ? Math.sign(dx) : Math.sign(dz)) }))
    .filter((o) => o.bottom < height)
    .sort((a, b) => a.at - b.at);

  let cursor = 0;
  for (const o of local) {
    const a = o.at - o.width / 2;
    const b = o.at + o.width / 2;
    const top = Math.min(o.top, height);
    piece(cursor, a, 0, height, true);
    if (o.bottom > 0) piece(a, b, 0, o.bottom, false);
    if (top < height) piece(a, b, top, height, true);
    if (spec.fixtures !== false) addFixture(lib, g, o.kind, a, b, o.bottom, top, t, outside);
    cursor = b;
  }
  piece(cursor, L, 0, height, true);
  return g;
}

function addFixture(
  lib: MaterialLibrary,
  g: THREE.Group,
  kind: OpeningKind,
  a: number,
  b: number,
  bottom: number,
  top: number,
  t: number,
  outside: 1 | -1 | 0,
) {
  const w = b - a;
  const h = top - bottom;
  const cx = (a + b) / 2;
  const cy = (bottom + top) / 2;
  const box = (bw: number, bh: number, bd: number, m: THREE.Material, x: number, y: number, z: number, cast = true) => {
    const mesh = shadowed(new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m), cast);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };

  if (kind === 'opening') {
    // Clean jamb liners for open passages
    box(0.03, h, t + 0.02, lib.trim, a + 0.015, cy, 0, false);
    box(0.03, h, t + 0.02, lib.trim, b - 0.015, cy, 0, false);
    box(w, 0.03, t + 0.02, lib.trim, cx, top - 0.015, 0, false);
    return;
  }

  const ft = 0.055;
  const fd = 0.09;
  const fz = outside * 0.03;
  box(w, ft, fd, lib.frame, cx, top - ft / 2, fz, false);
  box(w, ft, fd, lib.frame, cx, bottom + ft / 2, fz, false);
  box(ft, h, fd, lib.frame, a + ft / 2, cy, fz, false);
  box(ft, h, fd, lib.frame, b - ft / 2, cy, fz, false);

  if (kind === 'door') {
    const leaf = box(w - ft * 2, h - ft, 0.05, lib.doorWood, cx, bottom + (h - ft) / 2, fz, true);
    leaf.castShadow = true;
    box(0.02, 0.4, 0.04, lib.frame, b - ft - 0.12, bottom + 1.0, fz + outside * 0.04, false);
    box(0.02, 0.4, 0.04, lib.frame, b - ft - 0.12, bottom + 1.0, fz - outside * 0.04, false);
    box(0.12, h - 0.3, 0.012, lib.glass, a + ft + 0.14, cy, fz + outside * 0.03, false);
    return;
  }

  const panes = kind === 'glassdoor' ? 3 : w > 1.25 ? 2 : 1;
  for (let i = 1; i < panes; i++) box(ft * 0.8, h, fd * 0.9, lib.frame, a + (w * i) / panes, cy, fz, false);
  if (kind === 'window' && h > 1.1) box(w, ft * 0.7, fd * 0.9, lib.frame, cx, bottom + h * 0.68, fz, false);
  box(w - ft * 2, h - ft * 2, 0.012, lib.glass, cx, cy, fz, false);

  if (kind === 'window' && outside !== 0) {
    box(w + 0.12, 0.04, 0.16, lib.trim, cx, bottom - 0.02, outside * (t / 2 + 0.05), false);
    box(w + 0.04, 0.025, 0.08, lib.trim, cx, bottom - 0.01, -outside * (t / 2 + 0.02), false);
  }
}

// ---------------------------------------------------------------------------
// Exterior props
// ---------------------------------------------------------------------------

function tree(x: number, z: number, scale: number, blossom: boolean): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const bark = new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 1 });
  const trunk = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.2 * scale, 2.6 * scale, 10), bark));
  trunk.position.y = 1.3 * scale;
  g.add(trunk);
  for (const s of [-1, 1]) {
    const br = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.09 * scale, 1.2 * scale, 8), bark));
    br.position.set(s * 0.35 * scale, 2.6 * scale, 0);
    br.rotation.z = -s * 0.6;
    g.add(br);
  }
  const palette = blossom ? [0xf2b6c9, 0xeaa1b8, 0xf7cad6, 0xe48fab] : [0x3f6b34, 0x4d7d3e, 0x365c2d, 0x5b8a48];
  const count = 7;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const r = (0.9 + Math.random() * 0.5) * scale;
    const m = shadowed(
      new THREE.Mesh(foliageGeometry(r, 2, 0.16), new THREE.MeshStandardMaterial({ color: palette[i % palette.length], roughness: 0.9 })),
    );
    m.position.set(Math.cos(a) * 0.9 * scale, (3.2 + Math.random() * 0.9) * scale, Math.sin(a) * 0.9 * scale);
    g.add(m);
  }
  const crown = shadowed(
    new THREE.Mesh(foliageGeometry(1.2 * scale, 2, 0.16), new THREE.MeshStandardMaterial({ color: palette[0], roughness: 0.9 })),
  );
  crown.position.y = 4.1 * scale;
  g.add(crown);
  return g;
}

function cypress(x: number, z: number, h: number): THREE.Mesh {
  const m = shadowed(new THREE.Mesh(foliageGeometry(1, 2, 0.12), new THREE.MeshStandardMaterial({ color: 0x2f5530, roughness: 1 })));
  m.scale.set(0.55, h / 2, 0.55);
  m.position.set(x, h / 2, z);
  return m;
}

function shrub(x: number, z: number, r: number, color = 0x46703a): THREE.Mesh {
  const m = shadowed(new THREE.Mesh(foliageGeometry(r, 2, 0.2), new THREE.MeshStandardMaterial({ color, roughness: 1 })));
  m.position.set(x, r * 0.7, z);
  return m;
}

function car(): THREE.Group {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xf1f2f4, metalness: 0.5, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x14181e, roughness: 0.05, metalness: 0.6 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xbfc3c8, roughness: 0.25, metalness: 0.9 });
  const body = shadowed(new THREE.Mesh(new RoundedBoxGeometry(1.85, 0.62, 4.55, 4, 0.22), paint));
  body.position.y = 0.6;
  g.add(body);
  const cabin = shadowed(new THREE.Mesh(new RoundedBoxGeometry(1.62, 0.55, 2.35, 4, 0.2), glass));
  cabin.position.set(0, 1.08, -0.25);
  g.add(cabin);
  const roof = shadowed(new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.08, 1.9, 3, 0.03), paint));
  roof.position.set(0, 1.36, -0.3);
  g.add(roof);
  for (const sx of [-1, 1]) {
    for (const sz of [-1.45, 1.4]) {
      const tire = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 24), rubber));
      tire.rotation.z = Math.PI / 2;
      tire.position.set(sx * 0.86, 0.34, sz);
      g.add(tire);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.25, 18), rim);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(sx * 0.87, 0.34, sz);
      g.add(hub);
    }
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.08, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 0.6 }),
    );
    head.position.set(sx * 0.6, 0.72, 2.27);
    g.add(head);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.07, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x8a0f12, emissive: 0xc0141a, emissiveIntensity: 0.4 }),
    );
    tail.position.set(sx * 0.6, 0.76, -2.27);
    g.add(tail);
  }
  return g;
}

function glassRailing(lib: MaterialLibrary, parent: THREE.Object3D, x0: number, z0: number, x1: number, z1: number, y: number) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const g = new THREE.Group();
  g.position.set(x0, y, z0);
  g.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  const posts = Math.max(2, Math.round(len / 1.5) + 1);
  for (let i = 0; i < posts; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.05, 0.05), lib.frame);
    p.position.set((len * i) / (posts - 1), 0.525, 0);
    p.receiveShadow = true;
    g.add(p);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.07), lib.frame);
  rail.position.set(len / 2, 1.05, 0);
  rail.receiveShadow = true;
  g.add(rail);
  const pane = new THREE.Mesh(new THREE.BoxGeometry(len - 0.08, 0.9, 0.015), lib.glass);
  pane.position.set(len / 2, 0.52, 0);
  g.add(pane);
  parent.add(g);
}

// ---------------------------------------------------------------------------
// Whole house
// ---------------------------------------------------------------------------

export interface HouseBuild {
  root: THREE.Group;
  interior: THREE.Group;
  furnitureRoot: THREE.Group;
  roof: THREE.Group;
  frontWalls: THREE.Group;
  wallStubs: THREE.Group;
  villaGrounds: THREE.Group;
  pickers: Map<HomeRoomId, THREE.Mesh>;
  outlines: Map<HomeRoomId, THREE.Group>;
  roomLights: THREE.PointLight[];
  exteriorLights: THREE.PointLight[];
}

export const TIER_UNLOCKED_ROOMS: Record<HousingTier, HomeRoomId[]> = {
  dorm: ['study'],
  studio: ['study', 'living'],
  flat: ['study', 'living', 'bedroom', 'kitchen'],
  penthouse: ['study', 'living', 'bedroom', 'kitchen', 'balcony'],
};

/**
 * Builds an expansion plot marker with surveyor stakes, perimeter border,
 * translucent blueprint plane, and architectural signboard on the lawn for locked rooms.
 */
function buildUnbuiltPlot(
  lib: MaterialLibrary,
  r: RoomRect,
  roomId: HomeRoomId,
): THREE.Group {
  const g = new THREE.Group();
  g.userData.roomId = roomId;
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;

  // 4 wooden surveyor corner stakes (with bright accent caps)
  const stakeMat = lib.doorWood;
  const ribbonMat = lib.wallCap;
  const corners: [number, number][] = [
    [r.x0 + 0.15, r.z0 + 0.15],
    [r.x1 - 0.15, r.z0 + 0.15],
    [r.x1 - 0.15, r.z1 - 0.15],
    [r.x0 + 0.15, r.z1 - 0.15],
  ];
  for (const [sx, sz] of corners) {
    const stake = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), stakeMat), false);
    stake.position.set(sx, 0.22, sz);
    g.add(stake);

    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.09), ribbonMat);
    ribbon.position.set(sx, 0.4, sz);
    g.add(ribbon);
  }

  // Low perimeter boundary timber beams resting on the grass
  const beamY = 0.025;
  const beamT = 0.05;
  addBox(g, w - 0.3, beamT, beamT, stakeMat, cx, beamY, r.z0 + 0.15, false);
  addBox(g, w - 0.3, beamT, beamT, stakeMat, cx, beamY, r.z1 - 0.15, false);
  addBox(g, beamT, beamT, d - 0.3, stakeMat, r.x0 + 0.15, beamY, cz, false);
  addBox(g, beamT, beamT, d - 0.3, stakeMat, r.x1 - 0.15, beamY, cz, false);

  // Subtle translucent blueprint footprint on the lawn
  const blueprintMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.3, d - 0.3), blueprintMat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(cx, 0.015, cz);
  g.add(plane);

  // Center architectural expansion signboard
  const post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 8), lib.frame), false);
  post.position.set(cx, 0.42, cz);
  g.add(post);

  const signBoard = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.75, 0.04), stakeMat), false);
  signBoard.position.set(cx, 0.82, cz);
  signBoard.rotation.x = -0.15;
  g.add(signBoard);

  const faceMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.65), faceMat);
  face.position.set(cx, 0.82, cz + 0.025);
  face.rotation.x = -0.15;
  g.add(face);

  return g;
}

export function buildHouse(lib: MaterialLibrary, housingTier: HousingTier = 'dorm'): HouseBuild {
  const root = new THREE.Group();
  const H = WALL_HEIGHT;
  const FL = FLOOR_LEVEL;
  const isPenthouse = housingTier === 'penthouse';
  const unlocked = new Set<HomeRoomId>(TIER_UNLOCKED_ROOMS[housingTier] || ['study']);

  // ---------- Grounds ----------
  const pool = { x0: -7, x1: -1, z0: 13, z1: 17.5 };
  const lawnShape = new THREE.Shape();
  lawnShape.moveTo(-70, -70);
  lawnShape.lineTo(70, -70);
  lawnShape.lineTo(70, 70);
  lawnShape.lineTo(-70, 70);
  lawnShape.lineTo(-70, -70);

  if (isPenthouse) {
    const hole = new THREE.Path();
    hole.moveTo(pool.x0, -pool.z0);
    hole.lineTo(pool.x0, -pool.z1);
    hole.lineTo(pool.x1, -pool.z1);
    hole.lineTo(pool.x1, -pool.z0);
    hole.lineTo(pool.x0, -pool.z0);
    lawnShape.holes.push(hole);
  }

  const lawn = new THREE.Mesh(new THREE.ShapeGeometry(lawnShape), lib.grass);
  lawn.rotation.x = -Math.PI / 2;
  lawn.receiveShadow = true;
  root.add(lawn);

  // Street, sidewalk, lane markings
  root.add(worldPlane(140, 8, lib.asphalt, 0, 0.01, 30));
  addBox(root, 140, 0.12, 2.2, lib.paving, 0, 0.06, 24.9, false);
  const dash = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.8 });
  for (let x = -66; x <= 66; x += 6) addBox(root, 2.6, 0.012, 0.15, dash, x, 0.016, 30, false);

  // Driveway (always present on east side)
  addBox(root, 5.5, 0.05, 23.5, lib.paving, 12.75, 0.025, 12.05, false);

  // Pool & Pool Deck (only for penthouse villa)
  if (isPenthouse) {
    const deckEdge = { x0: -9.5, x1: 1.5, z0: 11, z1: 19.5 };
    const deckM = lib.paving;
    addBox(root, deckEdge.x1 - deckEdge.x0, 0.06, pool.z0 - deckEdge.z0, deckM, (deckEdge.x0 + deckEdge.x1) / 2, 0.03, (deckEdge.z0 + pool.z0) / 2, false);
    addBox(root, deckEdge.x1 - deckEdge.x0, 0.06, deckEdge.z1 - pool.z1, deckM, (deckEdge.x0 + deckEdge.x1) / 2, 0.03, (pool.z1 + deckEdge.z1) / 2, false);
    addBox(root, pool.x0 - deckEdge.x0, 0.06, pool.z1 - pool.z0, deckM, (deckEdge.x0 + pool.x0) / 2, 0.03, (pool.z0 + pool.z1) / 2, false);
    addBox(root, deckEdge.x1 - pool.x1, 0.06, pool.z1 - pool.z0, deckM, (pool.x1 + deckEdge.x1) / 2, 0.03, (pool.z0 + pool.z1) / 2, false);

    const pw = pool.x1 - pool.x0;
    const pd = pool.z1 - pool.z0;
    const pcx = (pool.x0 + pool.x1) / 2;
    const pcz = (pool.z0 + pool.z1) / 2;
    addBox(root, pw, 0.05, pd, lib.poolTile, pcx, -1.4, pcz, false);
    addBox(root, pw, 1.4, 0.05, lib.poolTile, pcx, -0.7, pool.z0, false);
    addBox(root, pw, 1.4, 0.05, lib.poolTile, pcx, -0.7, pool.z1, false);
    addBox(root, 0.05, 1.4, pd, lib.poolTile, pool.x0, -0.7, pcz, false);
    addBox(root, 0.05, 1.4, pd, lib.poolTile, pool.x1, -0.7, pcz, false);
    root.add(worldPlane(pw, pd, lib.water, pcx, -0.12, pcz));
  }

  // Entrance walkway tailored to the residence stage:
  if (housingTier === 'dorm') {
    // Front entrance to starter single room is at x: -4, z: 0
    addBox(root, 1.8, FL * 0.5, 0.9, lib.paving, -4.0, FL * 0.25, 0.45, false);
    for (let z = 1.6; z <= 24.0; z += 1.8) {
      addBox(root, 1.2, 0.04, 1.2, lib.paving, -4.0, 0.02, z, false);
    }
  } else if (housingTier === 'studio') {
    // Front entrance to living lounge is at x: -4, z: 7
    addBox(root, 1.8, FL * 0.5, 0.9, lib.paving, -4.0, FL * 0.25, 7.45, false);
    for (let z = 8.5; z <= 24.0; z += 1.8) {
      addBox(root, 1.2, 0.04, 1.2, lib.paving, -4.0, 0.02, z, false);
    }
  } else {
    // Main entrance for flat / penthouse is at x: 5.5, z: 7
    addBox(root, 1.8, FL * 0.5, 0.9, lib.paving, 5.5, FL * 0.25, 7.55);
    addBox(root, 1.3, 0.05, 16.4, lib.paving, 5.5, 0.025, 15.8, false);
  }

  // ---------- House Slab & Interior Group ----------
  const interior = new THREE.Group();
  interior.position.y = FL;
  root.add(interior);

  if (housingTier === 'dorm') {
    // Single room slab (only NW study: x: [-8, 0], z: [-7, 0])
    const slabW = 8 + EXT_T + 0.2;
    const slabD = 7 + EXT_T + 0.2;
    const slab = addBox(root, slabW, FL, slabD, lib.plinth, -4, FL / 2, -3.5);
    slab.castShadow = false;
  } else if (housingTier === 'studio') {
    // 2-room slab (study + living: x: [-8, 0], z: [-7, 7])
    const slabW = 8 + EXT_T + 0.2;
    const slabD = 14 + EXT_T + 0.2;
    const slab = addBox(root, slabW, FL, slabD, lib.plinth, -4, FL / 2, 0);
    slab.castShadow = false;
  } else {
    // Full 4-room slab (x: [-8, 8], z: [-7, 7])
    const slab = addBox(root, 16 + EXT_T + 0.2, FL, 14 + EXT_T + 0.2, lib.plinth, 0, FL / 2, 0);
    slab.castShadow = false;
  }

  // Floors (only for unlocked rooms)
  if (unlocked.has('study')) {
    const r = ROOM_LAYOUT.study;
    interior.add(worldPlane(r.x1 - r.x0, r.z1 - r.z0, lib.floor, (r.x0 + r.x1) / 2, 0.002, (r.z0 + r.z1) / 2));
  }
  if (unlocked.has('bedroom')) {
    const r = ROOM_LAYOUT.bedroom;
    interior.add(worldPlane(r.x1 - r.x0, r.z1 - r.z0, lib.floor, (r.x0 + r.x1) / 2, 0.002, (r.z0 + r.z1) / 2));
  }
  if (unlocked.has('living')) {
    const r = ROOM_LAYOUT.living;
    interior.add(worldPlane(r.x1 - r.x0, r.z1 - r.z0, lib.floor, (r.x0 + r.x1) / 2, 0.002, (r.z0 + r.z1) / 2));
  }
  if (unlocked.has('kitchen')) {
    const k = ROOM_LAYOUT.kitchen;
    interior.add(worldPlane(k.x1 - k.x0, k.z1 - k.z0, lib.kitchenFloor, (k.x0 + k.x1) / 2, 0.002, (k.z0 + k.z1) / 2));
  }
  if (unlocked.has('balcony')) {
    const b = ROOM_LAYOUT.balcony;
    addBox(root, b.x1 - b.x0, FL, b.z1 - b.z0, lib.deck, (b.x0 + b.x1) / 2, FL / 2, (b.z0 + b.z1) / 2);
    addBox(root, 1.6, FL / 2, 0.45, lib.deck, 0.1, FL / 4, b.z1 + 0.22);
    glassRailing(lib, root, b.x0 + 0.05, b.z1 - 0.05, -0.75, b.z1 - 0.05, FL);
    glassRailing(lib, root, b.x0 + 0.05, b.z0 + 0.2, b.x0 + 0.05, b.z1 - 0.05, FL);
    glassRailing(lib, root, b.x1 - 0.05, b.z0 + 0.2, b.x1 - 0.05, b.z1 - 0.9, FL);
  }

  // Unbuilt Expansion Plots for locked rooms
  const unbuiltPlots = new THREE.Group();
  (Object.keys(ROOM_LAYOUT) as HomeRoomId[]).forEach((id) => {
    if (!unlocked.has(id)) {
      unbuiltPlots.add(buildUnbuiltPlot(lib, ROOM_LAYOUT[id], id));
    }
  });
  root.add(unbuiltPlots);

  // ---------- Walls ----------
  const win = (at: number, width = 1.4, bottom = 0.9, top = 2.2): Opening => ({ at, width, bottom, top, kind: 'window' });
  const backWalls = new THREE.Group();
  const frontWalls = new THREE.Group();
  const wallStubs = new THREE.Group();

  if (housingTier === 'dorm') {
    // Level 1: Single Room Starter Dorm (study: x: [-8, 0], z: [-7, 0])
    const extNorth: WallSpec = {
      x0: -8 - EXT_T / 2, z0: -7, x1: 0 + EXT_T / 2, z1: -7, thickness: EXT_T, height: H, outside: -1,
      openings: [win(-4, 1.8)],
    };
    const extWest: WallSpec = {
      x0: -8, z0: -7 + EXT_T / 2, x1: -8, z1: 0 - EXT_T / 2, thickness: EXT_T, height: H, outside: 1,
      openings: [win(-3.5, 1.8)],
    };
    const extEast: WallSpec = {
      x0: 0, z0: -7 + EXT_T / 2, x1: 0, z1: 0 - EXT_T / 2, thickness: EXT_T, height: H, outside: -1,
      openings: [win(-3.5, 1.4)],
    };
    const extSouth: WallSpec = {
      x0: -8 - EXT_T / 2, z0: 0, x1: 0 + EXT_T / 2, z1: 0, thickness: EXT_T, height: H, outside: 1,
      openings: [
        { at: -4, width: 1.0, bottom: 0, top: 2.2, kind: 'door' },
        win(-1.8, 1.4),
      ],
    };

    backWalls.add(buildWall(lib, extNorth), buildWall(lib, extWest));
    frontWalls.add(buildWall(lib, extSouth), buildWall(lib, extEast));

    for (const spec of [extSouth, extEast]) {
      wallStubs.add(buildWall(lib, { ...spec, height: 0.32, fixtures: false }));
    }
  } else if (housingTier === 'studio') {
    // Level 2: 2 Rooms - West Wing (study + living: x: [-8, 0], z: [-7, 7])
    const extNorth: WallSpec = {
      x0: -8 - EXT_T / 2, z0: -7, x1: 0 + EXT_T / 2, z1: -7, thickness: EXT_T, height: H, outside: -1,
      openings: [win(-4, 1.8)],
    };
    const extWest: WallSpec = {
      x0: -8, z0: -7 + EXT_T / 2, x1: -8, z1: 7 - EXT_T / 2, thickness: EXT_T, height: H, outside: 1,
      openings: [win(-3.5, 1.8), win(3.5, 1.8)],
    };
    const extEast: WallSpec = {
      x0: 0, z0: -7 + EXT_T / 2, x1: 0, z1: 7 - EXT_T / 2, thickness: EXT_T, height: H, outside: -1,
      openings: [win(-3.5, 1.4), win(3.5, 1.4)],
    };
    const extSouth: WallSpec = {
      x0: -8 - EXT_T / 2, z0: 7, x1: 0 + EXT_T / 2, z1: 7, thickness: EXT_T, height: H, outside: 1,
      openings: [
        { at: -4, width: 2.8, bottom: 0, top: 2.35, kind: 'glassdoor' },
        win(-1.8, 1.2),
      ],
    };
    const intDivide: WallSpec = {
      x0: -8 + EXT_T / 2, z0: 0, x1: 0 - EXT_T / 2, z1: 0, thickness: INT_T, height: H, outside: 0,
      openings: [{ at: -4, width: 1.0, bottom: 0, top: 2.1, kind: 'opening' }],
    };

    backWalls.add(buildWall(lib, extNorth), buildWall(lib, extWest), buildWall(lib, intDivide));
    frontWalls.add(buildWall(lib, extSouth), buildWall(lib, extEast));

    for (const spec of [extSouth, extEast]) {
      wallStubs.add(buildWall(lib, { ...spec, height: 0.32, fixtures: false }));
    }
  } else {
    // Level 3 & 4: Full 4-Room Residence
    const extNorth: WallSpec = {
      x0: -8 - EXT_T / 2, z0: -7, x1: 8 + EXT_T / 2, z1: -7, thickness: EXT_T, height: H, outside: -1,
      openings: [win(-5.6), win(-2.4), win(2.5), win(5.6)],
    };
    const extSouth: WallSpec = {
      x0: -8 - EXT_T / 2, z0: 7, x1: 8 + EXT_T / 2, z1: 7, thickness: EXT_T, height: H, outside: 1,
      openings: [
        { at: -4, width: 3.0, bottom: 0, top: 2.35, kind: 'glassdoor' },
        win(2.5),
        { at: 5.5, width: 1.0, bottom: 0, top: 2.2, kind: 'door' },
      ],
    };
    const extWest: WallSpec = {
      x0: -8, z0: -7 + EXT_T / 2, x1: -8, z1: 7 - EXT_T / 2, thickness: EXT_T, height: H, outside: 1,
      openings: [win(-3.5, 1.8), win(1.6)],
    };
    const extEast: WallSpec = {
      x0: 8, z0: -7 + EXT_T / 2, x1: 8, z1: 7 - EXT_T / 2, thickness: EXT_T, height: H, outside: -1,
      openings: [win(-3.5), win(2.5, 1.4, 1.05, 2.2)],
    };

    backWalls.add(buildWall(lib, extNorth), buildWall(lib, extWest));
    backWalls.add(
      buildWall(lib, {
        x0: 0, z0: -7 + EXT_T / 2, x1: 0, z1: 7 - EXT_T / 2, thickness: INT_T, height: H, outside: 0,
        openings: [
          { at: -1.5, width: 0.9, bottom: 0, top: 2.1, kind: 'opening' },
          { at: 1.5, width: 2.4, bottom: 0, top: 2.35, kind: 'opening' },
        ],
      }),
      buildWall(lib, {
        x0: -8 + EXT_T / 2, z0: 0, x1: 8 - EXT_T / 2, z1: 0, thickness: INT_T, height: H, outside: 0,
        openings: [
          { at: -4, width: 0.9, bottom: 0, top: 2.1, kind: 'opening' },
          { at: 1.2, width: 0.9, bottom: 0, top: 2.1, kind: 'opening' },
        ],
      }),
    );

    frontWalls.add(buildWall(lib, extSouth), buildWall(lib, extEast));

    for (const spec of [extSouth, extEast]) {
      wallStubs.add(buildWall(lib, { ...spec, height: 0.32, fixtures: false }));
    }
  }

  interior.add(backWalls);
  interior.add(frontWalls);
  wallStubs.visible = false;
  interior.add(wallStubs);

  // ---------- Room pickers & selection outlines ----------
  const pickers = new Map<HomeRoomId, THREE.Mesh>();
  const outlines = new Map<HomeRoomId, THREE.Group>();
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  (Object.keys(ROOM_LAYOUT) as HomeRoomId[]).forEach((id) => {
    const r = ROOM_LAYOUT[id];
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    const cx = (r.x0 + r.x1) / 2;
    const cz = (r.z0 + r.z1) / 2;
    const isUnlocked = unlocked.has(id);

    const picker = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.2, d - 0.2), lib.highlight.clone());
    picker.rotation.x = -Math.PI / 2;
    picker.position.set(cx, isUnlocked ? 0.02 : 0.04, cz);
    picker.userData.roomId = id;
    picker.userData.isUnlocked = isUnlocked;
    picker.renderOrder = 2;
    if (isUnlocked) {
      interior.add(picker);
    } else {
      root.add(picker);
    }
    pickers.set(id, picker);

    const o = new THREE.Group();
    const inset = 0.16;
    const bar = 0.05;
    const add = (bw: number, bd: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.015, bd), outlineMat);
      m.position.set(x, isUnlocked ? 0.025 : 0.045, z);
      o.add(m);
    };
    add(w - inset * 2, bar, cx, r.z0 + inset);
    add(w - inset * 2, bar, cx, r.z1 - inset);
    add(bar, d - inset * 2, r.x0 + inset, cz);
    add(bar, d - inset * 2, r.x1 - inset, cz);
    o.visible = false;
    if (isUnlocked) {
      interior.add(o);
    } else {
      root.add(o);
    }
    outlines.set(id, o);
  });

  // ---------- Furniture container (populated separately) ----------
  const furnitureRoot = new THREE.Group();
  interior.add(furnitureRoot);

  // ---------- Interior lights & architectural ceiling downlights ----------
  const roomLights: THREE.PointLight[] = [];
  const ceilingFixtures = new THREE.Group();

  const addPotLight = (x: number, z: number) => {
    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16), lib.frame);
    bezel.position.set(x, H - 0.01, z);
    ceilingFixtures.add(bezel);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.022, 16), lib.glow);
    lens.position.set(x, H - 0.01, z);
    ceilingFixtures.add(lens);
  };

  const potLightConfigs: { room: HomeRoomId; x: number; z: number }[] = [
    { room: 'study', x: -5.2, z: -4.5 },
    { room: 'study', x: -2.8, z: -2.5 },
    { room: 'bedroom', x: 2.8, z: -4.5 },
    { room: 'bedroom', x: 5.2, z: -2.5 },
    { room: 'living', x: -5.5, z: 2.0 },
    { room: 'living', x: -2.5, z: 2.0 },
    { room: 'living', x: -5.5, z: 5.0 },
    { room: 'living', x: -2.5, z: 5.0 },
    { room: 'kitchen', x: 2.5, z: 2.2 },
    { room: 'kitchen', x: 5.5, z: 2.2 },
    { room: 'kitchen', x: 4.0, z: 5.2 },
    { room: 'balcony', x: -4.5, z: 8.5 },
    { room: 'balcony', x: -1.5, z: 8.5 },
  ];
  potLightConfigs.forEach((cfg) => {
    if (unlocked.has(cfg.room)) {
      addPotLight(cfg.x, cfg.z);
    }
  });
  interior.add(ceilingFixtures);

  const lightConfigs: { room: HomeRoomId; color: number; x: number; y: number; z: number; dist: number; decay: number }[] = [
    { room: 'study', color: 0xffdfaa, x: -4.0, y: 2.45, z: -3.5, dist: 10, decay: 2.0 },
    { room: 'bedroom', color: 0xffd1a4, x: 4.0, y: 2.4, z: -3.5, dist: 10, decay: 2.0 },
    { room: 'living', color: 0xffe4b5, x: -4.0, y: 2.45, z: 3.5, dist: 12, decay: 1.8 },
    { room: 'kitchen', color: 0xfff2dc, x: 4.0, y: 2.45, z: 3.5, dist: 11, decay: 2.0 },
    { room: 'balcony', color: 0xffbb77, x: -3.5, y: 2.2, z: 8.5, dist: 7, decay: 2.0 },
  ];
  lightConfigs.forEach((cfg) => {
    if (unlocked.has(cfg.room)) {
      const l = new THREE.PointLight(cfg.color, 0, cfg.dist, cfg.decay);
      l.position.set(cfg.x, cfg.y, cfg.z);
      l.userData.roomId = cfg.room;
      interior.add(l);
      roomLights.push(l);
    }
  });

  // ---------- Gable Roof ----------
  const roof = new THREE.Group();
  const wallTop = FL + H;

  if (housingTier === 'dorm') {
    // Single room roof (study: x: [-8, 0], z: [-7, 0])
    const rise = 1.6;
    const halfSpan = 3.5 + EXT_T / 2;
    const overhang = 0.45;
    const run = halfSpan + overhang;
    const angle = Math.atan(rise / halfSpan);
    const slopeLen = run / Math.cos(angle);
    const roofW = 8 + EXT_T + 0.8;
    const cx = -4;
    const cz = -3.5;

    for (const side of [1, -1]) {
      const plane = shadowed(new THREE.Mesh(worldBox(roofW, 0.16, slopeLen), lib.roof));
      plane.position.set(cx, wallTop + rise - (run / 2) * Math.tan(angle) + 0.08, cz + (side * run) / 2);
      plane.rotation.x = side * angle;
      roof.add(plane);

      const fascia = shadowed(new THREE.Mesh(new THREE.BoxGeometry(roofW, 0.18, 0.05), lib.trim));
      fascia.position.set(cx, wallTop + rise - run * Math.tan(angle) - 0.02, cz + side * (run + 0.02));
      roof.add(fascia);

      if (side === 1) {
        const sky = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 1.4), lib.glass);
        sky.position.set(0, 0.1, -0.4);
        plane.add(sky);
        const fr = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 1.5), lib.frame);
        fr.position.set(0, 0.07, -0.4);
        plane.add(fr);
      }
    }

    const ridge = shadowed(new THREE.Mesh(new THREE.BoxGeometry(roofW + 0.02, 0.12, 0.34), lib.wallCap));
    ridge.position.set(cx, wallTop + rise + 0.17, cz);
    roof.add(ridge);

    const gableShape = new THREE.Shape();
    gableShape.moveTo(-halfSpan, 0);
    gableShape.lineTo(halfSpan, 0);
    gableShape.lineTo(0, rise);
    gableShape.lineTo(-halfSpan, 0);
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: EXT_T, bevelEnabled: false });

    for (const gx of [-8 - EXT_T / 2, 0 - EXT_T / 2]) {
      const gable = shadowed(new THREE.Mesh(gableGeo, lib.exteriorWall));
      gable.rotation.y = Math.PI / 2;
      gable.position.set(gx, wallTop, cz);
      roof.add(gable);
    }

    const chimney = addBox(roof, 0.65, 1.7, 0.65, lib.brick, -6.0, wallTop + rise + 0.1, -5.2);
    chimney.castShadow = true;
    addBox(roof, 0.8, 0.08, 0.8, lib.wallCap, -6.0, wallTop + rise + 0.98, -5.2);
  } else if (housingTier === 'studio') {
    // 2-room roof (study + living: x: [-8, 0], z: [-7, 7])
    const rise = 1.7;
    const halfSpan = 4 + EXT_T / 2;
    const overhang = 0.45;
    const run = halfSpan + overhang;
    const angle = Math.atan(rise / halfSpan);
    const slopeLen = run / Math.cos(angle);
    const roofLen = 14 + EXT_T + 0.8;
    const cx = -4;
    const cz = 0;

    for (const side of [1, -1]) {
      const plane = shadowed(new THREE.Mesh(worldBox(slopeLen, 0.16, roofLen), lib.roof));
      plane.position.set(cx + (side * run) / 2, wallTop + rise - (run / 2) * Math.tan(angle) + 0.08, cz);
      plane.rotation.z = -side * angle;
      roof.add(plane);

      const fascia = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, roofLen), lib.trim));
      fascia.position.set(cx + side * (run + 0.02), wallTop + rise - run * Math.tan(angle) - 0.02, cz);
      roof.add(fascia);
    }

    const ridge = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, roofLen + 0.02), lib.wallCap));
    ridge.position.set(cx, wallTop + rise + 0.17, cz);
    roof.add(ridge);

    const gableShape = new THREE.Shape();
    gableShape.moveTo(-halfSpan, 0);
    gableShape.lineTo(halfSpan, 0);
    gableShape.lineTo(0, rise);
    gableShape.lineTo(-halfSpan, 0);
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: EXT_T, bevelEnabled: false });

    for (const gz of [-7 - EXT_T / 2, 7 - EXT_T / 2]) {
      const gable = shadowed(new THREE.Mesh(gableGeo, lib.exteriorWall));
      gable.position.set(cx, wallTop, gz);
      roof.add(gable);
    }

    const chimney = addBox(roof, 0.65, 1.8, 0.65, lib.brick, -6.0, wallTop + rise + 0.1, -4.5);
    chimney.castShadow = true;
    addBox(roof, 0.8, 0.08, 0.8, lib.wallCap, -6.0, wallTop + rise + 1.05, -4.5);
  } else {
    // Full House Gable Roof (flat & penthouse)
    const rise = 2.3;
    const halfSpan = 7 + EXT_T / 2;
    const overhang = 0.55;
    const run = halfSpan + overhang;
    const angle = Math.atan(rise / halfSpan);
    const slopeLen = run / Math.cos(angle);
    const roofW = 16 + EXT_T + 0.8;
    for (const side of [1, -1]) {
      const plane = shadowed(new THREE.Mesh(worldBox(roofW, 0.16, slopeLen), lib.roof));
      plane.position.set(0, wallTop + rise - (run / 2) * Math.tan(angle) + 0.08, (side * run) / 2);
      plane.rotation.x = side * angle;
      roof.add(plane);

      const fascia = shadowed(new THREE.Mesh(new THREE.BoxGeometry(roofW, 0.2, 0.05), lib.trim));
      fascia.position.set(0, wallTop + rise - run * Math.tan(angle) - 0.02, side * (run + 0.02));
      roof.add(fascia);

      if (side === 1) {
        for (const sx of [-4, 3.5]) {
          const sky = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 1.4), lib.glass);
          sky.position.set(sx, 0.1, -0.6);
          plane.add(sky);
          const fr = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 1.5), lib.frame);
          fr.position.set(sx, 0.07, -0.6);
          plane.add(fr);
        }
      }
    }
    const ridge = shadowed(new THREE.Mesh(new THREE.BoxGeometry(roofW + 0.02, 0.12, 0.34), lib.wallCap));
    ridge.position.set(0, wallTop + rise + 0.17, 0);
    roof.add(ridge);
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-halfSpan, 0);
    gableShape.lineTo(halfSpan, 0);
    gableShape.lineTo(0, rise);
    gableShape.lineTo(-halfSpan, 0);
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: EXT_T, bevelEnabled: false });
    for (const gx of [-8 - EXT_T / 2, 8 - EXT_T / 2]) {
      const gable = shadowed(new THREE.Mesh(gableGeo, lib.exteriorWall));
      gable.rotation.y = Math.PI / 2;
      gable.position.set(gx, wallTop, 0);
      roof.add(gable);
    }
    const chimney = addBox(roof, 0.75, 1.9, 0.75, lib.brick, -4.6, wallTop + rise + 0.2, -2.2);
    chimney.castShadow = true;
    addBox(roof, 0.9, 0.08, 0.9, lib.wallCap, -4.6, wallTop + rise + 1.18, -2.2);
  }
  root.add(roof);

  // ---------- Luxury Villa Grounds (Carport, Sports Car, Pool Deck Furniture) ----------
  const villaGrounds = new THREE.Group();
  root.add(villaGrounds);

  if (isPenthouse) {
    // Carport pergola over driveway
    const post = lib.frame;
    for (const px of [10.4, 15.1]) for (const pz of [0.2, 6.6]) addBox(villaGrounds, 0.14, 2.6, 0.14, post, px, 1.3, pz);
    addBox(villaGrounds, 5.0, 0.18, 0.18, post, 12.75, 2.6, 0.2);
    addBox(villaGrounds, 5.0, 0.18, 0.18, post, 12.75, 2.6, 6.6);
    for (let i = 0; i < 13; i++) addBox(villaGrounds, 5.2, 0.08, 0.12, lib.doorWood, 12.75, 2.74, 0.2 + i * 0.533);
    const c = car();
    c.position.set(12.75, 0.05, 3.4);
    villaGrounds.add(c);

    // Pool loungers / umbrella
    const umbrellaPole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 8), lib.frame));
    umbrellaPole.position.set(0.4, 1.2, 15.2);
    villaGrounds.add(umbrellaPole);
    const canopy = shadowed(
      new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.45, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.9, side: THREE.DoubleSide })),
    );
    canopy.position.set(0.4, 2.45, 15.2);
    villaGrounds.add(canopy);
  }
  villaGrounds.visible = isPenthouse;

  // ---------- Landscaping ----------
  root.add(tree(-14, -12, 1.25, false), tree(13.5, -12.5, 1.1, false), tree(-15.5, 5, 1.0, true), tree(8.5, 18.5, 0.95, true), tree(-14, 20.5, 1.05, false), tree(20, 12, 1.15, false));
  for (let x = 19; x <= 21; x += 2) for (let z = -6; z <= 4; z += 2.5) root.add(cypress(x, z, 4.2 + Math.random()));
  // Perimeter hedges (north/west/east)
  const hedge = (w: number, d: number, x: number, z: number) => {
    const m = shadowed(new THREE.Mesh(new RoundedBoxGeometry(w, 1.2, d, 3, 0.3), lib.hedge));
    m.position.set(x, 0.6, z);
    root.add(m);
  };
  hedge(44, 0.9, 0, -18);
  hedge(0.9, 41, -22, 2.5);
  hedge(0.9, 22, 22, -7);

  // Foundation shrubs
  if (housingTier === 'dorm') {
    for (const x of [-6.5, -3.5, -1.0]) root.add(shrub(x, -7.9, 0.5, 0x3f6a36));
    root.add(shrub(-8.9, -3.5, 0.45, 0x527d41));
    root.add(shrub(0.9, -3.5, 0.45, 0x527d41));
  } else if (housingTier === 'studio') {
    for (const x of [-6.5, -3.5, -1.0]) root.add(shrub(x, -7.9, 0.5, 0x3f6a36));
    for (const z of [-5, 0, 4]) root.add(shrub(-8.9, z, 0.45, 0x527d41));
    for (const z of [-5, 0, 4]) root.add(shrub(0.9, z, 0.45, 0x527d41));
  } else {
    for (const x of [1.6, 3.4, 7.2]) root.add(shrub(x, 7.9, 0.45));
    for (const x of [-6.5, -3.5, 0, 3.5, 6.5]) root.add(shrub(x, -7.9, 0.5, 0x3f6a36));
    for (const z of [-5, 0, 4]) root.add(shrub(-8.9, z, 0.45, 0x527d41));
  }

  // Street lamp + mailbox
  const exteriorLights: THREE.PointLight[] = [];
  const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 10), lib.frame));
  pole.position.set(-2, 2.1, 25.6);
  root.add(pole);
  const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), lib.glow);
  lampHead.position.set(-2, 4.2, 25.6);
  root.add(lampHead);
  const streetLight = new THREE.PointLight(0xffd59a, 0, 14, 1.5);
  streetLight.position.set(-2, 4.0, 25.6);
  root.add(streetLight);
  exteriorLights.push(streetLight);

  const porchLightZ = housingTier === 'dorm' ? 0.6 : 7.6;
  const porchLightX = housingTier === 'dorm' ? -4.0 : (housingTier === 'studio' ? -4.0 : 5.5);
  const porch = new THREE.PointLight(0xffd59a, 0, 6, 1.5);
  porch.position.set(porchLightX, FL + 2.5, porchLightZ);
  root.add(porch);
  exteriorLights.push(porch);

  addBox(root, 0.08, 1.1, 0.08, lib.frame, 6.6, 0.55, 23.6);
  addBox(root, 0.3, 0.25, 0.45, lib.frame, 6.6, 1.2, 23.6);

  return { root, interior, furnitureRoot, roof, frontWalls, wallStubs, villaGrounds, pickers, outlines, roomLights, exteriorLights };
}

/** Recursively frees GPU resources, skipping materials flagged as shared. */
export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const m = child as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
    mats.forEach((mt) => {
      if (mt.userData?.shared) return;
      const map = (mt as THREE.MeshStandardMaterial).map;
      if (map && !map.userData?.shared) map.dispose();
      mt.dispose();
    });
  });
}
