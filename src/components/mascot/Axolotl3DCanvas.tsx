import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { 
  axolotlService, 
  SKIN_PALETTES, 
  ENVIRONMENTS_META, 
  type AxolotlSkinId, 
  type AxolotlAccessoryId, 
  type AxolotlEnvironmentId,
  type AxolotlMood,
  type AxolotlTreatType,
  TREATS_META
} from '../../services/axolotlService';
import { soundEngine } from '../../services/soundEngine';

export interface Axolotl3DCanvasProps {
  skin?: AxolotlSkinId;
  accessory?: AxolotlAccessoryId;
  environment?: AxolotlEnvironmentId;
  mood?: AxolotlMood;
  interactive?: boolean;
  enableOrbit?: boolean;
  autoRotate?: boolean;
  breathingGuide?: boolean;
  className?: string;
  onPet?: () => void;
  onCaptureSnapshot?: (dataUrl: string) => void;
}

interface StoredMaterials {
  bodyMaterial: THREE.MeshStandardMaterial;
  bellyMaterial: THREE.MeshStandardMaterial;
  gillStemMaterial: THREE.MeshStandardMaterial;
  gillFrillMaterial: THREE.MeshStandardMaterial;
  eyeMaterial: THREE.MeshStandardMaterial;
  finMaterial: THREE.MeshStandardMaterial;
  ambientLight: THREE.AmbientLight;
  rimLight: THREE.DirectionalLight;
}

// Helper: Build Accessory Geometry
function buildAccessory(group: THREE.Group, acc: AxolotlAccessoryId) {
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }

  if (acc === 'none') return;

  if (acc === 'glasses') {
    const glassesGroup = new THREE.Group();
    glassesGroup.position.set(0, 0.15, 0.64);

    const frameMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      metalness: 0.8,
      roughness: 0.2,
    });

    [-0.43, 0.43].forEach((x) => {
      const rimGeom = new THREE.TorusGeometry(0.18, 0.022, 12, 24);
      const rimMesh = new THREE.Mesh(rimGeom, frameMat);
      rimMesh.position.set(x, 0, 0);
      glassesGroup.add(rimMesh);
    });

    const bridgeGeom = new THREE.CylinderGeometry(0.016, 0.016, 0.42, 8);
    bridgeGeom.rotateZ(Math.PI / 2);
    const bridgeMesh = new THREE.Mesh(bridgeGeom, frameMat);
    bridgeMesh.position.set(0, 0, 0);
    glassesGroup.add(bridgeMesh);

    group.add(glassesGroup);
  } else if (acc === 'cap') {
    const capGroup = new THREE.Group();
    capGroup.position.set(0, 0.72, 0.05);

    const capMat = new THREE.MeshStandardMaterial({ color: '#1e1b4b', roughness: 0.5 });
    const goldMat = new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.8, roughness: 0.2 });

    const boardGeom = new THREE.BoxGeometry(0.95, 0.045, 0.95);
    boardGeom.rotateY(Math.PI / 4);
    const boardMesh = new THREE.Mesh(boardGeom, capMat);
    capGroup.add(boardMesh);

    const baseGeom = new THREE.CylinderGeometry(0.38, 0.45, 0.2, 16);
    baseGeom.translate(0, -0.1, 0);
    const baseMesh = new THREE.Mesh(baseGeom, capMat);
    capGroup.add(baseMesh);

    const tasselGeom = new THREE.CylinderGeometry(0.02, 0.04, 0.45, 8);
    tasselGeom.translate(0.35, -0.22, 0.2);
    const tasselMesh = new THREE.Mesh(tasselGeom, goldMat);
    capGroup.add(tasselMesh);

    group.add(capGroup);
  } else if (acc === 'headphones') {
    const hpGroup = new THREE.Group();
    hpGroup.position.set(0, 0.38, 0);

    const hpMat = new THREE.MeshStandardMaterial({ color: '#090a10', roughness: 0.3 });
    const neonMat = new THREE.MeshStandardMaterial({
      color: '#00f0ff',
      emissive: '#00f0ff',
      emissiveIntensity: 0.8,
    });

    const bandGeom = new THREE.TorusGeometry(0.74, 0.05, 8, 24, Math.PI);
    const bandMesh = new THREE.Mesh(bandGeom, hpMat);
    bandMesh.rotation.z = -Math.PI;
    bandMesh.position.y = 0.12;
    hpGroup.add(bandMesh);

    [-0.74, 0.74].forEach((x) => {
      const cupGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.12, 16);
      cupGeom.rotateZ(Math.PI / 2);
      const cupMesh = new THREE.Mesh(cupGeom, hpMat);
      cupMesh.position.set(x, 0.1, 0);
      hpGroup.add(cupMesh);

      const ringGeom = new THREE.RingGeometry(0.08, 0.15, 16);
      ringGeom.rotateY(Math.PI / 2);
      const ringMesh = new THREE.Mesh(ringGeom, neonMat);
      ringMesh.position.set(x > 0 ? x + 0.07 : x - 0.07, 0.1, 0);
      hpGroup.add(ringMesh);
    });

    group.add(hpGroup);
  } else if (acc === 'halo') {
    const haloGroup = new THREE.Group();
    haloGroup.position.set(0, 0.95, 0);

    const haloMat = new THREE.MeshStandardMaterial({
      color: '#fef08a',
      emissive: '#eab308',
      emissiveIntensity: 1.2,
      roughness: 0.1,
    });

    const haloGeom = new THREE.TorusGeometry(0.55, 0.045, 12, 32);
    haloGeom.rotateX(Math.PI / 2.3);
    const haloMesh = new THREE.Mesh(haloGeom, haloMat);
    haloGroup.add(haloMesh);

    group.add(haloGroup);
  } else if (acc === 'crown') {
    const crownGroup = new THREE.Group();
    crownGroup.position.set(0, 0.68, 0.08);

    const crownMat = new THREE.MeshStandardMaterial({
      color: '#facc15',
      metalness: 0.9,
      roughness: 0.15,
    });
    const gemMat = new THREE.MeshStandardMaterial({
      color: '#ef4444',
      emissive: '#ef4444',
      emissiveIntensity: 0.5,
    });

    const ringGeom = new THREE.CylinderGeometry(0.38, 0.42, 0.18, 16);
    const ringMesh = new THREE.Mesh(ringGeom, crownMat);
    crownGroup.add(ringMesh);

    for (let s = 0; s < 5; s++) {
      const ang = (s / 5) * Math.PI * 2;
      const spikeGeom = new THREE.ConeGeometry(0.08, 0.25, 8);
      const spikeMesh = new THREE.Mesh(spikeGeom, crownMat);
      spikeMesh.position.set(Math.cos(ang) * 0.38, 0.2, Math.sin(ang) * 0.38);
      crownGroup.add(spikeMesh);

      if (s === 0) {
        const gemGeom = new THREE.SphereGeometry(0.05, 8, 8);
        const gemMesh = new THREE.Mesh(gemGeom, gemMat);
        gemMesh.position.set(Math.cos(ang) * 0.42, 0.12, Math.sin(ang) * 0.42);
        crownGroup.add(gemMesh);
      }
    }

    group.add(crownGroup);
  } else if (acc === 'bowtie') {
    const bowGroup = new THREE.Group();
    bowGroup.position.set(0, -0.32, 0.58);

    const bowMat = new THREE.MeshStandardMaterial({ color: '#ec4899', roughness: 0.4 });
    const knotGeom = new THREE.SphereGeometry(0.08, 10, 10);
    bowGroup.add(new THREE.Mesh(knotGeom, bowMat));

    [-0.18, 0.18].forEach((x) => {
      const wingGeom = new THREE.ConeGeometry(0.16, 0.28, 8);
      wingGeom.rotateZ(x > 0 ? -Math.PI / 2 : Math.PI / 2);
      const wingMesh = new THREE.Mesh(wingGeom, bowMat);
      wingMesh.position.set(x, 0, 0);
      bowGroup.add(wingMesh);
    });

    group.add(bowGroup);
  } else if (acc === 'snorkel') {
    const goggleGroup = new THREE.Group();
    goggleGroup.position.set(0, 0.15, 0.6);

    const goggleMat = new THREE.MeshStandardMaterial({ color: '#06b6d4', roughness: 0.2 });
    const lensMat = new THREE.MeshStandardMaterial({
      color: '#e0f2fe',
      transparent: true,
      opacity: 0.6,
      roughness: 0.1,
    });

    const frameGeom = new THREE.BoxGeometry(1.05, 0.38, 0.12);
    const frameMesh = new THREE.Mesh(frameGeom, goggleMat);
    goggleGroup.add(frameMesh);

    const lensGeom = new THREE.BoxGeometry(0.95, 0.3, 0.02);
    lensGeom.translate(0, 0, 0.06);
    const lensMesh = new THREE.Mesh(lensGeom, lensMat);
    goggleGroup.add(lensMesh);

    const pipeGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8);
    pipeGeom.translate(0.62, 0.35, -0.1);
    const pipeMesh = new THREE.Mesh(pipeGeom, new THREE.MeshStandardMaterial({ color: '#f59e0b' }));
    goggleGroup.add(pipeMesh);

    group.add(goggleGroup);
  }
}

// Helper: Build Environment Floor & Props
function buildEnvironmentProps(group: THREE.Group, envId: AxolotlEnvironmentId) {
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }

  if (envId === 'sanctuary-reef') {
    const pebbleMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.8 });
    for (let p = 0; p < 35; p++) {
      const rad = 0.15 + Math.random() * 0.25;
      const pGeom = new THREE.DodecahedronGeometry(rad, 1);
      pGeom.scale(1.2, 0.5, 1);
      const pMesh = new THREE.Mesh(pGeom, pebbleMat);
      pMesh.position.set(
        (Math.random() - 0.5) * 5,
        -2.3 + Math.random() * 0.2,
        (Math.random() - 0.5) * 4
      );
      group.add(pMesh);
    }

    const plantMat = new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.5 });
    [-1.8, 1.8].forEach((x) => {
      const plantGeom = new THREE.CylinderGeometry(0.04, 0.12, 2.2, 8);
      plantGeom.translate(x, -1.2, -1.2);
      const plantMesh = new THREE.Mesh(plantGeom, plantMat);
      group.add(plantMesh);
    });
  } else if (envId === 'deep-biolum') {
    const crystalMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#0284c7',
      emissiveIntensity: 0.8,
      roughness: 0.1,
    });

    [-2, -1.2, 1.4, 2.2].forEach((x) => {
      const cGeom = new THREE.ConeGeometry(0.25, 1.6, 6);
      cGeom.translate(x, -1.5, -1.5);
      const cMesh = new THREE.Mesh(cGeom, crystalMat);
      group.add(cMesh);
    });
  } else if (envId === 'zen-pond') {
    const lotusGroup = new THREE.Group();
    lotusGroup.position.set(1.5, -1.6, -1);

    const petalMat = new THREE.MeshStandardMaterial({ color: '#f472b6', roughness: 0.3 });
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const petalGeom = new THREE.SphereGeometry(0.2, 8, 8);
      petalGeom.scale(0.5, 0.2, 1.2);
      const petalMesh = new THREE.Mesh(petalGeom, petalMat);
      petalMesh.position.set(Math.cos(ang) * 0.3, 0, Math.sin(ang) * 0.3);
      petalMesh.rotation.y = -ang;
      lotusGroup.add(petalMesh);
    }
    group.add(lotusGroup);
  } else if (envId === 'cyber-matrix') {
    const grid = new THREE.GridHelper(8, 16, '#00f0ff', '#1e293b');
    grid.position.y = -2.2;
    group.add(grid);
  }
}

export const Axolotl3DCanvas: React.FC<Axolotl3DCanvasProps> = ({
  skin: propSkin,
  accessory: propAccessory,
  environment: propEnvironment,
  mood: propMood,
  interactive = true,
  enableOrbit = true,
  autoRotate = false,
  breathingGuide = false,
  className = '',
  onPet,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeSkin, setActiveSkin] = useState<AxolotlSkinId>(propSkin || axolotlService.getState().skin);
  const [activeAccessory, setActiveAccessory] = useState<AxolotlAccessoryId>(propAccessory || axolotlService.getState().accessory);
  const [activeEnvironment, setActiveEnvironment] = useState<AxolotlEnvironmentId>(propEnvironment || axolotlService.getState().environment);
  const [activeMood, setActiveMood] = useState<AxolotlMood>(propMood || axolotlService.getState().mood);

  // Floating heart DOM overlay state
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [isPetting, setIsPetting] = useState(false);
  const [webglError, setWebglError] = useState(false);

  const effectiveSkin = propSkin || activeSkin;
  const effectiveAccessory = propAccessory || activeAccessory;
  const effectiveEnvironment = propEnvironment || activeEnvironment;
  const effectiveMood = propMood || activeMood;

  useEffect(() => {
    const unsub = axolotlService.subscribe((state) => {
      if (!propSkin) setActiveSkin(state.skin);
      if (!propAccessory) setActiveAccessory(state.accessory);
      if (!propEnvironment) setActiveEnvironment(state.environment);
      if (!propMood) setActiveMood(state.mood);
    });
    return unsub;
  }, [propSkin, propAccessory, propEnvironment, propMood]);

  // Live refs for animation loop & stable scene initialization
  const activeMoodRef = useRef(effectiveMood);
  const activeSkinRef = useRef(effectiveSkin);
  const activeAccessoryRef = useRef(effectiveAccessory);
  const activeEnvironmentRef = useRef(effectiveEnvironment);
  const breathingGuideRef = useRef(breathingGuide);
  const autoRotateRef = useRef(autoRotate);

  useEffect(() => {
    activeMoodRef.current = effectiveMood;
    activeSkinRef.current = effectiveSkin;
    activeAccessoryRef.current = effectiveAccessory;
    activeEnvironmentRef.current = effectiveEnvironment;
    breathingGuideRef.current = breathingGuide;
    autoRotateRef.current = autoRotate;
  });

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const axolotlGroupRef = useRef<THREE.Group | null>(null);
  const headGroupRef = useRef<THREE.Group | null>(null);
  const eyeMeshesRef = useRef<THREE.Mesh[]>([]);
  const mouthMeshRef = useRef<THREE.Mesh | null>(null);
  const gillsRef = useRef<THREE.Group[]>([]);
  const tailSegmentsRef = useRef<THREE.Group[]>([]);
  const limbsRef = useRef<THREE.Group[]>([]);
  const accessoriesGroupRef = useRef<THREE.Group | null>(null);
  const bubblesGroupRef = useRef<THREE.Group | null>(null);
  const environmentPropsGroupRef = useRef<THREE.Group | null>(null);
  const materialsRef = useRef<StoredMaterials | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Ground Contact Shadow Refs
  const shadowMeshRef = useRef<THREE.Mesh | null>(null);
  const shadowMatRef = useRef<THREE.MeshBasicMaterial | null>(null);

  // Blinking & Expression State
  const nextBlinkTimeRef = useRef<number>(2.5);
  const blinkProgressRef = useRef<number>(0);

  // Animation & Physics state
  const mouseRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const orbitRef = useRef<{ isDragging: boolean; startX: number; startY: number; rotationY: number; rotationX: number }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    rotationY: 0,
    rotationX: 0,
  });
  const trickAnimationRef = useRef<{ active: boolean; progress: number }>({ active: false, progress: 0 });
  const activeTreatRef = useRef<{ mesh: THREE.Group; targetPos: THREE.Vector3; progress: number } | null>(null);

  // Trigger acrobatic trick (360 roll)
  const triggerTrick = useCallback(() => {
    trickAnimationRef.current = { active: true, progress: 0 };
    try {
      soundEngine.playAxolotlChirp();
    } catch {
      // Audio catch
    }
  }, []);

  // Expose feeding helper
  const feedTreat = useCallback((treatType: AxolotlTreatType) => {
    if (!sceneRef.current) return;
    const treatMeta = TREATS_META[treatType];

    // Remove existing treat if any
    if (activeTreatRef.current) {
      sceneRef.current.remove(activeTreatRef.current.mesh);
      activeTreatRef.current = null;
    }

    const treatGroup = new THREE.Group();
    let geom: THREE.BufferGeometry;
    if (treatType === 'shrimp') {
      geom = new THREE.TorusGeometry(0.12, 0.05, 8, 16, Math.PI * 1.2);
    } else if (treatType === 'berry') {
      geom = new THREE.DodecahedronGeometry(0.14, 1);
    } else if (treatType === 'bean') {
      geom = new THREE.CapsuleGeometry(0.08, 0.12, 8, 12);
    } else {
      geom = new THREE.SphereGeometry(0.13, 16, 16);
    }

    const mat = new THREE.MeshStandardMaterial({
      color: treatMeta.color,
      roughness: 0.2,
      metalness: 0.4,
      emissive: treatMeta.color,
      emissiveIntensity: 0.35,
    });
    const mesh = new THREE.Mesh(geom, mat);
    treatGroup.add(mesh);

    // Initial drop position (top of tank)
    const dropX = (Math.random() - 0.5) * 1.2;
    treatGroup.position.set(dropX, 2.2, 0.5);
    sceneRef.current.add(treatGroup);

    activeTreatRef.current = {
      mesh: treatGroup,
      targetPos: new THREE.Vector3(dropX * 0.4, 0.3, 0.7),
      progress: 0,
    };
  }, []);

  // Listen to custom window events for tricks/feeding
  useEffect(() => {
    const handleDoTrick = () => triggerTrick();
    const handleFeedEvent = (e: CustomEvent<AxolotlTreatType>) => feedTreat(e.detail);

    window.addEventListener('axolotl-trick' as any, handleDoTrick);
    window.addEventListener('axolotl-feed' as any, handleFeedEvent);
    return () => {
      window.removeEventListener('axolotl-trick' as any, handleDoTrick);
      window.removeEventListener('axolotl-feed' as any, handleFeedEvent);
    };
  }, [triggerTrick, feedTreat]);

  // Main Three.js Scene Setup & Single Lifecycle Loop
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 400;
    const height = containerRef.current.clientHeight || 400;

    const initialPalette = SKIN_PALETTES[activeSkinRef.current] || SKIN_PALETTES.leucistic;
    const initialEnv = ENVIRONMENTS_META[activeEnvironmentRef.current] || ENVIRONMENTS_META['sanctuary-reef'];

    // 1. Scene & Fog
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.fog = new THREE.FogExp2(initialEnv.fogColor, 0.045);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 4.2);
    cameraRef.current = camera;

    // 3. WebGL Renderer with safe context handling
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
    } catch (err) {
      console.warn('WebGL Renderer initialization failed:', err);
      setTimeout(() => setWebglError(true), 0);
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.className = 'w-full h-full block';
    rendererRef.current = renderer;

    // Clear previous children and attach canvas
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }
    containerRef.current.appendChild(renderer.domElement);

    // 4. Lighting System
    const ambientLight = new THREE.AmbientLight(initialPalette.glowColor, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight('#ffffff', 1.8);
    keyLight.position.set(3, 4, 3.5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(initialPalette.accentColor, 1.4);
    rimLight.position.set(-3, 2, -3);
    scene.add(rimLight);

    const waterUnderglow = new THREE.PointLight(initialEnv.ambientLight, 1.8, 12);
    waterUnderglow.position.set(0, -2.5, 0);
    scene.add(waterUnderglow);

    // Caustics shimmer light
    const causticsLight = new THREE.PointLight('#a5f3fc', 1.2, 8);
    causticsLight.position.set(1.5, 2.5, 2);
    scene.add(causticsLight);

    // 5. Contact Soft Depth Shadow Blob Plane
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(15, 23, 42, 0.65)');
      grad.addColorStop(0.4, 'rgba(15, 23, 42, 0.25)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    shadowMatRef.current = shadowMat;
    const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -2.26;
    scene.add(shadowMesh);
    shadowMeshRef.current = shadowMesh;

    // 6. Axolotl Root Group
    const axolotlRoot = new THREE.Group();
    axolotlGroupRef.current = axolotlRoot;
    scene.add(axolotlRoot);

    // Accessories Container Group
    const accessoriesGroup = new THREE.Group();
    accessoriesGroupRef.current = accessoriesGroup;

    // 7. Load Industry-Standard Rigged 3D GLB Character Model
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      '/models/axolotl.glb',
      (gltf) => {
        // Clear any placeholder
        while (axolotlRoot.children.length > 0) {
          axolotlRoot.remove(axolotlRoot.children[0]);
        }

        const character = gltf.scene;
        axolotlRoot.add(character);

        // A. Socket Head
        const headObj = character.getObjectByName('Socket_Head');
        if (headObj instanceof THREE.Group) {
          headGroupRef.current = headObj;
          headObj.add(accessoriesGroup);
          buildAccessory(accessoriesGroup, activeAccessoryRef.current);
        }

        // B. Morphable Expressive Eyes
        const eyeL = character.getObjectByName('Mesh_Eye_L') as THREE.Mesh;
        const eyeR = character.getObjectByName('Mesh_Eye_R') as THREE.Mesh;
        const eyes: THREE.Mesh[] = [];
        if (eyeL) eyes.push(eyeL);
        if (eyeR) eyes.push(eyeR);
        eyeMeshesRef.current = eyes;

        // C. Morphable Eating Mouth
        const mouthObj = character.getObjectByName('Mesh_Mouth') as THREE.Mesh;
        if (mouthObj) {
          mouthMeshRef.current = mouthObj;
        }

        // D. 6 External Feathery Gills
        const gills: THREE.Group[] = [];
        for (let i = 0; i < 6; i++) {
          const g = character.getObjectByName(`Group_Gill_${i}`) as THREE.Group;
          if (g) {
            g.userData = {
              baseRotZ: g.rotation.z,
              baseRotY: g.rotation.y,
              baseRotX: 0,
              idx: i,
            };
            gills.push(g);
          }
        }
        gillsRef.current = gills;

        // E. Tail Segments (Fluid swimming ribbon)
        const tailSegs: THREE.Group[] = [];
        const tBase = character.getObjectByName('Group_Tail') as THREE.Group;
        const tMid = character.getObjectByName('Group_TailSeg2') as THREE.Group;
        const tTip = character.getObjectByName('Group_TailTip') as THREE.Group;
        if (tBase) tailSegs.push(tBase);
        if (tMid) tailSegs.push(tMid);
        if (tTip) tailSegs.push(tTip);
        tailSegmentsRef.current = tailSegs;

        // F. Limbs (Paws)
        const limbs: THREE.Group[] = [];
        ['FrontL', 'FrontR', 'RearL', 'RearR'].forEach((name, idx) => {
          const limb = character.getObjectByName(`Group_Limb_${name}`) as THREE.Group;
          if (limb) {
            limb.userData = {
              baseRotX: limb.rotation.x,
              baseRotZ: limb.rotation.z,
              idx,
            };
            limbs.push(limb);
          }
        });
        limbsRef.current = limbs;

        // G. Map Materials for Dynamic Skin Palette Retargeting
        const matMap: Record<string, THREE.MeshStandardMaterial> = {};
        character.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (m && m.name) {
              matMap[m.name] = m;
            }
          }
        });

        const bodyMat = matMap['Mat_Axolotl_Body'];
        const bellyMat = matMap['Mat_Axolotl_Belly'];
        const stemMat = matMap['Mat_Axolotl_GillStem'];
        const frillMat = matMap['Mat_Axolotl_GillFrill'];
        const eyeMat = matMap['Mat_Axolotl_Eyes'];
        const finMat = matMap['Mat_Axolotl_Fin'];

        if (bodyMat && bellyMat && stemMat && frillMat && eyeMat && finMat) {
          materialsRef.current = {
            bodyMaterial: bodyMat,
            bellyMaterial: bellyMat,
            gillStemMaterial: stemMat,
            gillFrillMaterial: frillMat,
            eyeMaterial: eyeMat,
            finMaterial: finMat,
            ambientLight,
            rimLight,
          };

          // Apply current active skin
          const p = SKIN_PALETTES[activeSkinRef.current] || SKIN_PALETTES.leucistic;
          bodyMat.color.set(p.bodyColor);
          bodyMat.roughness = p.roughness;
          bodyMat.metalness = p.metalness;
          bellyMat.color.set(p.bellyColor);
          bellyMat.roughness = Math.min(1, p.roughness + 0.1);
          stemMat.color.set(p.gillStemColor);
          frillMat.color.set(p.gillFrillColor);
          frillMat.emissive.set(p.gillFrillColor);
          frillMat.emissiveIntensity = activeSkinRef.current === 'cyber' || activeSkinRef.current === 'midnight' ? 0.45 : 0.15;
          eyeMat.color.set(p.eyeColor);
          finMat.color.set(p.gillStemColor);
        }
      },
      undefined,
      (err) => {
        console.warn('Axolotl GLB loading error, rendering graceful procedural backup:', err);
      }
    );

    // 8. Aquatic Environment Props
    const envPropsGroup = new THREE.Group();
    environmentPropsGroupRef.current = envPropsGroup;
    scene.add(envPropsGroup);
    buildEnvironmentProps(envPropsGroup, activeEnvironmentRef.current);

    // 9. Floating Translucent Bubbles
    const bubblesGroup = new THREE.Group();
    bubblesGroupRef.current = bubblesGroup;
    scene.add(bubblesGroup);

    const bubbleGeom = new THREE.SphereGeometry(0.08, 12, 12);
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.4,
    });

    const bubbleCount = initialEnv.bubbleCount || 30;
    for (let b = 0; b < bubbleCount; b++) {
      const bMesh = new THREE.Mesh(bubbleGeom, bubbleMat);
      bMesh.position.set(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 4
      );
      const s = 0.4 + Math.random() * 0.9;
      bMesh.scale.set(s, s, s);
      bMesh.userData = {
        speedY: 0.012 + Math.random() * 0.02,
        driftSpeed: 0.5 + Math.random() * 1.5,
        baseX: bMesh.position.x,
        baseZ: bMesh.position.z,
      };
      bubblesGroup.add(bMesh);
    }

    // 10. Animation Render Loop
    const clock = new THREE.Clock();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      const delta = clock.getDelta();
      const mood = activeMoodRef.current;
      const isBreathing = breathingGuideRef.current;
      const isAutoRotating = autoRotateRef.current;

      // 1. Water Caustics Shimmer
      causticsLight.position.x = Math.sin(elapsedTime * 1.2) * 2;
      causticsLight.position.y = 2.4 + Math.cos(elapsedTime * 1.5) * 0.4;
      causticsLight.intensity = 1.0 + Math.sin(elapsedTime * 3) * 0.3;

      // 2. Rising Bubbles Physics
      bubblesGroup.children.forEach((bubble) => {
        bubble.position.y += bubble.userData.speedY;
        bubble.position.x = bubble.userData.baseX + Math.sin(elapsedTime * bubble.userData.driftSpeed) * 0.15;
        bubble.position.z = bubble.userData.baseZ + Math.cos(elapsedTime * bubble.userData.driftSpeed) * 0.15;
        if (bubble.position.y > 3.2) {
          bubble.position.y = -3.2;
          bubble.userData.baseX = (Math.random() - 0.5) * 6;
          bubble.userData.baseZ = (Math.random() - 0.5) * 4;
        }
      });

      // 3. Swimming Dynamics
      let swimSpeed = 3.2;
      let wagIntensity = 0.22;
      if (mood === 'playful') {
        swimSpeed = 5.2;
        wagIntensity = 0.42;
      } else if (mood === 'zen' || isBreathing) {
        swimSpeed = 1.6;
        wagIntensity = 0.12;
      } else if (mood === 'sleepy') {
        swimSpeed = 1.2;
        wagIntensity = 0.08;
      }

      // Vertical sine wave bobbing in water
      const bobbing = Math.sin(elapsedTime * (swimSpeed * 0.7)) * 0.12;
      axolotlRoot.position.y = bobbing;

      // Breathing Guide expansion rhythm (4s in, 4s out = 8s cycle)
      if (isBreathing) {
        const breathCycle = (Math.sin(elapsedTime * 0.78) + 1) * 0.5;
        const breathScale = 1.0 + breathCycle * 0.14;
        axolotlRoot.scale.set(breathScale, breathScale, breathScale);
      } else {
        axolotlRoot.scale.set(1, 1, 1);
      }

      // Smooth mouse tracking interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

      // Head turns gracefully toward cursor
      if (headGroupRef.current) {
        headGroupRef.current.rotation.y = mouseRef.current.x * 0.55;
        headGroupRef.current.rotation.x = -mouseRef.current.y * 0.4;
      }

      // Gills dynamic waving (frills flutter underwater)
      gillsRef.current.forEach((gill) => {
        const phase = elapsedTime * swimSpeed + gill.userData.idx * 0.6;
        const wave = Math.sin(phase) * 0.14;
        gill.rotation.z = gill.userData.baseRotZ + wave;

        const perk = (mood === 'happy' || mood === 'playful') 
          ? Math.sin(elapsedTime * 6 + gill.userData.idx) * 0.08 
          : 0;
        gill.rotation.x = gill.userData.baseRotX + perk;
      });

      // Tail spine undulation (smooth ribbon wave propagation)
      tailSegmentsRef.current.forEach((seg, idx) => {
        const offset = idx * 0.65;
        const wave = Math.sin(elapsedTime * swimSpeed - offset) * wagIntensity;
        seg.rotation.y = wave;
      });

      // Paws paddling rhythm
      limbsRef.current.forEach((limb) => {
        const paddle = Math.sin(elapsedTime * swimSpeed + limb.userData.idx * 1.5) * 0.18;
        limb.rotation.x = limb.userData.baseRotX + paddle;
      });

      // --- 4. MORPH TARGET 1: NATURAL BLINKING LOOP ---
      if (elapsedTime > nextBlinkTimeRef.current) {
        blinkProgressRef.current = 1.0;
        nextBlinkTimeRef.current = elapsedTime + 3.0 + Math.random() * 3.5;
      }
      if (blinkProgressRef.current > 0) {
        blinkProgressRef.current -= delta * 7.5; // ~130ms realistic blink
        const blinkVal = Math.max(0, Math.sin(Math.max(0, blinkProgressRef.current) * Math.PI));
        eyeMeshesRef.current.forEach((eye) => {
          if (eye.morphTargetInfluences && eye.morphTargetDictionary && 'blink' in eye.morphTargetDictionary) {
            eye.morphTargetInfluences[eye.morphTargetDictionary['blink']] = blinkVal;
          }
        });
      }

      // --- 5. MORPH TARGET 2: HAPPY SQUINT / ZEN RELAXED EYES ---
      const isHappy = mood === 'happy' || mood === 'playful';
      const targetSquint = isHappy ? 0.85 : (isBreathing || mood === 'zen' ? 0.38 : 0);
      eyeMeshesRef.current.forEach((eye) => {
        if (eye.morphTargetInfluences && eye.morphTargetDictionary && 'squint' in eye.morphTargetDictionary) {
          const idx = eye.morphTargetDictionary['squint'];
          eye.morphTargetInfluences[idx] = THREE.MathUtils.lerp(eye.morphTargetInfluences[idx], targetSquint, 0.1);
        }
      });

      // --- 6. MORPH TARGET 3: TREAT MUNCHING (MOUTH OPENS) ---
      if (mouthMeshRef.current && mouthMeshRef.current.morphTargetInfluences && mouthMeshRef.current.morphTargetDictionary && 'open' in mouthMeshRef.current.morphTargetDictionary) {
        const openIdx = mouthMeshRef.current.morphTargetDictionary['open'];
        const isChomping = activeTreatRef.current && activeTreatRef.current.mesh.position.y <= 0.65;
        mouthMeshRef.current.morphTargetInfluences[openIdx] = THREE.MathUtils.lerp(
          mouthMeshRef.current.morphTargetInfluences[openIdx],
          isChomping ? 1.0 : 0.0,
          0.25
        );
      }

      // --- 7. CONTACT SHADOW GROUND BLOB DYNAMICS ---
      if (shadowMeshRef.current && shadowMatRef.current) {
        const shadowScale = Math.max(0.7, 1.0 - axolotlRoot.position.y * 0.35);
        shadowMeshRef.current.scale.set(shadowScale, shadowScale, shadowScale);
        shadowMatRef.current.opacity = Math.max(0.2, 0.55 - axolotlRoot.position.y * 0.25);
      }

      // 8. Acrobatic Trick Animation (360° Barrel Roll)
      if (trickAnimationRef.current.active) {
        trickAnimationRef.current.progress += delta * 2.5;
        const p = trickAnimationRef.current.progress;
        if (p < Math.PI * 2) {
          axolotlRoot.rotation.z = Math.sin(p) * Math.PI * 2;
          axolotlRoot.rotation.x = Math.sin(p * 0.5) * 0.5;
        } else {
          axolotlRoot.rotation.z = 0;
          axolotlRoot.rotation.x = 0;
          trickAnimationRef.current.active = false;
        }
      }

      // 9. Active Treat Pathfinding & Munching
      if (activeTreatRef.current) {
        const treat = activeTreatRef.current;
        treat.progress += delta * 1.2;
        treat.mesh.position.y -= delta * 0.65;
        treat.mesh.rotation.y += delta * 2.5;

        const dx = treat.mesh.position.x - axolotlRoot.position.x;
        const dy = treat.mesh.position.y - axolotlRoot.position.y;
        if (headGroupRef.current) {
          headGroupRef.current.rotation.y = dx * 0.4;
          headGroupRef.current.rotation.x = dy * 0.3;
        }

        if (treat.mesh.position.y <= 0.45 && treat.mesh.position.y >= -0.2) {
          scene.remove(treat.mesh);
          activeTreatRef.current = null;
          triggerTrick();
          try {
            soundEngine.playAxolotlChomp();
          } catch {
            // Audio catch
          }
        }
      }

      // 10. Camera Orbiting (User Drag or Auto-Rotate)
      if (isAutoRotating && !orbitRef.current.isDragging) {
        orbitRef.current.rotationY += 0.005;
      }

      const radius = 4.2;
      const camX = Math.sin(orbitRef.current.rotationY) * radius * Math.cos(orbitRef.current.rotationX);
      const camZ = Math.cos(orbitRef.current.rotationY) * radius * Math.cos(orbitRef.current.rotationX);
      const camY = Math.sin(orbitRef.current.rotationX) * radius + 0.3;
      camera.position.set(camX, camY, camZ);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (renderer.domElement && renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [triggerTrick]);

  // Reactive Update 1: Skin Changes
  useEffect(() => {
    if (!materialsRef.current) return;
    const p = SKIN_PALETTES[activeSkin] || SKIN_PALETTES.leucistic;
    const mats = materialsRef.current;

    mats.bodyMaterial.color.set(p.bodyColor);
    mats.bodyMaterial.roughness = p.roughness;
    mats.bodyMaterial.metalness = p.metalness;

    mats.bellyMaterial.color.set(p.bellyColor);
    mats.bellyMaterial.roughness = Math.min(1, p.roughness + 0.1);

    mats.gillStemMaterial.color.set(p.gillStemColor);
    mats.gillFrillMaterial.color.set(p.gillFrillColor);
    mats.gillFrillMaterial.emissive.set(p.gillFrillColor);
    mats.gillFrillMaterial.emissiveIntensity = activeSkin === 'cyber' || activeSkin === 'midnight' ? 0.45 : 0.15;

    mats.eyeMaterial.color.set(p.eyeColor);
    mats.finMaterial.color.set(p.gillStemColor);

    mats.ambientLight.color.set(p.glowColor);
    mats.rimLight.color.set(p.accentColor);
  }, [activeSkin]);

  // Reactive Update 2: Accessory Changes
  useEffect(() => {
    if (!accessoriesGroupRef.current) return;
    buildAccessory(accessoriesGroupRef.current, activeAccessory);
  }, [activeAccessory]);

  // Reactive Update 3: Environment Changes
  useEffect(() => {
    if (!environmentPropsGroupRef.current || !sceneRef.current) return;
    const e = ENVIRONMENTS_META[activeEnvironment] || ENVIRONMENTS_META['sanctuary-reef'];
    sceneRef.current.fog = new THREE.FogExp2(e.fogColor, 0.045);
  }, [activeEnvironment]);

  // Pointer Movement (Interactive Tracking & Orbiting)
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

    mouseRef.current.targetX = x;
    mouseRef.current.targetY = y;

    if (enableOrbit && orbitRef.current.isDragging) {
      const deltaX = e.clientX - orbitRef.current.startX;
      const deltaY = e.clientY - orbitRef.current.startY;
      orbitRef.current.rotationY += deltaX * 0.008;
      orbitRef.current.rotationX = Math.max(-0.6, Math.min(0.6, orbitRef.current.rotationX - deltaY * 0.005));
      orbitRef.current.startX = e.clientX;
      orbitRef.current.startY = e.clientY;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (enableOrbit) {
      orbitRef.current.isDragging = true;
      orbitRef.current.startX = e.clientX;
      orbitRef.current.startY = e.clientY;
    }
  };

  const handlePointerUp = () => {
    orbitRef.current.isDragging = false;
  };

  // Petting interaction on Axolotl
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!containerRef.current || !interactive) return;

    setIsPetting(true);
    setTimeout(() => setIsPetting(false), 800);

    triggerTrick();
    axolotlService.pet();

    const rect = containerRef.current.getBoundingClientRect();
    const newHeart = {
      id: Date.now() + Math.random(),
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setHearts((prev) => [...prev.slice(-8), newHeart]);

    if (onPet) onPet();
  };

  // Capture Photo Booth PNG Snapshot
  const captureSnapshot = useCallback(() => {
    if (!rendererRef.current) return null;
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    return dataUrl;
  }, []);

  useEffect(() => {
    (window as any).__axolotlCaptureSnapshot = captureSnapshot;
    return () => {
      delete (window as any).__axolotlCaptureSnapshot;
    };
  }, [captureSnapshot]);

  if (webglError) {
    return (
      <div className={`flex flex-col items-center justify-center p-6 text-center bg-slate-900/50 rounded-2xl border border-white/[0.08] ${className}`}>
        <span className="text-4xl mb-2">🦎</span>
        <h4 className="text-sm font-bold text-white mb-1">WebGL Disabled</h4>
        <p className="text-xs text-slate-400">Please enable WebGL in your browser settings to meet your study companion.</p>
      </div>
    );
  }

  return (
    <div 
      className={`relative w-full h-full select-none overflow-hidden ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        orbitRef.current.isDragging = false;
      }}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onClick={handleCanvasClick}
    >
      {/* 3D WebGL Canvas Container */}
      <div 
        ref={containerRef} 
        className={`w-full h-full cursor-grab active:cursor-grabbing transition-transform duration-300 ${
          isPetting ? 'scale-[1.02]' : 'scale-100'
        }`}
      />

      {/* Floating Hearts Particle Overlay */}
      {hearts.map((h) => (
        <div
          key={h.id}
          className="absolute pointer-events-none text-rose-400 font-bold text-xl animate-float-heart"
          style={{
            left: h.x,
            top: h.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          💖
        </div>
      ))}

      {/* Subtle Interaction Guide Pill */}
      {interactive && isHovered && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-950/70 backdrop-blur-md border border-white/[0.1] text-[11px] text-slate-300 font-medium pointer-events-none flex items-center gap-1.5 animate-fadeIn">
          <span>Tap to Pet</span>
          <span>•</span>
          <span>Drag to Orbit</span>
        </div>
      )}
    </div>
  );
};
