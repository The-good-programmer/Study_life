import * as THREE from 'three';
import type { CharacterPose } from '../../../../types/character';
import { BONE_NAMES, type BoneMap, type BoneName } from './rig';
import { LID_CLOSED } from './face';
import { solveTwoBoneIK, handOrientation } from './ik';

type Side = 'L' | 'R';

/** How a hand is held, for rigs with finger bones (see v2/retarget.ts). */
export interface HandPose {
  /** Finger flexion: 0 = as modelled, 1 = a loose fist (negative straightens). */
  curl: number;
  /** Fingers fanned apart, 0..1. */
  spread: number;
  /** Thumb from out to the side (0) to across the palm (1). */
  thumb: number;
}

const HANDS = {
  relaxed: { curl: 0.3, spread: 0.08, thumb: 0.45 },
  open: { curl: -0.1, spread: 0.7, thumb: 0.1 },
  loose: { curl: 0.6, spread: 0.05, thumb: 0.6 },
  book: { curl: 0.4, spread: 0.1, thumb: 0.15 },
} as const satisfies Record<string, HandPose>;

/**
 * How far the eyes turn (radians) before the head has to: sideways, up and
 * down. About how far the shipped v2 eye shapes turn at full weight (see
 * gazeWeights in v2/expressions.ts); v1's eyeballs use the same limits.
 */
export const EYE_RANGE = { side: 0.5, up: 0.25, down: 0.4 };

/** One frame of a pose. Preallocated: poseTargets fills it in place. */
export interface PoseFrame {
  /** Joint rotations (Euler XYZ, radians) relative to the parent; 0 = straight stance, arms down. */
  rot: Record<BoneName, THREE.Vector3>;
  bounce: number;
  hipShift: number;
  /** The pose holds the open book. */
  book: boolean;
  hands: Record<Side, Readonly<HandPose>>;
}

export function createPoseFrame(): PoseFrame {
  const rot = {} as Record<BoneName, THREE.Vector3>;
  for (const n of BONE_NAMES) rot[n] = new THREE.Vector3();
  return { rot, bounce: 0, hipShift: 0, book: false, hands: { L: HANDS.relaxed, R: HANDS.relaxed } };
}

/**
 * Fills `out` with the pose at time t: joint rotations for bones not driven
 * by IK (0 everywhere is a straight stance with the arms hanging down; left
 * = +X, so +Z swings the left arm outward and -Z the right arm), plus hops,
 * hip shift, the book and the hands.
 */
export function poseTargets(pose: CharacterPose, t: number, out: PoseFrame): PoseFrame {
  const r = out.rot;
  for (const n of BONE_NAMES) r[n].set(0, 0, 0);
  out.bounce = 0;
  out.hipShift = 0;
  out.book = false;
  out.hands.L = HANDS.relaxed;
  out.hands.R = HANDS.relaxed;
  const breath = Math.sin(t * 1.7);
  switch (pose) {
    case 'study':
    case 'read':
      r.spine.set(0.05, 0, 0);
      r.chest.set(0.04 + breath * 0.008, 0, 0);
      r.neck.set(0.12, 0, 0);
      r.head.set(0.24, Math.sin(t * 0.6) * 0.04, Math.sin(t * 0.8) * 0.015);
      out.book = true;
      out.hands.L = HANDS.book;
      out.hands.R = HANDS.book;
      break;
    case 'wave':
      out.hipShift = 0.008;
      r.hips.set(0, 0, 0.025);
      r.thighL.set(0, 0, -0.025);
      r.thighR.set(0, 0, -0.025);
      r.spine.set(0, 0, -0.02);
      r.chest.set(breath * 0.01, 0, -0.03);
      r.neck.set(0, 0, -0.03);
      r.head.set(-0.04, -0.14, -0.1);
      r.upperArmL.set(0.03, 0, 0.1);
      r.forearmL.set(-0.14, 0, 0);
      r.handL.set(-0.05, 0, -0.06);
      out.hands.R = HANDS.open;
      break;
    case 'cheer': {
      const hop = Math.abs(Math.sin(t * 4.2));
      out.bounce = hop * 0.045;
      r.spine.set(-0.06, 0, 0);
      r.chest.set(-0.06, 0, 0);
      r.neck.set(-0.06, 0, 0);
      r.head.set(-0.2, 0, Math.sin(t * 4.2) * 0.05);
      r.thighL.set(-hop * 0.08, 0, 0.04);
      r.thighR.set(-hop * 0.08, 0, -0.04);
      r.shinL.set(hop * 0.16, 0, 0);
      r.shinR.set(hop * 0.16, 0, 0);
      r.footL.set(-hop * 0.08, 0, 0);
      r.footR.set(-hop * 0.08, 0, 0);
      out.hands.L = HANDS.loose;
      out.hands.R = HANDS.loose;
      break;
    }
    case 'idle':
    default: {
      const sway = Math.sin(t * 1.05);
      out.hipShift = sway * 0.007;
      r.hips.set(0, 0, sway * 0.014);
      r.thighL.set(0, 0, -sway * 0.014);
      r.thighR.set(0, 0, -sway * 0.014);
      r.spine.set(0.01, 0, -sway * 0.008);
      r.chest.set(breath * 0.012, 0, -sway * 0.006);
      r.neck.set(0.02, 0, 0);
      r.head.set(Math.sin(t * 0.55) * 0.02, Math.sin(t * 0.4) * 0.06, sway * 0.01);
      r.upperArmL.set(0.03 + Math.sin(t * 1.3) * 0.015, 0, 0.1 + breath * 0.008);
      r.upperArmR.set(0.03 + Math.sin(t * 1.3 + 0.4) * 0.015, 0, -0.1 - breath * 0.008);
      r.forearmL.set(-0.16, 0, 0);
      r.forearmR.set(-0.16, 0, 0);
      r.handL.set(-0.05, 0, -0.06);
      r.handR.set(-0.05, 0, 0.06);
    }
  }
  return out;
}

/** An IK goal for one arm, in the chest bone's local space. */
interface ArmGoal {
  target: THREE.Vector3; // wrist position
  pole: THREE.Vector3; // the elbow bends toward this point
  fingers: THREE.Vector3; // direction the fingers point
  palm: THREE.Vector3; // direction the palm faces
}

/**
 * Fills `out` with the arm goal for poses where the hands interact with
 * something; false for the others. `side` is +1 for the left arm. Positions
 * are in chest space, mostly relative to the shoulder.
 */
function armGoal(pose: CharacterPose, side: 1 | -1, t: number, shoulder: THREE.Vector3, out: ArmGoal): boolean {
  switch (pose) {
    case 'study':
    case 'read':
      // Cradle the open book (held on the chest bone) from underneath.
      out.target.set(side * 0.108, -0.092, 0.19);
      out.pole.set(side * 0.3, -0.35, -0.2).add(shoulder);
      out.fingers.set(-side * 0.45, 0.12, 1);
      out.palm.set(-side * 0.25, 1, -0.15);
      return true;
    case 'wave': {
      if (side === 1) return false;
      const sweep = Math.sin(t * 7) * 0.045;
      out.target.set(-0.2 + sweep, 0.2, 0.09).add(shoulder);
      out.pole.set(-0.35, -0.3, -0.15).add(shoulder);
      out.fingers.set(-0.15 + sweep * 2, 1, 0.1);
      out.palm.set(0, 0.1, 1);
      return true;
    }
    case 'cheer': {
      const hop = Math.abs(Math.sin(t * 4.2));
      out.target.set(side * 0.14, 0.4 + hop * 0.02, 0.05).add(shoulder);
      out.pole.set(side * 0.45, 0.05, -0.3).add(shoulder);
      out.fingers.set(side * 0.15, 1, 0.1);
      out.palm.set(-side, 0, 0.6);
      return true;
    }
    default:
      return false;
  }
}

export interface AnimatorTargets {
  bones: BoneMap;
  bodyGroup: THREE.Object3D;
  lids: THREE.Object3D[];
  /** Eyeballs (left, right) rotated to look around; none for eyes posed by blend shapes. */
  eyeballs: THREE.Object3D[];
  restLid: number;
  book: THREE.Object3D;
  restHipsX: number;
  upperArmLen: number;
  forearmLen: number;
  /** Ponytail pivot, swung by a damped spring (secondary motion). */
  ponytail?: THREE.Object3D | null;
  /** Eye centres (left, right) in the head bone's frame, when there are no eyeballs to measure. */
  eyeCentres?: readonly THREE.Vector3[] | null;
  /**
   * For a skeleton with clavicles (v2): each clavicle's pivot and the
   * shoulder's rest position, in the chest's frame. The shoulder then rises
   * with the arm, and the retargeter turns the clavicle to follow it.
   */
  clavicles?: Readonly<Record<Side, { pivot: THREE.Vector3; rest: THREE.Vector3 }>> | null;
}

const ARMS = [
  { side: 1, s: 'L', upper: 'upperArmL', fore: 'forearmL', hand: 'handL' },
  { side: -1, s: 'R', upper: 'upperArmR', fore: 'forearmR', hand: 'handR' },
] as const;
const SIDES = ['L', 'R'] as const;
const BONE_INDEX = Object.fromEntries(BONE_NAMES.map((n, i) => [n, i])) as Record<BoneName, number>;
/** Where eyes sit (head frame) when a rig has neither eyeballs nor measured centres. */
const DEFAULT_EYES = [new THREE.Vector3(0.032, 0.05, 0.09), new THREE.Vector3(-0.032, 0.05, 0.09)];
/** Share of the upper arm's swing the clavicle takes once the arm is raised. */
const SHRUG = 0.13;
const READ_COLS = 4;
const READ_LINES = 6;

const smoothstep = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const _euler = new THREE.Euler();
const _lookEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _qUpper = new THREE.Quaternion();
const _qFore = new THREE.Quaternion();
const _qHand = new THREE.Quaternion();
const _qArm = new THREE.Quaternion();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _fix = new THREE.Vector3();

/**
 * Procedural animation for the 17-bone rig (avatar/rig.ts): poses with IK
 * arms, breathing and sway, a look-at where the eyes lead and the head
 * follows, saccades, blinks, the ponytail spring and, for rigs with fingers,
 * eased hand shapes. The eased pose lives here rather than in the bones, so
 * a rebuilt rig carries on from the same pose (see restore). Nothing is
 * allocated per frame.
 */
export class AvatarAnimator {
  private time = Math.random() * 10;
  /** False until the first update, which snaps to the pose so a new avatar appears posed. */
  private started = false;
  private frame = createPoseFrame();
  private goal: ArmGoal = { target: new THREE.Vector3(), pole: new THREE.Vector3(), fingers: new THREE.Vector3(), palm: new THREE.Vector3() };
  private targets = BONE_NAMES.map(() => new THREE.Quaternion());
  private current = BONE_NAMES.map(() => new THREE.Quaternion());
  private hipShift = 0;
  private bounce = 0;
  /** How far the book is in hand, 0..1 (it scales with this). */
  private book = 0;
  private headYaw = 0;
  private headPitch = 0;
  private saccade = new THREE.Vector2();
  private saccadeTimer = 0;
  private saccadeMode = -1;
  private readStep = 0;
  private readTimer = 0;
  private blinkTimer = 0;
  private nextBlink = 2 + Math.random() * 2;
  private blinkPhase = -1; // -1 = not blinking, else 0..1
  private tail = { x: 0, z: 0, vx: 0, vz: 0 };
  private lastHead = new THREE.Euler();
  private lastBodyY = 0;

  /** Each eye's rotation relative to the head, radians: yaw toward the avatar's left (+X), pitch downward. */
  readonly gaze = { yawL: 0, yawR: 0, pitch: 0 };
  /** The eased hand shapes, for rigs with finger bones. */
  readonly hands: Record<Side, HandPose> = { L: { ...HANDS.relaxed }, R: { ...HANDS.relaxed } };

  update(dt: number, pose: CharacterPose, a: AnimatorTargets, look?: THREE.Vector3 | null) {
    const step = Math.min(dt, 0.05);
    this.time += step;
    const f = poseTargets(pose, this.time, this.frame);

    // Forward-kinematics targets from the pose table.
    for (let i = 0; i < BONE_NAMES.length; i++) {
      const r = f.rot[BONE_NAMES[i]];
      this.targets[i].setFromEuler(_euler.set(r.x, r.y, r.z));
    }

    // IK overrides for the arms (computed in chest space).
    for (const arm of ARMS) {
      const shoulder = a.bones[arm.upper].position;
      if (!armGoal(pose, arm.side, this.time, shoulder, this.goal)) continue;
      solveTwoBoneIK(shoulder, this.goal.target, this.goal.pole, a.upperArmLen, a.forearmLen, _qUpper, _qFore);
      this.targets[BONE_INDEX[arm.upper]].copy(_qUpper);
      this.targets[BONE_INDEX[arm.fore]].copy(_qFore);
      handOrientation(this.goal.fingers, this.goal.palm, arm.side, _qHand);
      // Hand local = (upper * forearm)^-1 * hand-in-chest.
      _qArm.copy(_qUpper).multiply(_qFore).invert();
      this.targets[BONE_INDEX[arm.hand]].copy(_qArm.multiply(_qHand));
    }

    // Ease toward the targets (the first frame snaps).
    const k = this.started ? 1 - Math.exp(-9 * step) : 1;
    for (let i = 0; i < BONE_NAMES.length; i++) this.current[i].slerp(this.targets[i], k);
    this.hipShift += (f.hipShift - this.hipShift) * k;
    this.bounce = this.started ? THREE.MathUtils.damp(this.bounce, f.bounce, 14, step) : f.bounce;
    for (const s of SIDES) {
      const h = this.hands[s];
      const want = f.hands[s];
      h.curl += (want.curl - h.curl) * k;
      h.spread += (want.spread - h.spread) * k;
      h.thumb += (want.thumb - h.thumb) * k;
    }
    // The book grows into the hands as the arms arrive and shrinks as they
    // leave; a linear ramp ends exactly instead of trailing off.
    this.book = THREE.MathUtils.clamp(this.book + (f.book ? step / 0.3 : -step / 0.2), 0, 1);

    this.writePose(a);
    this.look(pose, a, look ?? null, step);
    this.blink(a, step);
    this.swingPonytail(a, step);
    this.started = true;
  }

  /**
   * Writes the current pose into a rig without advancing time, e.g. into a
   * proxy rig rebuilt for a new body shape, so it carries on instead of
   * starting from its bind pose. Does nothing before the first update.
   */
  restore(a: AnimatorTargets) {
    if (!this.started) return;
    this.writePose(a);
    a.bones.head.quaternion.premultiply(_q.setFromEuler(_lookEuler.set(this.headPitch, this.headYaw, 0)));
  }

  /** The eased pose into the rig: bones, hips, hop, shoulders and the book. */
  private writePose(a: AnimatorTargets) {
    for (let i = 0; i < BONE_NAMES.length; i++) a.bones[BONE_NAMES[i]].quaternion.copy(this.current[i]);
    a.bones.hips.position.x = a.restHipsX + this.hipShift;
    a.bodyGroup.position.y = this.bounce;
    if (a.clavicles) for (const arm of ARMS) this.shrug(a, arm);
    // Scale the book about its own centre (its first child is the prop).
    const prop = a.book.children[0] ?? a.book;
    prop.scale.setScalar(Math.max(smoothstep(0, 1, this.book), 1e-3));
    a.book.visible = this.book > 0;
  }

  /** Raises the shoulder about the clavicle's pivot as the arm lifts past shoulder height. */
  private shrug(a: AnimatorTargets, arm: (typeof ARMS)[number]) {
    const c = a.clavicles![arm.s];
    const upper = a.bones[arm.upper];
    upper.position.copy(c.rest);
    // The upper arm's direction in the chest frame: it hangs along -Y at rest.
    _dir.set(0, -1, 0).applyQuaternion(upper.quaternion);
    const elevation = Math.acos(THREE.MathUtils.clamp(-_dir.y, -1, 1));
    const share = SHRUG * smoothstep(0.7, 2.6, elevation);
    if (share <= 0) return;
    _axis.set(0, -1, 0).cross(_dir);
    if (_axis.lengthSq() < 1e-8) _axis.set(0, 0, arm.side); // straight up: a sideways raise
    _q.setFromAxisAngle(_axis.normalize(), share * elevation);
    upper.position.sub(c.pivot).applyQuaternion(_q).add(c.pivot);
  }

  /**
   * Turns the head toward the look target (time-based, within limits; not
   * while reading), then aims the eyes: at the book while reading, at the
   * look target, or level with the horizon, plus small saccades. The eyes
   * move fast and the head follows slowly, so the eyes lead.
   */
  private look(pose: CharacterPose, a: AnimatorTargets, look: THREE.Vector3 | null, step: number) {
    const first = !this.started;
    const reading = (pose === 'study' || pose === 'read') && this.book > 0;
    const head = a.bones.head;
    let wantYaw = 0;
    let wantPitch = 0;
    if (look && !reading) {
      a.bones.neck.getWorldQuaternion(_q).invert();
      _dir.copy(look).sub(head.getWorldPosition(_v)).applyQuaternion(_q);
      wantYaw = THREE.MathUtils.clamp(Math.atan2(_dir.x, _dir.z) * 0.6, -0.75, 0.75);
      wantPitch = THREE.MathUtils.clamp(Math.atan2(-_dir.y, Math.hypot(_dir.x, _dir.z)) * 0.5, -0.3, 0.35);
    }
    this.headYaw = first ? wantYaw : THREE.MathUtils.damp(this.headYaw, wantYaw, 4, step);
    this.headPitch = first ? wantPitch : THREE.MathUtils.damp(this.headPitch, wantPitch, 4, step);
    head.quaternion.premultiply(_q.setFromEuler(_lookEuler.set(this.headPitch, this.headYaw, 0)));

    const fix = reading ? this.readingPoint(a.book, step, _fix) : look;
    this.pickSaccade(step, reading ? 2 : fix ? 1 : 0);
    head.getWorldQuaternion(_q);
    let yawL = 0;
    let yawR = 0;
    let pitch = 0;
    if (fix) {
      _q.invert();
      for (let i = 0; i < 2; i++) {
        _dir.copy(fix).sub(this.eyePosition(a, i, _v)).applyQuaternion(_q);
        const yaw = Math.atan2(_dir.x, _dir.z);
        if (i === 0) yawL = yaw;
        else yawR = yaw;
        pitch += Math.atan2(-_dir.y, Math.hypot(_dir.x, _dir.z)) / 2;
      }
    } else {
      // Level gaze: the eyes hold the horizon as the head nods (part of the way).
      _dir.set(0, 0, 1).applyQuaternion(_q);
      pitch = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(_dir.y, -1, 1)) * 0.7, -0.12, 0.12);
    }
    const g = this.gaze;
    const { side, up, down } = EYE_RANGE;
    const ek = first ? 1 : 1 - Math.exp(-25 * step);
    g.yawL += (THREE.MathUtils.clamp(yawL + this.saccade.x, -side, side) - g.yawL) * ek;
    g.yawR += (THREE.MathUtils.clamp(yawR + this.saccade.x, -side, side) - g.yawR) * ek;
    g.pitch += (THREE.MathUtils.clamp(pitch + this.saccade.y, -up, down) - g.pitch) * ek;
    for (let i = 0; i < a.eyeballs.length; i++) a.eyeballs[i].rotation.set(g.pitch, i === 0 ? g.yawL : g.yawR, 0);
  }

  private eyePosition(a: AnimatorTargets, i: number, out: THREE.Vector3) {
    if (a.eyeballs.length === 2) return a.eyeballs[i].getWorldPosition(out);
    return a.bones.head.localToWorld(out.copy(a.eyeCentres?.[i] ?? DEFAULT_EYES[i]));
  }

  /** Where the eyes rest on the open book: fixations along each line, the left page first. */
  private readingPoint(book: THREE.Object3D, step: number, out: THREE.Vector3) {
    this.readTimer -= step;
    if (this.readTimer <= 0) {
      this.readStep = (this.readStep + 1) % (READ_COLS * READ_LINES * 2);
      // Fixations last about a quarter of a second; the sweep to a new line a little longer.
      this.readTimer = (this.readStep % READ_COLS === 0 ? 0.4 : 0.2) + Math.random() * 0.12;
    }
    const col = this.readStep % READ_COLS;
    const line = Math.floor(this.readStep / READ_COLS) % READ_LINES;
    // +X is the reader's left: the left page spans x 0.095..0.025, the right -0.025..-0.095.
    const x0 = this.readStep < READ_COLS * READ_LINES ? 0.095 : -0.025;
    const x = x0 - (col / (READ_COLS - 1)) * 0.07;
    const z = 0.045 - (line / (READ_LINES - 1)) * 0.09;
    return (book.children[0] ?? book).localToWorld(out.set(x, 0.012, z));
  }

  /** Saccades: wandering glances when idle (mode 0), tiny ones while fixating (1), none while reading (2). */
  private pickSaccade(step: number, mode: number) {
    this.saccadeTimer -= step;
    if (this.saccadeTimer > 0 && mode === this.saccadeMode) return;
    this.saccadeMode = mode;
    if (mode === 2) {
      this.saccade.set(0, 0);
      this.saccadeTimer = 1;
    } else if (mode === 1) {
      this.saccade.set((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.025);
      this.saccadeTimer = 0.8 + Math.random() * 1.7;
    } else {
      this.saccade.set((Math.random() - 0.5) * 0.26, (Math.random() - 0.5) * 0.1);
      this.saccadeTimer = 1.2 + Math.random() * 2.8;
    }
  }

  /** Blinks (rigs with lid objects): quick close, slightly slower open; the lids droop when looking down. */
  private blink(a: AnimatorTargets, step: number) {
    this.blinkTimer += step;
    if (this.blinkPhase < 0 && this.blinkTimer > this.nextBlink) {
      this.blinkPhase = 0;
      this.blinkTimer = 0;
      this.nextBlink = 2.2 + Math.random() * 3.5;
    }
    const droop = 0.3 * THREE.MathUtils.clamp(this.gaze.pitch / EYE_RANGE.down, 0, 1);
    let lid = a.restLid + (1 - a.restLid) * droop;
    if (this.blinkPhase >= 0) {
      this.blinkPhase += step / 0.17;
      const p = this.blinkPhase;
      const closed = p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6;
      lid += (1 - lid) * Math.max(0, closed);
      if (this.blinkPhase >= 1) this.blinkPhase = -1;
    }
    for (const l of a.lids) l.rotation.x = lid * LID_CLOSED;
  }

  /** Ponytail: a damped spring that lags behind head turns and hops. */
  private swingPonytail(a: AnimatorTargets, step: number) {
    if (!a.ponytail) return;
    const head = a.bones.head.rotation;
    const pitchRate = (head.x - this.lastHead.x) / step;
    const yawRate = (head.y - this.lastHead.y) / step;
    const lift = (a.bodyGroup.position.y - this.lastBodyY) / step;
    this.lastHead.copy(head);
    this.lastBodyY = a.bodyGroup.position.y;
    const targetX = 0.05 * Math.sin(this.time * 1.3) + THREE.MathUtils.clamp(-pitchRate * 0.12 + lift * 1.5, -0.5, 0.5);
    const targetZ = 0.04 * Math.sin(this.time * 0.9) + THREE.MathUtils.clamp(yawRate * 0.22, -0.5, 0.5);
    const t = this.tail;
    t.vx += ((targetX - t.x) * 70 - t.vx * 9) * step;
    t.vz += ((targetZ - t.z) * 70 - t.vz * 9) * step;
    t.x += t.vx * step;
    t.z += t.vz * step;
    a.ponytail.rotation.set(t.x, 0, t.z);
  }
}
