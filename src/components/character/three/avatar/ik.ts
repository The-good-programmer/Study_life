import * as THREE from 'three';

const _s = new THREE.Vector3();
const _e = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _parentQ = new THREE.Quaternion();

/**
 * Analytic two-bone IK for an arm (upper arm → forearm → hand), all in one
 * frame (e.g. the chest bone's local space). Bones extend along their local
 * -Y; the forearm bends about its local X toward +Z (rotation.x < 0), which
 * matches the rig. Returns the upper arm's and forearm's target quaternions,
 * each relative to its parent.
 *
 * @param shoulder upper arm origin
 * @param target   where the wrist (hand bone origin) should go
 * @param pole     a point the elbow should bend toward
 */
export function solveTwoBoneIK(
  shoulder: THREE.Vector3,
  target: THREE.Vector3,
  pole: THREE.Vector3,
  upperLen: number,
  foreLen: number,
  outUpper: THREE.Quaternion,
  outFore: THREE.Quaternion
): void {
  _s.copy(shoulder);
  _dir.subVectors(target, _s);
  const reach = upperLen + foreLen;
  const d = THREE.MathUtils.clamp(_dir.length(), Math.abs(upperLen - foreLen) + 1e-4, reach * 0.999);
  _dir.normalize();

  // Elbow position: along the reach direction, pushed toward the pole.
  const a = (upperLen * upperLen - foreLen * foreLen + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(upperLen * upperLen - a * a, 0));
  _pole.subVectors(pole, _s);
  _pole.addScaledVector(_dir, -_pole.dot(_dir));
  if (_pole.lengthSq() < 1e-8) _pole.set(0, -1, 0).addScaledVector(_dir, -_dir.y);
  _pole.normalize();
  _e.copy(_s).addScaledVector(_dir, a).addScaledVector(_pole, h);

  // Upper arm basis: -Y toward the elbow, +Z toward where the forearm bends.
  _y.subVectors(_s, _e).normalize(); // +Y points back up the bone
  const tgt = _z.copy(_dir).multiplyScalar(d).add(_s); // target point
  _z.subVectors(tgt, _e); // forearm direction
  _z.addScaledVector(_y, -_z.dot(_y));
  if (_z.lengthSq() < 1e-8) _z.copy(_pole).multiplyScalar(-1);
  _z.normalize();
  _x.crossVectors(_y, _z).normalize();
  _m.makeBasis(_x, _y, _z);
  outUpper.setFromRotationMatrix(_m);

  // Forearm: bend at the elbow by the angle between the two segments.
  const cosElbow = THREE.MathUtils.clamp((upperLen * upperLen + foreLen * foreLen - d * d) / (2 * upperLen * foreLen), -1, 1);
  const bend = Math.PI - Math.acos(cosElbow);
  outFore.setFromAxisAngle(_x.set(1, 0, 0), -bend);
}

/**
 * Orientation (in the same frame) for a hand whose fingers point along
 * `fingers` and whose palm faces `palm`. `side` is +1 for the left hand: the
 * palm faces -side * X in the hand's local frame.
 */
export function handOrientation(fingers: THREE.Vector3, palm: THREE.Vector3, side: number, out: THREE.Quaternion) {
  _y.copy(fingers).normalize().multiplyScalar(-1); // fingers along local -Y
  _x.copy(palm).addScaledVector(_y, -palm.dot(_y)).normalize().multiplyScalar(-side);
  _z.crossVectors(_x, _y).normalize();
  _x.crossVectors(_y, _z).normalize();
  _m.makeBasis(_x, _y, _z);
  return out.setFromRotationMatrix(_m);
}

/** Converts a rotation expressed in `frame` space into `bone`'s local space. */
export function toLocal(frameQ: THREE.Quaternion, parentInFrame: THREE.Quaternion, out: THREE.Quaternion) {
  _parentQ.copy(parentInFrame).invert();
  return out.copy(_parentQ).multiply(frameQ);
}
