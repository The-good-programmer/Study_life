import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { HairStyle } from '../../../types/character';
import type { CharacterProportions } from './proportions';

export interface HairMetrics {
  hatOffset: number;
  hidesEars: boolean;
}

export function getHairMetrics(style: HairStyle): HairMetrics {
  switch (style) {
    case 'curly-afro':
      return { hatOffset: 0.035, hidesEars: true };
    case 'bob-cut':
      return { hatOffset: 0.012, hidesEars: true };
    case 'long-wavy':
      return { hatOffset: 0.012, hidesEars: false };
    case 'spiky':
      return { hatOffset: 0.025, hidesEars: false };
    case 'short-fade':
    case 'side-part':
      return { hatOffset: 0.010, hidesEars: false };
    case 'ponytail':
      return { hatOffset: 0.010, hidesEars: false };
    case 'buzz':
    default:
      return { hatOffset: 0.005, hidesEars: false };
  }
}

/**
 * Creates a base scalp shell with an anatomically correct open hairline.
 * Leaves the forehead, brow ridge, eyes, and face 100% exposed.
 */
function createScalpShellGeometry(
  props: CharacterProportions,
  thickness: number = 0.004,
  frontHairlineY: number = 0.065
): THREE.BufferGeometry {
  const hs = props.headScale;
  const baseGeo = new THREE.SphereGeometry(1, 36, 28);
  const pos = baseGeo.attributes.position;
  const index = baseGeo.index!;

  const rx = (0.118 + thickness) * hs;
  const ry = (0.128 + thickness) * hs;
  const rz = (0.122 + thickness) * hs;
  const centerY = 0.020 * hs;
  const centerZ = -0.022 * hs;

  const hlFrontY = frontHairlineY * hs;
  const hlTempleY = 0.020 * hs;
  const hlNapeY = -0.040 * hs;

  const keepVertex: boolean[] = new Array(pos.count);

  for (let i = 0; i < pos.count; i++) {
    const sx = pos.getX(i);
    const sy = pos.getY(i);
    const sz = pos.getZ(i);

    const x = sx * rx;
    const y = sy * ry + centerY;
    const z = sz * rz + centerZ;

    // Determine hairline height at this horizontal position
    let hlY: number;
    if (z >= centerZ) {
      // Front forehead and temples
      const t = THREE.MathUtils.clamp(Math.abs(x) / rx, 0, 1);
      hlY = THREE.MathUtils.lerp(hlFrontY, hlTempleY, Math.pow(t, 1.4));
    } else {
      // Back and nape
      const t = THREE.MathUtils.clamp((centerZ - z) / rz, 0, 1);
      hlY = THREE.MathUtils.lerp(hlTempleY, hlNapeY, Math.pow(t, 1.2));
    }

    keepVertex[i] = y >= hlY;
    pos.setXYZ(i, x, y, z);
  }

  // Filter triangles: only keep triangles where all 3 vertices are above hairline
  const keptIndices: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    if (keepVertex[a] && keepVertex[b] && keepVertex[c]) {
      keptIndices.push(a, b, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', pos.clone());
  geo.setIndex(keptIndices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds stylized 3D hair for each of the 8 character hairstyles.
 * Adheres strictly to the rule that eyes, eyebrows, and face must remain unobstructed.
 */
export function buildHairMesh(
  style: HairStyle,
  props: CharacterProportions,
  hairMat: THREE.Material
): THREE.Group {
  const hs = props.headScale;
  const hairGroup = new THREE.Group();
  hairGroup.name = `Hair_${style}`;

  // DoubleSide material ensures both exterior and interior of scalp shells render
  const shellMat = (hairMat as THREE.MeshStandardMaterial).clone();
  shellMat.side = THREE.DoubleSide;

  const addSideburns = (length: number = 0.055) => {
    const burnGeo = new RoundedBoxGeometry(0.016 * hs, length * hs, 0.024 * hs, 2, 0.004);
    const leftBurn = new THREE.Mesh(burnGeo, hairMat);
    leftBurn.position.set(0.106 * hs, -0.005 * hs, 0.002 * hs);
    const rightBurn = leftBurn.clone();
    rightBurn.position.x = -0.106 * hs;
    hairGroup.add(leftBurn, rightBurn);
  };

  switch (style) {
    case 'buzz': {
      const buzzGeo = createScalpShellGeometry(props, 0.003, 0.062);
      const buzzMesh = new THREE.Mesh(buzzGeo, shellMat);
      buzzMesh.castShadow = true;
      hairGroup.add(buzzMesh);
      addSideburns(0.04);
      break;
    }

    case 'short-fade': {
      // 1. Base scalp shell with open forehead
      const scalpGeo = createScalpShellGeometry(props, 0.004, 0.065);
      const scalpMesh = new THREE.Mesh(scalpGeo, shellMat);
      scalpMesh.castShadow = true;
      hairGroup.add(scalpMesh);

      // 2. Sculpted quiff: sleek, organic crest that conforms to skull curvature
      const crestGeo = new THREE.SphereGeometry(0.110 * hs, 24, 16);
      crestGeo.scale(0.88, 0.44, 0.96);
      const pos = crestGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const z = pos.getZ(i);
        if (z > 0) {
          pos.setX(i, pos.getX(i) * (1.0 - (z / (0.13 * hs)) * 0.22));
          pos.setY(i, y + (z / (0.13 * hs)) * 0.014 * hs);
        }
      }
      crestGeo.computeVertexNormals();

      const crestMesh = new THREE.Mesh(crestGeo, hairMat);
      crestMesh.position.set(0, 0.106 * hs, -0.005 * hs);
      crestMesh.rotation.x = -0.10;
      crestMesh.castShadow = true;
      hairGroup.add(crestMesh);

      addSideburns(0.05);
      break;
    }

    case 'side-part': {
      // 1. Base scalp shell
      const scalpGeo = createScalpShellGeometry(props, 0.005, 0.064);
      const scalpMesh = new THREE.Mesh(scalpGeo, shellMat);
      scalpMesh.castShadow = true;
      hairGroup.add(scalpMesh);

      // 2. Swept volume parted neatly to the side
      const leftSweepGeo = new RoundedBoxGeometry(0.125 * hs, 0.054 * hs, 0.155 * hs, 4, 0.022);
      const leftSweep = new THREE.Mesh(leftSweepGeo, hairMat);
      leftSweep.position.set(0.042 * hs, 0.124 * hs, 0.012 * hs);
      leftSweep.rotation.z = -0.16;
      leftSweep.castShadow = true;

      const rightTaperGeo = new RoundedBoxGeometry(0.075 * hs, 0.042 * hs, 0.145 * hs, 3, 0.018);
      const rightTaper = new THREE.Mesh(rightTaperGeo, hairMat);
      rightTaper.position.set(-0.065 * hs, 0.116 * hs, 0.008 * hs);
      rightTaper.rotation.z = 0.20;
      rightTaper.castShadow = true;

      hairGroup.add(leftSweep, rightTaper);
      addSideburns(0.06);
      break;
    }

    case 'spiky': {
      // 1. Base scalp shell
      const scalpGeo = createScalpShellGeometry(props, 0.004, 0.065);
      const scalpMesh = new THREE.Mesh(scalpGeo, shellMat);
      scalpMesh.castShadow = true;
      hairGroup.add(scalpMesh);

      // 2. Stylized dynamic spikes with cohesive flow
      const spikeGeoMain = new THREE.ConeGeometry(0.024 * hs, 0.075 * hs, 8);
      const spikeGeoSmall = new THREE.ConeGeometry(0.018 * hs, 0.058 * hs, 8);

      const spikeDefs: [number, number, number, number, number, boolean][] = [
        [0, 0.150, 0.035, -0.25, 0, true],
        [0.042, 0.144, 0.022, -0.18, -0.28, true],
        [-0.042, 0.144, 0.022, -0.18, 0.28, true],
        [0.030, 0.145, -0.035, 0.22, -0.18, true],
        [-0.030, 0.145, -0.035, 0.22, 0.18, true],
        [0, 0.148, -0.065, 0.35, 0, true],
        [0.068, 0.118, -0.008, 0.08, -0.42, false],
        [-0.068, 0.118, -0.008, 0.08, 0.42, false],
      ];

      spikeDefs.forEach(([x, y, z, rx, rz, isMain]) => {
        const s = new THREE.Mesh(isMain ? spikeGeoMain : spikeGeoSmall, hairMat);
        s.position.set(x * hs, y * hs, z * hs);
        s.rotation.set(rx, 0, rz);
        s.castShadow = true;
        hairGroup.add(s);
      });

      addSideburns(0.05);
      break;
    }

    case 'curly-afro': {
      // 1. Base scalp shell with open forehead
      const scalpGeo = createScalpShellGeometry(props, 0.005, 0.065);
      const scalpMesh = new THREE.Mesh(scalpGeo, shellMat);
      scalpMesh.castShadow = true;
      hairGroup.add(scalpMesh);

      // 2. High crown and back afro volume: rounded cohesive cloud
      const afroGeo = new THREE.SphereGeometry(0.138 * hs, 24, 20);
      afroGeo.scale(1.10, 1.08, 1.10);
      const afroMesh = new THREE.Mesh(afroGeo, hairMat);
      afroMesh.position.set(0, 0.090 * hs, -0.035 * hs);
      afroMesh.castShadow = true;
      hairGroup.add(afroMesh);

      // 3. Dense, organic surface curl nodules (smaller and more numerous to form a lush cloud texture)
      const curlGeo = new THREE.SphereGeometry(0.018 * hs, 8, 8);
      const curlCount = 56;
      for (let i = 0; i < curlCount; i++) {
        const phi = Math.acos(-1 + (2 * i) / curlCount);
        const theta = Math.sqrt(curlCount * Math.PI) * phi;
        const cx = Math.sin(phi) * Math.cos(theta) * 0.136 * hs;
        const cy = Math.cos(phi) * 0.136 * hs + 0.090 * hs;
        const cz = Math.sin(phi) * Math.sin(theta) * 0.136 * hs - 0.035 * hs;

        // Skip front facial sector so face remains completely open
        if (cz > 0.030 * hs && cy < 0.075 * hs) continue;

        const curl = new THREE.Mesh(curlGeo, hairMat);
        curl.position.set(cx, cy, cz);
        curl.castShadow = true;
        hairGroup.add(curl);
      }
      break;
    }

    case 'bob-cut': {
      // Unified sculpted bob shell framing head down to jawline with inward curl
      const baseGeo = new THREE.SphereGeometry(1, 36, 28);
      const pos = baseGeo.attributes.position;
      const index = baseGeo.index!;

      const thickness = 0.010 * hs;
      const rx = (0.118 + thickness) * hs;
      const ry = (0.128 + thickness) * hs;
      const rz = (0.122 + thickness) * hs;
      const centerY = 0.020 * hs;
      const centerZ = -0.022 * hs;

      const hlFrontY = 0.066 * hs;
      const hlTempleY = -0.038 * hs;
      const hlNapeY = -0.050 * hs;

      const keepVertex: boolean[] = new Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        const sx = pos.getX(i);
        const sy = pos.getY(i);
        const sz = pos.getZ(i);

        let x = sx * rx;
        let y = sy * ry + centerY;
        let z = sz * rz + centerZ;

        // Inward tuck under the jaw at lower edges
        if (y < 0) {
          const tuck = Math.min(-y / (0.05 * hs), 1);
          x *= (1.0 - tuck * 0.08);
          z *= (1.0 - tuck * 0.06);
        }

        let hlY: number;
        if (z >= centerZ) {
          const t = Math.min(Math.abs(x) / rx, 1);
          hlY = THREE.MathUtils.lerp(hlFrontY, hlTempleY, Math.pow(t, 1.8));
        } else {
          const t = Math.min((centerZ - z) / rz, 1);
          hlY = THREE.MathUtils.lerp(hlTempleY, hlNapeY, Math.pow(t, 1.0));
        }

        keepVertex[i] = y >= hlY;
        pos.setXYZ(i, x, y, z);
      }

      const keptIndices: number[] = [];
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i);
        const b = index.getX(i + 1);
        const c = index.getX(i + 2);
        if (keepVertex[a] && keepVertex[b] && keepVertex[c]) {
          keptIndices.push(a, b, c);
        }
      }

      const bobGeo = new THREE.BufferGeometry();
      bobGeo.setAttribute('position', pos.clone());
      bobGeo.setIndex(keptIndices);
      bobGeo.computeVertexNormals();

      const bobMesh = new THREE.Mesh(bobGeo, shellMat);
      bobMesh.castShadow = true;
      hairGroup.add(bobMesh);
      break;
    }

    case 'long-wavy': {
      // 1. Base scalp crown
      const scalpGeo = createScalpShellGeometry(props, 0.005, 0.065);
      const scalpMesh = new THREE.Mesh(scalpGeo, shellMat);
      scalpMesh.castShadow = true;
      hairGroup.add(scalpMesh);

      // 2. Flowing side locks with gentle wavy S-curve draped behind shoulders
      const lockPointsLeft = [
        new THREE.Vector3(0.112 * hs, 0.050 * hs, 0.010 * hs),
        new THREE.Vector3(0.116 * hs, -0.020 * hs, -0.010 * hs),
        new THREE.Vector3(0.112 * hs, -0.090 * hs, -0.035 * hs),
        new THREE.Vector3(0.106 * hs, -0.155 * hs, -0.055 * hs),
      ];
      const leftLockCurve = new THREE.CatmullRomCurve3(lockPointsLeft);
      const leftLockGeo = new THREE.TubeGeometry(leftLockCurve, 18, 0.014 * hs, 8, false);
      const leftLock = new THREE.Mesh(leftLockGeo, hairMat);
      leftLock.castShadow = true;

      const lockPointsRight = [
        new THREE.Vector3(-0.112 * hs, 0.050 * hs, 0.010 * hs),
        new THREE.Vector3(-0.116 * hs, -0.020 * hs, -0.010 * hs),
        new THREE.Vector3(-0.112 * hs, -0.090 * hs, -0.035 * hs),
        new THREE.Vector3(-0.106 * hs, -0.155 * hs, -0.055 * hs),
      ];
      const rightLockCurve = new THREE.CatmullRomCurve3(lockPointsRight);
      const rightLockGeo = new THREE.TubeGeometry(rightLockCurve, 18, 0.014 * hs, 8, false);
      const rightLock = new THREE.Mesh(rightLockGeo, hairMat);
      rightLock.castShadow = true;
      hairGroup.add(leftLock, rightLock);

      // 3. Back cascading volume falling down behind the neck/shoulders
      const backGeo = new RoundedBoxGeometry(0.18 * hs, 0.30 * hs, 0.050 * hs, 3, 0.018);
      const backMesh = new THREE.Mesh(backGeo, hairMat);
      backMesh.position.set(0, -0.075 * hs, -0.105 * hs);
      backMesh.castShadow = true;
      hairGroup.add(backMesh);
      break;
    }

    case 'ponytail': {
      // 1. Base scalp shell
      const scalpGeo = createScalpShellGeometry(props, 0.005, 0.064);
      const scalpMesh = new THREE.Mesh(scalpGeo, shellMat);
      hairGroup.add(scalpMesh);

      // 2. Hair tie at back-top crown
      const tieGeo = new THREE.TorusGeometry(0.024 * hs, 0.008 * hs, 8, 18);
      const tieMat = new THREE.MeshStandardMaterial({ color: 0x6366f1, roughness: 0.5 });
      const tieMesh = new THREE.Mesh(tieGeo, tieMat);
      tieMesh.position.set(0, 0.090 * hs, -0.115 * hs);
      tieMesh.rotation.x = Math.PI / 3;
      hairGroup.add(tieMesh);

      // 3. Curved ponytail hanging down with natural S-curve
      const tailPoints = [
        new THREE.Vector3(0, 0.090 * hs, -0.115 * hs),
        new THREE.Vector3(0, 0.020 * hs, -0.165 * hs),
        new THREE.Vector3(0, -0.080 * hs, -0.155 * hs),
        new THREE.Vector3(0, -0.180 * hs, -0.140 * hs),
      ];
      const tailCurve = new THREE.CatmullRomCurve3(tailPoints);
      const tailGeo = new THREE.TubeGeometry(tailCurve, 20, 0.020 * hs, 8, false);
      const tailMesh = new THREE.Mesh(tailGeo, hairMat);
      hairGroup.add(tailMesh);
      break;
    }
  }

  return hairGroup;
}
