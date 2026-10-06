import * as THREE from 'three';
import type { CharacterPose } from '../../../types/character';

export interface PoseNodeTargets {
  bodyPosY: number;
  hipsPos: [number, number, number];
  hipsRot: [number, number, number];
  spineRot: [number, number, number];
  chestRot: [number, number, number];
  neckRot: [number, number, number];
  headRot: [number, number, number];
  leftArmRot: [number, number, number];
  rightArmRot: [number, number, number];
  leftForearmRot: [number, number, number];
  rightForearmRot: [number, number, number];
  leftHandRot: [number, number, number];
  rightHandRot: [number, number, number];
  bookVisible: boolean;
}

export interface AnimationRigNodes {
  bodyGroup: THREE.Group;
  hips: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  torsoBreathingContainer: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  leftHandContainer: THREE.Group;
  rightHandContainer: THREE.Group;
  leftEyelid: THREE.Group;
  rightEyelid: THREE.Group;
  heldBookGroup: THREE.Group;
}

export function getPoseTargets(pose: CharacterPose, animTime: number): PoseNodeTargets {
  switch (pose) {
    case 'read':
    case 'study': {
      return {
        bodyPosY: 0,
        hipsPos: [0, 0, 0],
        hipsRot: [0, 0, 0],
        spineRot: [0.06, 0, 0],
        chestRot: [0.06, 0, 0],
        neckRot: [0.08, 0, 0],
        headRot: [0.32, 0, Math.sin(animTime * 0.8) * 0.015],
        // Arms forward & inward cupping the book's outer bottom corners
        leftArmRot: [-0.50, 0.20, 0.00],
        rightArmRot: [-0.50, -0.20, 0.00],
        leftForearmRot: [-1.38, 0.22, -0.42],
        rightForearmRot: [-1.38, -0.22, 0.42],
        leftHandRot: [0.38, 0.35, -0.25],
        rightHandRot: [0.38, -0.35, 0.25],
        bookVisible: true,
      };
    }

    case 'wave': {
      return {
        bodyPosY: 0,
        hipsPos: [0, 0, 0],
        hipsRot: [0, 0, 0.02],
        spineRot: [0, 0, -0.01],
        chestRot: [0, 0, -0.01],
        neckRot: [0, 0, -0.04],
        headRot: [-0.05, 0, -0.10],
        leftArmRot: [0.0, 0, 0.14],
        rightArmRot: [-0.2, 0.2, -1.9],
        leftForearmRot: [-0.05, 0, 0],
        rightForearmRot: [0, 0, -0.65 + Math.sin(animTime * 6.5) * 0.45],
        leftHandRot: [0, Math.PI / 2, 0],
        rightHandRot: [0, 0, 0],
        bookVisible: false,
      };
    }

    case 'cheer': {
      return {
        bodyPosY: Math.abs(Math.sin(animTime * 4)) * 0.04,
        hipsPos: [0, 0, 0],
        hipsRot: [0, 0, 0],
        spineRot: [-0.05, 0, 0],
        chestRot: [-0.05, 0, 0],
        neckRot: [-0.08, 0, 0],
        headRot: [-0.22, 0, 0],
        leftArmRot: [-0.2, 0.1, 2.3],
        rightArmRot: [-0.2, -0.1, -2.3],
        leftForearmRot: [0, 0, 0.35 + Math.sin(animTime * 4) * 0.15],
        rightForearmRot: [0, 0, -0.35 - Math.sin(animTime * 4) * 0.15],
        leftHandRot: [0, 0, 0],
        rightHandRot: [0, 0, 0],
        bookVisible: false,
      };
    }

    case 'idle':
    default: {
      const hipsSway = Math.sin(animTime * 1.2) * 0.008;
      const armSway = -0.02 + Math.sin(animTime * 1.5) * 0.015;
      return {
        bodyPosY: 0,
        hipsPos: [hipsSway, 0, 0],
        hipsRot: [0, 0, Math.sin(animTime * 1.2) * 0.015],
        spineRot: [0, 0, -Math.sin(animTime * 1.2) * 0.008],
        chestRot: [0, 0, -Math.sin(animTime * 1.2) * 0.007],
        neckRot: [0, 0, 0],
        headRot: [Math.sin(animTime * 0.7) * 0.015, Math.sin(animTime * 0.5) * 0.03, 0],
        leftArmRot: [armSway, 0, 0.12],
        rightArmRot: [armSway, 0, -0.12], // Same phase sway
        leftForearmRot: [-0.08, 0, 0],
        rightForearmRot: [-0.08, 0, 0],
        leftHandRot: [0, Math.PI / 2, 0],
        rightHandRot: [0, -Math.PI / 2, 0],
        bookVisible: false,
      };
    }
  }
}

function dampValue(current: number, target: number, lambda: number, dt: number): number {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

function dampEuler(euler: THREE.Euler, target: [number, number, number], lambda: number, dt: number) {
  euler.x = dampValue(euler.x, target[0], lambda, dt);
  euler.y = dampValue(euler.y, target[1], lambda, dt);
  euler.z = dampValue(euler.z, target[2], lambda, dt);
}


export class CharacterAnimationEngine {
  private animTime = 0;
  private blinkTimer = 0;
  private isBlinking = false;
  private blinkDuration = 0.18;
  private nextBlinkInterval = 3.5;

  public update(
    deltaSeconds: number,
    pose: CharacterPose,
    nodes: AnimationRigNodes,
    hasTargetLook: boolean,
    targetLook: THREE.Vector3
  ) {
    const dt = Math.min(deltaSeconds, 0.05);
    this.animTime += dt;

    // 1. Natural Eyelid Blinking
    this.blinkTimer += dt;
    if (!this.isBlinking && this.blinkTimer > this.nextBlinkInterval) {
      this.isBlinking = true;
      this.blinkTimer = 0;
      this.nextBlinkInterval = 2.5 + Math.random() * 3.0;
    }

    if (this.isBlinking) {
      const p = this.blinkTimer / this.blinkDuration;
      if (p >= 1.0) {
        this.isBlinking = false;
        this.blinkTimer = 0;
        nodes.leftEyelid.rotation.x = 0;
        nodes.rightEyelid.rotation.x = 0;
      } else {
        const lidRot = Math.sin(p * Math.PI) * 1.1;
        nodes.leftEyelid.rotation.x = lidRot;
        nodes.rightEyelid.rotation.x = lidRot;
      }
    } else {
      nodes.leftEyelid.rotation.x = 0;
      nodes.rightEyelid.rotation.x = 0;
    }

    // 2. Breathing oscillation (scale torso mesh container ONLY, never chest node)
    const breathCycle = Math.sin(this.animTime * 1.8);
    nodes.torsoBreathingContainer.scale.set(
      1 + breathCycle * 0.015,
      1 + breathCycle * 0.008,
      1 + breathCycle * 0.02
    );
    nodes.chest.scale.set(1, 1, 1);

    // 3. Pose-specific Skeletal Dynamics via full target table + damp
    const targets = getPoseTargets(pose, this.animTime);
    const DAMP_RATE = 10;

    nodes.bodyGroup.position.y = dampValue(nodes.bodyGroup.position.y, targets.bodyPosY, DAMP_RATE, dt);
    nodes.hips.position.x = dampValue(nodes.hips.position.x, targets.hipsPos[0], DAMP_RATE, dt);
    nodes.hips.position.z = dampValue(nodes.hips.position.z, targets.hipsPos[2], DAMP_RATE, dt);
    dampEuler(nodes.hips.rotation, targets.hipsRot, DAMP_RATE, dt);
    dampEuler(nodes.spine.rotation, targets.spineRot, DAMP_RATE, dt);
    dampEuler(nodes.chest.rotation, targets.chestRot, DAMP_RATE, dt);
    dampEuler(nodes.neck.rotation, targets.neckRot, DAMP_RATE, dt);
    dampEuler(nodes.head.rotation, targets.headRot, DAMP_RATE, dt);
    dampEuler(nodes.leftArm.rotation, targets.leftArmRot, DAMP_RATE, dt);
    dampEuler(nodes.rightArm.rotation, targets.rightArmRot, DAMP_RATE, dt);
    dampEuler(nodes.leftForearm.rotation, targets.leftForearmRot, DAMP_RATE, dt);
    dampEuler(nodes.rightForearm.rotation, targets.rightForearmRot, DAMP_RATE, dt);
    dampEuler(nodes.leftHandContainer.rotation, targets.leftHandRot, DAMP_RATE, dt);
    dampEuler(nodes.rightHandContainer.rotation, targets.rightHandRot, DAMP_RATE, dt);

    nodes.heldBookGroup.visible = targets.bookVisible;

    // 4. Smooth head tracking if look target supplied (disabled for study and read)
    if (hasTargetLook && pose !== 'study' && pose !== 'read') {
      const headWorldPos = nodes.head.getWorldPosition(new THREE.Vector3());
      const dir = targetLook.clone().sub(headWorldPos).normalize();
      const yaw = Math.atan2(dir.x, dir.z);
      nodes.head.rotation.y = THREE.MathUtils.lerp(
        nodes.head.rotation.y,
        THREE.MathUtils.clamp(yaw * 0.4, -0.6, 0.6),
        0.1
      );
    }
  }
}
