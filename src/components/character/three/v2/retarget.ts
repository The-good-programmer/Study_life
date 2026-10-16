import * as THREE from 'three';
import type { AvatarDims } from '../avatar/anatomy';
import type { HandPose } from '../avatar/animator';
import { BONE_NAMES, type AvatarRig, type BoneName } from '../avatar/rig';

/**
 * Limb bones whose bind pose is aimed along the proxy's (by the child they
 * point at). The spine, neck and head are not: the proxy copies those joints
 * from the target (measureJoints), so the model keeps its natural spine curve
 * and forward neck rather than being straightened, which tipped the head back.
 */
const AIM_CHILD: Partial<Record<BoneName, BoneName>> = {
  upperArmL: 'forearmL', forearmL: 'handL', upperArmR: 'forearmR', forearmR: 'handR',
  thighL: 'shinL', shinL: 'footL', thighR: 'shinR', shinR: 'footR',
};
/** Leaves reuse their parent's correction. */
const PARENT: Partial<Record<BoneName, BoneName>> = { handL: 'forearmL', handR: 'forearmR', footL: 'shinL', footR: 'shinR' };
/** Joints the proxy takes from the target as they are (see buildRig). */
const JOINTS: BoneName[] = ['hips', 'spine', 'chest', 'neck', 'head', 'upperArmL', 'upperArmR', 'thighL', 'thighR'];
const ARMS = [
  { s: 'L', side: 1, upper: 'upperArmL', fore: 'forearmL', hand: 'handL' },
  { s: 'R', side: -1, upper: 'upperArmR', fore: 'forearmR', hand: 'handR' },
] as const;

// Finger flexion at a loose fist (curl 1) for the base, middle and tip joints.
const CURL = [1.2, 1.5, 1.0];
// Each finger's share, index to little: the little finger curls most.
const CURL_FROM = 0.85;
const CURL_TO = 1.15;
const SPREAD = 0.2;

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();

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

const isBone = (o: THREE.Object3D): o is THREE.Bone => (o as THREE.Bone).isBone === true;

/**
 * Rotation taking the frame (dir, ref) onto (toDir, toRef): the directions
 * match exactly and the references as nearly as they can. Without a usable
 * reference it is the shortest swing (twist left as bound).
 */
function frameCorrection(dir: THREE.Vector3, ref: THREE.Vector3 | null, toDir: THREE.Vector3, toRef: THREE.Vector3 | null, out: THREE.Quaternion) {
  const basis = (d: THREE.Vector3, r: THREE.Vector3, m: THREE.Matrix4) => {
    _x.copy(d).normalize();
    _z.copy(r).addScaledVector(_x, -r.dot(_x));
    if (_z.lengthSq() < 1e-6) return false;
    _z.normalize();
    _y.crossVectors(_z, _x);
    m.makeBasis(_x, _y, _z);
    return true;
  };
  if (!ref || !toRef || !basis(dir, ref, _m) || !basis(toDir, toRef, _m2)) {
    return out.setFromUnitVectors(_v.copy(dir).normalize(), _v2.copy(toDir).normalize());
  }
  return out.setFromRotationMatrix(_m2.multiply(_m.transpose()));
}

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

/**
 * The target's spine, neck, head, shoulder and hip joints (relative to root,
 * at rest), for buildRig: a proxy built on them bends about the same joints,
 * so the two rigs agree on where the head, shoulders and hands are.
 */
export function measureJoints(targets: Record<BoneName, THREE.Object3D>, root: THREE.Object3D) {
  const out: Partial<Record<BoneName, THREE.Vector3>> = {};
  for (const n of JOINTS) out[n] = rootPos(targets[n], root, new THREE.Vector3());
  return out;
}

/** A finger (or thumb) of the target: its bones, bind rotations and bend axes in each bone's own frame. */
interface Digit {
  bones: THREE.Object3D[];
  bind: THREE.Quaternion[];
  curl: THREE.Vector3[];
  spread: THREE.Vector3 | null;
  spreadShare: number;
  share: number;
  thumb: boolean;
}

/**
 * Finds a hand's fingers by shape, not by name: the thumb's base sits
 * nearest the wrist, and the others run outward from the thumb. The palm
 * faces the side the fingers curl toward; every bend axis comes from the
 * bind pose, so mirrored hands and moved joints need no special cases.
 */
function rigHand(hand: THREE.Object3D, side: 1 | -1, root: THREE.Object3D) {
  const chains = hand.children.filter(isBone).map((first) => {
    const bones: THREE.Object3D[] = [];
    for (let b: THREE.Object3D | undefined = first; b; b = b.children.find(isBone)) bones.push(b);
    return bones;
  });
  if (chains.length < 3) return null;
  const pos = (o: THREE.Object3D) => rootPos(o, root, new THREE.Vector3());
  const wrist = pos(hand);
  const bases = chains.map((c) => pos(c[0]));
  let thumb = 0;
  bases.forEach((b, i) => {
    if (b.distanceTo(wrist) < bases[thumb].distanceTo(wrist)) thumb = i;
  });
  const fingers = chains.map((_, i) => i).filter((i) => i !== thumb)
    .sort((a, b) => bases[a].distanceTo(bases[thumb]) - bases[b].distanceTo(bases[thumb]));
  const index = bases[fingers[0]];
  const little = bases[fingers[fingers.length - 1]];
  const knuckles = fingers.reduce((sum, i) => sum.add(bases[i]), new THREE.Vector3()).divideScalar(fingers.length);
  const along = knuckles.clone().sub(wrist).normalize();
  const palm = along.clone().cross(index.clone().sub(little)).multiplyScalar(side).normalize();
  // The thumb folds across the palm toward the little finger's side.
  const across = wrist.clone().lerp(little, 0.6);
  const halfWidth = index.distanceTo(little) / 2;

  const digit = (bones: THREE.Object3D[], isThumb: boolean, order: number): Digit => {
    const joints = bones.map(pos);
    const curl: THREE.Vector3[] = [];
    let dir = new THREE.Vector3();
    bones.forEach((b, j) => {
      if (j + 1 < joints.length) dir = joints[j + 1].clone().sub(joints[j]);
      const toward = isThumb ? across.clone().sub(joints[j]) : palm;
      const axis = dir.clone().cross(toward).normalize();
      curl.push(axis.applyQuaternion(rootQuat(b, root, new THREE.Quaternion()).invert()));
    });
    let spread: THREE.Vector3 | null = null;
    let spreadShare = 0;
    if (!isThumb && joints.length > 1) {
      const away = joints[0].clone().sub(knuckles);
      away.addScaledVector(palm, -away.dot(palm));
      spreadShare = Math.min(away.length() / halfWidth, 1.3);
      const axis = joints[1].clone().sub(joints[0]).cross(away);
      if (axis.lengthSq() > 1e-10) spread = axis.normalize().applyQuaternion(rootQuat(bones[0], root, new THREE.Quaternion()).invert());
    }
    const share = fingers.length > 1 ? CURL_FROM + ((CURL_TO - CURL_FROM) * order) / (fingers.length - 1) : 1;
    return { bones, bind: bones.map((b) => b.quaternion.clone()), curl, spread, spreadShare, share, thumb: isThumb };
  };
  const digits = [digit(chains[thumb], true, 0), ...fingers.map((i, order) => digit(chains[i], false, order))];
  return { digits, palm };
}

/** Bends a hand's fingers into a shape (see HandPose); 0 everywhere is the bind pose. */
function poseHand(digits: Digit[], h: HandPose) {
  for (const d of digits) {
    for (let j = 0; j < d.bones.length; j++) {
      // Thumb: the base swings across the palm, the outer joints flex.
      const angle = d.thumb
        ? j === 0 ? (h.thumb - 0.35) * 0.8 : h.thumb * (j === 1 ? 0.45 : 0.6) + h.curl * 0.15
        : h.curl * CURL[Math.min(j, CURL.length - 1)] * d.share;
      const q = d.bones[j].quaternion.copy(d.bind[j]);
      if (j === 0 && d.spread) q.multiply(_q.setFromAxisAngle(d.spread, h.spread * SPREAD * d.spreadShare));
      q.multiply(_q.setFromAxisAngle(d.curl[j], angle));
    }
  }
}

type Step =
  /** World = proxy rotation since bind, times the corrected target bind. */
  | { kind: 'copy'; target: THREE.Object3D; proxy: THREE.Object3D; proxyBindInv: THREE.Quaternion; targetBind: THREE.Quaternion }
  /** An extra spine bone between two driven ones takes a blend of their rotations. */
  | { kind: 'blend'; target: THREE.Object3D; lower: THREE.Object3D; upper: THREE.Object3D; lowerBindInv: THREE.Quaternion; upperBindInv: THREE.Quaternion; t: number; targetBind: THREE.Quaternion }
  /** A clavicle turns so its shoulder joint lands on the proxy's shoulder. */
  | { kind: 'clavicle'; target: THREE.Object3D; shoulder: THREE.Object3D; bindLocal: THREE.Quaternion; offset: THREE.Vector3 };

/**
 * Copies the procedural animator's pose (on the 17-bone proxy rig, see
 * avatar/rig.ts) onto an imported skeleton whose bone axes, extra bones
 * (clavicles, extra spine joints, fingers) and bind pose all differ.
 *
 * Each driven bone takes the proxy's rotation change since bind, in the
 * frame of the common ancestor `root`. Limbs are first corrected so each
 * points the way the proxy's does (a T-pose import is aimed into the proxy's
 * A-pose); the arms also match the proxy's elbow plane and palm, so poses
 * bend the elbow and turn the hand the intended way. The spine column keeps
 * the model's own curve. The extra bones follow: spine_02 takes half of the
 * chest's bend, the clavicles follow the proxy's shoulders (they rise with
 * the arms, see AnimatorTargets.clavicles), and the fingers take the
 * animator's hand shapes.
 *
 * Both rigs must be in bind pose, under `root`, when this is constructed,
 * with the proxy built on measureJoints (its joints where the target's are).
 */
export class Retargeter {
  private steps: Step[] = [];
  private hips?: { proxyBind: THREE.Vector3; target: THREE.Object3D; targetBind: THREE.Vector3 };
  private hands: Partial<Record<'L' | 'R', Digit[]>> = {};
  private proxy: AvatarRig;
  private root: THREE.Object3D;
  /** Each clavicle's pivot and the rest shoulder in the proxy chest's frame (see AnimatorTargets.clavicles). */
  readonly clavicles: Record<'L' | 'R', { pivot: THREE.Vector3; rest: THREE.Vector3 }> | null = null;

  constructor(proxy: AvatarRig, root: THREE.Object3D, targets: Partial<Record<BoneName, THREE.Object3D>>) {
    this.proxy = proxy;
    this.root = root;
    const rq = (o: THREE.Object3D) => rootQuat(o, root, new THREE.Quaternion());
    const rp = (o: THREE.Object3D) => rootPos(o, root, new THREE.Vector3());
    const palms: Partial<Record<'L' | 'R', THREE.Vector3>> = {};
    for (const arm of ARMS) {
      const hand = targets[arm.hand];
      const rig = hand && rigHand(hand, arm.side, root);
      if (!rig) continue;
      this.hands[arm.s] = rig.digits;
      palms[arm.s] = rig.palm;
    }

    const corrections = new Map<BoneName, THREE.Quaternion>();
    const ordered: { depth: number; step: Step }[] = [];
    for (const name of BONE_NAMES) {
      const t = targets[name];
      if (!t) continue;
      const c = new THREE.Quaternion();
      const child = AIM_CHILD[name];
      const tChild = child && targets[child];
      if (child && tChild) {
        const dP = rp(proxy.bones[child]).sub(rp(proxy.bones[name]));
        const dT = rp(tChild).sub(rp(t));
        let refT: THREE.Vector3 | null = null;
        let refP: THREE.Vector3 | null = null;
        const arm = ARMS.find((a) => a.upper === name || a.fore === name);
        if (arm?.upper === name && targets[arm.hand]) {
          // The elbow plane: the proxy's forearm bends toward its upper arm's +Z.
          refT = rp(targets[arm.hand]!).sub(rp(tChild));
          refP = new THREE.Vector3(0, 0, 1).applyQuaternion(rq(proxy.bones[name]));
        } else if (arm?.fore === name && palms[arm.s]) {
          // The palm: the proxy's faces -side * X in its forearm and hand frames.
          refT = palms[arm.s]!;
          refP = new THREE.Vector3(-arm.side, 0, 0).applyQuaternion(rq(proxy.bones[name]));
        }
        frameCorrection(dT, refT, dP, refP, c);
      } else if (PARENT[name] && corrections.has(PARENT[name]!)) {
        c.copy(corrections.get(PARENT[name]!)!);
      }
      corrections.set(name, c);
      ordered.push({
        depth: depth(t),
        step: { kind: 'copy', target: t, proxy: proxy.bones[name], proxyBindInv: rq(proxy.bones[name]).invert(), targetBind: rq(t).premultiply(c) },
      });
    }

    // Extra spine bones between the proxy's spine and chest share the chest's bend.
    const between: THREE.Object3D[] = [];
    for (let o = targets.chest?.parent; o && targets.spine && o !== targets.spine && o !== root; o = o.parent) between.unshift(o);
    if (targets.spine && between[0]?.parent === targets.spine) {
      between.forEach((b, i) => ordered.push({
        depth: depth(b),
        step: {
          kind: 'blend', target: b, lower: proxy.bones.spine, upper: proxy.bones.chest,
          lowerBindInv: rq(proxy.bones.spine).invert(), upperBindInv: rq(proxy.bones.chest).invert(),
          t: (i + 1) / (between.length + 1), targetBind: rq(b),
        },
      }));
    }

    // Clavicles: the bone between the chest (or an extra spine bone) and each upper arm.
    const clavicles: Partial<Record<'L' | 'R', { pivot: THREE.Vector3; rest: THREE.Vector3 }>> = {};
    const chestInv = rq(proxy.bones.chest).invert();
    for (const arm of ARMS) {
      const upper = targets[arm.upper];
      const clavicle = upper?.parent;
      if (!upper || !clavicle || !isBone(clavicle) || clavicle === targets.chest) continue;
      ordered.push({ depth: depth(clavicle), step: { kind: 'clavicle', target: clavicle, shoulder: proxy.bones[arm.upper], bindLocal: clavicle.quaternion.clone(), offset: upper.position.clone() } });
      clavicles[arm.s] = {
        pivot: rp(clavicle).sub(rp(proxy.bones.chest)).applyQuaternion(chestInv),
        rest: proxy.bones[arm.upper].position.clone(),
      };
    }
    if (clavicles.L && clavicles.R) this.clavicles = { L: clavicles.L, R: clavicles.R };

    this.steps = ordered.sort((a, b) => a.depth - b.depth).map((o) => o.step);
    if (targets.hips) {
      this.hips = { proxyBind: rp(proxy.bones.hips), target: targets.hips, targetBind: targets.hips.position.clone() };
    }
  }

  /** Poses the target skeleton from the proxy's current pose, and its fingers from `hands`. */
  apply(hands?: Readonly<Record<'L' | 'R', HandPose>>) {
    const root = this.root;
    for (const s of this.steps) {
      if (s.kind === 'copy') {
        rootQuat(s.proxy, root, _q).multiply(s.proxyBindInv).multiply(s.targetBind);
      } else if (s.kind === 'blend') {
        rootQuat(s.lower, root, _q).multiply(s.lowerBindInv);
        rootQuat(s.upper, root, _q3).multiply(s.upperBindInv);
        _q.slerp(_q3, s.t).multiply(s.targetBind);
      } else {
        // Aim the clavicle (in its bind relation to its parent) at the proxy's shoulder.
        rootQuat(s.target.parent, root, _q).multiply(s.bindLocal);
        _v.copy(s.offset).applyQuaternion(_q).normalize();
        rootPos(s.shoulder, root, _v2).sub(rootPos(s.target, root, _x)).normalize();
        _q.premultiply(_q3.setFromUnitVectors(_v, _v2));
      }
      // Local = parent^-1 * world.
      rootQuat(s.target.parent, root, _q2).invert();
      s.target.quaternion.copy(_q2.multiply(_q));
    }
    if (this.hips) {
      // Hip sway: the proxy's hip translation, carried into the target's parent space.
      const h = this.hips;
      const offset = rootPos(this.proxy.bones.hips, root, _v).sub(h.proxyBind);
      rootQuat(h.target.parent, root, _q2).invert();
      offset.applyQuaternion(_q2).divideScalar(rootScale(h.target.parent, root));
      h.target.position.copy(_v2.copy(h.targetBind).add(offset));
    }
    if (hands) {
      if (this.hands.L) poseHand(this.hands.L, hands.L);
      if (this.hands.R) poseHand(this.hands.R, hands.R);
    }
  }
}
