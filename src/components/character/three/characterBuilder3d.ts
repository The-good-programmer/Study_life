import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CharacterAnimationEngine } from './animation';
import { getProportions, type CharacterProportions } from './proportions';
import { 
  buildTorsoLathe, 
  buildHandMesh, 
  buildNeckMesh 
} from './bodyBuilder';
import { 
  buildOutfitTop, 
  buildOutfitBottom, 
  buildShoeModel 
} from './outfit';
import { buildHeadAnatomy, getBlushTexture } from './head';
import { buildHairMesh } from './hair';
import { 
  buildFacialHairMesh, 
  buildEyewearMesh, 
  buildHeadwearMesh 
} from './accessories';
import type { 
  CharacterCustomization, 
  CharacterPose, 
  HairStyle, 
  Eyewear, 
  Headwear, 
  OutfitTop, 
  OutfitBottom, 
  Shoes, 
  CharacterGender,
  FacialHair 
} from '../../../types/character';

export interface CharacterModelInstance {
  root: THREE.Group;
  update: (deltaSeconds: number, poseOverride?: CharacterPose) => void;
  updateCustomization: (custom: CharacterCustomization) => void;
  setLookTarget: (targetPos: THREE.Vector3) => void;
  dispose: () => void;
}

/** Helper to clean up meshes and materials recursively */
export function disposeHierarchy(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    }
  });
}

/** Helper to clean up geometries only, preserving shared materials */
export function disposeGeometries(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    }
  });
}

/** Blends two hex colors by a factor [0, 1] */
function blendColor(hex1: string, hex2: string, factor: number): THREE.Color {
  const c1 = new THREE.Color(hex1);
  const c2 = new THREE.Color(hex2);
  return c1.lerp(c2, THREE.MathUtils.clamp(factor, 0, 1));
}

let blobShadowTexture: THREE.CanvasTexture | null = null;
function getBlobShadowTexture(): THREE.CanvasTexture {
  if (!blobShadowTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.22)');
    grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.06)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    blobShadowTexture = new THREE.CanvasTexture(canvas);
  }
  return blobShadowTexture;
}

/**
 * Builds a high-fidelity, anatomically grounded, customizable 3D human student model.
 * Realistic meter scale (~1.74m tall) with distinct, unmistakably masculine,
 * feminine, or androgynous human craniofacial anatomy and athletic posture.
 */
export function buildCharacter3D(
  custom: CharacterCustomization,
  options: { showPedestal?: boolean; showShadow?: boolean } = {}
): CharacterModelInstance {
  const root = new THREE.Group();
  root.name = 'Character3D_Root';

  let currentCustom = { ...custom };

  // Rig node references for animators (Bone hierarchy never cleared; sub-mesh containers are cleared)
  const nodes = {
    bodyGroup: new THREE.Group(),
    hips: new THREE.Group(),
    spine: new THREE.Group(),
    chest: new THREE.Group(),
    torsoBreathingContainer: new THREE.Group(),
    neck: new THREE.Group(),
    neckMeshContainer: new THREE.Group(),
    head: new THREE.Group(),
    leftArm: new THREE.Group(),
    leftUpperArmMeshContainer: new THREE.Group(),
    leftForearm: new THREE.Group(),
    leftForearmMeshContainer: new THREE.Group(),
    leftHandContainer: new THREE.Group(),
    rightArm: new THREE.Group(),
    rightUpperArmMeshContainer: new THREE.Group(),
    rightForearm: new THREE.Group(),
    rightForearmMeshContainer: new THREE.Group(),
    rightHandContainer: new THREE.Group(),
    leftLeg: new THREE.Group(),
    leftUpperLegMeshContainer: new THREE.Group(),
    leftLowerLeg: new THREE.Group(),
    leftLowerLegMeshContainer: new THREE.Group(),
    leftShoeContainer: new THREE.Group(),
    rightLeg: new THREE.Group(),
    rightUpperLegMeshContainer: new THREE.Group(),
    rightLowerLeg: new THREE.Group(),
    rightLowerLegMeshContainer: new THREE.Group(),
    rightShoeContainer: new THREE.Group(),
    leftEyelid: new THREE.Group(),
    rightEyelid: new THREE.Group(),
    heldBookGroup: new THREE.Group(),
    coreAnatomyContainer: new THREE.Group(),
    hairContainer: new THREE.Group(),
    facialHairContainer: new THREE.Group(),
    eyewearContainer: new THREE.Group(),
    headwearContainer: new THREE.Group(),
    outfitContainer: new THREE.Group(),
    bottomContainer: new THREE.Group(),
    pedestal: new THREE.Group(),
    shadowDisc: new THREE.Mesh(),
  };

  // -------------------------------------------------------------------------
  // Proportions according to gender and body type & Skeletal Joint Rigging
  // -------------------------------------------------------------------------
  const ANKLE_HEIGHT = 0.070;
  const UPPER_ARM_LENGTH = 0.28;
  const FOREARM_LENGTH = 0.25;

  function updateRigJoints(p: CharacterProportions) {
    const upperLegLength = p.legLength * 0.5;
    const lowerLegLength = p.legLength * 0.5;
    const hipJointY = ANKLE_HEIGHT + p.legLength;

    nodes.hips.position.y = hipJointY;
    nodes.spine.position.y = 0.10;
    nodes.chest.position.y = 0.18;
    nodes.neck.position.y = 0.24;
    nodes.head.position.y = 0.12;

    const armPivotX = p.shoulderWidth * 0.5 - 0.025;
    nodes.leftArm.position.set(armPivotX, 0.20, 0);
    nodes.rightArm.position.set(-armPivotX, 0.20, 0);
    nodes.leftForearm.position.set(0, -UPPER_ARM_LENGTH, 0);
    nodes.rightForearm.position.set(0, -UPPER_ARM_LENGTH, 0);
    nodes.leftHandContainer.position.set(0, -FOREARM_LENGTH, 0);
    nodes.rightHandContainer.position.set(0, -FOREARM_LENGTH, 0);

    const hipJointX = p.hipsWidth * 0.28;
    nodes.leftLeg.position.set(hipJointX, 0, 0);
    nodes.rightLeg.position.set(-hipJointX, 0, 0);
    nodes.leftLowerLeg.position.set(0, -upperLegLength, 0);
    nodes.rightLowerLeg.position.set(0, -upperLegLength, 0);
    nodes.leftShoeContainer.position.set(0, -lowerLegLength, 0);
    nodes.rightShoeContainer.position.set(0, -lowerLegLength, 0);
  }

  // Materials map for dynamic color tweaking without geometry rebuilding
  const computeLipColor = (skinTone: string, gender: CharacterGender) => {
    if (gender === 'male') {
      return blendColor(skinTone, '#a25141', 0.42);
    } else if (gender === 'female') {
      return blendColor(skinTone, '#be185d', 0.55);
    }
    return blendColor(skinTone, '#b45309', 0.45);
  };

  const mats = {
    skin: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(currentCustom.skinTone),
      roughness: 0.55,
      metalness: 0.0,
      sheen: 0.3,
      sheenColor: new THREE.Color(0xffe4d6),
    }),
    hair: new THREE.MeshStandardMaterial({
      color: new THREE.Color(currentCustom.hairColor),
      roughness: 0.48,
      metalness: 0.04,
    }),
    facialHair: new THREE.MeshStandardMaterial({
      color: new THREE.Color(currentCustom.facialHairColor || currentCustom.hairColor),
      roughness: 0.65,
      metalness: 0.05,
    }),
    eyeIris: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(currentCustom.eyeColor),
      roughness: 0.15,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    }),
    eyeSclera: new THREE.MeshStandardMaterial({ 
      color: 0xfafafa,
      roughness: 0.3,
      metalness: 0.0,
    }),
    eyePupil: new THREE.MeshBasicMaterial({ color: 0x070709 }),
    cornea: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      opacity: 0.15,
      transparent: true,
      roughness: 0.05,
      clearcoat: 1.0,
    }),
    mouth: new THREE.MeshStandardMaterial({ 
      color: computeLipColor(currentCustom.skinTone, currentCustom.gender),
      roughness: 0.5,
      metalness: 0.02,
    }),
    nostrilCavity: new THREE.MeshBasicMaterial({ color: 0x1f1512 }),
    eyeCatchLight: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    blush: new THREE.MeshBasicMaterial({ 
      map: getBlushTexture(), 
      transparent: true, 
      opacity: 0.25,
      depthWrite: false,
    }),
    topPrimary: new THREE.MeshStandardMaterial({
      color: new THREE.Color(currentCustom.topColor),
      roughness: 0.72,
      metalness: 0.05,
    }),
    topSecondary: new THREE.MeshStandardMaterial({
      color: new THREE.Color(currentCustom.topSecondaryColor),
      roughness: 0.65,
      metalness: 0.05,
    }),
    labCoatWhite: new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.65,
      metalness: 0.05,
    }),
    bottom: new THREE.MeshStandardMaterial({
      color: new THREE.Color(currentCustom.bottomColor),
      roughness: 0.78,
      metalness: 0.04,
    }),
    shoes: new THREE.MeshStandardMaterial({
      color: new THREE.Color(currentCustom.shoesColor),
      roughness: 0.52,
      metalness: 0.08,
    }),
    shoesSole: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.05,
    }),
    glasses: new THREE.MeshStandardMaterial({
      color: new THREE.Color(currentCustom.eyewearColor),
      roughness: 0.25,
      metalness: 0.75,
    }),
    glassesLens: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.14,
      roughness: 0.05,
      clearcoat: 1.0,
    }),
    headwear: new THREE.MeshStandardMaterial({
      color: new THREE.Color(currentCustom.headwearColor),
      roughness: 0.68,
      metalness: 0.1,
    }),
    goldAccent: new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.2,
      metalness: 0.85,
    }),
    bookCover: new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      roughness: 0.5,
      metalness: 0.1,
    }),
    bookPages: new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      roughness: 0.8,
    }),
  };

  // -------------------------------------------------------------------------
  // Ground Shadow & Studio Pedestal
  // -------------------------------------------------------------------------
  if (options.showShadow !== false) {
    const shadowGeo = new THREE.PlaneGeometry(1.05, 1.05);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: getBlobShadowTexture(),
      transparent: true,
      depthWrite: false,
    });
    nodes.shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
    nodes.shadowDisc.rotation.x = -Math.PI / 2;
    nodes.shadowDisc.position.y = 0.003;
    root.add(nodes.shadowDisc);
  }

  if (options.showPedestal) {
    const pedGroup = new THREE.Group();
    const baseGeo = new THREE.CylinderGeometry(0.70, 0.74, 0.06, 36);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.5,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -0.03;
    baseMesh.receiveShadow = true;
    pedGroup.add(baseMesh);

    const rimGeo = new THREE.TorusGeometry(0.72, 0.012, 16, 48);
    const rimMat = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 0.001;
    pedGroup.add(rimMesh);

    nodes.pedestal = pedGroup;
    root.add(pedGroup);
  }

  // -------------------------------------------------------------------------
  // Skeleton / Transform Tree Assembly (PERMANENT SKELETON - NEVER CLEARED)
  // -------------------------------------------------------------------------
  root.add(nodes.bodyGroup);
  nodes.bodyGroup.add(nodes.hips);
  nodes.hips.add(nodes.spine);
  nodes.spine.add(nodes.chest);
  nodes.chest.add(nodes.neck);

  // Neck holds neck mesh container AND head bone
  nodes.neck.add(nodes.neckMeshContainer);
  nodes.neck.add(nodes.head);

  // Head holds its modular attachments
  nodes.head.add(nodes.coreAnatomyContainer);
  nodes.head.add(nodes.hairContainer);
  nodes.head.add(nodes.facialHairContainer);
  nodes.head.add(nodes.eyewearContainer);
  nodes.head.add(nodes.headwearContainer);

  // Chest attachments
  nodes.chest.add(nodes.torsoBreathingContainer);
  nodes.torsoBreathingContainer.add(nodes.outfitContainer);
  nodes.chest.add(nodes.heldBookGroup);
  nodes.chest.add(nodes.leftArm);
  nodes.chest.add(nodes.rightArm);

  // Left arm chain
  nodes.leftArm.add(nodes.leftUpperArmMeshContainer);
  nodes.leftArm.add(nodes.leftForearm);
  nodes.leftForearm.add(nodes.leftForearmMeshContainer);
  nodes.leftForearm.add(nodes.leftHandContainer);

  // Right arm chain
  nodes.rightArm.add(nodes.rightUpperArmMeshContainer);
  nodes.rightArm.add(nodes.rightForearm);
  nodes.rightForearm.add(nodes.rightForearmMeshContainer);
  nodes.rightForearm.add(nodes.rightHandContainer);

  // Hips & Legs chain
  nodes.hips.add(nodes.bottomContainer);
  nodes.hips.add(nodes.leftLeg);
  nodes.hips.add(nodes.rightLeg);

  // Left leg chain
  nodes.leftLeg.add(nodes.leftUpperLegMeshContainer);
  nodes.leftLeg.add(nodes.leftLowerLeg);
  nodes.leftLowerLeg.add(nodes.leftLowerLegMeshContainer);
  nodes.leftLowerLeg.add(nodes.leftShoeContainer);

  // Right leg chain
  nodes.rightLeg.add(nodes.rightUpperLegMeshContainer);
  nodes.rightLeg.add(nodes.rightLowerLeg);
  nodes.rightLowerLeg.add(nodes.rightLowerLegMeshContainer);
  nodes.rightLowerLeg.add(nodes.rightShoeContainer);

  // Initial rig joint positions derived from proportions
  updateRigJoints(getProportions(currentCustom.gender, currentCustom.bodyType));

  // -------------------------------------------------------------------------
  // Anatomical Human Head, Face, Neck & Hands Construction
  // -------------------------------------------------------------------------
  function rebuildCoreAnatomy() {
    disposeGeometries(nodes.coreAnatomyContainer);
    nodes.coreAnatomyContainer.clear();

    disposeGeometries(nodes.neckMeshContainer);
    nodes.neckMeshContainer.clear();

    disposeGeometries(nodes.leftHandContainer);
    nodes.leftHandContainer.clear();

    disposeGeometries(nodes.rightHandContainer);
    nodes.rightHandContainer.clear();

    const props = getProportions(currentCustom.gender, currentCustom.bodyType);

    // Update dynamic materials
    mats.mouth.color.copy(computeLipColor(currentCustom.skinTone, currentCustom.gender));

    // Update joint positions based on proportions
    updateRigJoints(props);

    // =========================================================================
    // 1. ANATOMICAL NECK
    // =========================================================================
    nodes.neckMeshContainer.add(buildNeckMesh(props, mats.skin));

    // =========================================================================
    // 2. UNIFIED PROCEDURAL HEAD & FACE ANATOMY
    // =========================================================================
    const headAnatomy = buildHeadAnatomy(props, mats, currentCustom);
    nodes.coreAnatomyContainer.add(headAnatomy.headGroup);
    nodes.leftEyelid = headAnatomy.leftEyelid;
    nodes.rightEyelid = headAnatomy.rightEyelid;

    // =========================================================================
    // 9. ARTICULATED HUMAN HANDS (Palm, Opposable Thumb & Natural Rest Curl)
    // =========================================================================
    nodes.leftHandContainer.add(buildHandMesh(props, mats.skin, false));
    nodes.rightHandContainer.add(buildHandMesh(props, mats.skin, true));
  }

  // -------------------------------------------------------------------------
  // Modular Facial Hair (Stubble, Goatee, Trimmed Beard)
  // -------------------------------------------------------------------------
  function rebuildFacialHair(style: FacialHair = 'none') {
    disposeGeometries(nodes.facialHairContainer);
    nodes.facialHairContainer.clear();

    const props = getProportions(currentCustom.gender, currentCustom.bodyType);
    nodes.facialHairContainer.add(
      buildFacialHairMesh(
        style,
        props,
        mats,
        currentCustom.skinTone,
        currentCustom.facialHairColor || currentCustom.hairColor
      )
    );
  }

  // -------------------------------------------------------------------------
  // Modular Hairstyles (High-fidelity 3D volume, strands & hairlines)
  // -------------------------------------------------------------------------
  function rebuildHair(style: HairStyle) {
    disposeGeometries(nodes.hairContainer);
    nodes.hairContainer.clear();

    const props = getProportions(currentCustom.gender, currentCustom.bodyType);
    nodes.hairContainer.add(buildHairMesh(style, props, mats.hair));
  }

  // -------------------------------------------------------------------------
  // Modular Eyewear & Glasses
  // -------------------------------------------------------------------------
  function rebuildEyewear(eyewear: Eyewear) {
    disposeGeometries(nodes.eyewearContainer);
    nodes.eyewearContainer.clear();

    const props = getProportions(currentCustom.gender, currentCustom.bodyType);
    nodes.eyewearContainer.add(buildEyewearMesh(eyewear, props, mats));
  }

  // -------------------------------------------------------------------------
  // Modular Headwear (Cap, Beanie, Mortarboard, Headphones, etc.)
  // -------------------------------------------------------------------------
  function rebuildHeadwear(headwear: Headwear) {
    disposeGeometries(nodes.headwearContainer);
    nodes.headwearContainer.clear();

    const props = getProportions(currentCustom.gender, currentCustom.bodyType);
    nodes.headwearContainer.add(
      buildHeadwearMesh(headwear, currentCustom.hairStyle, props, mats)
    );
  }

  // -------------------------------------------------------------------------
  // Modular Tops & Clothing (Anatomical V-taper Torso & Deltoid Shoulders)
  // -------------------------------------------------------------------------
  function rebuildOutfit(top: OutfitTop) {
    disposeGeometries(nodes.outfitContainer);
    nodes.outfitContainer.clear();

    disposeGeometries(nodes.leftUpperArmMeshContainer);
    nodes.leftUpperArmMeshContainer.clear();

    disposeGeometries(nodes.rightUpperArmMeshContainer);
    nodes.rightUpperArmMeshContainer.clear();

    disposeGeometries(nodes.leftForearmMeshContainer);
    nodes.leftForearmMeshContainer.clear();

    disposeGeometries(nodes.rightForearmMeshContainer);
    nodes.rightForearmMeshContainer.clear();

    const props = getProportions(currentCustom.gender, currentCustom.bodyType);

    // Anatomical Torso via continuous LatheGeometry in torsoBreathingContainer
    disposeGeometries(nodes.torsoBreathingContainer);
    nodes.torsoBreathingContainer.clear();
    const torsoMat = top === 'lab-coat' ? mats.labCoatWhite : mats.topPrimary;
    nodes.torsoBreathingContainer.add(buildTorsoLathe(props, torsoMat, currentCustom.gender === 'female'));

    const outfitRes = buildOutfitTop(
      top,
      props,
      {
        topPrimary: top === 'lab-coat' ? mats.labCoatWhite : mats.topPrimary,
        topSecondary: mats.topSecondary,
        skin: mats.skin,
        goldAccent: mats.goldAccent,
      },
      UPPER_ARM_LENGTH,
      FOREARM_LENGTH
    );

    nodes.leftUpperArmMeshContainer.add(outfitRes.leftUpperArm);
    nodes.rightUpperArmMeshContainer.add(outfitRes.rightUpperArm);
    nodes.leftForearmMeshContainer.add(outfitRes.leftForearm);
    nodes.rightForearmMeshContainer.add(outfitRes.rightForearm);
    nodes.outfitContainer.add(outfitRes.outfitGroup);
  }

  // -------------------------------------------------------------------------
  // Modular Bottoms & Pants
  // -------------------------------------------------------------------------
  function rebuildBottom(bottom: OutfitBottom) {
    disposeGeometries(nodes.bottomContainer);
    nodes.bottomContainer.clear();

    disposeGeometries(nodes.leftUpperLegMeshContainer);
    nodes.leftUpperLegMeshContainer.clear();

    disposeGeometries(nodes.rightUpperLegMeshContainer);
    nodes.rightUpperLegMeshContainer.clear();

    disposeGeometries(nodes.leftLowerLegMeshContainer);
    nodes.leftLowerLegMeshContainer.clear();

    disposeGeometries(nodes.rightLowerLegMeshContainer);
    nodes.rightLowerLegMeshContainer.clear();

    const props = getProportions(currentCustom.gender, currentCustom.bodyType);
    const bottomRes = buildOutfitBottom(bottom, props, {
      bottom: mats.bottom,
      skin: mats.skin,
      goldAccent: mats.goldAccent,
    });

    nodes.leftUpperLegMeshContainer.add(bottomRes.leftUpperLeg);
    nodes.rightUpperLegMeshContainer.add(bottomRes.rightUpperLeg);
    nodes.leftLowerLegMeshContainer.add(bottomRes.leftLowerLeg);
    nodes.rightLowerLegMeshContainer.add(bottomRes.rightLowerLeg);
    nodes.bottomContainer.add(bottomRes.bottomGroup);
  }

  // -------------------------------------------------------------------------
  // Modular Shoes & Footwear (Anatomical Foot Form)
  // -------------------------------------------------------------------------
  function rebuildShoes(shoes: Shoes) {
    disposeGeometries(nodes.leftShoeContainer);
    nodes.leftShoeContainer.clear();

    disposeGeometries(nodes.rightShoeContainer);
    nodes.rightShoeContainer.clear();

    nodes.leftShoeContainer.add(buildShoeModel(shoes, mats.shoes, mats.shoesSole, mats.topSecondary));
    nodes.rightShoeContainer.add(buildShoeModel(shoes, mats.shoes, mats.shoesSole, mats.topSecondary));
  }

  // -------------------------------------------------------------------------
  // Held Study Prop (Open Textbook with V-folded wings & silk ribbon marker)
  // -------------------------------------------------------------------------
  function buildHeldProps() {
    disposeGeometries(nodes.heldBookGroup);
    nodes.heldBookGroup.clear();

    const propGroup = new THREE.Group();
    // Positioned so the book corners land directly in the student's cupped palms
    propGroup.position.set(0, 0.055, 0.31);
    propGroup.rotation.x = 0.52; // ~30 deg tilt toward face

    const wingAngle = 0.085; // ~4.9 deg gentle V-spread
    const halfW = 0.126;
    const pageLen = 0.185;
    const pageThick = 0.014;

    // Left cover & pages
    const leftCover = new THREE.Mesh(
      new RoundedBoxGeometry(halfW, 0.004, pageLen + 0.008, 2, 0.002),
      mats.bookCover
    );
    leftCover.position.set(-halfW * 0.5 - 0.002, -0.003, 0);
    leftCover.rotation.z = -wingAngle;
    leftCover.castShadow = true;
    propGroup.add(leftCover);

    const leftPages = new THREE.Mesh(
      new THREE.BoxGeometry(halfW - 0.006, pageThick, pageLen),
      mats.bookPages
    );
    leftPages.position.set(-halfW * 0.5 - 0.003, pageThick * 0.5, 0);
    leftPages.rotation.z = -wingAngle;
    propGroup.add(leftPages);

    // Right cover & pages
    const rightCover = new THREE.Mesh(
      new RoundedBoxGeometry(halfW, 0.004, pageLen + 0.008, 2, 0.002),
      mats.bookCover
    );
    rightCover.position.set(halfW * 0.5 + 0.002, -0.003, 0);
    rightCover.rotation.z = wingAngle;
    rightCover.castShadow = true;
    propGroup.add(rightCover);

    const rightPages = new THREE.Mesh(
      new THREE.BoxGeometry(halfW - 0.006, pageThick, pageLen),
      mats.bookPages
    );
    rightPages.position.set(halfW * 0.5 + 0.003, pageThick * 0.5, 0);
    rightPages.rotation.z = wingAngle;
    propGroup.add(rightPages);

    // Rounded spine cylinder joining the covers
    const spineGeo = new THREE.CylinderGeometry(0.007, 0.007, pageLen + 0.010, 12, 1, false, 0, Math.PI);
    spineGeo.rotateX(Math.PI / 2);
    spineGeo.rotateZ(Math.PI);
    const spineMesh = new THREE.Mesh(spineGeo, mats.bookCover);
    spineMesh.position.set(0, -0.005, 0);
    propGroup.add(spineMesh);

    // Silk bookmark ribbon
    const ribbonGeo = new THREE.BoxGeometry(0.010, 0.002, pageLen * 0.72);
    const ribbonMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbonMesh.position.set(0.022, pageThick + 0.002, 0.020);
    ribbonMesh.rotation.y = 0.08;
    propGroup.add(ribbonMesh);

    nodes.heldBookGroup.add(propGroup);
    nodes.heldBookGroup.visible = false;
  }

  // Initial Assembly
  rebuildCoreAnatomy();
  rebuildFacialHair(currentCustom.facialHair);
  rebuildHair(currentCustom.hairStyle);
  rebuildEyewear(currentCustom.eyewear);
  rebuildHeadwear(currentCustom.headwear);
  rebuildOutfit(currentCustom.outfitTop);
  rebuildBottom(currentCustom.outfitBottom);
  rebuildShoes(currentCustom.shoes);
  buildHeldProps();

  // -------------------------------------------------------------------------
  // Animation System & State Engine
  // -------------------------------------------------------------------------
  const animEngine = new CharacterAnimationEngine();
  const targetLook = new THREE.Vector3();
  let hasTargetLook = false;

  const update = (deltaSeconds: number, poseOverride?: CharacterPose) => {
    const pose = poseOverride || currentCustom.pose || 'idle';
    animEngine.update(deltaSeconds, pose, nodes, hasTargetLook, targetLook);
  };

  const updateCustomization = (newCustom: CharacterCustomization) => {
    const prev = currentCustom;
    currentCustom = { ...newCustom };

    // Update material colors directly
    if (prev.skinTone !== newCustom.skinTone) {
      mats.skin.color.set(newCustom.skinTone);
      mats.mouth.color.copy(computeLipColor(newCustom.skinTone, newCustom.gender));
    }
    if (prev.hairColor !== newCustom.hairColor) {
      mats.hair.color.set(newCustom.hairColor);
      mats.facialHair.color.set(newCustom.facialHairColor || newCustom.hairColor);
    }
    if (prev.eyeColor !== newCustom.eyeColor) {
      mats.eyeIris.color.set(newCustom.eyeColor);
    }
    if (prev.topColor !== newCustom.topColor) {
      mats.topPrimary.color.set(newCustom.topColor);
    }
    if (prev.topSecondaryColor !== newCustom.topSecondaryColor) {
      mats.topSecondary.color.set(newCustom.topSecondaryColor);
    }
    if (prev.bottomColor !== newCustom.bottomColor) {
      mats.bottom.color.set(newCustom.bottomColor);
    }
    if (prev.shoesColor !== newCustom.shoesColor) {
      mats.shoes.color.set(newCustom.shoesColor);
    }
    if (prev.eyewearColor !== newCustom.eyewearColor) {
      mats.glasses.color.set(newCustom.eyewearColor);
    }
    if (prev.headwearColor !== newCustom.headwearColor) {
      mats.headwear.color.set(newCustom.headwearColor);
    }

    // Rebuild core anatomy if gender, body type, skin tone, or mood changed
    if (
      prev.gender !== newCustom.gender || 
      prev.bodyType !== newCustom.bodyType ||
      prev.skinTone !== newCustom.skinTone ||
      prev.mood !== newCustom.mood
    ) {
      rebuildCoreAnatomy();
    }

    // Rebuild facial hair if facial hair or gender changed
    if (
      prev.facialHair !== newCustom.facialHair || 
      prev.facialHairColor !== newCustom.facialHairColor ||
      prev.gender !== newCustom.gender
    ) {
      rebuildFacialHair(newCustom.facialHair);
    }

    // Rebuild modular meshes if types or gender changed
    if (prev.hairStyle !== newCustom.hairStyle || prev.gender !== newCustom.gender) {
      rebuildHair(newCustom.hairStyle);
      rebuildHeadwear(newCustom.headwear);
    }
    if (prev.eyewear !== newCustom.eyewear || prev.gender !== newCustom.gender) {
      rebuildEyewear(newCustom.eyewear);
    }
    if (prev.headwear !== newCustom.headwear || prev.gender !== newCustom.gender) {
      rebuildHeadwear(newCustom.headwear);
    }
    if (prev.outfitTop !== newCustom.outfitTop || prev.gender !== newCustom.gender || prev.bodyType !== newCustom.bodyType) {
      rebuildOutfit(newCustom.outfitTop);
    }
    if (prev.outfitBottom !== newCustom.outfitBottom || prev.gender !== newCustom.gender || prev.bodyType !== newCustom.bodyType) {
      rebuildBottom(newCustom.outfitBottom);
    }
    if (prev.shoes !== newCustom.shoes || prev.gender !== newCustom.gender) {
      rebuildShoes(newCustom.shoes);
    }
  };

  const setLookTarget = (targetPos: THREE.Vector3) => {
    targetLook.copy(targetPos);
    hasTargetLook = true;
  };

  const dispose = () => {
    root.removeFromParent();
    disposeHierarchy(root);
    Object.values(mats).forEach((m) => m.dispose());
  };

  return {
    root,
    update,
    updateCustomization,
    setLookTarget,
    dispose,
  };
}
