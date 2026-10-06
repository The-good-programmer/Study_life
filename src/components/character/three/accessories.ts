import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Eyewear, Headwear, FacialHair, HairStyle } from '../../../types/character';
import type { CharacterProportions } from './proportions';
import { getHairMetrics } from './hair';

/**
 * Builds facial hair meshes (stubble, goatee, beard) adhering strictly
 * to the mouth-hole rule so lips and mouth are never covered.
 */
export function buildFacialHairMesh(
  style: FacialHair,
  props: CharacterProportions,
  mats: {
    facialHair: THREE.Material;
    skin: THREE.Material;
  },
  skinTone: string,
  hairColor: string
): THREE.Group {
  const group = new THREE.Group();
  group.name = `FacialHair_${style}`;

  if (style === 'none' || props.hasBlush) return group;

  const hs = props.headScale;

  switch (style) {
    case 'stubble': {
      // Thin conforming jawline shell with alpha / transparent texture
      const stubbleGeo = new RoundedBoxGeometry(
        props.jawWidth * 0.88 * hs,
        0.085 * hs,
        0.115 * hs,
        3,
        0.02
      );
      const stubbleMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(hairColor).lerp(new THREE.Color(skinTone), 0.55),
        roughness: 0.88,
        metalness: 0.02,
      });
      const stubbleMesh = new THREE.Mesh(stubbleGeo, stubbleMat);
      stubbleMesh.position.set(0, -0.065 * hs, 0.025 * hs);
      group.add(stubbleMesh);
      break;
    }

    case 'goatee': {
      // 1. Sculpted chin tuft resting flush against the chin protuberance
      const goateeGeo = new RoundedBoxGeometry(0.044 * hs, 0.046 * hs, 0.022 * hs, 3, 0.008);
      const goatee = new THREE.Mesh(goateeGeo, mats.facialHair);
      goatee.position.set(0, -0.076 * hs, 0.080 * hs);
      goatee.castShadow = true;

      // 2. Contoured mustache sitting strictly ABOVE upper lip
      const mustacheGeo = new RoundedBoxGeometry(0.044 * hs, 0.012 * hs, 0.014 * hs, 3, 0.004);
      const mustache = new THREE.Mesh(mustacheGeo, mats.facialHair);
      mustache.position.set(0, -0.034 * hs, 0.080 * hs);
      mustache.castShadow = true;

      group.add(goatee, mustache);
      break;
    }

    case 'beard': {
      // 1. Mandible wrap tube conforming closely to the sculpted jaw curvature from ear to chin
      const beardPoints = [
        new THREE.Vector3(0.082 * hs, -0.015 * hs, 0.012 * hs),
        new THREE.Vector3(0.065 * hs, -0.045 * hs, 0.042 * hs),
        new THREE.Vector3(0.035 * hs, -0.068 * hs, 0.072 * hs),
        new THREE.Vector3(0, -0.075 * hs, 0.082 * hs),
        new THREE.Vector3(-0.035 * hs, -0.068 * hs, 0.072 * hs),
        new THREE.Vector3(-0.065 * hs, -0.045 * hs, 0.042 * hs),
        new THREE.Vector3(-0.082 * hs, -0.015 * hs, 0.012 * hs),
      ];
      const beardCurve = new THREE.CatmullRomCurve3(beardPoints);
      const beardGeo = new THREE.TubeGeometry(beardCurve, 20, 0.010 * hs, 8, false);
      const beard = new THREE.Mesh(beardGeo, mats.facialHair);
      beard.castShadow = true;

      // Chin fullness flush on chin surface
      const chinTuftGeo = new RoundedBoxGeometry(0.044 * hs, 0.042 * hs, 0.020 * hs, 3, 0.008);
      const chinTuft = new THREE.Mesh(chinTuftGeo, mats.facialHair);
      chinTuft.position.set(0, -0.076 * hs, 0.080 * hs);
      chinTuft.castShadow = true;

      // 2. Mustache above upper lip
      const mustacheGeo = new RoundedBoxGeometry(0.046 * hs, 0.012 * hs, 0.014 * hs, 3, 0.004);
      const mustache = new THREE.Mesh(mustacheGeo, mats.facialHair);
      mustache.position.set(0, -0.034 * hs, 0.080 * hs);
      mustache.castShadow = true;

      group.add(beard, chinTuft, mustache);
      break;
    }
  }

  return group;
}

/**
 * Builds eyewear (wireframe, thick-frame, round, sunglasses) with open lens frames,
 * nasal bridge resting on nose, and temple arms extending back to the ears.
 */
export function buildEyewearMesh(
  eyewear: Eyewear,
  props: CharacterProportions,
  mats: {
    glasses: THREE.Material;
    glassesLens: THREE.Material;
  }
): THREE.Group {
  const group = new THREE.Group();
  group.name = `Eyewear_${eyewear}`;

  if (eyewear === 'none') return group;

  const hs = props.headScale;
  const frameZ = 0.096 * hs; // In front of eyeball front (0.0865 * hs)
  const eyeX = 0.046 * hs;
  const eyeY = 0.014 * hs;
  const earX = 0.112 * hs;
  const earY = 0.010 * hs;
  const earZ = -0.015 * hs;

  // Helper to add temple arms from frame corners back to ears
  const addTempleArms = (frameCornerX: number, mat: THREE.Material) => {
    const leftArmPoints = [
      new THREE.Vector3(frameCornerX, eyeY, frameZ),
      new THREE.Vector3(earX, earY, earZ),
    ];
    const leftCurve = new THREE.CatmullRomCurve3(leftArmPoints);
    const leftGeo = new THREE.TubeGeometry(leftCurve, 8, 0.0016 * hs, 6, false);
    const leftArm = new THREE.Mesh(leftGeo, mat);

    const rightArmPoints = [
      new THREE.Vector3(-frameCornerX, eyeY, frameZ),
      new THREE.Vector3(-earX, earY, earZ),
    ];
    const rightCurve = new THREE.CatmullRomCurve3(rightArmPoints);
    const rightGeo = new THREE.TubeGeometry(rightCurve, 8, 0.0016 * hs, 6, false);
    const rightArm = new THREE.Mesh(rightGeo, mat);

    group.add(leftArm, rightArm);
  };

  switch (eyewear) {
    case 'wireframe': {
      const rimRadius = 0.024 * hs;
      const rimGeo = new THREE.TorusGeometry(rimRadius, 0.0018 * hs, 8, 24);
      const leftRim = new THREE.Mesh(rimGeo, mats.glasses);
      leftRim.position.set(eyeX, eyeY, frameZ);
      const rightRim = leftRim.clone();
      rightRim.position.x = -eyeX;

      // Nose bridge
      const bridgePoints = [
        new THREE.Vector3(-eyeX + rimRadius, eyeY + 0.003 * hs, frameZ),
        new THREE.Vector3(0, eyeY + 0.006 * hs, frameZ + 0.003 * hs),
        new THREE.Vector3(eyeX - rimRadius, eyeY + 0.003 * hs, frameZ),
      ];
      const bridgeCurve = new THREE.CatmullRomCurve3(bridgePoints);
      const bridgeGeo = new THREE.TubeGeometry(bridgeCurve, 8, 0.0016 * hs, 6, false);
      const bridge = new THREE.Mesh(bridgeGeo, mats.glasses);

      // Clear subtle lenses
      const lensGeo = new THREE.CircleGeometry(rimRadius * 0.95, 20);
      const leftLens = new THREE.Mesh(lensGeo, mats.glassesLens);
      leftLens.position.set(eyeX, eyeY, frameZ);
      const rightLens = leftLens.clone();
      rightLens.position.x = -eyeX;

      group.add(leftRim, rightRim, bridge, leftLens, rightLens);
      addTempleArms(eyeX + rimRadius, mats.glasses);
      break;
    }

    case 'round': {
      const rimRadius = 0.025 * hs;
      const rimGeo = new THREE.TorusGeometry(rimRadius, 0.0022 * hs, 8, 24);
      const leftRim = new THREE.Mesh(rimGeo, mats.glasses);
      leftRim.position.set(eyeX, eyeY, frameZ);
      const rightRim = leftRim.clone();
      rightRim.position.x = -eyeX;

      const bridgePoints = [
        new THREE.Vector3(-eyeX + rimRadius, eyeY + 0.004 * hs, frameZ),
        new THREE.Vector3(0, eyeY + 0.008 * hs, frameZ + 0.003 * hs),
        new THREE.Vector3(eyeX - rimRadius, eyeY + 0.004 * hs, frameZ),
      ];
      const bridgeCurve = new THREE.CatmullRomCurve3(bridgePoints);
      const bridgeGeo = new THREE.TubeGeometry(bridgeCurve, 8, 0.0018 * hs, 6, false);
      const bridge = new THREE.Mesh(bridgeGeo, mats.glasses);

      const lensGeo = new THREE.CircleGeometry(rimRadius * 0.95, 20);
      const leftLens = new THREE.Mesh(lensGeo, mats.glassesLens);
      leftLens.position.set(eyeX, eyeY, frameZ);
      const rightLens = leftLens.clone();
      rightLens.position.x = -eyeX;

      group.add(leftRim, rightRim, bridge, leftLens, rightLens);
      addTempleArms(eyeX + rimRadius, mats.glasses);
      break;
    }

    case 'thick-frame': {
      // Extruded shape with true open lens holes
      const frameW = 0.056 * hs;
      const frameH = 0.038 * hs;
      const border = 0.0042 * hs;

      const makeFrameWithHole = () => {
        const shape = new THREE.Shape();
        shape.moveTo(-frameW / 2, -frameH / 2);
        shape.lineTo(frameW / 2, -frameH / 2);
        shape.lineTo(frameW / 2, frameH / 2);
        shape.lineTo(-frameW / 2, frameH / 2);
        shape.closePath();

        const hole = new THREE.Path();
        hole.moveTo(-frameW / 2 + border, -frameH / 2 + border);
        hole.lineTo(frameW / 2 - border, -frameH / 2 + border);
        hole.lineTo(frameW / 2 - border, frameH / 2 - border);
        hole.lineTo(-frameW / 2 + border, frameH / 2 - border);
        hole.closePath();
        shape.holes.push(hole);

        return new THREE.ExtrudeGeometry(shape, { depth: 0.004 * hs, bevelEnabled: false });
      };

      const leftGeo = makeFrameWithHole();
      const leftFrame = new THREE.Mesh(leftGeo, mats.glasses);
      leftFrame.position.set(eyeX, eyeY, frameZ);

      const rightGeo = makeFrameWithHole();
      const rightFrame = new THREE.Mesh(rightGeo, mats.glasses);
      rightFrame.position.set(-eyeX, eyeY, frameZ);

      // Center bridge
      const bridgeGeo = new THREE.BoxGeometry(0.022 * hs, 0.006 * hs, 0.004 * hs);
      const bridge = new THREE.Mesh(bridgeGeo, mats.glasses);
      bridge.position.set(0, eyeY + 0.008 * hs, frameZ + 0.002 * hs);

      // Clear lenses
      const lensGeo = new THREE.PlaneGeometry(frameW - border * 2, frameH - border * 2);
      const leftLens = new THREE.Mesh(lensGeo, mats.glassesLens);
      leftLens.position.set(eyeX, eyeY, frameZ + 0.002 * hs);
      const rightLens = leftLens.clone();
      rightLens.position.x = -eyeX;

      group.add(leftFrame, rightFrame, bridge, leftLens, rightLens);
      addTempleArms(eyeX + frameW / 2, mats.glasses);
      break;
    }

    case 'sunglasses': {
      const sunMat = new THREE.MeshStandardMaterial({
        color: 0x111827,
        roughness: 0.15,
        metalness: 0.85,
      });
      const sunLensMat = new THREE.MeshStandardMaterial({
        color: 0x09090b,
        roughness: 0.05,
        metalness: 0.95,
      });

      const frameW = 0.060 * hs;
      const frameH = 0.040 * hs;
      const border = 0.0045 * hs;

      const makeSunFrame = () => {
        const shape = new THREE.Shape();
        shape.moveTo(-frameW / 2, -frameH / 2);
        shape.lineTo(frameW / 2, -frameH / 2);
        shape.lineTo(frameW / 2, frameH / 2);
        shape.lineTo(-frameW / 2, frameH / 2);
        shape.closePath();

        const hole = new THREE.Path();
        hole.moveTo(-frameW / 2 + border, -frameH / 2 + border);
        hole.lineTo(frameW / 2 - border, -frameH / 2 + border);
        hole.lineTo(frameW / 2 - border, frameH / 2 - border);
        hole.lineTo(-frameW / 2 + border, frameH / 2 - border);
        hole.closePath();
        shape.holes.push(hole);

        return new THREE.ExtrudeGeometry(shape, { depth: 0.004 * hs, bevelEnabled: false });
      };

      const leftFrame = new THREE.Mesh(makeSunFrame(), sunMat);
      leftFrame.position.set(eyeX, eyeY, frameZ);
      const rightFrame = new THREE.Mesh(makeSunFrame(), sunMat);
      rightFrame.position.set(-eyeX, eyeY, frameZ);

      const bridgeGeo = new THREE.BoxGeometry(0.022 * hs, 0.007 * hs, 0.004 * hs);
      const bridge = new THREE.Mesh(bridgeGeo, sunMat);
      bridge.position.set(0, eyeY + 0.008 * hs, frameZ + 0.002 * hs);

      const lensGeo = new THREE.PlaneGeometry(frameW - border * 2, frameH - border * 2);
      const leftLens = new THREE.Mesh(lensGeo, sunLensMat);
      leftLens.position.set(eyeX, eyeY, frameZ + 0.002 * hs);
      const rightLens = leftLens.clone();
      rightLens.position.x = -eyeX;

      group.add(leftFrame, rightFrame, bridge, leftLens, rightLens);
      addTempleArms(eyeX + frameW / 2, sunMat);
      break;
    }
  }

  return group;
}

/**
 * Builds headwear (headphones, mortarboard, cap, beanie, crown, halo)
 * correctly scaled to head cranium ellipsoid and accommodating hairstyles.
 */
export function buildHeadwearMesh(
  headwear: Headwear,
  hairStyle: HairStyle,
  props: CharacterProportions,
  mats: {
    headwear: THREE.Material;
    goldAccent: THREE.Material;
  }
): THREE.Group {
  const group = new THREE.Group();
  group.name = `Headwear_${headwear}`;

  if (headwear === 'none') return group;

  const hs = props.headScale;
  const metrics = getHairMetrics(hairStyle);
  const hatOffset = metrics.hatOffset * hs;

  switch (headwear) {
    case 'headphones': {
      // Band = upper arc OVER the head (standard orientation, rotation.z = 0)
      const bandRadius = 0.138 * hs + hatOffset;
      const bandGeo = new THREE.TorusGeometry(bandRadius, 0.012 * hs, 10, 32, Math.PI);
      const bandMesh = new THREE.Mesh(bandGeo, mats.headwear);
      bandMesh.position.set(0, 0.010 * hs, -0.012 * hs);
      group.add(bandMesh);

      // Ear cups centered over the ears
      const cupRadius = 0.038 * hs;
      const cupGeo = new THREE.CylinderGeometry(cupRadius, cupRadius, 0.024 * hs, 20);
      cupGeo.rotateZ(Math.PI / 2);

      const leftCup = new THREE.Mesh(cupGeo, mats.headwear);
      leftCup.position.set(0.128 * hs + hatOffset, 0.008 * hs, -0.012 * hs);

      // Glowing LED accent ring on outer cup
      const ledGeo = new THREE.TorusGeometry(0.026 * hs, 0.003 * hs, 8, 20);
      ledGeo.rotateY(Math.PI / 2);
      const ledMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const leftLed = new THREE.Mesh(ledGeo, ledMat);
      leftLed.position.set(0.141 * hs + hatOffset, 0.008 * hs, -0.012 * hs);

      const rightCup = leftCup.clone();
      rightCup.position.x = -(0.128 * hs + hatOffset);
      const rightLed = leftLed.clone();
      rightLed.position.x = -(0.141 * hs + hatOffset);

      group.add(leftCup, rightCup, leftLed, rightLed);
      break;
    }

    case 'cap': {
      // Crown cap dome sitting comfortably above brow
      const crownGeo = new THREE.SphereGeometry(
        0.126 * hs + hatOffset,
        22,
        16,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.48
      );
      const crownMesh = new THREE.Mesh(crownGeo, mats.headwear);
      crownMesh.position.set(0, 0.068 * hs, -0.015 * hs);
      crownMesh.rotation.x = -0.10;

      // Realistic arched baseball cap visor (projecting forward over forehead)
      const shape = new THREE.Shape();
      const rIn = 0.114 * hs + hatOffset;
      const rOut = 0.165 * hs + hatOffset;
      const startAng = -Math.PI * 0.28;
      const endAng = Math.PI * 0.28;
      const segments = 16;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const a = startAng + t * (endAng - startAng);
        const x = Math.sin(a) * rOut;
        const z = Math.cos(a) * rOut;
        if (i === 0) shape.moveTo(x, z);
        else shape.lineTo(x, z);
      }
      for (let i = segments; i >= 0; i--) {
        const t = i / segments;
        const a = startAng + t * (endAng - startAng);
        const x = Math.sin(a) * rIn;
        const z = Math.cos(a) * rIn;
        shape.lineTo(x, z);
      }
      shape.closePath();

      const visorGeo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.0035 * hs,
        bevelEnabled: true,
        bevelThickness: 0.001 * hs,
        bevelSize: 0.001 * hs,
        bevelSegments: 1,
      });
      visorGeo.rotateX(-Math.PI / 2);

      // Arch across X (sides curve downward naturally)
      const pos = visorGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const arch = -Math.pow(vx / (0.12 * hs), 2) * 0.010 * hs;
        pos.setY(i, pos.getY(i) + arch);
      }
      visorGeo.computeVertexNormals();

      const visorMesh = new THREE.Mesh(visorGeo, mats.headwear);
      visorMesh.position.set(0, 0.060 * hs, -0.008 * hs);
      visorMesh.rotation.x = -0.12;

      // Center button on top
      const btnGeo = new THREE.SphereGeometry(0.008 * hs, 10, 10);
      const btn = new THREE.Mesh(btnGeo, mats.headwear);
      btn.position.set(0, 0.190 * hs + hatOffset, -0.020 * hs);

      group.add(crownMesh, visorMesh, btn);
      break;
    }

    case 'beanie': {
      // Folded cuff torus
      const cuffGeo = new THREE.TorusGeometry(0.126 * hs + hatOffset, 0.022 * hs, 12, 28);
      cuffGeo.rotateX(Math.PI / 2);
      const cuffMesh = new THREE.Mesh(cuffGeo, mats.headwear);
      cuffMesh.position.set(0, 0.060 * hs, -0.015 * hs);

      // Dome with slight slouch backwards
      const domeGeo = new THREE.SphereGeometry(
        0.124 * hs + hatOffset,
        20,
        16,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.60
      );
      const domeMesh = new THREE.Mesh(domeGeo, mats.headwear);
      domeMesh.position.set(0, 0.065 * hs, -0.025 * hs);
      domeMesh.rotation.x = -0.15; // Slouch back

      group.add(cuffMesh, domeMesh);
      break;
    }

    case 'mortarboard': {
      // Skull cap base
      const capGeo = new THREE.CylinderGeometry(
        0.115 * hs + hatOffset,
        0.125 * hs + hatOffset,
        0.065 * hs,
        24
      );
      const capMesh = new THREE.Mesh(capGeo, mats.headwear);
      capMesh.position.set(0, 0.115 * hs, -0.015 * hs);

      // Square academic board
      const boardGeo = new THREE.BoxGeometry(0.28 * hs, 0.012 * hs, 0.28 * hs);
      const boardMesh = new THREE.Mesh(boardGeo, mats.headwear);
      boardMesh.position.set(0, 0.150 * hs, -0.015 * hs);
      boardMesh.rotation.y = Math.PI / 4;

      // Center button
      const btnGeo = new THREE.SphereGeometry(0.012 * hs, 10, 10);
      const btnMesh = new THREE.Mesh(btnGeo, mats.goldAccent);
      btnMesh.position.set(0, 0.160 * hs, -0.015 * hs);

      // Tassel hanging to the side (not over the face)
      const tasselPoints = [
        new THREE.Vector3(0, 0.160 * hs, -0.015 * hs),
        new THREE.Vector3(0.085 * hs, 0.145 * hs, 0.015 * hs),
        new THREE.Vector3(0.095 * hs, 0.065 * hs, 0.025 * hs),
      ];
      const tasselCurve = new THREE.CatmullRomCurve3(tasselPoints);
      const tasselGeo = new THREE.TubeGeometry(tasselCurve, 12, 0.0035 * hs, 6, false);
      const tasselMesh = new THREE.Mesh(tasselGeo, mats.goldAccent);

      group.add(capMesh, boardMesh, btnMesh, tasselMesh);
      break;
    }

    case 'crown': {
      // Golden band with DoubleSide so open interior renders correctly
      const bandGeo = new THREE.CylinderGeometry(
        0.124 * hs + hatOffset,
        0.124 * hs + hatOffset,
        0.030 * hs,
        24,
        1,
        true
      );
      const crownMat = (mats.goldAccent as THREE.MeshStandardMaterial).clone();
      crownMat.side = THREE.DoubleSide;
      const bandMesh = new THREE.Mesh(bandGeo, crownMat);
      bandMesh.position.set(0, 0.135 * hs, -0.012 * hs);
      group.add(bandMesh);

      // 6 peaks with jewel spheres
      const peakGeo = new THREE.ConeGeometry(0.020 * hs, 0.055 * hs, 6);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const peak = new THREE.Mesh(peakGeo, mats.goldAccent);
        peak.position.set(
          Math.cos(ang) * (0.124 * hs + hatOffset),
          0.165 * hs,
          Math.sin(ang) * (0.124 * hs + hatOffset) - 0.012 * hs
        );
        group.add(peak);
      }
      break;
    }

    case 'halo': {
      const haloGeo = new THREE.TorusGeometry(0.145 * hs, 0.010 * hs, 12, 36);
      const haloMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.rotateX(Math.PI / 2.3);
      haloMesh.position.set(0, 0.200 * hs + hatOffset, -0.020 * hs);
      group.add(haloMesh);
      break;
    }
  }

  return group;
}
