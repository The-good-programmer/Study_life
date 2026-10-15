import * as THREE from 'three';
import type { CharacterMood } from '../../../../types/character';
import { EYE_RANGE } from '../avatar/animator';

/** The 52 ARKit face blend shapes; the base head's morph targets use these names. */
export const ARKIT_SHAPES = [
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight',
  'eyeBlinkLeft', 'eyeBlinkRight', 'eyeLookDownLeft', 'eyeLookDownRight', 'eyeLookInLeft', 'eyeLookInRight',
  'eyeLookOutLeft', 'eyeLookOutRight', 'eyeLookUpLeft', 'eyeLookUpRight', 'eyeSquintLeft', 'eyeSquintRight',
  'eyeWideLeft', 'eyeWideRight',
  'jawForward', 'jawLeft', 'jawOpen', 'jawRight',
  'mouthClose', 'mouthDimpleLeft', 'mouthDimpleRight', 'mouthFrownLeft', 'mouthFrownRight', 'mouthFunnel',
  'mouthLeft', 'mouthLowerDownLeft', 'mouthLowerDownRight', 'mouthPressLeft', 'mouthPressRight', 'mouthPucker',
  'mouthRight', 'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight', 'noseSneerLeft', 'noseSneerRight', 'tongueOut',
] as const;

export type ArkitShape = (typeof ARKIT_SHAPES)[number];
export type FaceWeights = Partial<Record<ArkitShape, number>>;

/** Applies a weight to both sides of a Left/Right pair. */
const both = (base: string, w: number): FaceWeights =>
  ({ [`${base}Left`]: w, [`${base}Right`]: w }) as FaceWeights;

/**
 * Each mood is a resting expression built from FACS-style shapes, kept subtle
 * so it reads as a mood rather than a pulled face. Blinks layer on top.
 */
export const MOOD_PRESETS: Record<CharacterMood, FaceWeights> = {
  happy: { ...both('mouthSmile', 0.55), ...both('cheekSquint', 0.35), ...both('eyeSquint', 0.2), ...both('mouthDimple', 0.2), browInnerUp: 0.1 },
  focused: { ...both('browDown', 0.35), ...both('eyeSquint', 0.25), ...both('mouthPress', 0.25), mouthClose: 0.1 },
  proud: { ...both('mouthSmile', 0.3), mouthShrugLower: 0.25, ...both('browOuterUp', 0.15), ...both('eyeLookDown', 0.1) },
  zen: { ...both('eyeBlink', 0.55), ...both('mouthSmile', 0.18), browInnerUp: 0.05 },
  energetic: { ...both('mouthSmile', 0.7), jawOpen: 0.22, ...both('eyeWide', 0.35), browInnerUp: 0.3, ...both('browOuterUp', 0.35) },
  sleepy: { ...both('eyeBlink', 0.62), browInnerUp: 0.15, jawOpen: 0.06, ...both('mouthFrown', 0.1) },
};

const slot = (name: ArkitShape) => ARKIT_SHAPES.indexOf(name);
const BLINK_L = slot('eyeBlinkLeft');
const BLINK_R = slot('eyeBlinkRight');
const LOOK = {
  inL: slot('eyeLookInLeft'), outL: slot('eyeLookOutLeft'), upL: slot('eyeLookUpLeft'), downL: slot('eyeLookDownLeft'),
  inR: slot('eyeLookInRight'), outR: slot('eyeLookOutRight'), upR: slot('eyeLookUpRight'), downR: slot('eyeLookDownRight'),
};
/** How far the upper lids follow the eyes down (as a share of a blink) when looking fully down. */
const LID_DROOP = 0.22;

const unit = (v: number, max: number) => Math.min(Math.max(v / max, 0), 1);

/**
 * ARKit eye-look weights for eye rotations relative to the head (radians),
 * written into `out`, indexed like ARKIT_SHAPES (other entries untouched).
 * Yaw turns toward the avatar's left (+X), pitch downward. Left and Right
 * are the avatar's own eyes, and In means toward the nose. Weight 1 is the
 * edge of EYE_RANGE: the shipped eye shapes turn the eye about 29° sideways,
 * 14° up and 23° down at full weight.
 */
export function gazeWeights(yawL: number, yawR: number, pitch: number, out: Float32Array): Float32Array {
  out[LOOK.outL] = unit(yawL, EYE_RANGE.side);
  out[LOOK.inL] = unit(-yawL, EYE_RANGE.side);
  out[LOOK.inR] = unit(yawR, EYE_RANGE.side);
  out[LOOK.outR] = unit(-yawR, EYE_RANGE.side);
  out[LOOK.downL] = out[LOOK.downR] = unit(pitch, EYE_RANGE.down);
  out[LOOK.upL] = out[LOOK.upR] = unit(-pitch, EYE_RANGE.up);
  return out;
}

/**
 * Drives the face: eases toward the mood's preset (about 250 ms), adds the
 * gaze (see setGaze) and blinks on top, and writes ARKit weights into every
 * mesh that has them.
 */
export class FaceController {
  private current = new Float32Array(ARKIT_SHAPES.length);
  private target = new Float32Array(ARKIT_SHAPES.length);
  /** Eye-look weights from the gaze, added to the mood's. */
  private gaze = new Float32Array(ARKIT_SHAPES.length);
  private lidDroop = 0;
  private meshes: { mesh: THREE.Mesh; slots: Int16Array }[] = [];
  private blinkTimer = 0;
  private nextBlink = 2 + Math.random() * 3;
  private blinkPhase = -1;

  setMeshes(root: THREE.Object3D) {
    this.meshes = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const dict = mesh.morphTargetDictionary;
      if (!mesh.isMesh || !dict || !mesh.morphTargetInfluences) return;
      const slots = new Int16Array(ARKIT_SHAPES.map((n) => dict[n] ?? -1));
      if (slots.some((s) => s >= 0)) this.meshes.push({ mesh, slots });
    });
  }

  setMood(mood: CharacterMood) {
    const preset = MOOD_PRESETS[mood] ?? {};
    ARKIT_SHAPES.forEach((n, i) => (this.target[i] = preset[n] ?? 0));
  }

  /**
   * Where the eyes look, relative to the head (see AvatarAnimator.gaze). It
   * adds to the mood's own eye-look weights (e.g. 'proud' looks down a
   * little), and the upper lids follow the eyes down.
   */
  setGaze(yawL: number, yawR: number, pitch: number) {
    gazeWeights(yawL, yawR, pitch, this.gaze);
    this.lidDroop = LID_DROOP * this.gaze[LOOK.downL];
  }

  /** Snaps to the target (no easing), e.g. for the first frame. */
  snap() {
    this.current.set(this.target);
  }

  update(dt: number) {
    const k = 1 - Math.exp(-12 * Math.min(dt, 0.05));
    for (let i = 0; i < this.current.length; i++) this.current[i] += (this.target[i] - this.current[i]) * k;

    // Blink every 2–5 s: a quick close (~55 ms), held shut for ~45 ms so even
    // a 30 fps frame sees the lids fully closed, then a slower open (~120 ms).
    this.blinkTimer += dt;
    if (this.blinkPhase < 0 && this.blinkTimer > this.nextBlink) {
      this.blinkPhase = 0;
      this.blinkTimer = 0;
      this.nextBlink = 2 + Math.random() * 3;
    }
    let blink = 0;
    if (this.blinkPhase >= 0) {
      this.blinkPhase += dt / 0.22;
      const t = this.blinkPhase;
      blink = t < 0.25 ? t / 0.25 : t < 0.45 ? 1 : Math.max(0, 1 - (t - 0.45) / 0.55);
      if (this.blinkPhase >= 1) this.blinkPhase = -1;
    }

    for (const { mesh, slots } of this.meshes) {
      const inf = mesh.morphTargetInfluences!;
      for (let i = 0; i < slots.length; i++) {
        if (slots[i] < 0) continue;
        const w = i === BLINK_L || i === BLINK_R ? Math.max(this.current[i] + this.lidDroop, blink) : this.current[i] + this.gaze[i];
        inf[slots[i]] = Math.min(w, 1);
      }
    }
  }

  weight(shape: ArkitShape) {
    return this.current[ARKIT_SHAPES.indexOf(shape)];
  }
}
