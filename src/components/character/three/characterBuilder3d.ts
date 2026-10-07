import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CharacterCustomization, CharacterPose } from '../../../types/character';
import { buildRig, type AvatarRig, type BoneName } from './avatar/rig';
import { headBaseSdf, headLayout } from './avatar/head';
import { buildFace, getEyeTexture, type FaceRig } from './avatar/face';
import { buildTopSpec } from './avatar/clothing';
import { hairParts, assembleHair, type HairPart } from './avatar/hair';
import {
  buildEyewear, headwearParts, assembleHeadwear, assembleFacialHair, type HeadwearPart,
} from './avatar/accessories';
import { AvatarAnimator } from './avatar/animator';
import { coversHair } from './avatar/hatShape';
import { createAvatarMaterials, type AvatarMaterials, lipColorFor } from './avatar/materials';
import { shapeContext, eyeCentres, type GeometryJob } from './avatar/jobs';
import { geometryService, type Resolved } from './avatar/geometryService';
import type { AvatarDims } from './avatar/anatomy';

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

/** Frees per-avatar geometry/materials under obj (cached geometry is shared). */
function disposeOwned(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (!mesh.geometry.userData.shared) mesh.geometry.dispose();
    if (mesh.userData.ownsMaterial) (mesh.material as THREE.Material).dispose();
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

// ─── One assembled avatar (a skeleton plus everything bound to it) ───────────

type SlotName = 'hands' | 'head' | 'face' | 'top' | 'bottom' | 'shoes' | 'bodySkin' | 'hair' | 'headwear' | 'facialHair' | 'eyewear';
type Placed = Array<[BoneName | null, THREE.Object3D]>;

interface Slot {
  objects: THREE.Object3D[];
  leases: Array<() => void>;
  version: number;
  pending: Array<() => void>;
}

interface AvatarBuild {
  group: THREE.Group;
  rig: AvatarRig;
  dims: AvatarDims;
  book: THREE.Group;
  face: () => FaceRig | null;
  apply: (prev: CharacterCustomization, next: CharacterCustomization) => void;
  dispose: () => void;
}

/**
 * Builds an avatar for one body shape. Each part ("slot") requests its
 * geometry from the shared service and swaps in only when every piece has
 * arrived, so changes never flicker. `onReady` fires once all parts exist.
 */
function createBuild(
  initial: CharacterCustomization,
  mats: AvatarMaterials,
  onReady: () => void,
  onChange: () => void
): AvatarBuild {
  let custom = { ...initial };
  const shape = { gender: custom.gender, bodyType: custom.bodyType };
  const ctx = shapeContext(shape.gender, shape.bodyType);
  const dims = ctx.dims;
  // Each avatar animates its own bones (the context rig is only a template).
  const rig = buildRig(dims);

  const group = new THREE.Group();
  group.name = 'Avatar';
  group.add(rig.root);
  const headRoot = new THREE.Group();
  headRoot.name = 'HeadRoot';
  headRoot.scale.setScalar(dims.headScale);
  rig.bones.head.add(headRoot);
  const book = buildBook(mats);
  rig.bones.chest.add(book);

  const slots = new Map<SlotName, Slot>();
  let headGeometry: THREE.BufferGeometry | null = null;
  let face: FaceRig | null = null;
  let disposed = false;
  let readyFired = false;
  const awaiting = new Set<SlotName>(['hands', 'head', 'face', 'top', 'bottom', 'shoes', 'bodySkin', 'hair', 'headwear', 'facialHair', 'eyewear']);

  const slotOf = (name: SlotName) => {
    let s = slots.get(name);
    if (!s) {
      s = { objects: [], leases: [], version: 0, pending: [] };
      slots.set(name, s);
    }
    return s;
  };
  const parentFor = (bone: BoneName | null) => (bone === 'head' ? headRoot : bone ? rig.bones[bone] : group);

  /** Replaces a slot's contents with `objects` (attached to their bones). */
  const install = (name: SlotName, objects: Placed, leases: Array<() => void>) => {
    const s = slotOf(name);
    for (const obj of s.objects) {
      obj.removeFromParent();
      disposeOwned(obj);
    }
    for (const release of s.leases) release();
    s.objects = objects.map(([bone, obj]) => {
      parentFor(bone).add(obj);
      return obj;
    });
    s.leases = leases;
    if (awaiting.delete(name) && awaiting.size === 0 && !readyFired && !disposed) {
      readyFired = true;
      onReady();
    } else if (readyFired) {
      onChange(); // a part of a visible avatar changed
    }
  };

  /**
   * Requests every job for a slot, installs what `assemble` builds from the
   * results (in job order), then runs `after`. A newer request for the same
   * slot supersedes an older one that is still in flight.
   */
  const request = (name: SlotName, jobs: GeometryJob[], assemble: (results: Resolved[]) => Placed, after?: () => void) => {
    const s = slotOf(name);
    for (const cancel of s.pending) cancel();
    const version = ++s.version;
    const results: Resolved[] = new Array(jobs.length);
    const leases: Array<() => void> = [];
    let remaining = jobs.length;
    let issued = false;
    const finish = () => {
      if (disposed || version !== s.version) {
        leases.forEach((l) => l());
        return;
      }
      s.pending = [];
      install(name, assemble(results), leases);
      after?.();
    };
    jobs.forEach((job, i) => {
      leases.push(
        geometryService.get(job, (r) => {
          results[i] = r;
          remaining--;
          if (remaining === 0 && issued) finish();
        })
      );
    });
    issued = true;
    s.pending = leases;
    if (remaining === 0) finish();
  };

  const skinned = (geo: THREE.BufferGeometry, material: THREE.Material, name: string) => {
    const m = new THREE.SkinnedMesh(geo, material);
    m.name = name;
    m.bind(rig.skeleton, new THREE.Matrix4());
    m.castShadow = true;
    m.frustumCulled = false;
    return m;
  };
  const rigid = (geo: THREE.BufferGeometry, material: THREE.Material, name?: string) => {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true;
    if (name) m.name = name;
    return m;
  };
  const boots = () => custom.shoes === 'boots';

  // ── Slots ──────────────────────────────────────────────────────────────
  const requestHands = () =>
    request('hands', [{ kind: 'hand', side: 'L', ...shape }, { kind: 'hand', side: 'R', ...shape }], ([l, r]) => [
      ['handL', rigid(l as THREE.BufferGeometry, mats.skin)],
      ['handR', rigid(r as THREE.BufferGeometry, mats.skin)],
    ]);

  const rebuildFace = () => {
    if (!headGeometry) return;
    face?.dispose();
    face = buildFace(dims, headLayout(dims), headBaseSdf(dims), new THREE.Mesh(headGeometry), eyeCentres(dims), custom.mood, lipColorFor(custom), {
      skin: mats.skin,
      lid: mats.lid,
      hair: mats.brow,
      eye: mats.eye,
      lash: mats.lash,
    });
    install('face', [['head', face.group]], []);
  };

  const requestHead = () =>
    request(
      'head',
      [{ kind: 'head', ...shape }],
      ([g]) => {
        headGeometry = g as THREE.BufferGeometry;
        return [['head', rigid(headGeometry, mats.skin, 'Head')]];
      },
      rebuildFace // the face's decals are projected onto the new head
    );

  const requestTop = () => {
    const top = custom.outfitTop;
    request('top', [{ kind: 'top', top, ...shape }], ([g]) => {
      // Details are placed with the bind-pose template rig (bone-local
      // positions are the same for every avatar, whatever its current pose).
      const spec = buildTopSpec(top, ctx.rig, dims, ctx.parts, { secondary: mats.topSecondary, button: mats.button, gold: mats.gold });
      const out: Placed = [[null, skinned(g as THREE.BufferGeometry, mats.top, 'Top')]];
      for (const d of spec.details ?? []) out.push([d.bone, d.object]);
      return out;
    });
  };

  const requestBottom = () =>
    request('bottom', [{ kind: 'bottom', bottom: custom.outfitBottom, boots: boots(), ...shape }], ([g]) => [
      [null, skinned(g as THREE.BufferGeometry, mats.bottom, 'Bottom')],
    ]);

  const requestShoes = () =>
    request('shoes', [{ kind: 'shoe', shoes: custom.shoes, ...shape }], ([g]) => [
      ['footL', rigid(g as THREE.BufferGeometry, mats.shoes)],
      ['footR', rigid(g as THREE.BufferGeometry, mats.shoes)],
    ]);

  /** Skin only where clothing doesn't cover it (no poke-through, fewer triangles). */
  const requestBodySkin = () =>
    request(
      'bodySkin',
      [
        { kind: 'body', ...shape },
        { kind: 'bodyCull', top: custom.outfitTop, bottom: custom.outfitBottom, boots: boots(), ...shape },
      ],
      ([bodyGeo, indices]) => {
        const source = bodyGeo as THREE.BufferGeometry;
        const culled = new THREE.BufferGeometry();
        for (const attr of Object.keys(source.attributes)) culled.setAttribute(attr, source.getAttribute(attr));
        culled.setIndex(new THREE.BufferAttribute(indices as Uint32Array, 1));
        culled.boundingBox = source.boundingBox;
        culled.boundingSphere = source.boundingSphere;
        return [[null, skinned(culled, mats.skin, 'Body')]];
      }
    );

  const requestHair = () => {
    const style = custom.hairStyle;
    const pieces = hairParts(style);
    // Under a cap, beanie or mortarboard the hair is tucked in (re-meshed).
    const under = coversHair(custom.headwear) ? custom.headwear : 'none';
    request('hair', pieces.map((part) => ({ kind: 'hair', style, part, under, ...shape })), (results) => {
      const geos: Partial<Record<HairPart, THREE.BufferGeometry>> = {};
      pieces.forEach((p, i) => (geos[p] = results[i] as THREE.BufferGeometry));
      return [['head', assembleHair(style, geos, mats.hair)]];
    });
  };

  const requestHeadwear = () => {
    const { headwear, hairStyle } = custom;
    const pieces = headwearParts(headwear);
    request('headwear', pieces.map((part) => ({ kind: 'headwear', headwear, hair: hairStyle, part, ...shape })), (results) => {
      const geos: Partial<Record<HeadwearPart, THREE.BufferGeometry>> = {};
      pieces.forEach((p, i) => (geos[p] = results[i] as THREE.BufferGeometry));
      const obj = assembleHeadwear(headwear, hairStyle, dims, mats, geos);
      return obj ? [['head', obj]] : [];
    });
  };

  const requestFacialHair = () => {
    const style = custom.facialHair ?? 'none';
    if (style === 'none') {
      request('facialHair', [], () => []);
      return;
    }
    request('facialHair', [{ kind: 'facialHair', style, ...shape }], ([g]) => [
      ['head', assembleFacialHair(style, g as THREE.BufferGeometry, mats.facialHair)],
    ]);
  };

  const requestEyewear = () =>
    request('eyewear', [], () => {
      const obj = buildEyewear(custom.eyewear, dims, eyeCentres(dims), mats);
      return obj ? [['head', obj]] : [];
    });

  requestHands();
  requestHead();
  requestTop();
  requestBottom();
  requestShoes();
  requestBodySkin();
  requestHair();
  requestHeadwear();
  requestFacialHair();
  requestEyewear();

  return {
    group,
    rig,
    dims,
    book,
    face: () => face,
    apply(prev, next) {
      custom = { ...next };
      if (prev.mood !== next.mood || prev.skinTone !== next.skinTone) rebuildFace();
      const topChanged = prev.outfitTop !== next.outfitTop;
      const bottomChanged = prev.outfitBottom !== next.outfitBottom || (prev.shoes === 'boots') !== (next.shoes === 'boots');
      if (topChanged) requestTop();
      if (bottomChanged) requestBottom();
      if (prev.shoes !== next.shoes) requestShoes();
      if (topChanged || bottomChanged) requestBodySkin();
      const tuckChanged = coversHair(prev.headwear) !== coversHair(next.headwear) ||
        (coversHair(next.headwear) && prev.headwear !== next.headwear);
      if (prev.hairStyle !== next.hairStyle || tuckChanged) requestHair();
      if (prev.headwear !== next.headwear || prev.hairStyle !== next.hairStyle) requestHeadwear();
      if (prev.eyewear !== next.eyewear) requestEyewear();
      if (prev.facialHair !== next.facialHair) requestFacialHair();
    },
    dispose() {
      disposed = true;
      for (const s of slots.values()) {
        for (const cancel of s.pending) cancel();
        for (const obj of s.objects) {
          obj.removeFromParent();
          disposeOwned(obj);
        }
        for (const release of s.leases) release();
      }
      slots.clear();
      face?.dispose();
      face = null;
      disposeHierarchy(book);
      group.removeFromParent();
    },
  };
}

// ─── Public instance ─────────────────────────────────────────────────────────

/**
 * Builds the stylized, fully skinned 3D student avatar (~1.55 m tall, feet on
 * y = 0, facing +Z). Body, head, hands, clothes and hair are sculpted as
 * signed distance fields and meshed in background workers; parts swap in as
 * they finish, and a body-shape change swaps in a whole new avatar once it is
 * ready, so the scene never stalls or flickers. Without workers (tests) the
 * avatar is complete when this returns.
 */
export function buildCharacter3D(
  custom: CharacterCustomization,
  options: {
    showPedestal?: boolean;
    showShadow?: boolean;
    /** Called when visible geometry changes (parts arrive or are swapped). */
    onChange?: () => void;
  } = {}
): CharacterModelInstance {
  const root = new THREE.Group();
  root.name = 'Character3D_Root';
  const notify = () => options.onChange?.();
  let current: CharacterCustomization = { ...custom };
  const mats = createAvatarMaterials(current);
  const animator = new AvatarAnimator();
  const lookTarget = new THREE.Vector3();
  let hasLook = false;

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

  let active: AvatarBuild | null = null;
  let pending: AvatarBuild | null = null;

  const swapIn = (build: AvatarBuild) => {
    if (active && active !== build) active.dispose();
    active = build;
    if (pending === build) pending = null;
    root.add(build.group);
    notify();
  };

  /** Assembles an avatar off-screen and swaps it in when every part is ready. */
  const startBuild = (c: CharacterCustomization) => {
    pending?.dispose();
    pending = null;
    let build: AvatarBuild | null = null;
    let readyBeforeReturn = false;
    build = createBuild(c, mats, () => {
      if (!build) {
        readyBeforeReturn = true; // synchronous geometry: ready inside createBuild
        return;
      }
      if (pending === build) swapIn(build);
    }, () => {
      if (active === build) notify();
    });
    if (readyBeforeReturn) swapIn(build);
    else pending = build;
  };
  startBuild(current);

  const update = (dt: number, poseOverride?: CharacterPose) => {
    const face = active?.face();
    if (!active || !face) return;
    animator.update(dt, poseOverride || current.pose || 'idle', {
      bones: active.rig.bones,
      bodyGroup: active.group,
      lids: face.lids,
      eyeballs: face.eyeballs,
      restLid: face.restLid,
      book: active.book,
      restHipsX: 0,
      upperArmLen: active.dims.upperArmLen,
      forearmLen: active.dims.forearmLen,
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
    if (!active || pending || prev.gender !== next.gender || prev.bodyType !== next.bodyType) {
      // A new body shape needs a new skeleton (and a build still in flight is
      // simply restarted with the latest settings).
      startBuild(current);
      return;
    }
    active.apply(prev, current);
  };

  const setLookTarget = (target: THREE.Vector3) => {
    lookTarget.copy(target);
    hasLook = true;
  };

  const dispose = () => {
    pending?.dispose();
    active?.dispose();
    pending = null;
    active = null;
    root.removeFromParent();
    root.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
    mats.dispose();
  };

  return { root, update, updateCustomization, setLookTarget, dispose };
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
