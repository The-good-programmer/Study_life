import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CharacterProportions } from './proportions';
import type { Shoes } from '../../../types/character';

export function buildTorsoLathe(
  props: CharacterProportions,
  topMat: THREE.Material,
  isFemale: boolean
): THREE.Group {
  const group = new THREE.Group();

  // Continuous lathe profile from hips-0.08 (y = -0.36 relative to chest) to neck base (y = 0.28)
  const profilePoints: THREE.Vector2[] = [
    new THREE.Vector2(0.01, -0.36),
    new THREE.Vector2(props.hipsWidth * 0.48, -0.36),
    new THREE.Vector2(props.hipsWidth * 0.49, -0.28),
    new THREE.Vector2(props.waistWidth * 0.49, -0.16),
    new THREE.Vector2(props.chestWidth * 0.48, -0.04),
    new THREE.Vector2(props.chestWidth * 0.50, 0.08),
    new THREE.Vector2(props.shoulderWidth * 0.46, 0.17),
    new THREE.Vector2(props.shoulderWidth * 0.36, 0.22),
    new THREE.Vector2(props.neckRadius * 1.15, 0.27),
    new THREE.Vector2(props.neckRadius * 0.95, 0.29),
  ];

  const latheGeo = new THREE.LatheGeometry(profilePoints, 32);
  // Elliptical Z-scale (0.80) provides natural front-to-back human depth (eliminates paper-thin silhouette)
  latheGeo.scale(1.0, 1.0, 0.80);
  latheGeo.computeVertexNormals();

  const torsoMesh = new THREE.Mesh(latheGeo, topMat);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  group.add(torsoMesh);

  // Female chest: gentle, stylized, seamless organic contour sculpted directly into the continuous torso lathe
  if (isFemale || props.hasBust) {
    const pos = latheGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const ly = pos.getY(i);
      const lz = pos.getZ(i);
      const lx = pos.getX(i);
      if (lz > 0 && ly > -0.05 && ly < 0.14) {
        const yFactor = Math.sin(((ly + 0.05) / 0.19) * Math.PI);
        const xFactor = Math.max(0, 1 - Math.pow(lx / (props.chestWidth * 0.45), 2));
        const bump = yFactor * xFactor * 0.022;
        pos.setZ(i, lz + bump);
      }
    }
    latheGeo.computeVertexNormals();
  }

  // NOTE: Redundant stationary deltoid spheres removed. The shoulder joint is articulated on the arm root.

  return group;
}

export function buildPelvis(props: CharacterProportions, bottomMat: THREE.Material): THREE.Mesh {
  // Rounded brief volume that comfortably encloses the hip joints and blends smoothly into torso and thighs
  const pelvisGeo = new THREE.SphereGeometry(1.0, 24, 16);
  // Z-scale aligns with torso lathe lower section (hipsWidth * 0.48 * 0.80 ≈ 0.384)
  pelvisGeo.scale(props.hipsWidth * 0.50, 0.11, props.hipsWidth * 0.40);
  pelvisGeo.computeVertexNormals();

  const pelvisMesh = new THREE.Mesh(pelvisGeo, bottomMat);
  pelvisMesh.position.set(0, -0.02, 0);
  pelvisMesh.castShadow = true;
  pelvisMesh.receiveShadow = true;
  return pelvisMesh;
}

export function buildUpperArmMesh(
  props: CharacterProportions,
  mat: THREE.Material,
  length: number
): THREE.Group {
  const group = new THREE.Group();

  // Shoulder joint sphere
  const jointGeo = new THREE.SphereGeometry(0.056 * props.armThickness, 16, 12);
  const joint = new THREE.Mesh(jointGeo, mat);
  joint.castShadow = true;
  group.add(joint);

  // Shaft
  const shaftGeo = new THREE.CylinderGeometry(
    0.054 * props.armThickness,
    0.046 * props.armThickness,
    length,
    16
  );
  const shaft = new THREE.Mesh(shaftGeo, mat);
  shaft.position.y = -length * 0.5;
  shaft.castShadow = true;
  group.add(shaft);

  return group;
}

export function buildForearmMesh(
  props: CharacterProportions,
  mat: THREE.Material,
  length: number
): THREE.Group {
  const group = new THREE.Group();

  // Elbow joint sphere
  const elbowGeo = new THREE.SphereGeometry(0.046 * props.armThickness, 16, 12);
  const elbow = new THREE.Mesh(elbowGeo, mat);
  elbow.castShadow = true;
  group.add(elbow);

  // Shaft
  const shaftGeo = new THREE.CylinderGeometry(
    0.045 * props.armThickness,
    0.038 * props.armThickness,
    length,
    16
  );
  const shaft = new THREE.Mesh(shaftGeo, mat);
  shaft.position.y = -length * 0.5;
  shaft.castShadow = true;
  group.add(shaft);

  return group;
}

export function buildHandMesh(
  props: CharacterProportions,
  skinMat: THREE.Material,
  isRight: boolean
): THREE.Group {
  const group = new THREE.Group();

  // Wrist joint sphere
  const wristGeo = new THREE.SphereGeometry(0.036 * props.armThickness, 14, 10);
  const wrist = new THREE.Mesh(wristGeo, skinMat);
  wrist.castShadow = true;
  group.add(wrist);

  // Palm
  const palmGeo = new RoundedBoxGeometry(0.062, 0.075, 0.024, 3, 0.005);
  const palm = new THREE.Mesh(palmGeo, skinMat);
  palm.position.set(0, -0.040, 0);
  palm.castShadow = true;
  group.add(palm);

  // 4 Fingers (Index, Middle, Ring, Pinky)
  const fingerConfigs = [
    { len: 0.052, x: isRight ? -0.020 : 0.020 },
    { len: 0.058, x: isRight ? -0.007 : 0.007 },
    { len: 0.054, x: isRight ? 0.007 : -0.007 },
    { len: 0.044, x: isRight ? 0.020 : -0.020 },
  ];

  fingerConfigs.forEach(({ len, x }) => {
    const fingerGroup = new THREE.Group();
    fingerGroup.position.set(x, -0.075, 0);

    // Proximal phalanx
    const pLen = len * 0.58;
    const pGeo = new THREE.CylinderGeometry(0.0075, 0.007, pLen, 8);
    const pMesh = new THREE.Mesh(pGeo, skinMat);
    pMesh.position.y = -pLen * 0.5;
    pMesh.rotation.x = 0.18; // Natural slight rest curl
    pMesh.castShadow = true;
    fingerGroup.add(pMesh);

    // Distal phalanx
    const dLen = len * 0.42;
    const dGeo = new THREE.CylinderGeometry(0.0068, 0.0058, dLen, 8);
    const dMesh = new THREE.Mesh(dGeo, skinMat);
    dMesh.position.set(0, -pLen - dLen * 0.5 * Math.cos(0.18), -dLen * 0.5 * Math.sin(0.18));
    dMesh.rotation.x = 0.32;
    dMesh.castShadow = true;
    fingerGroup.add(dMesh);

    group.add(fingerGroup);
  });

  // Thumb on medial side, angled slightly forward/inward
  const thumbGroup = new THREE.Group();
  const thumbX = isRight ? 0.026 : -0.026;
  thumbGroup.position.set(thumbX, -0.038, 0.008);
  thumbGroup.rotation.y = isRight ? -0.42 : 0.42;
  thumbGroup.rotation.x = 0.28;

  const tLen = 0.042;
  const tGeo = new THREE.CylinderGeometry(0.0085, 0.0072, tLen, 8);
  const tMesh = new THREE.Mesh(tGeo, skinMat);
  tMesh.position.y = -tLen * 0.5;
  tMesh.castShadow = true;
  thumbGroup.add(tMesh);

  group.add(thumbGroup);

  return group;
}

export function buildUpperLegMesh(
  props: CharacterProportions,
  mat: THREE.Material,
  length: number
): THREE.Group {
  const group = new THREE.Group();

  // Hip joint sphere
  const hipGeo = new THREE.SphereGeometry(props.legThickness * 0.068, 16, 12);
  const hip = new THREE.Mesh(hipGeo, mat);
  hip.castShadow = true;
  group.add(hip);

  // Shaft
  const shaftGeo = new THREE.CylinderGeometry(
    props.legThickness * 0.068,
    props.legThickness * 0.056,
    length,
    16
  );
  const shaft = new THREE.Mesh(shaftGeo, mat);
  shaft.position.y = -length * 0.5;
  shaft.castShadow = true;
  group.add(shaft);

  return group;
}

export function buildLowerLegMesh(
  props: CharacterProportions,
  mat: THREE.Material,
  length: number
): THREE.Group {
  const group = new THREE.Group();

  // Knee joint sphere
  const kneeGeo = new THREE.SphereGeometry(props.legThickness * 0.056, 16, 12);
  const knee = new THREE.Mesh(kneeGeo, mat);
  knee.castShadow = true;
  group.add(knee);

  // Shaft
  const shaftGeo = new THREE.CylinderGeometry(
    props.legThickness * 0.055,
    props.legThickness * 0.045,
    length,
    16
  );
  const shaft = new THREE.Mesh(shaftGeo, mat);
  shaft.position.y = -length * 0.5;
  shaft.castShadow = true;
  group.add(shaft);

  return group;
}

export function buildShoeMesh(
  shoesStyle: Shoes,
  shoeMat: THREE.Material,
  soleMat: THREE.Material
): THREE.Group {
  const group = new THREE.Group();

  // Ankle joint sphere at local (0, 0, 0)
  const ankleGeo = new THREE.SphereGeometry(0.042, 14, 10);
  const ankle = new THREE.Mesh(ankleGeo, shoeMat);
  ankle.castShadow = true;
  group.add(ankle);

  const isBoots = shoesStyle === 'boots';
  const isLoafers = shoesStyle === 'loafers';
  const isRunning = shoesStyle === 'running';

  // Sole thickness: exactly 0.025 (boots slightly thicker 0.028)
  const soleThickness = isBoots ? 0.028 : 0.025;
  // Lowest vertex MUST sit at exactly local y = -0.070
  // Therefore, center y of sole = -0.070 + soleThickness / 2
  const soleCenterY = -0.070 + soleThickness * 0.5;
  const soleLength = isRunning ? 0.235 : 0.225;
  const soleZ = 0.055;

  const soleGeo = new RoundedBoxGeometry(0.088, soleThickness, soleLength, 3, 0.005);
  const soleMesh = new THREE.Mesh(soleGeo, soleMat);
  soleMesh.position.set(0, soleCenterY, soleZ);
  soleMesh.castShadow = true;
  group.add(soleMesh);

  // Shoe Upper: from sole top up to collar
  const upperHeight = isBoots ? 0.11 : isLoafers ? 0.058 : 0.068;
  const upperCenterY = -0.070 + soleThickness + upperHeight * 0.5 - 0.002;
  const upperGeo = new RoundedBoxGeometry(0.082, upperHeight, soleLength - 0.015, 3, 0.010);
  const upperMesh = new THREE.Mesh(upperGeo, shoeMat);
  upperMesh.position.set(0, upperCenterY, soleZ - 0.005);
  upperMesh.castShadow = true;
  group.add(upperMesh);

  return group;
}

export function buildNeckMesh(props: CharacterProportions, skinMat: THREE.Material): THREE.Group {
  const group = new THREE.Group();

  // Tapered neck cylinder
  const neckGeo = new THREE.CylinderGeometry(props.neckRadius, props.neckRadius * 1.10, 0.14, 20);
  const neckMesh = new THREE.Mesh(neckGeo, skinMat);
  neckMesh.position.y = 0.04;
  neckMesh.castShadow = true;
  group.add(neckMesh);

  // Subtle stylized Adam's apple (if male)
  if (props.hasAdamsApple) {
    const appleGeo = new THREE.SphereGeometry(0.009, 10, 10);
    appleGeo.scale(1.0, 1.3, 0.6);
    const appleMesh = new THREE.Mesh(appleGeo, skinMat);
    appleMesh.position.set(0, 0.03, props.neckRadius * 0.98);
    appleMesh.castShadow = true;
    group.add(appleMesh);
  }

  return group;
}
