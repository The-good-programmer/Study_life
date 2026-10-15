import * as THREE from 'three';
import type { CharacterCustomization, CharacterPose } from '../../../../types/character';
import {
  buildCharacter3D, buildBook, buildPedestal, getBlobShadowTexture, type CharacterModelInstance,
} from '../characterBuilder3d';
import { AvatarAnimator, type AnimatorTargets } from '../avatar/animator';
import { getAvatarDims } from '../avatar/anatomy';
import { buildRig, BONE_NAMES, type AvatarRig, type BoneName } from '../avatar/rig';
import { avatarAssets, disposeInstance, type AssetCache } from './assetLoader';
import { applyBodyShape, bodyMorphWeights } from './bodyShape';
import { BodyHider, hideMask } from './bodyHide';
import { SkeletonShaper } from './skeletonShape';
import { FaceController } from './expressions';
import { loadManifest, resolveItems, assetUrl, type AvatarManifest, type ResolvedItem, type Slot } from './manifest';
import { applyRoleColors, prepareMaterial, setBeard, setScalp } from './materialsV2';
import { getQualityTier, type QualityTier } from './quality';
import { measureDims, measureJoints, Retargeter } from './retarget';

export interface V2Deps {
  loadManifest: () => Promise<AvatarManifest | null>;
  assets: Pick<AssetCache, 'acquire' | 'release'>;
  tier: QualityTier;
  /** The procedural avatar, used when there is no manifest or base asset. */
  fallback: typeof buildCharacter3D;
}

type BuildOptions = Parameters<typeof buildCharacter3D>[1];

const defaultDeps = (): V2Deps => ({ loadManifest, assets: avatarAssets, tier: getQualityTier(), fallback: buildCharacter3D });

interface Equipped {
  item: ResolvedItem;
  object: THREE.Object3D;
  /** Hides the parts of this item covered by outer garments. */
  hider?: BodyHider;
}

/**
 * Builds the asset-based (v2) avatar: a skinned base human from the asset
 * manifest, dressed with per-item glTF assets. It honours the same contract
 * as buildCharacter3D, so callers can switch between the two freely.
 *
 * - Motion: the procedural AvatarAnimator poses a hidden 17-bone proxy rig
 *   (poses, IK, look-at), and a Retargeter copies that onto the asset's
 *   skeleton. The held book rides on the proxy's chest, where the IK puts it.
 * - Body shape is morph targets on the body and every garment, so changing
 *   gender or build is instant; moods are ARKit blend-shape presets.
 * - Items load asynchronously; the previous item stays until its
 *   replacement is ready, so changes never flicker.
 * - With no manifest (assets not built yet) or a failed base, it shows the
 *   procedural avatar instead.
 */
export function buildCharacterV2(
  custom: CharacterCustomization,
  options: BuildOptions = {},
  deps: V2Deps = defaultDeps()
): CharacterModelInstance {
  const root = new THREE.Group();
  root.name = 'Character3D_Root';
  const notify = () => options.onChange?.();
  let current: CharacterCustomization = { ...custom };
  let disposed = false;
  let fallback: CharacterModelInstance | null = null;

  if (options.showShadow !== false) root.add(blobShadow());
  if (options.showPedestal) root.add(buildPedestal());

  const animator = new AvatarAnimator();
  const face = new FaceController();
  const lookTarget = new THREE.Vector3();
  let hasLook = false;
  const bookMats = {
    bookCover: new THREE.MeshStandardMaterial({ color: 0x2f5fd0, roughness: 0.55 }),
    bookPages: new THREE.MeshStandardMaterial({ color: 0xfbf6ea, roughness: 0.9 }),
    ribbon: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 }),
  };

  // Assembled state (null until the base and first items arrive).
  let manifest: AvatarManifest | null = null;
  let avatar: THREE.Group | null = null;
  let base: {
    url: string;
    object: THREE.Object3D;
    bones: Map<string, THREE.Object3D>;
    /** Each node's bind-pose matrix relative to the avatar, inverted (for rigid attachments). */
    bindInverse: Map<string, THREE.Matrix4>;
  } | null = null;
  let targets: Record<BoneName, THREE.Object3D> | null = null;
  let shaper: SkeletonShaper | null = null;
  let hider: BodyHider | null = null;
  let shapeKey = '';
  let proxy: AvatarRig | null = null;
  let retarget: Retargeter | null = null;
  let book: THREE.Group | null = null;
  let eyeballs: THREE.Object3D[] = [];
  /** What the animator poses; rebuilt with the proxy rig. */
  let animTargets: AnimatorTargets | null = null;
  const equipped = new Map<Slot, Equipped>();
  // Replaced by the base skeleton's measurements once it loads.
  let dims = getAvatarDims('nonbinary', 'average');
  let version = 0;
  let outfitApplied = () => {};
  const firstOutfit = new Promise<void>((resolve) => (outfitApplied = resolve));

  const switchToFallback = (reason: string) => {
    if (disposed || fallback) return;
    if (reason) console.warn(`[avatar v2] ${reason}; using the procedural avatar.`);
    fallback = deps.fallback(current, { ...options, showPedestal: false, showShadow: false });
    root.add(fallback.root);
    notify();
  };

  /** Loads the items for `c`, then swaps in whatever changed (all at once). */
  const syncItems = async (c: CharacterCustomization) => {
    if (!manifest || !base || !avatar) return;
    const v = ++version;
    const wanted = resolveItems(manifest, c, deps.tier);
    // Shading-only items share an empty URL, so they are told apart by id.
    const key = (it: ResolvedItem) => it.url || `shade:${it.id}`;
    const changed = wanted.filter((it) => {
      const e = equipped.get(it.slot);
      return !e || key(e.item) !== key(it);
    });
    const removed = [...equipped.keys()].filter((s) => !wanted.some((it) => it.slot === s));
    const loaded = await Promise.all(
      changed.map((item) =>
        (item.url ? deps.assets.acquire(item.url) : Promise.resolve(new THREE.Group())).then(
          (object) => ({ item, object }),
          (err) => {
            console.warn(`[avatar v2] could not load ${item.slot} "${item.id}"`, err);
            return null;
          }
        )
      )
    );
    if (disposed || v !== version) {
      for (const l of loaded) if (l) release(l);
      return;
    }
    for (const slot of removed) unequip(slot);
    for (const l of loaded) {
      if (!l) continue;
      unequip(l.item.slot);
      equip(l);
    }
    refresh();
    outfitApplied();
    notify();
  };

  const release = (e: Equipped) => {
    e.hider?.dispose();
    e.object.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) shaper?.removeSkeleton(mesh.skeleton);
    });
    e.object.removeFromParent();
    disposeInstance(e.object);
    if (e.item.url) deps.assets.release(e.item.url);
  };

  const unequip = (slot: Slot) => {
    const e = equipped.get(slot);
    if (!e) return;
    release(e);
    equipped.delete(slot);
  };

  const equip = (e: Equipped) => {
    const { object, item } = e;
    object.name = `Item_${item.slot}_${item.id}`;
    let skinned = false;
    object.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      skinned = true;
      // Drive the garment with the base skeleton, matched by bone name.
      const bones = mesh.skeleton.bones.map((b) => (base!.bones.get(b.name) as THREE.Bone) ?? b);
      mesh.bind(new THREE.Skeleton(bones, mesh.skeleton.boneInverses), mesh.bindMatrix);
      shaper?.addSkeleton(mesh.skeleton);
    });
    const hider = new BodyHider(object, 2);
    if (!hider.isEmpty) e.hider = hider;
    const anchor = item.entry.attach ? base!.bones.get(item.entry.attach) : null;
    if (!skinned && anchor) {
      // Rigid items are authored in the avatar's bind pose: re-express them in the bone's frame.
      object.applyMatrix4(base!.bindInverse.get(item.entry.attach!)!);
      anchor.add(object);
    } else {
      avatar!.add(object);
    }
    equipped.set(item.slot, e);
  };

  /**
   * Builds the proxy rig the animator poses, on the skeleton's current
   * joints, and the retargeter that copies its pose across. The skeleton must
   * be at rest; the current pose is then carried over, so a body-shape change
   * doesn't flick the arms back to the bind pose.
   */
  const rebuildProxy = () => {
    if (!avatar || !targets || !book) return;
    proxy?.root.removeFromParent();
    avatar.updateMatrixWorld(true);
    dims = measureDims(targets, avatar, dims);
    proxy = buildRig(dims, measureJoints(targets, avatar));
    proxy.root.name = 'ProxyRig';
    avatar.add(proxy.root);
    avatar.updateMatrixWorld(true);
    retarget = new Retargeter(proxy, avatar, targets);
    proxy.bones.chest.add(book);
    animTargets = {
      bones: proxy.bones,
      bodyGroup: avatar,
      lids: [],
      eyeballs,
      eyeCentres: eyeballs.length ? null : eyeCentres(avatar, proxy.bones.head),
      restLid: 0,
      book,
      restHipsX: 0,
      upperArmLen: dims.upperArmLen,
      forearmLen: dims.forearmLen,
      ponytail: null,
      clavicles: retarget.clavicles,
    };
    animator.restore(animTargets);
    retarget.apply(animator.hands);
  };

  /** Body shape: morph weights everywhere, plus joints when the shape changed. */
  const reshape = () => {
    if (!avatar) return;
    const weights = bodyMorphWeights(current.gender, current.bodyType);
    applyBodyShape(avatar, weights);
    const key = `${current.gender}|${current.bodyType}`;
    if (key === shapeKey) return;
    shapeKey = key;
    shaper?.apply(weights);
    rebuildProxy();
  };

  /** Re-applies everything that depends on the set of equipped items. */
  const refresh = () => {
    if (!avatar || !base) return;
    const mask = hideMask([...equipped.values()].map((e) => e.item.entry.hideBit));
    hider?.apply(mask);
    for (const e of equipped.values()) e.hider?.apply(mask);
    avatar.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh || mesh.morphTargetInfluences) mesh.frustumCulled = false;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(prepareMaterial) : prepareMaterial(mesh.material);
    });
    reshape();
    applyRoleColors(avatar, current);
    const hair = equipped.get('hair')?.item.entry;
    setScalp(avatar, hair?.scalpBit ?? -1, current.hairColor, hair?.scalpOnly ? 0.92 : 0.75);
    const beard = equipped.get('facialHair')?.item.entry;
    setBeard(avatar, beard?.beardBit ?? -1, current.facialHairColor ?? current.hairColor, beard?.shadeStrength ?? 0.85);
    face.setMeshes(avatar);
  };

  const assemble = async () => {
    manifest = await deps.loadManifest();
    if (disposed) return;
    if (!manifest) return switchToFallback('');
    const url = assetUrl(manifest.base, deps.tier);
    if (!url) return switchToFallback('the manifest has no base asset');
    let object: THREE.Object3D;
    try {
      object = await deps.assets.acquire(url);
    } catch (err) {
      return switchToFallback(`could not load the base avatar (${String(err)})`);
    }
    if (disposed) {
      deps.assets.release(url);
      return;
    }
    const bones = new Map<string, THREE.Object3D>();
    object.traverse((o) => {
      if (o.name && !bones.has(o.name)) bones.set(o.name, o);
    });
    const found: Partial<Record<BoneName, THREE.Object3D>> = {};
    for (const name of BONE_NAMES) {
      const t = bones.get(manifest.boneMap[name]);
      if (t) found[name] = t;
    }
    const missing = BONE_NAMES.filter((n) => !found[n]);
    if (missing.length) {
      deps.assets.release(url);
      disposeInstance(object);
      return switchToFallback(`the base skeleton is missing ${missing.join(', ')}`);
    }

    targets = found as Record<BoneName, THREE.Object3D>;
    avatar = new THREE.Group();
    avatar.name = 'Avatar';
    avatar.add(object);
    avatar.updateMatrixWorld(true);
    const bindInverse = new Map<string, THREE.Matrix4>();
    for (const [name, node] of bones) bindInverse.set(name, node.matrixWorld.clone().invert());
    base = { url, object, bones, bindInverse };
    const skeletonBones = [...bones.values()].filter((o): o is THREE.Bone => (o as THREE.Bone).isBone);
    shaper = new SkeletonShaper(avatar, skeletonBones, manifest.jointMorphs);
    object.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) shaper!.addSkeleton(mesh.skeleton);
    });
    hider = new BodyHider(object);
    book = buildBook(bookMats);
    // Eyeball nodes if the base has them; otherwise the eyes turn by blend shapes (see eyeCentres).
    eyeballs = ['Eye_L', 'Eye_R'].map((n) => bones.get(n)).filter((o): o is THREE.Object3D => Boolean(o));
    if (eyeballs.length !== 2) eyeballs = [];
    reshape(); // joints for the initial body shape, then the proxy rig
    face.setMood(current.mood);
    face.snap();
    // Show the base only once its first outfit is on (a later sync may supersede this one).
    void syncItems(current);
    await firstOutfit;
    if (disposed) return;
    root.add(avatar);
    notify();
  };
  void assemble();

  const update = (dt: number, poseOverride?: CharacterPose) => {
    if (fallback) return fallback.update(dt, poseOverride);
    if (!avatar || !retarget || !animTargets) return;
    animator.update(dt, poseOverride || current.pose || 'idle', animTargets, hasLook ? lookTarget : null);
    retarget.apply(animator.hands);
    const { yawL, yawR, pitch } = animator.gaze;
    face.setGaze(yawL, yawR, pitch);
    face.update(dt);
  };

  const updateCustomization = (next: CharacterCustomization) => {
    current = { ...next };
    if (fallback) return fallback.updateCustomization(next);
    face.setMood(current.mood);
    if (!avatar) return; // assemble() reads `current` when it gets there
    refresh();
    void syncItems(current);
  };

  const setLookTarget = (target: THREE.Vector3) => {
    if (fallback) fallback.setLookTarget(target);
    lookTarget.copy(target);
    hasLook = true;
  };

  const dispose = () => {
    disposed = true;
    fallback?.dispose();
    for (const slot of [...equipped.keys()]) unequip(slot);
    hider?.dispose();
    if (base) {
      disposeInstance(base.object);
      deps.assets.release(base.url);
    }
    book?.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    Object.values(bookMats).forEach((m) => m.dispose());
    root.removeFromParent();
    for (const child of root.children) {
      if (child === avatar) continue;
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
    }
  };

  return { root, update, updateCustomization, setLookTarget, dispose };
}

/**
 * Centres of the eyes (left, right) in `head`'s frame, measured from the
 * eyeball meshes: the meshes that look around (eyeLook* shapes) without
 * blinking. The skeleton must be at rest. Null if there are none.
 */
function eyeCentres(avatar: THREE.Object3D, head: THREE.Object3D): THREE.Vector3[] | null {
  const boxes = [new THREE.Box3(), new THREE.Box3()];
  const v = new THREE.Vector3();
  avatar.updateMatrixWorld(true);
  avatar.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    const dict = mesh.isMesh ? mesh.morphTargetDictionary : undefined;
    if (!dict || dict.eyeLookInLeft === undefined || dict.eyeBlinkLeft !== undefined) return;
    const local = new THREE.Vector3();
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
      // The avatar's left is +X in its own frame.
      boxes[avatar.worldToLocal(local.copy(v)).x >= 0 ? 0 : 1].expandByPoint(v);
    }
  });
  if (boxes.some((b) => b.isEmpty())) return null;
  return boxes.map((b) => head.worldToLocal(b.getCenter(new THREE.Vector3())));
}

function blobShadow() {
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.95),
    new THREE.MeshBasicMaterial({ map: getBlobShadowTexture(), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.003;
  shadow.name = 'BlobShadow';
  return shadow;
}
