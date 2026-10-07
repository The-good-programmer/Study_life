import * as THREE from 'three';
import type { Eyewear, FacialHair, HairStyle, Headwear } from '../../../../types/character';
import { type Sdf, v3, ellipsoid, roundBox, sphere, smin, smax } from '../sdf/sdf';
import type { AvatarDims } from './anatomy';
import { headBaseSdf, headLayout } from './head';
import { hairVolume } from './hatShape';
import { taperedTube } from './face';
import type { AvatarMaterials } from './materials';
import type { MeshSpec } from './meshSpec';

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// Shared accessory materials that don't vary per avatar.
const cushionMat = new THREE.MeshStandardMaterial({ color: 0x1f2430, roughness: 0.8 });
const gemMats = [0xe11d48, 0x2563eb, 0x10b981].map(
  (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.05, clearcoat: 1, metalness: 0.1 })
);

// ─── Eyewear ─────────────────────────────────────────────────────────────────

function outline(kind: Eyewear, R: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  if (kind === 'round') {
    const r = R * 1.34;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    return pts;
  }
  const w = kind === 'sunglasses' ? R * 1.55 : kind === 'thick-frame' ? R * 1.45 : R * 1.38;
  const h = kind === 'sunglasses' ? R * 1.18 : R * 1.05;
  const n = kind === 'thick-frame' ? 5 : 3.2; // superellipse exponent: higher = squarer
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    let x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * w;
    let y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * h;
    if (kind === 'sunglasses' && y < 0) {
      y *= 1.1; // aviator-like teardrop toward the outer bottom
      x *= 1 - 0.06 * Math.abs(s);
    }
    pts.push(new THREE.Vector2(x, y));
  }
  return pts;
}

export function buildEyewear(
  kind: Eyewear,
  d: AvatarDims,
  eyes: [number, number, number][],
  mats: AvatarMaterials
): THREE.Object3D | null {
  if (kind === 'none') return null;
  const group = new THREE.Group();
  group.name = `Eyewear_${kind}`;
  const R = d.eyeRadius;
  const frameR = kind === 'thick-frame' ? 0.0034 : kind === 'sunglasses' ? 0.0026 : 0.0012;
  const lensZ = Math.max(...eyes.map((e) => e[2])) + R + 0.013;
  const shape2d = outline(kind, R);

  const innerEdges: THREE.Vector3[] = [];
  eyes.forEach(([ex, ey], i) => {
    const side = i === 0 ? 1 : -1;
    const lens = new THREE.Group();
    lens.position.set(ex, ey + 0.002, lensZ);
    lens.rotation.y = side * 0.07;
    group.add(lens);

    const ring = shape2d.map((p) => new THREE.Vector3(p.x, p.y, 0));
    ring.push(ring[0].clone());
    const frameGeo = taperedTube(ring, () => frameR, 96, kind === 'thick-frame' ? 8 : 6);
    const frame = new THREE.Mesh(frameGeo, mats.glasses);
    frame.castShadow = true;
    if (kind === 'thick-frame') frame.scale.set(1, 1, 1.6);
    lens.add(frame);

    const glass = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(shape2d), 1), mats.lens);
    glass.renderOrder = 3;
    lens.add(glass);

    // Points on this lens for the bridge and temple, in head space.
    lens.updateMatrix();
    const innerX = side > 0 ? Math.min(...shape2d.map((p) => p.x)) : Math.max(...shape2d.map((p) => p.x));
    innerEdges.push(new THREE.Vector3(innerX, R * 0.25, 0).applyMatrix4(lens.matrix));
    const outerX = side > 0 ? Math.max(...shape2d.map((p) => p.x)) : Math.min(...shape2d.map((p) => p.x));
    const hinge = new THREE.Vector3(outerX, R * 0.45, 0).applyMatrix4(lens.matrix);
    const templePts = [
      hinge,
      new THREE.Vector3(side * (d.headWidth + 0.011), 0.142, 0.035),
      new THREE.Vector3(side * (d.headWidth + 0.015), 0.151, -0.012),
      new THREE.Vector3(side * (d.headWidth + 0.008), 0.128, -0.042),
    ];
    const templeGeo = taperedTube(templePts, (t) => Math.max(frameR, 0.0016) * (1 - 0.25 * t), 24, 6);
    group.add(new THREE.Mesh(templeGeo, mats.glasses));
  });

  // Bridge resting on the nose.
  const [a, b] = innerEdges;
  const mid = a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.006, -0.002));
  const bridgeGeo = taperedTube([a, mid, b], () => Math.max(frameR, 0.0015), 16, 6);
  group.add(new THREE.Mesh(bridgeGeo, mats.glasses));
  return group;
}

// ─── Headwear ────────────────────────────────────────────────────────────────

/** Sculpted (meshed) pieces of a hat. Halo and crown are built from primitives. */
export type HeadwearPart = 'main' | 'pompom';

export function headwearParts(kind: Headwear): HeadwearPart[] {
  if (kind === 'beanie') return ['main', 'pompom'];
  if (kind === 'cap' || kind === 'mortarboard' || kind === 'headphones') return ['main'];
  return [];
}

/** What to mesh for one sculpted piece of a hat (head-bone space). */
export function headwearMeshSpec(kind: Headwear, part: HeadwearPart, hair: HairStyle, d: AvatarDims): MeshSpec {
  const L = headLayout(d);
  const { lift, grow } = hairVolume(hair);
  const W = d.headWidth;
  const crownTop = L.crownY + lift;
  const ao = { distance: 0.02 };

  if (part === 'pompom') {
    const field: Sdf = (x, y, z) =>
      Math.sqrt(x * x + y * y + z * z) - 0.03 + 0.003 * Math.sin(x * 160) * Math.sin(y * 170) * Math.sin(z * 150);
    return { sdf: field, min: [-0.04, -0.04, -0.04], max: [0.04, 0.04, 0.04], cellSize: 0.0025, ao };
  }

  switch (kind) {
    case 'cap': {
      const dome = ellipsoid(v3(0, 0.148 + lift * 0.5, -0.012), W + grow + 0.015, 0.126 + lift + 0.008, 0.122 + grow + 0.011);
      const brim = ellipsoid(v3(0, 0.188 + lift * 0.4, 0.15 + grow * 0.5), 0.086, 0.006, 0.07);
      const button = sphere(v3(0, crownTop + 0.012, -0.01), 0.009);
      const field: Sdf = (x, y, z) => {
        const panel = 0.0009 * Math.abs(Math.sin(Math.atan2(x, z) * 3)); // panel seams
        let c = smax(dome(x, y, z) + panel, 0.168 + lift * 0.4 + 0.22 * z - y, 0.004);
        const b = smax(brim(x, y, z), 0.085 - z, 0.004);
        c = smin(c, b, 0.006);
        return smin(c, button(x, y, z), 0.004);
      };
      return { sdf: field, min: [-0.2, 0.08, -0.2], max: [0.2, 0.34, 0.26], cellSize: 0.0032, ao };
    }
    case 'beanie': {
      const dome = ellipsoid(v3(0, 0.16 + lift * 0.5, -0.014), W + grow + 0.018, 0.134 + lift, 0.124 + grow + 0.014);
      const edge = (y: number, z: number) => 0.155 + lift * 0.3 + 0.2 * z - y;
      const field: Sdf = (x, y, z) => {
        const rib = 0.0011 * Math.sin(Math.atan2(x, z) * 52);
        const e = edge(y, z);
        // Folded cuff: thicker band just above the edge.
        const cuff = 0.006 * smoothstep(-0.035, -0.022, e) * (1 - smoothstep(-0.006, 0, e));
        return smax(dome(x, y, z) + rib - cuff, e, 0.004);
      };
      return { sdf: field, min: [-0.2, 0.06, -0.2], max: [0.2, 0.34, 0.2], cellSize: 0.0032, ao };
    }
    case 'mortarboard': {
      const capDome = ellipsoid(v3(0, 0.155 + lift * 0.5, -0.012), W + grow + 0.014, 0.124 + lift, 0.122 + grow + 0.01);
      const board = roundBox(v3(0, crownTop + 0.016, -0.015), 0.13, 0.0055, 0.13, 0.002);
      const button = sphere(v3(0, crownTop + 0.024, -0.015), 0.008);
      const field: Sdf = (x, y, z) => {
        const capPart = smax(capDome(x, y, z), 0.17 + lift * 0.3 + 0.18 * z - y, 0.004);
        return Math.min(smin(capPart, board(x, y, z), 0.006), button(x, y, z));
      };
      return { sdf: field, min: [-0.2, 0.08, -0.2], max: [0.2, 0.36, 0.2], cellSize: 0.003, ao };
    }
    case 'headphones':
    default: {
      const bandR = W + grow + 0.022;
      const centre = v3(0, 0.122, -0.006);
      const band: Sdf = (x, y, z) => {
        const q = Math.sqrt((x - centre.x) ** 2 + ((y - centre.y) * 0.92) ** 2) - bandR;
        const ring = Math.max(Math.abs(q) - 0.007, Math.abs(z - centre.z) - 0.014);
        return smax(ring, centre.y + 0.02 - y, 0.004);
      };
      const cups: Sdf[] = [1, -1].map((s) => roundBox(v3(s * (W + 0.03), 0.118, -0.006), 0.016, 0.038, 0.03, 0.014));
      const field: Sdf = (x, y, z) => smin(band(x, y, z), Math.min(cups[0](x, y, z), cups[1](x, y, z)), 0.012);
      return { sdf: field, min: [-0.2, 0.05, -0.08], max: [0.2, 0.34, 0.07], cellSize: 0.003, ao };
    }
  }
}

/** Assembles a hat (child of the head) from its meshed pieces plus primitives. */
export function assembleHeadwear(
  kind: Headwear,
  hair: HairStyle,
  d: AvatarDims,
  mats: AvatarMaterials,
  geos: Partial<Record<HeadwearPart, THREE.BufferGeometry>>
): THREE.Object3D | null {
  if (kind === 'none') return null;
  const L = headLayout(d);
  const { lift, grow } = hairVolume(hair);
  const group = new THREE.Group();
  group.name = `Headwear_${kind}`;
  const W = d.headWidth;
  const crownTop = L.crownY + lift;
  if (geos.main) group.add(new THREE.Mesh(geos.main, mats.headwear));

  switch (kind) {
    case 'beanie': {
      if (geos.pompom) {
        const pom = new THREE.Mesh(geos.pompom, mats.topSecondary);
        pom.position.set(0, crownTop + 0.04, -0.02);
        group.add(pom);
      }
      break;
    }
    case 'mortarboard': {
      // Tassel cord and tassel in gold.
      const cord = taperedTube([
        new THREE.Vector3(0, crownTop + 0.03, -0.015),
        new THREE.Vector3(0.07, crownTop + 0.026, 0.03),
        new THREE.Vector3(0.118, crownTop + 0.02, 0.07),
        new THREE.Vector3(0.122, crownTop - 0.03, 0.075),
      ], () => 0.0018, 24, 6);
      group.add(new THREE.Mesh(cord, mats.gold));
      const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.009, 0.045, 12), mats.gold);
      tassel.position.set(0.122, crownTop - 0.052, 0.075);
      group.add(tassel);
      break;
    }
    case 'headphones': {
      for (const s of [1, -1]) {
        const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.012, 32), cushionMat);
        cushion.rotation.z = Math.PI / 2;
        cushion.scale.set(1, 1, 0.82);
        cushion.position.set(s * (W + 0.012), 0.118, -0.006);
        group.add(cushion);
      }
      break;
    }
    case 'halo': {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.0075, 16, 72), mats.halo);
      halo.rotation.x = Math.PI / 2 - 0.12;
      halo.position.set(0, crownTop + 0.075, -0.01);
      group.add(halo);
      break;
    }
    case 'crown': {
      const y0 = crownTop - 0.03;
      const r = W * 0.72 + grow * 0.6;
      const bandMat = mats.gold.clone();
      bandMat.side = THREE.DoubleSide;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.96, 0.03, 48, 1, true), bandMat);
      band.userData.ownsMaterial = true;
      band.position.set(0, y0, -0.01);
      group.add(band);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.04, 12), mats.gold);
        spike.position.set(Math.sin(a) * r, y0 + 0.034, Math.cos(a) * r - 0.01);
        group.add(spike);
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 12, 10), mats.gold);
        ball.position.set(Math.sin(a) * r, y0 + 0.056, Math.cos(a) * r - 0.01);
        group.add(ball);
        const gem = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 16, 12), gemMats[i % gemMats.length]);
        gem.position.set(Math.sin(a) * (r + 0.003), y0, Math.cos(a) * (r + 0.003) - 0.01);
        gem.scale.set(1, 1.2, 0.6);
        gem.lookAt(gem.position.clone().multiplyScalar(2));
        group.add(gem);
      }
      group.rotation.z = 0.08;
      break;
    }
  }
  group.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).castShadow = true) : null));
  return group;
}

// ─── Facial hair ─────────────────────────────────────────────────────────────

/** What to mesh for a facial-hair style (head-bone space), or null for none. */
export function facialHairMeshSpec(style: FacialHair, d: AvatarDims): MeshSpec | null {
  if (style === 'none') return null;
  const L = headLayout(d);
  const head = headBaseSdf(d);
  const mouth = ellipsoid(v3(0, L.mouthY - 0.002, 0.11), 0.023, 0.0085, 0.04);
  const nose = ellipsoid(v3(0, 0.1, 0.125), 0.024, 0.024, 0.032);
  const mustache = ellipsoid(v3(0, L.mouthY + 0.016, 0.104), 0.03, 0.0085, 0.022);

  let field: Sdf;
  if (style === 'goatee') {
    const thickness = 0.0042;
    const chin = ellipsoid(v3(0, 0.038, 0.078), 0.022, 0.026, 0.04);
    field = (x, y, z) => {
      const shellD = head(x, y, z) - thickness;
      const patch = smax(shellD, chin(x, y, z), 0.006);
      const tache = smax(shellD, mustache(x, y, z), 0.004);
      return smax(Math.min(patch, tache), -mouth(x, y, z), 0.003);
    };
  } else {
    const thickness = style === 'beard' ? 0.011 : 0.0016;
    field = (x, y, z) => {
      // Jaw, chin and cheeks below the cheekbones, with sideburns at the sides.
      const side = smoothstep(0.06, 0.1, Math.abs(x));
      const allow = Math.min(0.094 + 0.04 * side - y, z + 0.03, y + 0.012);
      let s = smax(head(x, y, z) - thickness, -allow, 0.006);
      s = smax(s, -mouth(x, y, z), 0.003);
      s = smax(s, -nose(x, y, z), 0.004);
      if (style === 'beard') s = smin(s, smax(head(x, y, z) - 0.008, mustache(x, y, z), 0.004), 0.004);
      return s;
    };
  }
  return { sdf: field, min: [-0.14, -0.03, -0.08], max: [0.14, 0.17, 0.16], cellSize: 0.0032, ao: { distance: 0.012 } };
}

export function assembleFacialHair(style: FacialHair, geo: THREE.BufferGeometry, material: THREE.Material): THREE.Object3D {
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = `FacialHair_${style}`;
  mesh.castShadow = style !== 'stubble';
  if (style === 'stubble') {
    // Stubble is a translucent shadow of hair rather than a solid layer.
    const stubble = (material as THREE.MeshPhysicalMaterial).clone();
    stubble.transparent = true;
    stubble.opacity = 0.2;
    stubble.depthWrite = false;
    mesh.material = stubble;
    mesh.userData.ownsMaterial = true;
  }
  return mesh;
}
