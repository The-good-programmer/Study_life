import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CharacterProportions } from './proportions';
import type { OutfitTop, OutfitBottom, Shoes } from '../../../types/character';
import { buildPelvis } from './bodyBuilder';

// =============================================================================
// PROCEDURAL PROCEDURAL TEXTURES (Generated once and cached)
// =============================================================================

let varsityEmblemTexture: THREE.CanvasTexture | null = null;
function getVarsityEmblemTexture(): THREE.CanvasTexture {
  if (!varsityEmblemTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Circular navy patch
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.arc(64, 64, 56, 0, Math.PI * 2);
    ctx.fill();

    // Gold border
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#fbbf24';
    ctx.stroke();

    // Classic varsity serif 'S'
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 74px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', 64, 66);

    varsityEmblemTexture = new THREE.CanvasTexture(canvas);
  }
  return varsityEmblemTexture;
}

let sweaterBumpTexture: THREE.CanvasTexture | null = null;
function getSweaterBumpTexture(): THREE.CanvasTexture {
  if (!sweaterBumpTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 128, 128);

    // Vertical knit ribbing pattern
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    for (let x = 8; x < 128; x += 16) {
      ctx.beginPath();
      for (let y = 0; y <= 128; y += 8) {
        const offset = Math.sin((y / 16) * Math.PI) * 3;
        if (y === 0) ctx.moveTo(x + offset, y);
        else ctx.lineTo(x + offset, y);
      }
      ctx.stroke();
    }

    sweaterBumpTexture = new THREE.CanvasTexture(canvas);
    sweaterBumpTexture.wrapS = THREE.RepeatWrapping;
    sweaterBumpTexture.wrapT = THREE.RepeatWrapping;
    sweaterBumpTexture.repeat.set(4, 6);
  }
  return sweaterBumpTexture;
}

// =============================================================================
// OUTIFT TOPS & SLEEVES
// =============================================================================

export interface OutfitTopMaterials {
  topPrimary: THREE.MeshStandardMaterial;
  topSecondary: THREE.MeshStandardMaterial;
  skin: THREE.Material;
  goldAccent: THREE.Material;
}

export interface OutfitTopResult {
  outfitGroup: THREE.Group;
  leftUpperArm: THREE.Group;
  rightUpperArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
}

/**
 * Builds upper arm mesh respecting short-sleeve vs long-sleeve clothing.
 */
function buildUpperArmSegment(
  props: CharacterProportions,
  mat: THREE.Material,
  skinMat: THREE.Material,
  length: number,
  isShortSleeve: boolean
): THREE.Group {
  const group = new THREE.Group();

  // Shoulder joint sphere: sleek anatomical articulation
  const jointGeo = new THREE.SphereGeometry(0.050 * props.armThickness, 16, 14);
  jointGeo.scale(1.0, 0.95, 0.95);
  const joint = new THREE.Mesh(jointGeo, mat);
  joint.castShadow = true;
  group.add(joint);

  if (isShortSleeve) {
    // Upper half cloth sleeve
    const sleeveLength = length * 0.48;
    const sleeveGeo = new THREE.CylinderGeometry(
      0.056 * props.armThickness,
      0.051 * props.armThickness,
      sleeveLength,
      16
    );
    const sleeve = new THREE.Mesh(sleeveGeo, mat);
    sleeve.position.y = -sleeveLength * 0.5;
    sleeve.castShadow = true;
    group.add(sleeve);

    // Sleeve cuff hem ring
    const cuffGeo = new THREE.TorusGeometry(0.052 * props.armThickness, 0.0035, 8, 20);
    cuffGeo.rotateX(Math.PI / 2);
    const cuff = new THREE.Mesh(cuffGeo, mat);
    cuff.position.y = -sleeveLength;
    cuff.castShadow = true;
    group.add(cuff);

    // Lower half bare skin
    const skinLength = length - sleeveLength;
    const skinGeo = new THREE.CylinderGeometry(
      0.049 * props.armThickness,
      0.046 * props.armThickness,
      skinLength,
      16
    );
    const skinMesh = new THREE.Mesh(skinGeo, skinMat);
    skinMesh.position.y = -sleeveLength - skinLength * 0.5;
    skinMesh.castShadow = true;
    group.add(skinMesh);
  } else {
    // Full sleeve
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
  }

  return group;
}

/**
 * Builds forearm mesh in either cloth or bare skin.
 */
function buildForearmSegment(
  props: CharacterProportions,
  mat: THREE.Material,
  length: number,
  hasWristCuff: boolean = false,
  cuffMat?: THREE.Material
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

  if (hasWristCuff && cuffMat) {
    const cuffGeo = new THREE.CylinderGeometry(
      0.041 * props.armThickness,
      0.040 * props.armThickness,
      0.024,
      16
    );
    const cuff = new THREE.Mesh(cuffGeo, cuffMat);
    cuff.position.y = -length + 0.012;
    cuff.castShadow = true;
    group.add(cuff);
  }

  return group;
}

export function buildOutfitTop(
  top: OutfitTop,
  props: CharacterProportions,
  mats: OutfitTopMaterials,
  upperArmLength: number,
  forearmLength: number
): OutfitTopResult {
  const outfitGroup = new THREE.Group();

  const isTee = top === 'casual-tee';
  const isVarsity = top === 'varsity-jacket';
  const isHoodie = top === 'hoodie';
  const isSweater = top === 'sweater';

  // Apply or remove bumpMap on sweater
  if (isSweater) {
    mats.topPrimary.bumpMap = getSweaterBumpTexture();
    mats.topPrimary.bumpScale = 0.04;
    mats.topPrimary.needsUpdate = true;
  } else if (mats.topPrimary.bumpMap) {
    mats.topPrimary.bumpMap = null;
    mats.topPrimary.needsUpdate = true;
  }

  // 1. Arm materials according to outfit style
  // Casual tee: short sleeve, skin forearm
  // Varsity: secondary sleeves for BOTH upper arm and forearm (P2 defect 34 fix)
  // Lab coat: white sleeves
  const upperArmMat = isVarsity ? mats.topSecondary : mats.topPrimary;
  const forearmMat = isTee ? mats.skin : (isVarsity ? mats.topSecondary : mats.topPrimary);

  const leftUpperArm = buildUpperArmSegment(props, upperArmMat, mats.skin, upperArmLength, isTee);
  const rightUpperArm = buildUpperArmSegment(props, upperArmMat, mats.skin, upperArmLength, isTee);

  const leftForearm = buildForearmSegment(
    props,
    forearmMat,
    forearmLength,
    isVarsity || isSweater || isHoodie,
    mats.topSecondary
  );
  const rightForearm = buildForearmSegment(
    props,
    forearmMat,
    forearmLength,
    isVarsity || isSweater || isHoodie,
    mats.topSecondary
  );

  // 2. Specific Top Details & Accents
  switch (top) {
    case 'casual-tee': {
      // Crew neck ribbing ring
      const collarGeo = new THREE.TorusGeometry(props.neckRadius * 1.15, 0.012, 10, 24);
      collarGeo.rotateX(Math.PI / 2);
      const collar = new THREE.Mesh(collarGeo, mats.topSecondary);
      collar.position.set(0, 0.22, 0);
      collar.castShadow = true;
      outfitGroup.add(collar);
      break;
    }

    case 'hoodie': {
      // Draped hood resting on upper back/shoulders
      const hoodGeo = new THREE.TorusGeometry(0.10, 0.038, 12, 24, Math.PI * 1.35);
      hoodGeo.rotateX(Math.PI * 0.42);
      const hood = new THREE.Mesh(hoodGeo, mats.topSecondary);
      hood.position.set(0, 0.14, -0.07);
      hood.castShadow = true;

      // Kangaroo belly pocket
      const pocketGeo = new RoundedBoxGeometry(0.20, 0.12, 0.04, 3, 0.015);
      const pocket = new THREE.Mesh(pocketGeo, mats.topSecondary);
      pocket.position.set(0, -0.07, 0.105);
      pocket.castShadow = true;

      // Drawstrings hanging from front neckline
      const strGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.13, 8);
      const strMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.8 });
      const leftStr = new THREE.Mesh(strGeo, strMat);
      leftStr.position.set(0.035, 0.09, 0.115);
      leftStr.castShadow = true;

      // Metal aglets on tips
      const agletGeo = new THREE.CylinderGeometry(0.0036, 0.0036, 0.015, 8);
      const leftAglet = new THREE.Mesh(agletGeo, mats.goldAccent);
      leftAglet.position.y = -0.065;
      leftStr.add(leftAglet);

      const rightStr = leftStr.clone();
      rightStr.position.x = -0.035;

      // Ribbed waist hem ring
      const hemGeo = new THREE.CylinderGeometry(props.waistWidth * 0.49, props.waistWidth * 0.49, 0.035, 24);
      const hem = new THREE.Mesh(hemGeo, mats.topSecondary);
      hem.position.set(0, -0.22, 0);
      hem.scale.set(1.0, 1.0, 0.64);
      hem.castShadow = true;

      outfitGroup.add(hood, pocket, leftStr, rightStr, hem);
      break;
    }

    case 'varsity-jacket': {
      // Striped ribbed collar
      const collarGeo = new THREE.TorusGeometry(props.neckRadius * 1.15, 0.016, 10, 24);
      collarGeo.rotateX(Math.PI / 2);
      const collar = new THREE.Mesh(collarGeo, mats.topSecondary);
      collar.position.set(0, 0.22, 0);
      collar.castShadow = true;

      // Chest letter emblem patch ('S')
      const emblemGeo = new THREE.CircleGeometry(0.032, 20);
      const emblemMat = new THREE.MeshBasicMaterial({
        map: getVarsityEmblemTexture(),
        transparent: true,
      });
      const emblem = new THREE.Mesh(emblemGeo, emblemMat);
      emblem.position.set(0.075, 0.08, 0.118);
      emblem.rotation.y = -0.15;

      // Striped waist hem
      const hemGeo = new THREE.CylinderGeometry(props.waistWidth * 0.49, props.waistWidth * 0.49, 0.038, 24);
      const hem = new THREE.Mesh(hemGeo, mats.topSecondary);
      hem.position.set(0, -0.22, 0);
      hem.scale.set(1.0, 1.0, 0.64);
      hem.castShadow = true;

      outfitGroup.add(collar, emblem, hem);
      break;
    }

    case 'button-down': {
      // Two crisp collar wings pointing forward-down
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.lineTo(0.045, -0.045);
      wingShape.lineTo(0.02, -0.065);
      wingShape.lineTo(-0.01, -0.01);
      wingShape.closePath();

      const extrudeOpts = { depth: 0.006, bevelEnabled: false };
      const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeOpts);

      const leftWing = new THREE.Mesh(wingGeo, mats.topSecondary);
      leftWing.position.set(0.015, 0.21, 0.08);
      leftWing.rotation.set(-0.35, 0.25, -0.1);
      leftWing.castShadow = true;

      const rightWing = new THREE.Mesh(wingGeo, mats.topSecondary);
      rightWing.position.set(-0.015, 0.21, 0.08);
      rightWing.rotation.set(-0.35, -0.25, 0.1);
      rightWing.scale.set(-1, 1, 1);
      rightWing.castShadow = true;

      // Center front placket strip
      const placketGeo = new THREE.BoxGeometry(0.024, 0.38, 0.014);
      const placket = new THREE.Mesh(placketGeo, mats.topSecondary);
      placket.position.set(0, -0.01, 0.112);
      placket.castShadow = true;

      // 5 tiny pearl buttons
      const btnGeo = new THREE.SphereGeometry(0.0035, 8, 8);
      const btnMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
      for (let i = 0; i < 5; i++) {
        const btn = new THREE.Mesh(btnGeo, btnMat);
        btn.position.set(0, 0.12 - i * 0.065, 0.008);
        placket.add(btn);
      }

      outfitGroup.add(leftWing, rightWing, placket);
      break;
    }

    case 'sweater': {
      // Chunky ribbed crew neck
      const collarGeo = new THREE.TorusGeometry(props.neckRadius * 1.18, 0.022, 12, 24);
      collarGeo.rotateX(Math.PI / 2);
      const collar = new THREE.Mesh(collarGeo, mats.topSecondary);
      collar.position.set(0, 0.21, 0);
      collar.castShadow = true;

      // Chunky ribbed waist hem
      const hemGeo = new THREE.CylinderGeometry(props.waistWidth * 0.50, props.waistWidth * 0.50, 0.045, 24);
      const hem = new THREE.Mesh(hemGeo, mats.topSecondary);
      hem.position.set(0, -0.22, 0);
      hem.scale.set(1.0, 1.0, 0.64);
      hem.castShadow = true;

      outfitGroup.add(collar, hem);
      break;
    }

    case 'lab-coat': {
      // Crisp white lapels over open front
      const lapelShape = new THREE.Shape();
      lapelShape.moveTo(0, 0);
      lapelShape.lineTo(0.06, -0.12);
      lapelShape.lineTo(0.01, -0.24);
      lapelShape.lineTo(-0.015, -0.15);
      lapelShape.closePath();

      const lapelGeo = new THREE.ExtrudeGeometry(lapelShape, { depth: 0.008, bevelEnabled: false });

      const leftLapel = new THREE.Mesh(lapelGeo, mats.topPrimary);
      leftLapel.position.set(0.02, 0.20, 0.10);
      leftLapel.rotation.set(-0.25, 0.18, 0);
      leftLapel.castShadow = true;

      const rightLapel = new THREE.Mesh(lapelGeo, mats.topPrimary);
      rightLapel.position.set(-0.02, 0.20, 0.10);
      rightLapel.rotation.set(-0.25, -0.18, 0);
      rightLapel.scale.set(-1, 1, 1);
      rightLapel.castShadow = true;

      // Left chest pocket with pens
      const pocketGeo = new THREE.BoxGeometry(0.052, 0.065, 0.012);
      const pocket = new THREE.Mesh(pocketGeo, mats.topPrimary);
      pocket.position.set(0.085, 0.05, 0.118);
      pocket.castShadow = true;

      // Blue pen
      const penGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.055, 8);
      const bluePenMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.3 });
      const bluePen = new THREE.Mesh(penGeo, bluePenMat);
      bluePen.position.set(-0.012, 0.035, 0.004);
      bluePen.rotation.z = -0.08;

      // Red pen
      const redPenMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 });
      const redPen = new THREE.Mesh(penGeo, redPenMat);
      redPen.position.set(0.012, 0.032, 0.004);
      redPen.rotation.z = 0.08;

      pocket.add(bluePen, redPen);

      // Open coat tails: two separate side panels extending down to mid-thigh/knee level
      // Leaving front completely open so legs swing without clipping
      const tailGeo = new RoundedBoxGeometry(0.14, 0.32, 0.22, 3, 0.02);
      const leftTail = new THREE.Mesh(tailGeo, mats.topPrimary);
      leftTail.position.set(props.hipsWidth * 0.35, -0.32, -0.01);
      leftTail.castShadow = true;

      const rightTail = leftTail.clone();
      rightTail.position.x = -props.hipsWidth * 0.35;

      outfitGroup.add(leftLapel, rightLapel, pocket, leftTail, rightTail);
      break;
    }
  }

  return {
    outfitGroup,
    leftUpperArm,
    rightUpperArm,
    leftForearm,
    rightForearm,
  };
}

// =============================================================================
// OUTIFT BOTTOMS (Pants, Shorts, Pleated Skirt)
// =============================================================================

export interface OutfitBottomMaterials {
  bottom: THREE.MeshStandardMaterial;
  skin: THREE.Material;
  goldAccent: THREE.Material;
}

export interface OutfitBottomResult {
  bottomGroup: THREE.Group;
  leftUpperLeg: THREE.Group;
  rightUpperLeg: THREE.Group;
  leftLowerLeg: THREE.Group;
  rightLowerLeg: THREE.Group;
}

/**
 * Builds upper leg supporting cloth pants vs shorts with bare thigh.
 */
function buildUpperLegSegment(
  props: CharacterProportions,
  clothMat: THREE.Material,
  skinMat: THREE.Material,
  length: number,
  isShorts: boolean,
  isSkirt: boolean
): THREE.Group {
  const group = new THREE.Group();

  const useSkin = isSkirt;
  const mainMat = useSkin ? skinMat : clothMat;

  // Hip joint sphere
  const hipGeo = new THREE.SphereGeometry(props.legThickness * 0.068, 16, 12);
  const hip = new THREE.Mesh(hipGeo, mainMat);
  hip.castShadow = true;
  group.add(hip);

  if (isShorts) {
    // Collegiate athletic shorts extending down to mid-thigh
    const shortsLength = length * 0.58;
    const shortsGeo = new THREE.CylinderGeometry(
      props.legThickness * 0.072,
      props.legThickness * 0.066,
      shortsLength,
      16
    );
    const shortsMesh = new THREE.Mesh(shortsGeo, clothMat);
    shortsMesh.position.y = -shortsLength * 0.5;
    shortsMesh.castShadow = true;
    group.add(shortsMesh);

    // Hem ring
    const hemGeo = new THREE.TorusGeometry(props.legThickness * 0.067, 0.0035, 8, 20);
    hemGeo.rotateX(Math.PI / 2);
    const hem = new THREE.Mesh(hemGeo, clothMat);
    hem.position.y = -shortsLength;
    hem.castShadow = true;
    group.add(hem);

    // Lower half bare skin
    const skinLength = length - shortsLength;
    const skinGeo = new THREE.CylinderGeometry(
      props.legThickness * 0.061,
      props.legThickness * 0.056,
      skinLength,
      16
    );
    const skinMesh = new THREE.Mesh(skinGeo, skinMat);
    skinMesh.position.y = -shortsLength - skinLength * 0.5;
    skinMesh.castShadow = true;
    group.add(skinMesh);
  } else {
    // Full pants segment or bare leg
    const shaftGeo = new THREE.CylinderGeometry(
      props.legThickness * 0.068,
      props.legThickness * 0.056,
      length,
      16
    );
    const shaft = new THREE.Mesh(shaftGeo, mainMat);
    shaft.position.y = -length * 0.5;
    shaft.castShadow = true;
    group.add(shaft);
  }

  return group;
}

/**
 * Builds lower leg segment supporting cloth pants vs shorts bare leg vs joggers ankle cuff.
 */
function buildLowerLegSegment(
  props: CharacterProportions,
  clothMat: THREE.Material,
  skinMat: THREE.Material,
  length: number,
  isShorts: boolean,
  isSkirt: boolean,
  isJoggers: boolean
): THREE.Group {
  const group = new THREE.Group();

  const useSkin = isShorts || isSkirt;
  const mainMat = useSkin ? skinMat : clothMat;

  // Knee joint sphere
  const kneeGeo = new THREE.SphereGeometry(props.legThickness * 0.056, 16, 12);
  const knee = new THREE.Mesh(kneeGeo, mainMat);
  knee.castShadow = true;
  group.add(knee);

  // Shaft
  const shaftGeo = new THREE.CylinderGeometry(
    props.legThickness * 0.055,
    props.legThickness * 0.045,
    length,
    16
  );
  const shaft = new THREE.Mesh(shaftGeo, mainMat);
  shaft.position.y = -length * 0.5;
  shaft.castShadow = true;
  group.add(shaft);

  // Joggers ribbed elastic ankle cuff
  if (isJoggers) {
    const cuffGeo = new THREE.CylinderGeometry(
      props.legThickness * 0.048,
      props.legThickness * 0.044,
      0.035,
      16
    );
    const cuff = new THREE.Mesh(cuffGeo, clothMat);
    cuff.position.y = -length + 0.018;
    cuff.castShadow = true;
    group.add(cuff);
  }

  return group;
}

/**
 * Builds genuine 20-pleat accordion tennis skirt geometry.
 */
function buildPleatedSkirtGeometry(props: CharacterProportions): THREE.BufferGeometry {
  const numPleats = 20;
  const segments = numPleats * 2;
  const waistRadius = props.hipsWidth * 0.51;
  const hemOuterRadius = props.hipsWidth * 0.80;
  const hemInnerRadius = props.hipsWidth * 0.72;
  const skirtHeight = 0.26;

  const positions: number[] = [];
  const indices: number[] = [];

  // Generate top ring (waist) and bottom ring (alternating pleats)
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Top vertex at waist
    positions.push(cos * waistRadius, -0.04, sin * waistRadius * 0.78);

    // Bottom vertex at hem (alternates outer ridge and inner valley)
    const isRidge = i % 2 === 0;
    const hemR = isRidge ? hemOuterRadius : hemInnerRadius;
    positions.push(cos * hemR, -0.04 - skirtHeight, sin * hemR * 0.78);
  }

  // Create quads (2 triangles per segment)
  for (let i = 0; i < segments; i++) {
    const top1 = i * 2;
    const bot1 = i * 2 + 1;
    const top2 = (i + 1) * 2;
    const bot2 = (i + 1) * 2 + 1;

    indices.push(top1, bot1, top2);
    indices.push(top2, bot1, bot2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildOutfitBottom(
  bottom: OutfitBottom,
  props: CharacterProportions,
  mats: OutfitBottomMaterials
): OutfitBottomResult {
  const bottomGroup = new THREE.Group();

  const isSkirt = bottom === 'pleated-skirt';
  const isShorts = bottom === 'shorts';
  const isJoggers = bottom === 'joggers';
  const isChinos = bottom === 'chinos';
  const isJeans = bottom === 'jeans';

  const upperLegLength = props.legLength * 0.5;
  const lowerLegLength = props.legLength * 0.5;

  // Pelvis brief volume
  bottomGroup.add(buildPelvis(props, mats.bottom));

  // Build legs
  const leftUpperLeg = buildUpperLegSegment(props, mats.bottom, mats.skin, upperLegLength, isShorts, isSkirt);
  const rightUpperLeg = buildUpperLegSegment(props, mats.bottom, mats.skin, upperLegLength, isShorts, isSkirt);

  const leftLowerLeg = buildLowerLegSegment(props, mats.bottom, mats.skin, lowerLegLength, isShorts, isSkirt, isJoggers);
  const rightLowerLeg = buildLowerLegSegment(props, mats.bottom, mats.skin, lowerLegLength, isShorts, isSkirt, isJoggers);

  // Bottom Specific Accents
  if (isSkirt) {
    const skirtGeo = buildPleatedSkirtGeometry(props);
    const skirtMesh = new THREE.Mesh(skirtGeo, mats.bottom);
    skirtMesh.material.side = THREE.DoubleSide;
    skirtMesh.castShadow = true;
    bottomGroup.add(skirtMesh);
  } else if (isChinos) {
    // Belt with metallic gold buckle
    const beltGeo = new THREE.CylinderGeometry(props.waistWidth * 0.50, props.waistWidth * 0.50, 0.026, 24);
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x271e1b, roughness: 0.6 });
    const belt = new THREE.Mesh(beltGeo, beltMat);
    belt.position.set(0, 0.06, 0);
    belt.scale.set(1.0, 1.0, 0.65);
    belt.castShadow = true;

    const buckleGeo = new THREE.BoxGeometry(0.038, 0.030, 0.012);
    const buckle = new THREE.Mesh(buckleGeo, mats.goldAccent);
    buckle.position.set(0, 0.06, props.waistWidth * 0.33);
    buckle.castShadow = true;

    bottomGroup.add(belt, buckle);
  } else if (isJoggers) {
    // Waist tie cords
    const cordGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.08, 8);
    const cordMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.8 });
    const leftCord = new THREE.Mesh(cordGeo, cordMat);
    leftCord.position.set(0.02, 0.04, props.waistWidth * 0.32);
    leftCord.rotation.set(0.2, 0, -0.15);

    const rightCord = leftCord.clone();
    rightCord.position.x = -0.02;
    rightCord.rotation.set(0.2, 0, 0.15);

    bottomGroup.add(leftCord, rightCord);
  } else if (isJeans) {
    // Front curved pocket stitching lines
    const stitchPoints = [
      new THREE.Vector3(props.hipsWidth * 0.22, 0.02, props.hipsWidth * 0.26),
      new THREE.Vector3(props.hipsWidth * 0.35, -0.02, props.hipsWidth * 0.22),
      new THREE.Vector3(props.hipsWidth * 0.44, -0.04, props.hipsWidth * 0.08),
    ];
    const stitchCurve = new THREE.CatmullRomCurve3(stitchPoints);
    const stitchGeo = new THREE.TubeGeometry(stitchCurve, 12, 0.002, 6, false);
    const stitchMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 });
    const leftStitch = new THREE.Mesh(stitchGeo, stitchMat);

    const rightPoints = stitchPoints.map((p) => new THREE.Vector3(-p.x, p.y, p.z));
    const rightCurve = new THREE.CatmullRomCurve3(rightPoints);
    const rightGeo = new THREE.TubeGeometry(rightCurve, 12, 0.002, 6, false);
    const rightStitch = new THREE.Mesh(rightGeo, stitchMat);

    bottomGroup.add(leftStitch, rightStitch);
  }

  return {
    bottomGroup,
    leftUpperLeg,
    rightUpperLeg,
    leftLowerLeg,
    rightLowerLeg,
  };
}

// =============================================================================
// DISTINCT FOOTWEAR SILHOUETTES (Sneakers, Running, Loafers, Boots)
// Lowest vertex is strictly at local y = -0.070 (Floor = 0.000m)
// =============================================================================

export function buildShoeModel(
  shoesStyle: Shoes,
  shoeMat: THREE.Material,
  soleMat: THREE.Material,
  accentMat: THREE.Material
): THREE.Group {
  const group = new THREE.Group();

  switch (shoesStyle) {
    case 'sneakers': {
      // Crisp midsole with smooth rounded edges
      const soleThickness = 0.025;
      const soleLength = 0.225;
      const soleCenterY = -0.070 + soleThickness * 0.5;
      const soleZ = 0.055;

      const soleGeo = new RoundedBoxGeometry(0.086, soleThickness, soleLength, 3, 0.006);
      const sole = new THREE.Mesh(soleGeo, soleMat);
      sole.position.set(0, soleCenterY, soleZ);
      sole.castShadow = true;

      // Contoured sneaker upper: tapered toe slope and curved heel collar
      const upperHeight = 0.066;
      const upperCenterY = -0.070 + soleThickness + upperHeight * 0.5;
      const upperGeo = new RoundedBoxGeometry(0.080, upperHeight, soleLength - 0.008, 4, 0.012);
      const pos = upperGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const lx = pos.getX(i);
        const ly = pos.getY(i);
        const lz = pos.getZ(i);
        // Slope toe downwards and inwards
        if (lz > 0.02) {
          const t = (lz - 0.02) / (soleLength * 0.5 - 0.02);
          pos.setY(i, ly - t * 0.020);
          pos.setX(i, lx * (1.0 - t * 0.16));
        }
        // Heel contour curve
        if (lz < -0.04 && ly > 0) {
          const ht = (-0.04 - lz) / (soleLength * 0.5 - 0.04);
          pos.setY(i, ly + ht * 0.006);
        }
      }
      upperGeo.computeVertexNormals();

      const upper = new THREE.Mesh(upperGeo, shoeMat);
      upper.position.set(0, upperCenterY, soleZ - 0.004);
      upper.castShadow = true;

      // Padded ankle collar ring
      const collarGeo = new THREE.TorusGeometry(0.038, 0.006, 8, 20);
      collarGeo.rotateX(Math.PI / 2);
      const collar = new THREE.Mesh(collarGeo, shoeMat);
      collar.position.set(0, 0.018, soleZ - 0.035);
      collar.castShadow = true;

      // Low-profile laces strip flush against instep slope
      const lacesGeo = new RoundedBoxGeometry(0.032, 0.006, 0.065, 2, 0.002);
      const laces = new THREE.Mesh(lacesGeo, soleMat);
      laces.position.set(0, upperCenterY + 0.008, soleZ + 0.015);
      laces.rotation.x = -0.32;
      laces.castShadow = true;

      group.add(sole, upper, collar, laces);
      break;
    }

    case 'running': {
      // Sculpted wedge athletic sole with toe spring
      const soleThickness = 0.028;
      const soleLength = 0.235;
      const soleCenterY = -0.070 + soleThickness * 0.5;
      const soleZ = 0.058;

      const soleGeo = new RoundedBoxGeometry(0.092, soleThickness, soleLength, 3, 0.008);
      const sole = new THREE.Mesh(soleGeo, soleMat);
      sole.position.set(0, soleCenterY, soleZ);
      sole.castShadow = true;

      // Aerodynamic mesh upper
      const upperHeight = 0.064;
      const upperCenterY = -0.070 + soleThickness + upperHeight * 0.5 - 0.002;
      const upperGeo = new RoundedBoxGeometry(0.084, upperHeight, soleLength - 0.014, 3, 0.010);
      const upper = new THREE.Mesh(upperGeo, shoeMat);
      upper.position.set(0, upperCenterY, soleZ - 0.006);
      upper.castShadow = true;

      // Athletic swoosh/stripe accent along outer quarter
      const stripePoints = [
        new THREE.Vector3(0.044, upperCenterY - 0.008, soleZ + 0.04),
        new THREE.Vector3(0.045, upperCenterY + 0.010, soleZ),
        new THREE.Vector3(0.043, upperCenterY + 0.022, soleZ - 0.05),
      ];
      const stripeCurve = new THREE.CatmullRomCurve3(stripePoints);
      const stripeGeo = new THREE.TubeGeometry(stripeCurve, 8, 0.0035, 6, false);
      const stripe = new THREE.Mesh(stripeGeo, accentMat);
      stripe.castShadow = true;

      // Heel pull tab
      const tabGeo = new THREE.BoxGeometry(0.016, 0.028, 0.008);
      const tab = new THREE.Mesh(tabGeo, accentMat);
      tab.position.set(0, upperCenterY + 0.038, soleZ - 0.098);
      tab.rotation.x = -0.25;

      group.add(sole, upper, stripe, tab);
      break;
    }

    case 'loafers': {
      // Sleek low-cut dress sole
      const soleThickness = 0.022;
      const soleLength = 0.222;
      const soleCenterY = -0.070 + soleThickness * 0.5;
      const soleZ = 0.054;

      const soleGeo = new RoundedBoxGeometry(0.086, soleThickness, soleLength, 3, 0.004);
      const sole = new THREE.Mesh(soleGeo, soleMat);
      sole.position.set(0, soleCenterY, soleZ);
      sole.castShadow = true;

      // Separated dress heel lift at rear
      const heelGeo = new RoundedBoxGeometry(0.084, 0.010, 0.065, 2, 0.003);
      const heel = new THREE.Mesh(heelGeo, soleMat);
      heel.position.set(0, -0.070 + 0.005, soleZ - 0.065);
      heel.castShadow = true;

      // Low sleek leather upper
      const upperHeight = 0.054;
      const upperCenterY = -0.070 + soleThickness + upperHeight * 0.5 - 0.002;
      const upperGeo = new RoundedBoxGeometry(0.080, upperHeight, soleLength - 0.012, 3, 0.008);
      const upper = new THREE.Mesh(upperGeo, shoeMat);
      upper.position.set(0, upperCenterY, soleZ - 0.005);
      upper.castShadow = true;

      // Penny loafer apron saddle strap bar across instep
      const strapGeo = new THREE.BoxGeometry(0.076, 0.014, 0.024);
      const strap = new THREE.Mesh(strapGeo, shoeMat);
      strap.position.set(0, upperCenterY + 0.020, soleZ + 0.025);
      strap.rotation.x = -0.28;
      strap.castShadow = true;

      group.add(sole, heel, upper, strap);
      break;
    }

    case 'boots': {
      // Heavy lugged commando sole
      const soleThickness = 0.028;
      const soleLength = 0.230;
      const soleCenterY = -0.070 + soleThickness * 0.5;
      const soleZ = 0.055;

      const soleGeo = new RoundedBoxGeometry(0.090, soleThickness, soleLength, 3, 0.005);
      const sole = new THREE.Mesh(soleGeo, soleMat);
      sole.position.set(0, soleCenterY, soleZ);
      sole.castShadow = true;

      // Lower foot boot upper
      const footHeight = 0.070;
      const footCenterY = -0.070 + soleThickness + footHeight * 0.5 - 0.002;
      const footGeo = new RoundedBoxGeometry(0.084, footHeight, soleLength - 0.012, 3, 0.010);
      const foot = new THREE.Mesh(footGeo, shoeMat);
      foot.position.set(0, footCenterY, soleZ - 0.005);
      foot.castShadow = true;

      // Tall boot shaft extending up the shin covering the ankle
      const shaftHeight = 0.085;
      const shaftGeo = new THREE.CylinderGeometry(0.052, 0.048, shaftHeight, 16);
      const shaft = new THREE.Mesh(shaftGeo, shoeMat);
      shaft.position.set(0, 0.038, 0.005);
      shaft.castShadow = true;

      // Top collar cuff & buckle
      const cuffGeo = new THREE.TorusGeometry(0.052, 0.006, 8, 20);
      cuffGeo.rotateX(Math.PI / 2);
      const cuff = new THREE.Mesh(cuffGeo, shoeMat);
      cuff.position.set(0, 0.078, 0.005);
      cuff.castShadow = true;

      const buckleGeo = new THREE.BoxGeometry(0.016, 0.016, 0.008);
      const buckle = new THREE.Mesh(buckleGeo, accentMat);
      buckle.position.set(0.054, 0.065, 0.005);
      buckle.castShadow = true;

      group.add(sole, foot, shaft, cuff, buckle);
      break;
    }
  }

  return group;
}
