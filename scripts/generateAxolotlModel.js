import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as fs from 'fs';
import * as path from 'path';

// Polyfill FileReader for Node.js
if (typeof global.FileReader === 'undefined') {
  global.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        if (this.onloadend) this.onloadend();
      });
    }
  };
}

console.log('🦎 Constructing Unified Stylized 3D Axolotl Model...');

const scene = new THREE.Scene();
scene.name = 'Axolotl_Character';

const rootGroup = new THREE.Group();
rootGroup.name = 'Axolotl_Root';
scene.add(rootGroup);

// --- 1. MATERIALS WITH STYLIZED PALETTE ---
const bodyMat = new THREE.MeshStandardMaterial({
  name: 'Mat_Axolotl_Body',
  color: new THREE.Color('#ffc1cc'), // Soft axolotl pink
  roughness: 0.28,
  metalness: 0.05,
});

const bellyMat = new THREE.MeshStandardMaterial({
  name: 'Mat_Axolotl_Belly',
  color: new THREE.Color('#fff0f3'), // Warm cream/white belly
  roughness: 0.35,
  metalness: 0.02,
});

const gillStemMat = new THREE.MeshStandardMaterial({
  name: 'Mat_Axolotl_GillStem',
  color: new THREE.Color('#ff6b8b'),
  roughness: 0.3,
  metalness: 0.08,
});

const gillFrillMat = new THREE.MeshStandardMaterial({
  name: 'Mat_Axolotl_GillFrill',
  color: new THREE.Color('#ff477e'),
  emissive: new THREE.Color('#ff2a6d'),
  emissiveIntensity: 0.35,
  roughness: 0.2,
  metalness: 0.05,
});

const eyeMat = new THREE.MeshStandardMaterial({
  name: 'Mat_Axolotl_Eyes',
  color: new THREE.Color('#1a162b'),
  roughness: 0.04,
  metalness: 0.4,
});

const glintMat = new THREE.MeshBasicMaterial({
  name: 'Mat_Axolotl_Glint',
  color: new THREE.Color('#ffffff'),
});

const finMat = new THREE.MeshStandardMaterial({
  name: 'Mat_Axolotl_Fin',
  color: new THREE.Color('#ffa8ba'),
  roughness: 0.15,
  metalness: 0.05,
  transparent: true,
  opacity: 0.85,
  side: THREE.DoubleSide,
});

const mouthMat = new THREE.MeshBasicMaterial({
  name: 'Mat_Axolotl_Mouth',
  color: new THREE.Color('#d94668'),
});

const blushMat = new THREE.MeshBasicMaterial({
  name: 'Mat_Axolotl_Blush',
  color: new THREE.Color('#ff758f'),
  transparent: true,
  opacity: 0.7,
});

// --- 2. HEAD & CRANIUM ---
const headGroup = new THREE.Group();
headGroup.name = 'Socket_Head';
headGroup.position.set(0, 0.12, 0.75);
rootGroup.add(headGroup);

// Main Cranium - Organic smoothed shape
const headGeom = new THREE.SphereGeometry(0.68, 36, 30);
headGeom.scale(1.32, 0.96, 1.15);
const headMesh = new THREE.Mesh(headGeom, bodyMat);
headMesh.name = 'Mesh_Head';
headGroup.add(headMesh);

// Chubby Cheeks
[-0.56, 0.56].forEach((x, i) => {
  const cheekGeom = new THREE.SphereGeometry(0.26, 20, 18);
  cheekGeom.scale(1.15, 0.95, 1.05);
  const cheekMesh = new THREE.Mesh(cheekGeom, bodyMat);
  cheekMesh.name = `Mesh_Cheek_${i === 0 ? 'L' : 'R'}`;
  cheekMesh.position.set(x, -0.11, 0.18);
  headGroup.add(cheekMesh);

  // Soft Rosy Blush (slightly curved cap to prevent z-fighting)
  const blushGeom = new THREE.SphereGeometry(0.14, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.4);
  const blushMesh = new THREE.Mesh(blushGeom, blushMat);
  blushMesh.name = `Mesh_Blush_${i === 0 ? 'L' : 'R'}`;
  blushMesh.position.set(x > 0 ? 0.63 : -0.63, -0.06, 0.38);
  blushMesh.rotation.y = x > 0 ? 0.7 : -0.7;
  blushMesh.rotation.x = 0.2;
  headGroup.add(blushMesh);
});

// --- 3. EYES WITH MORPH TARGETS (BLINK & SQUINT) ---
[-0.43, 0.43].forEach((x, i) => {
  const eyeGroup = new THREE.Group();
  eyeGroup.name = `Group_Eye_${i === 0 ? 'L' : 'R'}`;
  eyeGroup.position.set(x, 0.15, 0.54);

  // Eye base geometry with morph targets
  const eyeGeom = new THREE.SphereGeometry(0.13, 24, 24);
  eyeGeom.scale(0.95, 1.05, 0.9);

  // Morph Target 1: Blink (flatten Y)
  const blinkPositions = [];
  const basePos = eyeGeom.attributes.position;
  for (let p = 0; p < basePos.count; p++) {
    const px = basePos.getX(p);
    const py = basePos.getY(p) * 0.08; // squashed flat
    const pz = basePos.getZ(p);
    blinkPositions.push(px, py, pz);
  }
  eyeGeom.morphAttributes.position = [];
  eyeGeom.morphAttributes.position[0] = new THREE.Float32BufferAttribute(blinkPositions, 3);
  eyeGeom.morphTargetsRelative = false;

  // Morph Target 2: Happy Squint (^ shaped smile)
  const squintPositions = [];
  for (let p = 0; p < basePos.count; p++) {
    const px = basePos.getX(p);
    const py = Math.max(-0.02, basePos.getY(p) * 0.2 + Math.abs(px) * 0.15);
    const pz = basePos.getZ(p);
    squintPositions.push(px, py, pz);
  }
  eyeGeom.morphAttributes.position[1] = new THREE.Float32BufferAttribute(squintPositions, 3);

  const eyeMesh = new THREE.Mesh(eyeGeom, eyeMat);
  eyeMesh.name = `Mesh_Eye_${i === 0 ? 'L' : 'R'}`;
  eyeMesh.morphTargetDictionary = { blink: 0, squint: 1 };
  eyeMesh.morphTargetInfluences = [0, 0];
  eyeGroup.add(eyeMesh);

  // Catchlight Glints (sparkle in eyes)
  const glint1 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), glintMat);
  glint1.position.set(0.038, 0.048, 0.105);
  eyeGroup.add(glint1);

  const glint2 = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), glintMat);
  glint2.position.set(-0.036, -0.038, 0.115);
  eyeGroup.add(glint2);

  headGroup.add(eyeGroup);
});

// --- 4. CUTE SMILE MOUTH WITH MORPH TARGET ---
const mouthCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-0.16, -0.16, 0.65),
  new THREE.Vector3(-0.08, -0.21, 0.68),
  new THREE.Vector3(0, -0.22, 0.69),
  new THREE.Vector3(0.08, -0.21, 0.68),
  new THREE.Vector3(0.16, -0.16, 0.65),
]);
const mouthGeom = new THREE.TubeGeometry(mouthCurve, 20, 0.022, 8, false);

// Morph Target for mouth open
const mouthOpenPositions = [];
const mBasePos = mouthGeom.attributes.position;
for (let p = 0; p < mBasePos.count; p++) {
  const mx = mBasePos.getX(p);
  const my = mBasePos.getY(p) - (Math.abs(mx) < 0.1 ? 0.09 : 0.02);
  const mz = mBasePos.getZ(p);
  mouthOpenPositions.push(mx, my, mz);
}
mouthGeom.morphAttributes.position = [new THREE.Float32BufferAttribute(mouthOpenPositions, 3)];

const mouthMesh = new THREE.Mesh(mouthGeom, mouthMat);
mouthMesh.name = 'Mesh_Mouth';
mouthMesh.morphTargetDictionary = { open: 0 };
mouthMesh.morphTargetInfluences = [0];
headGroup.add(mouthMesh);

// --- 5. THE 6 ICONIC EXTERNAL GILLS (FEATHERY & SCULPTED) ---
const gillConfigs = [
  { side: -1, y: 0.35, z: -0.15, rotZ: 0.48, rotY: -0.38, scale: 1.08 },
  { side: -1, y: 0.14, z: -0.22, rotZ: 0.18, rotY: -0.55, scale: 1.02 },
  { side: -1, y: -0.07, z: -0.26, rotZ: -0.18, rotY: -0.48, scale: 0.9 },
  { side: 1, y: 0.35, z: -0.15, rotZ: -0.48, rotY: 0.38, scale: 1.08 },
  { side: 1, y: 0.14, z: -0.22, rotZ: -0.18, rotY: 0.55, scale: 1.02 },
  { side: 1, y: -0.07, z: -0.26, rotZ: 0.18, rotY: 0.48, scale: 0.9 },
];

gillConfigs.forEach((cfg, idx) => {
  const gillBranch = new THREE.Group();
  gillBranch.name = `Group_Gill_${idx}`;
  gillBranch.position.set(cfg.side * 0.58, cfg.y, cfg.z);
  gillBranch.rotation.z = cfg.rotZ;
  gillBranch.rotation.y = cfg.rotY;
  gillBranch.scale.setScalar(cfg.scale);

  // Smooth curved stem
  const stemCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(cfg.side * 0.08, 0.35, -0.06),
    new THREE.Vector3(cfg.side * 0.22, 0.68, -0.12)
  );
  const stemGeom = new THREE.TubeGeometry(stemCurve, 16, 0.038, 10, false);
  const stemMesh = new THREE.Mesh(stemGeom, gillStemMat);
  stemMesh.name = `Mesh_GillStem_${idx}`;
  gillBranch.add(stemMesh);

  // Feathery ruffles / frills
  const rufflesCount = 8;
  for (let r = 0; r < rufflesCount; r++) {
    const t = (r + 1) / (rufflesCount + 1);
    const pos = stemCurve.getPoint(t);
    const ruffGeom = new THREE.SphereGeometry(0.082 * (1 - t * 0.3), 12, 10);
    ruffGeom.scale(1.45, 0.65, 0.95);
    const ruffMesh = new THREE.Mesh(ruffGeom, gillFrillMat);
    ruffMesh.name = `Mesh_GillFrill_${idx}_${r}`;
    ruffMesh.position.copy(pos);
    ruffMesh.position.x += cfg.side * 0.05;
    ruffMesh.position.z += (r % 2 === 0 ? 0.035 : -0.035);
    ruffMesh.rotation.z = (cfg.side * Math.PI) / 3.8;
    gillBranch.add(ruffMesh);
  }

  headGroup.add(gillBranch);
});

// --- 6. TORSO & SEAMLESS BELLY ---
const torsoGroup = new THREE.Group();
torsoGroup.name = 'Group_Torso';
torsoGroup.position.set(0, 0, 0);
rootGroup.add(torsoGroup);

const torsoGeom = new THREE.CapsuleGeometry(0.52, 0.88, 20, 28);
torsoGeom.rotateX(Math.PI / 2);
const torsoMesh = new THREE.Mesh(torsoGeom, bodyMat);
torsoMesh.name = 'Mesh_Torso';
torsoGroup.add(torsoMesh);

// Soft Belly Under-patch
const bellyGeom = new THREE.SphereGeometry(0.49, 24, 20);
bellyGeom.scale(1.02, 0.62, 1.25);
const bellyMesh = new THREE.Mesh(bellyGeom, bellyMat);
bellyMesh.name = 'Mesh_Belly';
bellyMesh.position.set(0, -0.15, 0.06);
torsoGroup.add(bellyMesh);

// --- 7. TAIL & INTEGRATED CAUDAL FIN ---
const tailGroup = new THREE.Group();
tailGroup.name = 'Group_Tail';
tailGroup.position.set(0, 0, -0.58);
rootGroup.add(tailGroup);

// Tapered graceful tail spine
const tailSeg1 = new THREE.ConeGeometry(0.4, 0.65, 20);
tailSeg1.rotateX(-Math.PI / 2);
tailSeg1.translate(0, 0, -0.32);
const tailMesh1 = new THREE.Mesh(tailSeg1, bodyMat);
tailMesh1.name = 'Mesh_TailSeg1';
tailGroup.add(tailMesh1);

const tailSeg2Group = new THREE.Group();
tailSeg2Group.name = 'Group_TailSeg2';
tailSeg2Group.position.set(0, 0, -0.65);
tailGroup.add(tailSeg2Group);

const tailSeg2 = new THREE.ConeGeometry(0.29, 0.72, 18);
tailSeg2.rotateX(-Math.PI / 2);
tailSeg2.translate(0, 0, -0.36);
const tailMesh2 = new THREE.Mesh(tailSeg2, bodyMat);
tailMesh2.name = 'Mesh_TailSeg2';
tailSeg2Group.add(tailMesh2);

const tailTipGroup = new THREE.Group();
tailTipGroup.name = 'Group_TailTip';
tailTipGroup.position.set(0, 0, -0.72);
tailSeg2Group.add(tailTipGroup);

const tailTipGeom = new THREE.ConeGeometry(0.18, 0.8, 16);
tailTipGeom.rotateX(-Math.PI / 2);
tailTipGeom.translate(0, 0, -0.4);
const tailTipMesh = new THREE.Mesh(tailTipGeom, bodyMat);
tailTipMesh.name = 'Mesh_TailTip';
tailTipGroup.add(tailTipMesh);

// Translucent Ribbon Fin
const finGeom = new THREE.CylinderGeometry(0.012, 0.38, 2.1, 20, 6, true);
finGeom.rotateX(Math.PI / 2);
finGeom.scale(0.12, 1.25, 1);
finGeom.translate(0, 0.08, -1.05);
const finMesh = new THREE.Mesh(finGeom, finMat);
finMesh.name = 'Mesh_DorsalFin';
rootGroup.add(finMesh);

// --- 8. 4 CUTE PADDLE LIMBS (WITH DIGITS) ---
const limbConfigs = [
  { name: 'FrontL', x: -0.48, y: -0.22, z: 0.36, rotZ: 0.6, rotX: 0.2 },
  { name: 'FrontR', x: 0.48, y: -0.22, z: 0.36, rotZ: -0.6, rotX: 0.2 },
  { name: 'RearL', x: -0.42, y: -0.2, z: -0.38, rotZ: 0.7, rotX: -0.3 },
  { name: 'RearR', x: 0.42, y: -0.2, z: -0.38, rotZ: -0.7, rotX: -0.3 },
];

limbConfigs.forEach((cfg) => {
  const limbGroup = new THREE.Group();
  limbGroup.name = `Group_Limb_${cfg.name}`;
  limbGroup.position.set(cfg.x, cfg.y, cfg.z);
  limbGroup.rotation.z = cfg.rotZ;
  limbGroup.rotation.x = cfg.rotX;

  // Upper limb
  const legGeom = new THREE.CapsuleGeometry(0.082, 0.25, 10, 14);
  const legMesh = new THREE.Mesh(legGeom, bodyMat);
  legMesh.name = `Mesh_Leg_${cfg.name}`;
  legMesh.position.set(0, -0.12, 0);
  limbGroup.add(legMesh);

  // Soft paddle paw with 4 rounded digits
  const pawGeom = new THREE.SphereGeometry(0.105, 12, 10);
  pawGeom.scale(1.25, 0.42, 1.35);
  const pawMesh = new THREE.Mesh(pawGeom, gillStemMat);
  pawMesh.name = `Mesh_Paw_${cfg.name}`;
  pawMesh.position.set(0, -0.27, 0.05);
  limbGroup.add(pawMesh);

  [-0.07, -0.024, 0.024, 0.07].forEach((dx, d) => {
    const toeGeom = new THREE.SphereGeometry(0.028, 8, 8);
    const toeMesh = new THREE.Mesh(toeGeom, gillStemMat);
    toeMesh.position.set(dx, -0.28, 0.16);
    limbGroup.add(toeMesh);
  });

  rootGroup.add(limbGroup);
});

// --- 9. EXPORT BINARY .GLB FILE ---
const outputPath = path.resolve('public/models/axolotl.glb');
console.log(`📦 Exporting to ${outputPath}...`);

const exporter = new GLTFExporter();
exporter.parse(
  scene,
  (glb) => {
    const buffer = Buffer.from(glb);
    fs.writeFileSync(outputPath, buffer);
    console.log(`✨ DONE! Successfully exported axolotl.glb (${(buffer.length / 1024).toFixed(1)} KB)`);
    process.exit(0);
  },
  (error) => {
    console.error('❌ Failed to export GLB:', error);
    process.exit(1);
  },
  { binary: true }
);
