import * as THREE from 'three';
import type { CharacterPose } from '../../../../types/character';
import type { BoneMap, BoneName } from './rig';
import { LID_CLOSED } from './face';
import { solveTwoBoneIK, handOrientation } from './ik';

type Rot = [number, number, number];
type PoseTable = Partial<Record<BoneName, Rot>> & { bounce?: number; hipShift?: number; book?: boolean };

/**
 * Joint rotations (Euler XYZ, radians) for each pose at time t, for bones not
 * driven by IK. 0 everywhere is a straight stance with the arms hanging down;
 * left = +X, so +Z swings the left arm outward and -Z the right arm.
 */
export function poseTargets(pose: CharacterPose, t: number): PoseTable {
  const breath = Math.sin(t * 1.7);
  switch (pose) {
    case 'study':
    case 'read':
      return {
        spine: [0.05, 0, 0],
        chest: [0.04 + breath * 0.008, 0, 0],
        neck: [0.12, 0, 0],
        head: [0.24, Math.sin(t * 0.6) * 0.04, Math.sin(t * 0.8) * 0.015],
        book: true,
      };
    case 'wave':
      return {
        hipShift: 0.008,
        hips: [0, 0, 0.025],
        thighL: [0, 0, -0.025],
        thighR: [0, 0, -0.025],
        spine: [0, 0, -0.02],
        chest: [breath * 0.01, 0, -0.03],
        neck: [0, 0, -0.03],
        head: [-0.04, -0.14, -0.1],
        upperArmL: [0.03, 0, 0.1],
        forearmL: [-0.14, 0, 0],
        handL: [-0.05, 0, -0.06],
      };
    case 'cheer': {
      const hop = Math.abs(Math.sin(t * 4.2));
      return {
        bounce: hop * 0.045,
        spine: [-0.06, 0, 0],
        chest: [-0.06, 0, 0],
        neck: [-0.06, 0, 0],
        head: [-0.2, 0, Math.sin(t * 4.2) * 0.05],
        thighL: [-hop * 0.08, 0, 0.04],
        thighR: [-hop * 0.08, 0, -0.04],
        shinL: [hop * 0.16, 0, 0],
        shinR: [hop * 0.16, 0, 0],
        footL: [-hop * 0.08, 0, 0],
        footR: [-hop * 0.08, 0, 0],
      };
    }
    case 'idle':
    default: {
      const sway = Math.sin(t * 1.05);
      return {
        hipShift: sway * 0.007,
        hips: [0, 0, sway * 0.014],
        thighL: [0, 0, -sway * 0.014],
        thighR: [0, 0, -sway * 0.014],
        spine: [0.01, 0, -sway * 0.008],
        chest: [breath * 0.012, 0, -sway * 0.006],
        neck: [0.02, 0, 0],
        head: [Math.sin(t * 0.55) * 0.02, Math.sin(t * 0.4) * 0.06, sway * 0.01],
        upperArmL: [0.03 + Math.sin(t * 1.3) * 0.015, 0, 0.1 + breath * 0.008],
        upperArmR: [0.03 + Math.sin(t * 1.3 + 0.4) * 0.015, 0, -0.1 - breath * 0.008],
        forearmL: [-0.16, 0, 0],
        forearmR: [-0.16, 0, 0],
        handL: [-0.05, 0, -0.06],
        handR: [-0.05, 0, 0.06],
      };
    }
  }
}

/** An IK goal for one arm, in the chest bone's local space. */
interface ArmGoal {
  target: THREE.Vector3; // wrist position
  pole: THREE.Vector3; // the elbow bends toward this point
  fingers: THREE.Vector3; // direction the fingers point
  palm: THREE.Vector3; // direction the palm faces
}

/**
 * Arm goals for poses where the hands interact with something. `side` is +1
 * for the left arm. Positions are relative to the shoulder (chest space).
 */
function armGoal(pose: CharacterPose, side: 1 | -1, t: number, shoulder: THREE.Vector3): ArmGoal | null {
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  switch (pose) {
    case 'study':
    case 'read':
      // Cradle the open book (held on the chest bone) from underneath.
      return {
        target: at(side * 0.108, -0.092, 0.19),
        pole: shoulder.clone().add(at(side * 0.3, -0.35, -0.2)),
        fingers: at(-side * 0.45, 0.12, 1),
        palm: at(-side * 0.25, 1, -0.15),
      };
    case 'wave': {
      if (side === 1) return null;
      const sweep = Math.sin(t * 7) * 0.045;
      return {
        target: shoulder.clone().add(at(-0.2 + sweep, 0.2, 0.09)),
        pole: shoulder.clone().add(at(-0.35, -0.3, -0.15)),
        fingers: at(-0.15 + sweep * 2, 1, 0.1),
        palm: at(0, 0.1, 1),
      };
    }
    case 'cheer': {
      const hop = Math.abs(Math.sin(t * 4.2));
      return {
        target: shoulder.clone().add(at(side * 0.14, 0.4 + hop * 0.02, 0.05)),
        pole: shoulder.clone().add(at(side * 0.45, 0.05, -0.3)),
        fingers: at(side * 0.15, 1, 0.1),
        palm: at(-side, 0, 0.6),
      };
    }
    default:
      return null;
  }
}

const ANIMATED: BoneName[] = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'upperArmL', 'forearmL', 'handL', 'upperArmR', 'forearmR', 'handR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR',
];

export interface AnimatorTargets {
  bones: BoneMap;
  bodyGroup: THREE.Object3D;
  lids: THREE.Object3D[];
  eyeballs: THREE.Object3D[];
  restLid: number;
  book: THREE.Object3D;
  restHipsX: number;
  upperArmLen: number;
  forearmLen: number;
}

const _euler = new THREE.Euler();
const _qUpper = new THREE.Quaternion();
const _qFore = new THREE.Quaternion();
const _qHand = new THREE.Quaternion();
const _qArm = new THREE.Quaternion();

export class AvatarAnimator {
  private time = Math.random() * 10;
  private blinkTimer = 0;
  private nextBlink = 2 + Math.random() * 2;
  private blinkPhase = -1; // -1 = not blinking, else 0..1
  private gazeTimer = 0;
  private gaze = new THREE.Vector2();
  private gazeTarget = new THREE.Vector2();
  private targets = new Map<BoneName, THREE.Quaternion>(ANIMATED.map((n) => [n, new THREE.Quaternion()]));

  update(dt: number, pose: CharacterPose, a: AnimatorTargets, look?: THREE.Vector3 | null) {
    const step = Math.min(dt, 0.05);
    this.time += step;
    const table = poseTargets(pose, this.time);

    // Forward-kinematics targets from the pose table.
    for (const name of ANIMATED) {
      const r = table[name] ?? [0, 0, 0];
      this.targets.get(name)!.setFromEuler(_euler.set(r[0], r[1], r[2]));
    }

    // IK overrides for the arms (computed in chest space).
    for (const [side, s] of [[1, 'L'], [-1, 'R']] as const) {
      const shoulder = a.bones[`upperArm${s}`].position;
      const goal = armGoal(pose, side, this.time, shoulder);
      if (!goal) continue;
      solveTwoBoneIK(shoulder, goal.target, goal.pole, a.upperArmLen, a.forearmLen, _qUpper, _qFore);
      this.targets.get(`upperArm${s}`)!.copy(_qUpper);
      this.targets.get(`forearm${s}`)!.copy(_qFore);
      handOrientation(goal.fingers, goal.palm, side, _qHand);
      // Hand local = (upper * forearm)^-1 * hand-in-chest.
      _qArm.copy(_qUpper).multiply(_qFore).invert();
      this.targets.get(`hand${s}`)!.copy(_qArm.multiply(_qHand));
    }

    // Ease every bone toward its target.
    const blend = 1 - Math.exp(-9 * step);
    for (const name of ANIMATED) a.bones[name].quaternion.slerp(this.targets.get(name)!, blend);
    a.bones.hips.position.x = THREE.MathUtils.damp(a.bones.hips.position.x, a.restHipsX + (table.hipShift ?? 0), 9, step);
    a.bodyGroup.position.y = THREE.MathUtils.damp(a.bodyGroup.position.y, table.bounce ?? 0, 14, step);
    a.book.visible = Boolean(table.book);

    // Head turns toward a look target (not while reading).
    if (look && pose !== 'study' && pose !== 'read') {
      const head = a.bones.head;
      const headPos = head.getWorldPosition(new THREE.Vector3());
      const dir = look.clone().sub(headPos);
      dir.applyQuaternion(a.bones.neck.getWorldQuaternion(new THREE.Quaternion()).invert());
      const yaw = THREE.MathUtils.clamp(Math.atan2(dir.x, dir.z), -0.7, 0.7);
      const pitch = THREE.MathUtils.clamp(-Math.atan2(dir.y, Math.hypot(dir.x, dir.z)), -0.35, 0.35);
      const lookQ = new THREE.Quaternion().setFromEuler(_euler.set(pitch * 0.5, yaw * 0.6, 0));
      head.quaternion.slerp(lookQ, 0.12);
    }

    // Blinks: quick close, slightly slower open, from the mood's resting lid.
    this.blinkTimer += step;
    if (this.blinkPhase < 0 && this.blinkTimer > this.nextBlink) {
      this.blinkPhase = 0;
      this.blinkTimer = 0;
      this.nextBlink = 2.2 + Math.random() * 3.5;
    }
    let lid = a.restLid;
    if (this.blinkPhase >= 0) {
      this.blinkPhase += step / 0.17;
      const p = this.blinkPhase;
      const closed = p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6;
      lid = a.restLid + (1 - a.restLid) * Math.max(0, closed);
      if (this.blinkPhase >= 1) this.blinkPhase = -1;
    }
    for (const l of a.lids) l.rotation.x = lid * LID_CLOSED;

    // Small eye darts every couple of seconds.
    this.gazeTimer -= step;
    if (this.gazeTimer <= 0) {
      this.gazeTimer = 1.2 + Math.random() * 2.8;
      this.gazeTarget.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.14);
      if (pose === 'study' || pose === 'read') this.gazeTarget.set((Math.random() - 0.5) * 0.12, 0.22);
    }
    this.gaze.x = THREE.MathUtils.damp(this.gaze.x, this.gazeTarget.x, 18, step);
    this.gaze.y = THREE.MathUtils.damp(this.gaze.y, this.gazeTarget.y, 18, step);
    for (const e of a.eyeballs) {
      e.rotation.y = this.gaze.x;
      e.rotation.x = this.gaze.y;
    }
  }
}
