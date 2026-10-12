import * as THREE from 'three';

/** Avatar-space joint offset per bone for each body morph at weight 1 (glTF axes, metres). */
export type JointMorphs = Partial<Record<string, Record<string, [number, number, number]>>>;

interface BoneRest {
  bone: THREE.Object3D;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  /** Bind matrix relative to the avatar. */
  bind: THREE.Matrix4;
  /** Current rest matrix relative to the avatar (the bind, moved by joint morphs). */
  rest: THREE.Matrix4;
  depth: number;
}

const _m = new THREE.Matrix4();
const _avatarInv = new THREE.Matrix4();
const _v = new THREE.Vector3();

/**
 * Moves the skeleton's joints with the body-shape morphs. Morphs reshape the
 * skin, but gender also changes height and limb lengths (several cm), so a
 * skeleton left in the neutral pose would bend a tall body at the neutral
 * body's elbows. This puts every joint where the morphed body has it and
 * rebinds the skins at that new rest pose, so skin and joints agree again.
 *
 * Call apply() with the skeleton at rest (it resets the pose itself) and
 * before re-measuring anything that depends on joint positions.
 */
export class SkeletonShaper {
  private rests: BoneRest[] = [];
  private byName = new Map<string, BoneRest>();
  private skeletons = new Map<THREE.Skeleton, THREE.Matrix4[]>();
  private avatar: THREE.Object3D;
  private morphs: JointMorphs;

  /** `bones`: the base's skeleton nodes by name, in bind pose. */
  constructor(avatar: THREE.Object3D, bones: Iterable<THREE.Bone>, morphs: JointMorphs = {}) {
    this.avatar = avatar;
    this.morphs = morphs;
    avatar.updateMatrixWorld(true);
    _avatarInv.copy(avatar.matrixWorld).invert();
    for (const bone of bones) {
      let depth = 0;
      for (let p = bone.parent; p && p !== avatar; p = p.parent) depth++;
      const rest: BoneRest = {
        bone,
        position: bone.position.clone(),
        quaternion: bone.quaternion.clone(),
        scale: bone.scale.clone(),
        bind: new THREE.Matrix4().multiplyMatrices(_avatarInv, bone.matrixWorld),
        rest: new THREE.Matrix4(),
        depth,
      };
      rest.rest.copy(rest.bind);
      this.rests.push(rest);
      this.byName.set(bone.name, rest);
    }
    this.rests.sort((a, b) => a.depth - b.depth);
  }

  get hasMorphs() {
    return Object.values(this.morphs).some((m) => m && Object.keys(m).length > 0);
  }

  /**
   * Tracks a skeleton (the base's, or a garment's bound to the same bones).
   * Its inverse bind matrices are replaced by private copies first: cloned
   * assets share them with the cached original (and with every other avatar
   * built from it), so rebinding them in place would compound across loads.
   */
  addSkeleton(skeleton: THREE.Skeleton) {
    if (this.skeletons.has(skeleton)) return;
    this.skeletons.set(skeleton, skeleton.boneInverses.map((m) => m.clone()));
    skeleton.boneInverses = skeleton.boneInverses.map((m) => m.clone());
    this.rebind(skeleton);
  }

  removeSkeleton(skeleton: THREE.Skeleton) {
    this.skeletons.delete(skeleton);
  }

  /** Resets the pose and moves each joint by the weighted offsets. */
  apply(weights: Record<string, number>) {
    _avatarInv.copy(this.avatar.matrixWorld).invert();
    for (const r of this.rests) {
      r.bone.position.copy(r.position);
      r.bone.quaternion.copy(r.quaternion);
      r.bone.scale.copy(r.scale);
    }
    for (const r of this.rests) {
      // Where this joint should be, relative to the avatar.
      const target = _v.setFromMatrixPosition(r.bind);
      for (const [morph, w] of Object.entries(weights)) {
        const off = w ? this.morphs[morph]?.[r.bone.name] : undefined;
        if (off) {
          target.x += off[0] * w;
          target.y += off[1] * w;
          target.z += off[2] * w;
        }
      }
      // Express it in the parent's (already moved) frame.
      const parent = r.bone.parent!;
      parent.updateWorldMatrix(true, false);
      _m.multiplyMatrices(_avatarInv, parent.matrixWorld).invert();
      r.bone.position.copy(target.applyMatrix4(_m));
    }
    this.avatar.updateMatrixWorld(true);
    for (const r of this.rests) r.rest.multiplyMatrices(_avatarInv, r.bone.matrixWorld);
    for (const skeleton of this.skeletons.keys()) this.rebind(skeleton);
  }

  /**
   * Rebinds at the current rest pose: inverse = rest⁻¹ · bind · original
   * inverse, which is the identity change at the bind pose whatever frame the
   * asset's inverse bind matrices were authored in. Uses the stored rest
   * matrices, so it is safe while the skeleton is posed.
   */
  private rebind(skeleton: THREE.Skeleton) {
    const original = this.skeletons.get(skeleton)!;
    skeleton.bones.forEach((bone, i) => {
      const r = this.byName.get(bone.name);
      if (!r) return;
      _m.copy(r.rest).invert();
      skeleton.boneInverses[i].multiplyMatrices(_m, r.bind).multiply(original[i]);
    });
  }
}
