import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CharacterProportions } from './proportions';
import type { CharacterCustomization } from '../../../types/character';

/**
 * Creates a reusable CanvasTexture for female cheek blush with smooth radial falloff.
 */
let cachedBlushTexture: THREE.CanvasTexture | null = null;
export function getBlushTexture(): THREE.CanvasTexture {
  if (cachedBlushTexture) return cachedBlushTexture;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const center = size / 2;
    const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
    grad.addColorStop(0, 'rgba(244, 114, 182, 0.7)');
    grad.addColorStop(0.5, 'rgba(244, 114, 182, 0.35)');
    grad.addColorStop(1.0, 'rgba(244, 114, 182, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  cachedBlushTexture = new THREE.CanvasTexture(canvas);
  return cachedBlushTexture;
}

/**
 * Deforms a SphereGeometry(1, 48, 36) into a smooth, organic, stylised human head.
 * Features: cranium ellipsoid, jaw & chin taper, eye socket indentations (-6.5mm),
 * brow ridge protrusion, zygomatic cheek prominence, and nose bridge ridge.
 * Eliminates disjoint forehead/cheek/jaw/chin primitive boxes.
 */
export function createHeadGeometry(props: CharacterProportions): THREE.BufferGeometry {
  const hs = props.headScale;
  const geo = new THREE.SphereGeometry(1, 48, 36);
  const pos = geo.attributes.position;

  const rx = 0.116 * hs;
  const ry = 0.128 * hs;
  const rz = 0.120 * hs;
  const centerY = 0.020 * hs;
  const centerZ = -0.024 * hs;

  const jawWidthHalf = props.jawWidth * 0.5 * hs;
  const chinWidthHalf = props.chinWidth * 0.5 * hs;
  const browDepth = (props.hasAdamsApple ? props.browRidgeDepth : 0.002) * hs;

  const eyeX = 0.046 * hs;
  const eyeY = 0.012 * hs;
  const socketRadius = 0.026 * hs;
  const socketDepth = 0.0085 * hs;

  for (let i = 0; i < pos.count; i++) {
    const sx = pos.getX(i);
    const sy = pos.getY(i);
    const sz = pos.getZ(i);

    let x = sx * rx;
    let y = sy * ry + centerY;
    let z = sz * rz + centerZ;

    // 1. Jaw & Chin Taper (for y < centerY)
    if (y < centerY) {
      const t = THREE.MathUtils.clamp((centerY - y) / (0.125 * hs), 0, 1);
      const frontFactor = THREE.MathUtils.clamp((z - centerZ + 0.02 * hs) / (rz * 0.8), 0, 1);
      const jawWidthAtY = THREE.MathUtils.lerp(rx, jawWidthHalf, t * 0.8);
      const chinWidthAtY = THREE.MathUtils.lerp(jawWidthHalf, chinWidthHalf, Math.pow(t, 2.0));
      const targetHalfWidth = THREE.MathUtils.lerp(jawWidthAtY, chinWidthAtY, t);
      const widthScale = THREE.MathUtils.clamp(targetHalfWidth / rx, 0.35, 1.0);
      x *= THREE.MathUtils.lerp(1.0, widthScale, frontFactor);

      // Chin forward projection
      if (t > 0.5 && z > centerZ) {
        const chinT = (t - 0.5) / 0.5;
        const chinBump = Math.sin(chinT * Math.PI) * 0.012 * hs * props.chinSquareness * 1.5;
        z += chinBump;
      }
    }

    // 2. Eye socket indentations (front face)
    if (z > 0.02 * hs) {
      const dLeft = Math.hypot(x - eyeX, y - eyeY);
      const dRight = Math.hypot(x + eyeX, y - eyeY);
      const d = Math.min(dLeft, dRight);
      if (d < socketRadius) {
        const falloff = 0.5 * (1 + Math.cos((Math.PI * d) / socketRadius));
        z -= socketDepth * falloff;
      }
    }

    // 3. Brow Ridge (Supraorbital margin)
    if (z > 0.03 * hs && y > 0.028 * hs && y < 0.056 * hs && Math.abs(x) < 0.068 * hs) {
      const dY = (y - 0.040 * hs) / (0.014 * hs);
      const dX = Math.abs(x) / (0.068 * hs);
      const dDist = Math.hypot(dX, dY);
      if (dDist < 1.0) {
        const browBump = browDepth * 0.5 * (1 + Math.cos(Math.PI * dDist));
        z += browBump;
      }
    }

    // 4. Cheekbone prominence (Zygomatic)
    if (z > 0.02 * hs && y > -0.015 * hs && y < 0.020 * hs) {
      const cX = (Math.abs(x) - 0.072 * hs) / (0.024 * hs);
      const cY = (y - 0.002 * hs) / (0.018 * hs);
      const cDist = Math.hypot(cX, cY);
      if (cDist < 1.0) {
        const cheekBump = 0.0035 * hs * 0.5 * (1 + Math.cos(Math.PI * cDist));
        z += cheekBump;
        x += Math.sign(x) * cheekBump * 0.5;
      }
    }

    // 5. Nose bridge ridge between eyes
    if (z > 0.04 * hs && y > -0.020 * hs && y < 0.030 * hs && Math.abs(x) < 0.016 * hs) {
      const nbX = Math.abs(x) / (0.016 * hs);
      const nbY = Math.abs(y - 0.006 * hs) / (0.024 * hs);
      if (nbX < 1.0 && nbY < 1.0) {
        const ridgeBump = 0.004 * hs * (1 - nbX) * (1 - nbY);
        z += ridgeBump;
      }
    }

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds eye anatomy: spherical eyeball, spherical-cap iris, pupil, specular catch-light,
 * and an articulated eyelid shell connected to the rig eyelid node for real-time blinking.
 */
function buildEye(
  isRight: boolean,
  props: CharacterProportions,
  mats: {
    skin: THREE.Material;
    eyeSclera: THREE.Material;
    eyeIris: THREE.Material;
    eyePupil: THREE.Material;
    eyeCatchLight: THREE.Material;
  }
): { eyeGroup: THREE.Group; eyelidNode: THREE.Group } {
  const hs = props.headScale;
  const eyeGroup = new THREE.Group();
  const xOffset = isRight ? -0.046 * hs : 0.046 * hs;
  const yOffset = 0.012 * hs;
  const zOffset = 0.063 * hs;

  eyeGroup.position.set(xOffset, yOffset, zOffset);

  const rEye = 0.0175 * hs;

  // 1. Eyeball (Sclera)
  const eyeballGeo = new THREE.SphereGeometry(rEye, 24, 24);
  const eyeball = new THREE.Mesh(eyeballGeo, mats.eyeSclera);
  eyeball.castShadow = false;
  eyeball.receiveShadow = true;
  eyeGroup.add(eyeball);

  // 2. Iris (Spherical Cap rotated to face +Z)
  const irisGeo = new THREE.SphereGeometry(rEye + 0.0003 * hs, 24, 8, 0, Math.PI * 2, 0, 0.58);
  irisGeo.rotateX(Math.PI / 2);
  const iris = new THREE.Mesh(irisGeo, mats.eyeIris);
  eyeGroup.add(iris);

  // 3. Pupil (Spherical Cap rotated to face +Z)
  const pupilGeo = new THREE.SphereGeometry(rEye + 0.0005 * hs, 20, 6, 0, Math.PI * 2, 0, 0.28);
  pupilGeo.rotateX(Math.PI / 2);
  const pupil = new THREE.Mesh(pupilGeo, mats.eyePupil);
  eyeGroup.add(pupil);

  // 4. Specular Catch-light (Tiny crisp white sphere at upper-right)
  const catchGeo = new THREE.SphereGeometry(0.0020 * hs, 8, 8);
  const catchLight = new THREE.Mesh(catchGeo, mats.eyeCatchLight);
  catchLight.position.set(0.0038 * hs, 0.0040 * hs, rEye + 0.0006 * hs);
  eyeGroup.add(catchLight);

  // 5. Lower lid subtle crease
  const lowerLidGeo = new THREE.TorusGeometry(rEye + 0.0006 * hs, 0.0015 * hs, 8, 16, Math.PI * 0.75);
  lowerLidGeo.rotateZ(isRight ? -Math.PI * 0.05 : Math.PI * 0.05);
  lowerLidGeo.rotateX(Math.PI * 0.56);
  const lowerLid = new THREE.Mesh(lowerLidGeo, mats.skin);
  lowerLid.position.set(0, -0.005 * hs, 0.005 * hs);
  eyeGroup.add(lowerLid);

  // 6. Upper Eyelid Shell (Articulated on eyelidNode pivot)
  const eyelidNode = new THREE.Group();
  eyelidNode.name = isRight ? 'rightEyelidPivot' : 'leftEyelidPivot';
  eyelidNode.position.copy(eyeGroup.position);

  // Upper lid spherical shell: rotated -0.25 rad at rest so top ~22% of iris is covered,
  // creating a friendly, attentive student expression; sweeps down +1.1 rad during blink
  const upperLidGeo = new THREE.SphereGeometry(rEye + 0.0008 * hs, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.48);
  upperLidGeo.rotateX(-0.25);
  const upperLidMesh = new THREE.Mesh(upperLidGeo, mats.skin);
  upperLidMesh.castShadow = true;
  eyelidNode.add(upperLidMesh);

  return { eyeGroup, eyelidNode };
}

/**
 * Builds 3-point Catmull-Rom curved tube eyebrows hugging brow surface ~24mm above eye centre.
 */
function buildEyebrows(
  props: CharacterProportions,
  hairMat: THREE.Material,
  mood: string
): THREE.Group {
  const hs = props.headScale;
  const browGroup = new THREE.Group();

  let moodInnerY = 0;
  let moodPeakY = 0;
  switch (mood) {
    case 'happy':
    case 'energetic':
      moodPeakY = 0.0025 * hs;
      break;
    case 'focused':
      moodInnerY = -0.002 * hs;
      moodPeakY = 0.001 * hs;
      break;
    case 'sleepy':
      moodInnerY = -0.001 * hs;
      moodPeakY = -0.002 * hs;
      break;
    case 'proud':
      moodPeakY = 0.002 * hs;
      break;
  }

  const browRadius = props.eyebrowThickness * hs * 0.45;

  // Left eyebrow points
  const leftPoints = [
    new THREE.Vector3(0.018 * hs, 0.038 * hs + moodInnerY, 0.084 * hs),
    new THREE.Vector3(0.048 * hs, 0.044 * hs + moodPeakY, 0.082 * hs),
    new THREE.Vector3(0.076 * hs, 0.036 * hs, 0.072 * hs),
  ];
  const leftCurve = new THREE.CatmullRomCurve3(leftPoints);
  const leftGeo = new THREE.TubeGeometry(leftCurve, 16, browRadius, 8, false);
  const leftMesh = new THREE.Mesh(leftGeo, hairMat);

  // Right eyebrow points (mirrored)
  const rightPoints = [
    new THREE.Vector3(-0.018 * hs, 0.038 * hs + moodInnerY, 0.084 * hs),
    new THREE.Vector3(-0.048 * hs, 0.044 * hs + moodPeakY, 0.082 * hs),
    new THREE.Vector3(-0.076 * hs, 0.036 * hs, 0.072 * hs),
  ];
  const rightCurve = new THREE.CatmullRomCurve3(rightPoints);
  const rightGeo = new THREE.TubeGeometry(rightCurve, 16, browRadius, 8, false);
  const rightMesh = new THREE.Mesh(rightGeo, hairMat);

  browGroup.add(leftMesh, rightMesh);
  return browGroup;
}

/**
 * Builds a single sculpted nose mesh protruding from the face: bridge, apex tip,
 * rounded alae, and underside dark nostril ellipses.
 */
function buildNose(
  props: CharacterProportions,
  skinMat: THREE.Material,
  nostrilMat: THREE.Material
): THREE.Group {
  const hs = props.headScale;
  const noseGroup = new THREE.Group();

  const bridgeZ = 0.078 * hs;
  const proj = props.noseProjection * hs * 0.85;
  const tipZ = bridgeZ + proj;

  // Bridge path
  const bridgePoints = [
    new THREE.Vector3(0, 0.022 * hs, bridgeZ + 0.002 * hs),
    new THREE.Vector3(0, 0.005 * hs, bridgeZ + proj * 0.55),
    new THREE.Vector3(0, -0.010 * hs, tipZ),
  ];
  const bridgeCurve = new THREE.CatmullRomCurve3(bridgePoints);
  const bridgeGeo = new THREE.TubeGeometry(bridgeCurve, 12, props.noseBridgeWidth * hs * 0.40, 10, false);

  // Nasal Tip (Apex)
  const tipRadius = 0.0095 * hs;
  const tipGeo = new THREE.SphereGeometry(tipRadius, 14, 14);
  tipGeo.scale(1.05, 0.95, 1.15);
  tipGeo.translate(0, -0.010 * hs, tipZ);

  // Left Ala (Nostril wing)
  const alaRadius = 0.0075 * hs;
  const leftAlaGeo = new THREE.SphereGeometry(alaRadius, 12, 12);
  leftAlaGeo.translate(0.012 * hs, -0.012 * hs, bridgeZ + proj * 0.72);

  // Right Ala
  const rightAlaGeo = new THREE.SphereGeometry(alaRadius, 12, 12);
  rightAlaGeo.translate(-0.012 * hs, -0.012 * hs, bridgeZ + proj * 0.72);

  // Merge bridge, tip, and alae into a single seamless nose mesh
  const mergedNoseGeo = mergeGeometries([bridgeGeo, tipGeo, leftAlaGeo, rightAlaGeo]);
  if (mergedNoseGeo) {
    const noseMesh = new THREE.Mesh(mergedNoseGeo, skinMat);
    noseMesh.castShadow = true;
    noseMesh.receiveShadow = true;
    noseGroup.add(noseMesh);
  }

  // Dark Nostril Ellipses on underside
  const nostrilGeo = new THREE.CircleGeometry(0.0028 * hs, 10);
  nostrilGeo.scale(0.8, 1.2, 1.0);
  nostrilGeo.rotateX(Math.PI / 2);

  const leftNostril = new THREE.Mesh(nostrilGeo, nostrilMat);
  leftNostril.position.set(0.0055 * hs, -0.016 * hs, bridgeZ + proj * 0.75);
  leftNostril.rotation.z = -0.25;

  const rightNostril = leftNostril.clone();
  rightNostril.position.x = -0.0055 * hs;
  rightNostril.rotation.z = 0.25;

  noseGroup.add(leftNostril, rightNostril);
  return noseGroup;
}

/**
 * Builds 3D sculpted human lips using smooth Catmull-Rom curved tubes.
 * Upper lip features a Cupid's bow; lower lip is fuller.
 * Corners and shape dynamically reflect character mood (e.g. smile for happy/proud/energetic).
 */
function buildLips(
  props: CharacterProportions,
  mouthMat: THREE.Material,
  mood: string
): THREE.Group {
  const hs = props.headScale;
  const mouthGroup = new THREE.Group();

  let cornerLift = 0;
  switch (mood) {
    case 'happy':
      cornerLift = 0.0035 * hs;
      break;
    case 'energetic':
      cornerLift = 0.0050 * hs;
      break;
    case 'proud':
      cornerLift = 0.0028 * hs;
      break;
    case 'sleepy':
      cornerLift = -0.0012 * hs;
      break;
    case 'focused':
    case 'zen':
    default:
      cornerLift = 0.0;
      break;
  }

  const lipY = -0.048 * hs;
  const lipZ = 0.076 * hs;

  // Upper Lip Cupid's bow
  const upperPoints = [
    new THREE.Vector3(-0.024 * hs, lipY + cornerLift, lipZ - 0.003 * hs),
    new THREE.Vector3(-0.011 * hs, lipY + 0.004 * hs, lipZ + 0.005 * hs),
    new THREE.Vector3(0, lipY + 0.002 * hs, lipZ + 0.004 * hs),
    new THREE.Vector3(0.011 * hs, lipY + 0.004 * hs, lipZ + 0.005 * hs),
    new THREE.Vector3(0.024 * hs, lipY + cornerLift, lipZ - 0.003 * hs),
  ];
  const upperCurve = new THREE.CatmullRomCurve3(upperPoints);
  const upperGeo = new THREE.TubeGeometry(upperCurve, 20, 0.0042 * hs, 8, false);
  const upperMesh = new THREE.Mesh(upperGeo, mouthMat);

  // Lower Lip
  const lowerPoints = [
    new THREE.Vector3(-0.022 * hs, lipY + cornerLift, lipZ - 0.003 * hs),
    new THREE.Vector3(0, lipY - 0.006 * hs, lipZ + 0.004 * hs),
    new THREE.Vector3(0.022 * hs, lipY + cornerLift, lipZ - 0.003 * hs),
  ];
  const lowerCurve = new THREE.CatmullRomCurve3(lowerPoints);
  const lowerGeo = new THREE.TubeGeometry(lowerCurve, 16, 0.0052 * hs, 8, false);
  const lowerMesh = new THREE.Mesh(lowerGeo, mouthMat);

  mouthGroup.add(upperMesh, lowerMesh);
  return mouthGroup;
}

/**
 * Builds anatomical ears aligned to the YZ plane (vertical span from brow line to nose base).
 * Contains helix tube, concha bowl, and earlobe.
 */
function buildEar(
  isRight: boolean,
  props: CharacterProportions,
  skinMat: THREE.Material
): THREE.Group {
  const hs = props.headScale;
  const earGroup = new THREE.Group();
  const xPos = isRight ? -0.114 * hs : 0.114 * hs;

  earGroup.position.set(xPos, 0.006 * hs, -0.012 * hs);
  earGroup.rotation.y = isRight ? -Math.PI / 2 + 0.16 : Math.PI / 2 - 0.16;
  earGroup.rotation.z = isRight ? 0.08 : -0.08;

  // Helix (Outer Rim Tube)
  const helixGeo = new THREE.TorusGeometry(0.028 * hs, 0.0065 * hs, 10, 20, Math.PI * 1.35);
  helixGeo.rotateZ(isRight ? -Math.PI * 0.72 : Math.PI * 0.72);
  const helix = new THREE.Mesh(helixGeo, skinMat);
  earGroup.add(helix);

  // Concha (Inner bowl)
  const conchaGeo = new THREE.SphereGeometry(0.019 * hs, 12, 12);
  conchaGeo.scale(0.35, 1.15, 0.85);
  const concha = new THREE.Mesh(conchaGeo, skinMat);
  earGroup.add(concha);

  // Lobe
  const lobeGeo = new THREE.SphereGeometry(0.009 * hs, 10, 10);
  const lobe = new THREE.Mesh(lobeGeo, skinMat);
  lobe.position.set(0, -0.022 * hs, 0);
  earGroup.add(lobe);

  return earGroup;
}

/**
 * Builds the complete anatomical head group and eyelid pivots.
 */
export function buildHeadAnatomy(
  props: CharacterProportions,
  mats: {
    skin: THREE.Material;
    hair: THREE.Material;
    mouth: THREE.Material;
    eyeSclera: THREE.Material;
    eyeIris: THREE.Material;
    eyePupil: THREE.Material;
    eyeCatchLight: THREE.Material;
    nostrilCavity: THREE.Material;
    blush: THREE.Material;
  },
  custom: CharacterCustomization
): {
  headGroup: THREE.Group;
  leftEyelid: THREE.Group;
  rightEyelid: THREE.Group;
  sculptedHeadMesh: THREE.Mesh;
} {
  const headGroup = new THREE.Group();
  headGroup.name = 'HeadAnatomyGroup';

  // 1. Single Sculpted Head Mesh
  const headGeo = createHeadGeometry(props);
  const sculptedHeadMesh = new THREE.Mesh(headGeo, mats.skin);
  sculptedHeadMesh.castShadow = true;
  sculptedHeadMesh.receiveShadow = true;
  headGroup.add(sculptedHeadMesh);

  // 2. Eyes & Eyelids
  const leftEye = buildEye(false, props, mats);
  const rightEye = buildEye(true, props, mats);

  headGroup.add(leftEye.eyeGroup);
  headGroup.add(rightEye.eyeGroup);
  headGroup.add(leftEye.eyelidNode);
  headGroup.add(rightEye.eyelidNode);

  // 3. Eyebrows
  headGroup.add(buildEyebrows(props, mats.hair, custom.mood));

  // 4. Sculpted Nose
  headGroup.add(buildNose(props, mats.skin, mats.nostrilCavity));

  // 5. Sculpted Lips
  headGroup.add(buildLips(props, mats.mouth, custom.mood));

  // 6. Ears
  headGroup.add(buildEar(false, props, mats.skin));
  headGroup.add(buildEar(true, props, mats.skin));

  // 7. Female Cheek Blush Decal
  if (props.hasBlush) {
    const hs = props.headScale;
    const blushGeo = new THREE.CircleGeometry(0.026 * hs, 16);
    blushGeo.rotateY(-0.35);

    const leftBlush = new THREE.Mesh(blushGeo, mats.blush);
    leftBlush.position.set(0.068 * hs, -0.004 * hs, 0.080 * hs);

    const rightBlushGeo = new THREE.CircleGeometry(0.026 * hs, 16);
    rightBlushGeo.rotateY(0.35);
    const rightBlush = new THREE.Mesh(rightBlushGeo, mats.blush);
    rightBlush.position.set(-0.068 * hs, -0.004 * hs, 0.080 * hs);

    headGroup.add(leftBlush, rightBlush);
  }

  return {
    headGroup,
    leftEyelid: leftEye.eyelidNode,
    rightEyelid: rightEye.eyelidNode,
    sculptedHeadMesh,
  };
}
