import * as THREE from 'three';
import type { AvatarDims } from '../avatar/anatomy';
import { BONE_NAMES, type AvatarRig, type BoneName } from '../avatar/rig';

/** Child used to aim each driven bone (leaves reuse their parent's correction). */
const AIM_CHILD: Partial<Record<BoneName, BoneName>> = {
  hips: 'spine', spine: 'chest', chest: 'neck', neck: 'head',
  upperArmL: 'forearmL', forearmL: 'handL', upperArmR: 'forearmR', forearmR: 'handR',
  thighL: 'shinL', shinL: 'footL', thighR: 'shinR', shinR: 'footR',
};
const PARENT: Partial<Record<BoneName, BoneName>> = {
  head: 'neck', handL: 'forearmL', handR: 'forearmR', footL: 'shinL', footR: 'shinR',
};

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

/** Rotation of obj relative to an ancestor, from local quaternions only. */
function rootQuat(obj: THREE.Object3D | null, root: THREE.Object3D, out: THREE.Quaternion) {
  out.identity();
  for (let o = obj; o && o !== root; o = o.parent) out.premultiply(o.quaternion);
  return out;
}

/** Position of obj relative to an ancestor (uniform scale assumed). */
function rootPos(obj: THREE.Object3D, root: THREE.Object3D, out: THREE.Vector3) {
  out.set(0, 0, 0);
  for (let o: THREE.Object3D | null = obj; o && o !== root; o = o.parent) {
    out.multiplyScalar(o.scale.x).applyQuaternion(o.quaternion).add(o.position);
  }
  return out;
}

function rootScale(obj: THREE.Object3D | null, root: THREE.Object3D) {
  let s = 1;
  for (let o = obj; o && o !== root; o = o.parent) s *= o.scale.x;
  return s;
}

const depth = (o: THREE.Object3D) => {
  let d = 0;
  for (let p = o.parent; p; p = p.parent) d++;
  return d;
};

/**
 * Proxy proportions that put its joints where the imported skeleton's are.
 * The animator's IK goals (a hand on the book, a wave) are positions, so the
 * proxy has to share the target's limb lengths for its hands, and the book
 * riding on its chest, to land where the target's hands are.
 */
export function measureDims(targets: Record<BoneName, THREE.Object3D>, root: THREE.Object3D, base: AvatarDims): AvatarDims {
  const p = (n: BoneName) => rootPos(targets[n], root, new THREE.Vector3());
  const [upperArm, forearm, hand] = [p('upperArmL'), p('forearmL'), p('handL')];
  const [thigh, shin, foot] = [p('thighL'), p('shinL'), p('footL')];
  return {
    ...base,
    pelvisY: p('hips').y,
    waistY: p('spine').y,
    chestY: p('chest').y,
    neckY: p('neck').y,
    headY: p('head').y,
    shoulderX: Math.abs(upperArm.x),
    shoulderY: upperArm.y,
    upperArmLen: upperArm.distanceTo(forearm),
    forearmLen: forearm.distanceTo(hand),
    hipJointX: Math.abs(thigh.x),
    hipJointY: thigh.y,
    thighLen: thigh.distanceTo(shin),
    shinLen: shin.distanceTo(foot),
    ankleY: foot.y,
  };
}

interface Driven {
  proxy: THREE.Bone;
  target: THREE.Object3D;
  /** Proxy bind rotation, inverted (relative to the shared root). */
  proxyBindInv: THREE.Quaternion;
  /** Target bind rotation with the pose correction applied. */
  targetBind: THREE.Quaternion;
}

/**
 * Copies the procedural animator's pose (on the 17-bone proxy rig, see
 * avatar/rig.ts) onto an imported skeleton whose bone axes, extra bones
 * (clavicles, extra spine joints, fingers) and bind pose all differ.
 *
 * Each driven bone takes the proxy's rotation change since bind, in the
 * frame of the common ancestor `root`. A per-bone correction first rotates
 * the target's bind pose so each bone points the same way as the proxy's
 * (a T-pose import is aimed into the proxy's A-pose), so animator rotations
 * mean the same thing on both rigs. Twist about the bone is left as bound.
 *
 * Both rigs must be in bind pose, under `root`, when this is constructed.
 */
export class Retargeter {
  private driven: Driven[] = [];
  private hips?: { proxyBind: THREE.Vector3; target: THREE.Object3D; targetBind: THREE.Vector3 };
  private proxy: AvatarRig;
  private root: THREE.Object3D;

  constructor(proxy: AvatarRig, root: THREE.Object3D, targets: Partial<Record<BoneName, THREE.Object3D>>) {
    this.proxy = proxy;
    this.root = root;
    const corrections = new Map<BoneName, THREE.Quaternion>();
    for (const name of BONE_NAMES) {
      const t = targets[name];
      if (!t) continue;
      const c = new THREE.Quaternion();
      const child = AIM_CHILD[name];
      const tChild = child && targets[child];
      if (child && tChild) {
        const dP = rootPos(proxy.bones[child], root, new THREE.Vector3()).sub(rootPos(proxy.bones[name], root, _v)).normalize();
        const dT = rootPos(tChild, root, new THREE.Vector3()).sub(rootPos(t, root, _v)).normalize();
        c.setFromUnitVectors(dT, dP);
      } else if (PARENT[name] && corrections.has(PARENT[name]!)) {
        c.copy(corrections.get(PARENT[name]!)!);
      }
      corrections.set(name, c);
      const targetBind = rootQuat(t, root, new THREE.Quaternion()).premultiply(c);
      this.driven.push({
        proxy: proxy.bones[name],
        target: t,
        proxyBindInv: rootQuat(proxy.bones[name], root, new THREE.Quaternion()).invert(),
        targetBind,
      });
    }
    this.driven.sort((a, b) => depth(a.target) - depth(b.target));
    if (targets.hips) {
      this.hips = {
        proxyBind: rootPos(proxy.bones.hips, root, new THREE.Vector3()),
        target: targets.hips,
        targetBind: targets.hips.position.clone(),
      };
    }
  }

  /** Poses the target skeleton from the proxy's current pose. */
  apply() {
    for (const d of this.driven) {
      // World (root-relative) target rotation = proxy delta since bind * corrected bind.
      rootQuat(d.proxy, this.root, _q).multiply(d.proxyBindInv).multiply(d.targetBind);
      // Local = parent^-1 * world.
      rootQuat(d.target.parent, this.root, _q2).invert();
      d.target.quaternion.copy(_q2.multiply(_q));
    }
    if (this.hips) {
      // Hip sway: the proxy's hip translation, carried into the target's parent space.
      const h = this.hips;
      const offset = rootPos(this.proxy.bones.hips, this.root, _v).sub(h.proxyBind);
      rootQuat(h.target.parent, this.root, _q2).invert();
      offset.applyQuaternion(_q2).divideScalar(rootScale(h.target.parent, this.root));
      h.target.position.copy(_v2.copy(h.targetBind).add(offset));
    }
  }
}
