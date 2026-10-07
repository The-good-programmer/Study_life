import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CharacterCustomization, CharacterPose } from '../../../types/character';
import { meshSdf } from './sdf/surfaceNets';
import { getAvatarDims, EYE_DEPTH, type AvatarDims } from './avatar/anatomy';
import { buildRig, type AvatarRig, type BoneName } from './avatar/rig';
import { buildBodyParts, composeBody, computeSkinWeights, type BodyPart } from './avatar/body';
import { handSdf, handBounds } from './avatar/hands';
import { headBaseSdf, headSdf, headBounds, headLayout, traceFront } from './avatar/head';
import { buildFace, getEyeTexture, type FaceRig } from './avatar/face';
import { buildTopSpec, buildBottomSpec, shoeSpec, type GarmentSpec } from './avatar/clothing';
import { buildHair } from './avatar/hair';
import { buildEyewear, buildHeadwear, buildFacialHair } from './avatar/accessories';
import { toGeometry, filterTriangles, GeometryCache } from './avatar/geometry';
import { AvatarAnimator } from './avatar/animator';
import { createAvatarMaterials, type AvatarMaterials, lipColorFor } from './avatar/materials';

export interface CharacterModelInstance {
  root: THREE.Group;
  update: (deltaSeconds: number, poseOverride?: CharacterPose) => void;
  updateCustomization: (custom: CharacterCustomization) => void;
  setLookTarget: (targetPos: THREE.Vector3) => void;
  dispose: () => void;
}

/** Disposes every geometry and material under obj. */
export function disposeHierarchy(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const m = mesh.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else m?.dispose();
  });
}

// Shared across avatars: identical bodies, garments and hair reuse geometry.
const cache = new GeometryCache<THREE.BufferGeometry>(48);

// Mesh resolutions (metres per cell), tuned for a ~70k-triangle avatar.
const BODY_CELL = 0.011;
const HEAD_CELL = 0.0048;
const HAND_CELL = 0.003;
const GARMENT_CELL = 0.0098;
const SHOE_CELL = 0.0045;

const shapeKey = (d: AvatarDims) => `${d.gender}|${d.bodyType}`;

/** Eyeball centres on the face surface, slightly sunk into their sockets. */
function eyeCentres(d: AvatarDims): [number, number, number][] {
  const L = headLayout(d);
  const base = headBaseSdf(d);
  return [1, -1].map((side) => {
    const x = side * L.eyeX;
    const z = traceFront(base, x, L.eyeY) ?? L.eyeZ + L.eyeR;
    // Eyes are flattened to EYE_DEPTH; sink them so ~40% of that depth shows.
    return [x, L.eyeY, z - L.eyeR * EYE_DEPTH * 0.6] as [number, number, number];
  });
}

let blobShadowTexture: THREE.CanvasTexture | null = null;
function getBlobShadowTexture(): THREE.CanvasTexture {
  if (!blobShadowTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
    grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.2)');
    grad.addColorStop(0.8, 'rgba(0, 0, 0, 0.05)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    blobShadowTexture = new THREE.CanvasTexture(canvas);
  }
  return blobShadowTexture;
}

/**
 * Builds the stylized, fully skinned 3D student avatar. The body, head,
 * hands, clothing and hair are sculpted as signed distance fields and meshed
 * on the fly; the body and clothes share one skeleton so everything bends
 * together. ~1.55 m tall, feet on y = 0, facing +Z.
 */
export function buildCharacter3D(
  custom: CharacterCustomization,
  options: { showPedestal?: boolean; showShadow?: boolean } = {}
): CharacterModelInstance {
  const root = new THREE.Group();
  root.name = 'Character3D_Root';

  let current: CharacterCustomization = { ...custom };
  const mats: AvatarMaterials = createAvatarMaterials(current);

  if (options.showShadow !== false) {
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.95),
      new THREE.MeshBasicMaterial({ map: getBlobShadowTexture(), transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.003;
    shadow.name = 'BlobShadow';
    root.add(shadow);
  }
  if (options.showPedestal) root.add(buildPedestal());

  const avatar = new THREE.Group();
  avatar.name = 'Avatar';
  root.add(avatar);

  const animator = new AvatarAnimator();
  const lookTarget = new THREE.Vector3();
  let hasLook = false;

  // ── Mutable build state ────────────────────────────────────────────────
  let dims: AvatarDims;
  let rig: AvatarRig;
  let parts: BodyPart[];
  let bodyGeo: THREE.BufferGeometry;
  let bodyMesh: THREE.SkinnedMesh | null = null;
  let face: FaceRig | null = null;
  let headMesh: THREE.Mesh;
  // Everything on the head lives under headRoot, scaled by dims.headScale.
  let headRoot: THREE.Group;
  const book = buildBook(mats);
  // Geometry this avatar currently holds from the shared cache, by key.
  const held = new Map<string, THREE.BufferGeometry>();
  const slots: Record<string, THREE.Object3D[]> = {};
  let topSpec: GarmentSpec | null = null;
  let bottomSpec: GarmentSpec | null = null;
  let culledBody: THREE.BufferGeometry | null = null;

  const acquire = (key: string, create: () => THREE.BufferGeometry) => {
    let geo = held.get(key);
    if (!geo) {
      geo = cache.acquire(key, () => {
        const g = create();
        g.userData.shared = true;
        return g;
      });
      held.set(key, geo);
    }
    return geo;
  };
  const releaseMatching = (prefix: string) => {
    for (const k of [...held.keys()]) {
      if (k.startsWith(prefix)) {
        cache.release(k);
        held.delete(k);
      }
    }
  };
  /** Removes a slot's objects, freeing per-avatar geometry (cached geometry is shared). */
  const clearSlot = (slot: string) => {
    for (const obj of slots[slot] ?? []) {
      obj.removeFromParent();
      obj.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (!mesh.geometry.userData.shared) mesh.geometry.dispose();
        if (mesh.userData.ownsMaterial) (mesh.material as THREE.Material).dispose();
      });
    }
    slots[slot] = [];
  };
  const attach = (slot: string, bone: BoneName | null, obj: THREE.Object3D) => {
    (bone === 'head' ? headRoot : bone ? rig.bones[bone] : avatar).add(obj);
    (slots[slot] ??= []).push(obj);
  };
  const skinned = (geo: THREE.BufferGeometry, material: THREE.Material | THREE.Material[]) => {
    const mesh = new THREE.SkinnedMesh(geo, material);
    mesh.bind(rig.skeleton, new THREE.Matrix4());
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    return mesh;
  };

  // ── Builders ────────────────────────────────────────────────────────────
  function buildSkeletonAndBody() {
    dims = getAvatarDims(current.gender, current.bodyType);
    rig = buildRig(dims);
    parts = buildBodyParts(rig, dims);
    avatar.add(rig.root);
    headRoot = new THREE.Group();
    headRoot.name = 'HeadRoot';
    headRoot.scale.setScalar(dims.headScale);
    rig.bones.head.add(headRoot);
    const sk = shapeKey(dims);

    bodyGeo = acquire(`body|${sk}`, () => {
      const field = composeBody(parts);
      const data = meshSdf(field, { min: [-0.47, 0.06, -0.2], max: [0.47, 1.32, 0.2], cellSize: BODY_CELL, ao: { distance: 0.06 } });
      return toGeometry(data, { skin: computeSkinWeights(data.positions, parts, rig.boneIndex) });
    });

    for (const s of ['L', 'R'] as const) {
      const side = s === 'L' ? 1 : -1;
      const geo = acquire(`hand|${sk}|${s}`, () => {
        const b = handBounds(dims);
        return toGeometry(meshSdf(handSdf(dims, side as 1 | -1), { ...b, cellSize: HAND_CELL, ao: { distance: 0.014 } }));
      });
      const hand = new THREE.Mesh(geo, mats.skin);
      hand.castShadow = true;
      attach('core', `hand${s}`, hand);
    }

    const centres = eyeCentres(dims);
    const headGeo = acquire(`head|${sk}`, () =>
      toGeometry(meshSdf(headSdf(dims, centres), { ...headBounds(), cellSize: HEAD_CELL, ao: { distance: 0.02, strength: 0.75 } }))
    );
    headMesh = new THREE.Mesh(headGeo, mats.skin);
    headMesh.castShadow = true;
    headMesh.name = 'Head';
    attach('core', 'head', headMesh);

    rig.bones.chest.add(book);
  }

  function rebuildFace() {
    clearSlot('face');
    face?.dispose();
    const layout = headLayout(dims);
    face = buildFace(dims, layout, headBaseSdf(dims), headMesh, eyeCentres(dims), current.mood, lipColorFor(current), {
      skin: mats.skin,
      lid: mats.lid,
      hair: mats.brow,
      eye: mats.eye,
      lash: mats.lash,
    });
    attach('face', 'head', face.group);
  }

  function rebuildTop() {
    clearSlot('top');
    releaseMatching('top|');
    topSpec = buildTopSpec(current.outfitTop, rig, dims, parts, {
      secondary: mats.topSecondary, button: mats.button, gold: mats.gold,
    });
    const spec = topSpec;
    const geo = acquire(`top|${current.outfitTop}|${shapeKey(dims)}`, () => garmentGeometry(spec, rig));
    const mesh = skinned(geo, mats.top);
    mesh.name = 'Top';
    attach('top', null, mesh);
    for (const d of spec.details ?? []) attach('top', d.bone, d.object);
  }

  function rebuildBottom() {
    clearSlot('bottom');
    releaseMatching('bottom|');
    bottomSpec = buildBottomSpec(current.outfitBottom, current.shoes, rig, dims, parts);
    const spec = bottomSpec;
    const boots = current.shoes === 'boots' ? 'boots' : 'low';
    const geo = acquire(`bottom|${current.outfitBottom}|${boots}|${shapeKey(dims)}`, () => garmentGeometry(spec, rig));
    const mesh = skinned(geo, mats.bottom);
    mesh.name = 'Bottom';
    attach('bottom', null, mesh);
    for (const d of spec.details ?? []) attach('bottom', d.bone, d.object);
  }

  function rebuildShoes() {
    clearSlot('shoes');
    releaseMatching('shoe|');
    const geo = acquire(`shoe|${current.shoes}|${shapeKey(dims)}`, () => {
      const spec = shoeSpec(current.shoes, dims);
      return toGeometry(meshSdf(spec.sdf, { min: spec.min, max: spec.max, cellSize: SHOE_CELL, ao: { distance: 0.02 } }), { materialOf: spec.materialOf });
    });
    for (const s of ['L', 'R'] as const) {
      const shoe = new THREE.Mesh(geo, mats.shoes);
      shoe.castShadow = true;
      attach('shoes', `foot${s}`, shoe);
    }
  }

  /** Skin only where clothing doesn't cover it (no poke-through, fewer triangles). */
  function rebuildBodySkin() {
    if (bodyMesh) bodyMesh.removeFromParent();
    culledBody?.dispose();
    const top = topSpec!.sdf;
    const bottom = bottomSpec!.sdf;
    culledBody = filterTriangles(bodyGeo, (x, y, z) => top(x, y, z) > -0.0045 && bottom(x, y, z) > -0.0045);
    bodyMesh = skinned(culledBody, mats.skin);
    bodyMesh.name = 'Body';
    avatar.add(bodyMesh);
  }

  function rebuildHair() {
    clearSlot('hair');
    releaseMatching('hair|');
    const obj = buildHair(current.hairStyle, dims, mats.hair, (key, create) => acquire(`hair|${key}|${shapeKey(dims)}`, create));
    if (obj) attach('hair', 'head', obj);
  }

  function rebuildHeadwear() {
    clearSlot('headwear');
    const obj = buildHeadwear(current.headwear, current.hairStyle, dims, mats);
    if (obj) attach('headwear', 'head', obj);
  }

  function rebuildEyewear() {
    clearSlot('eyewear');
    const obj = buildEyewear(current.eyewear, dims, eyeCentres(dims), mats);
    if (obj) attach('eyewear', 'head', obj);
  }

  function rebuildFacialHair() {
    clearSlot('facialHair');
    releaseMatching('beard|');
    const style = current.facialHair ?? 'none';
    const obj = buildFacialHair(style, dims, mats.facialHair, (key, create) => acquire(`beard|${key}|${shapeKey(dims)}`, create));
    if (obj) attach('facialHair', 'head', obj);
  }

  function buildAll() {
    buildSkeletonAndBody();
    rebuildFace();
    rebuildTop();
    rebuildBottom();
    rebuildShoes();
    rebuildBodySkin();
    rebuildHair();
    rebuildHeadwear();
    rebuildEyewear();
    rebuildFacialHair();
  }

  function teardown() {
    for (const slot of Object.keys(slots)) clearSlot(slot);
    face?.dispose();
    face = null;
    bodyMesh?.removeFromParent();
    bodyMesh = null;
    culledBody?.dispose();
    culledBody = null;
    book.removeFromParent();
    rig?.root.removeFromParent();
    for (const k of held.keys()) cache.release(k);
    held.clear();
  }

  buildAll();

  // ── Public API ────────────────────────────────────────────────────────
  const update = (dt: number, poseOverride?: CharacterPose) => {
    if (!face) return;
    animator.update(dt, poseOverride || current.pose || 'idle', {
      bones: rig.bones,
      bodyGroup: avatar,
      lids: face.lids,
      eyeballs: face.eyeballs,
      restLid: face.restLid,
      book,
      restHipsX: 0,
      upperArmLen: dims.upperArmLen,
      forearmLen: dims.forearmLen,
    }, hasLook ? lookTarget : null);
  };

  const updateCustomization = (next: CharacterCustomization) => {
    const prev = current;
    current = { ...next };
    mats.applyColors(current);
    if (prev.eyeColor !== next.eyeColor) {
      mats.eye.map = getEyeTexture(next.eyeColor);
      mats.eye.needsUpdate = true;
    }

    if (prev.gender !== next.gender || prev.bodyType !== next.bodyType) {
      teardown();
      buildAll();
      return;
    }
    if (prev.mood !== next.mood || prev.skinTone !== next.skinTone) rebuildFace();
    const topChanged = prev.outfitTop !== next.outfitTop;
    const bottomChanged = prev.outfitBottom !== next.outfitBottom || (prev.shoes === 'boots') !== (next.shoes === 'boots');
    if (topChanged) rebuildTop();
    if (bottomChanged) rebuildBottom();
    if (prev.shoes !== next.shoes) rebuildShoes();
    if (topChanged || bottomChanged) rebuildBodySkin();
    if (prev.hairStyle !== next.hairStyle) rebuildHair();
    if (prev.headwear !== next.headwear || prev.hairStyle !== next.hairStyle) rebuildHeadwear();
    if (prev.eyewear !== next.eyewear) rebuildEyewear();
    if (prev.facialHair !== next.facialHair) rebuildFacialHair();
  };

  const setLookTarget = (target: THREE.Vector3) => {
    lookTarget.copy(target);
    hasLook = true;
  };

  const dispose = () => {
    teardown();
    root.removeFromParent();
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && (mesh.name === 'BlobShadow' || mesh.name === 'Pedestal')) mesh.geometry.dispose();
    });
    disposeHierarchy(book);
    mats.dispose();
  };

  return { root, update, updateCustomization, setLookTarget, dispose };
}

/** Meshes, skins and splits a garment into material groups. */
function garmentGeometry(spec: GarmentSpec, rig: AvatarRig): THREE.BufferGeometry {
  const data = meshSdf(spec.sdf, { min: spec.min, max: spec.max, cellSize: GARMENT_CELL, ao: { distance: 0.06 } });
  return toGeometry(data, {
    materialOf: spec.materialOf,
    skin: computeSkinWeights(data.positions, spec.weightParts, rig.boneIndex),
  });
}

/** Open textbook held in the study / read poses (child of the chest bone). */
function buildBook(mats: AvatarMaterials): THREE.Group {
  const group = new THREE.Group();
  group.name = 'HeldBook';
  const prop = new THREE.Group();
  // Rests on the palms of the IK-posed hands (see animator.ts armGoal).
  prop.position.set(0, -0.066, 0.25);
  prop.rotation.x = 0.38;
  group.add(prop);

  const halfW = 0.115, len = 0.155, thick = 0.012, wing = 0.12;
  for (const side of [1, -1]) {
    const cover = new THREE.Mesh(new RoundedBoxGeometry(halfW, 0.004, len + 0.008, 2, 0.0018), mats.bookCover);
    cover.position.set(side * (halfW / 2 + 0.002), -0.003, 0);
    cover.rotation.z = side * wing;
    cover.castShadow = true;
    prop.add(cover);
    const pages = new THREE.Mesh(new THREE.BoxGeometry(halfW - 0.006, thick, len), mats.bookPages);
    pages.position.set(side * (halfW / 2 + 0.003), thick / 2, 0);
    pages.rotation.z = side * wing;
    prop.add(pages);
  }
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, len + 0.01, 12, 1, false, 0, Math.PI), mats.bookCover);
  spine.rotation.set(Math.PI / 2, 0, Math.PI);
  spine.position.y = -0.004;
  prop.add(spine);
  const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.0015, len * 0.7), mats.ribbon);
  ribbon.position.set(0.02, thick + 0.002, 0.018);
  prop.add(ribbon);
  group.visible = false;
  return group;
}

function buildPedestal(): THREE.Group {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.66, 0.05, 64),
    new THREE.MeshStandardMaterial({ color: 0x1b2236, roughness: 0.55, metalness: 0.35 })
  );
  base.name = 'Pedestal';
  base.position.y = -0.025;
  base.receiveShadow = true;
  group.add(base);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.64, 0.006, 12, 96),
    new THREE.MeshBasicMaterial({ color: 0x818cf8 })
  );
  rim.name = 'Pedestal';
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.0005;
  group.add(rim);
  return group;
}
