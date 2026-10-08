import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import confetti from 'canvas-confetti';
import {
  Armchair,
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Download,
  Focus,
  Footprints,
  Grid3x3,
  Layers,
  Lock,
  Maximize2,
  Menu,
  Minimize2,
  Moon,
  PanelLeftClose,
  PanelTop,
  Play,
  Repeat,
  RotateCw,
  Star,
  Sun,
  Tag,
  Trees,
  Utensils,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { lifeSimService, HOME_ROOMS, FURNITURE_CATALOG, HOUSING_CATALOG } from '../../services/lifeSimService';
import { type HomeRoomId, type DesignSlotType, type RoomDesignEvaluation, type HousingTier } from '../../types/lifeSim';
import type { StudySession } from '../../types';
import { soundEngine, type SoundType } from '../../services/soundEngine';
import { StorageService } from '../../services/storageService';
import { cn } from '../../utils/cn';
import { Badge, Button, IconButton, Kbd, Tokens } from '../ui/primitives';
import { CafeDialog } from './CafeDialog';
import { HomeDialog } from './HomeDialog';
import { MoneyDialog } from './MoneyDialog';
import { RoomRatingDialog } from './RoomRatingDialog';
import { formatBonus, formatMultiplier } from './campusFormat';
import {
  buildHouse,
  createMaterialLibrary,
  disposeObject,
  roomArea,
  roomCenter,
  ROOM_LAYOUT,
  FLOOR_LEVEL,
  type FloorFinishId,
  type HouseBuild,
  type MaterialLibrary,
  type WallFinishId,
} from './three/houseBuilder';
import { buildRoomFurniture, type FurnitureItemMeta } from './three/furniture';
import { skyGradient } from './three/textures';
import { buildCharacter3D, type CharacterModelInstance } from '../character/three/characterBuilder3d';
import { characterService } from '../../services/characterService';

export interface HomeDesign3DProps {
  onStartSession?: (session: StudySession) => void;
  onOpenStarterCatalog?: () => void;
  onToggleMobileSidebar?: () => void;
  className?: string;
}

type CameraMode = 'dollhouse' | 'exterior' | 'blueprint' | 'room_focus' | 'walk';
type WallsMode = 'cut' | 'full';

/** Floating panels over the 3D scene. */
const PANEL =
  'border border-line-strong bg-surface-solid/90 shadow-[0_12px_32px_-16px_rgb(0_0_0/0.55)] backdrop-blur-xl';

const VIEWS: { mode: CameraMode; label: string; hint: string; icon: LucideIcon }[] = [
  { mode: 'dollhouse', label: 'Dollhouse', hint: 'Every room from above, front walls cut away', icon: Box },
  { mode: 'exterior', label: 'Outside', hint: 'The house from the street', icon: Trees },
  { mode: 'blueprint', label: 'Plan', hint: 'Straight down, like a floor plan', icon: Grid3x3 },
  { mode: 'room_focus', label: 'Room', hint: 'Close up on the selected room', icon: Focus },
  { mode: 'walk', label: 'Walk', hint: 'Walk through it with WASD or the arrow keys', icon: Footprints },
];

const PANEL_TABS = [
  { id: 'furniture', label: 'Furniture' },
  { id: 'finishes', label: 'Finishes' },
  { id: 'outdoors', label: 'Outdoors' },
] as const;

const ROOM_LABELS: Record<HomeRoomId, string> = {
  study: 'Study',
  bedroom: 'Bedroom',
  living: 'Living room',
  kitchen: 'Kitchen',
  balcony: 'Balcony',
};

const SLOT_LABELS: Record<DesignSlotType, string> = {
  desk: 'Desk',
  chair: 'Chair',
  bed: 'Bed',
  sofa: 'Sofa',
  lighting: 'Lighting',
  plant: 'Plant',
  rug: 'Rug',
  wall_art: 'Wall art',
  station: 'Station',
  shelf: 'Shelf',
};

/** The background sounds the speaker button steps through. */
const SOUND_CYCLE: SoundType[] = ['off', 'rain', 'ambient-drone', 'binaural-40hz'];
const SOUND_LABELS: Partial<Record<SoundType, string>> = {
  rain: 'rain',
  'ambient-drone': 'ambient pad',
  'binaural-40hz': '40 Hz tone',
  'binaural-alpha-10hz': 'alpha waves',
  'brown-noise': 'brown noise',
  'pink-noise': 'pink noise',
};

const SITE_FEATURES = [
  { icon: '🚗', title: 'Carport and driveway', desc: 'A timber pergola over a paved drive' },
  { icon: '🏊', title: 'Pool', desc: 'A 6 × 4.5 m pool with a stone deck' },
  { icon: '🪴', title: 'Terrace', desc: 'A timber deck with a glass balustrade' },
  { icon: '🌸', title: 'Garden', desc: 'Cherry blossoms, cypress and hedges' },
];

const FINISH_STORAGE_KEY = 'studify_home3d_finishes_v1';
const ROTATION_STORAGE_KEY = 'studify_home3d_rotations_v1';

const WALL_FINISHES: { id: WallFinishId; label: string; color: string }[] = [
  { id: 'white_modern', label: 'Matte White Plaster', color: '#eeebe5' },
  { id: 'exposed_brick', label: 'Reclaimed Brick', color: '#9a4a32' },
  { id: 'cedar_slats', label: 'Cedar Slat Panelling', color: '#b0703a' },
  { id: 'concrete_loft', label: 'Board-Formed Concrete', color: '#8e9297' },
];

const FLOOR_FINISHES: { id: FloorFinishId; label: string; color: string }[] = [
  { id: 'honey_parquet', label: 'Oak Plank', color: '#c08a4a' },
  { id: 'white_marble', label: 'Carrara Marble', color: '#e7e6e2' },
  { id: 'charcoal_slate', label: 'Charcoal Slate', color: '#2b2f35' },
  { id: 'wool_carpet', label: 'Wool Carpet', color: '#a9a197' },
];

const readFinishes = (): { wall: WallFinishId; floor: FloorFinishId } => {
  try {
    const raw = localStorage.getItem(FINISH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { wall?: WallFinishId; floor?: FloorFinishId };
      return {
        wall: WALL_FINISHES.some((f) => f.id === parsed.wall) ? (parsed.wall as WallFinishId) : 'white_modern',
        floor: FLOOR_FINISHES.some((f) => f.id === parsed.floor) ? (parsed.floor as FloorFinishId) : 'honey_parquet',
      };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return { wall: 'white_modern', floor: 'honey_parquet' };
};

const readRotations = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(ROTATION_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore corrupt storage */
  }
  return {};
};

/** Camera presets in meters (adapts to current housing tier footprint). */
const cameraPreset = (
  mode: CameraMode,
  room: HomeRoomId,
  tier: HousingTier = 'dorm',
): { pos: THREE.Vector3; target: THREE.Vector3 } => {
  switch (mode) {
    case 'exterior':
      if (tier === 'dorm') {
        return { pos: new THREE.Vector3(8, 6.5, 14), target: new THREE.Vector3(-4, 1.4, -3.5) };
      }
      if (tier === 'studio') {
        return { pos: new THREE.Vector3(12, 7.5, 18), target: new THREE.Vector3(-4, 1.8, 0) };
      }
      return { pos: new THREE.Vector3(24, 8.5, 30), target: new THREE.Vector3(1, 2.2, 3) };
    case 'blueprint':
      if (tier === 'dorm') {
        return { pos: new THREE.Vector3(-4, 22, -3.49), target: new THREE.Vector3(-4, 0, -3.5) };
      }
      if (tier === 'studio') {
        return { pos: new THREE.Vector3(-4, 30, 0.01), target: new THREE.Vector3(-4, 0, 0) };
      }
      return { pos: new THREE.Vector3(0, 40, 0.01), target: new THREE.Vector3(0, 0, 1.6) };
    case 'walk': {
      const c = roomCenter(room);
      return { pos: new THREE.Vector3(c.x, 1.82, c.z + 1.2), target: new THREE.Vector3(c.x, 1.82, c.z - 2) };
    }
    case 'room_focus': {
      const c = roomCenter(room);
      const offset = room === 'balcony' ? new THREE.Vector3(2.5, 6, 7.5) : new THREE.Vector3(3.6, 7.4, 6.2);
      return { pos: c.clone().add(offset), target: c.clone().add(new THREE.Vector3(0, 0.4, 0)) };
    }
    case 'dollhouse':
    default:
      if (tier === 'dorm') {
        return { pos: new THREE.Vector3(5, 12, 6), target: new THREE.Vector3(-4, 0.4, -3.5) };
      }
      if (tier === 'studio') {
        return { pos: new THREE.Vector3(8, 15, 11), target: new THREE.Vector3(-4, 0.4, 0) };
      }
      return { pos: new THREE.Vector3(15, 17, 19), target: new THREE.Vector3(0, 0.4, 1.2) };
  }
};

export const HomeDesign3D: React.FC<HomeDesign3DProps> = ({
  onStartSession,
  onOpenStarterCatalog,
  onToggleMobileSidebar,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const compassRef = useRef<HTMLDivElement>(null);

  // View controls
  const [dailyLedger, setDailyLedger] = useState(() => lifeSimService.getDailyLedger());
  const [cameraMode, setCameraMode] = useState<CameraMode>('dollhouse');
  const [selectedRoomId, setSelectedRoomId] = useState<HomeRoomId>('study');
  const [hoveredRoom, setHoveredRoom] = useState<HomeRoomId | null>(null);
  const [showRoof, setShowRoof] = useState(false);
  const [wallsMode, setWallsMode] = useState<WallsMode>('cut');
  const [showLabels, setShowLabels] = useState(true);
  const [sunTime, setSunTime] = useState<number>(14);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 768 : true));
  const [sidebarTab, setSidebarTab] = useState<(typeof PANEL_TABS)[number]['id']>('furniture');

  // Finishes (persisted)
  const [wallTexture, setWallTexture] = useState<WallFinishId>(() => readFinishes().wall);
  const [floorTexture, setFloorTexture] = useState<FloorFinishId>(() => readFinishes().floor);
  const [selectedSlotFilter, setSelectedSlotFilter] = useState<DesignSlotType | 'all'>('all');
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 3D Direct Manipulation & Walk Mode state
  const [selectedFurniture, setSelectedFurniture] = useState<FurnitureItemMeta | null>(null);
  const [furnitureRotations, setFurnitureRotations] = useState<Record<string, number>>(readRotations);
  const [walkCurrentRoom, setWalkCurrentRoom] = useState<string>('Study Sanctuary');

  const modeRef = useRef<CameraMode>('dollhouse');
  // Latest setMode, for listeners registered once in the mount effect.
  const setModeRef = useRef<(mode: CameraMode) => void>(() => {});
  const selectionRingRef = useRef<THREE.Mesh | null>(null);
  const walkKeysRef = useRef<Record<string, boolean>>({});
  const walkAnglesRef = useRef<{ yaw: number; pitch: number }>({ yaw: Math.PI, pitch: 0 });
  const activeRoomNameRef = useRef<string>('Study Sanctuary');
  const charInstanceRef = useRef<CharacterModelInstance | null>(null);

  // Synchronize 3D character customizations live (the avatar editor opens from the sidebar)
  useEffect(() => {
    const unsub = characterService.subscribe((updated) => {
      if (charInstanceRef.current) {
        charInstanceRef.current.updateCustomization(updated);
      }
    });
    return unsub;
  }, []);

  // Live service state
  const [walletCoins, setWalletCoins] = useState(() => lifeSimService.getWalletBalance());
  const [equippedItems, setEquippedItems] = useState(() => lifeSimService.getEquippedFurniture(selectedRoomId));
  const [ownedIds, setOwnedIds] = useState(() => lifeSimService.getOwnedFurnitureIds());
  const [currentSound, setCurrentSound] = useState<SoundType>(soundEngine.getCurrentSound());
  const [furnitureVersion, setFurnitureVersion] = useState(0);
  const [evaluation, setEvaluation] = useState<RoomDesignEvaluation>(() => lifeSimService.calculateRoomDesignScore(selectedRoomId));
  const [isHomeOpen, setIsHomeOpen] = useState(false);
  const [isCafeOpen, setIsCafeOpen] = useState(false);
  const [isMoneyOpen, setIsMoneyOpen] = useState(false);
  const [housingProperty, setHousingProperty] = useState(() => lifeSimService.getHousing());

  const activeMultiplier = lifeSimService.getActiveMultiplier();

  // Reviews can't happen while this screen is open, so read the total once on mount.
  const [totalCardsReviewed] = useState(() => {
    try {
      const cards = StorageService.getAllCards();
      const count = cards.reduce((acc, c) => acc + (c.reps || 0), 0);
      return count > 0 ? count : (StorageService.getStats().conceptsMastered || 0);
    } catch {
      return 0;
    }
  });

  const savedSessions = StorageService.getSessions();
  const dueCards = StorageService.getDueCards();
  const primaryDeck = useMemo(() => {
    if (savedSessions.length === 0) return null;
    if (dueCards.length > 0) {
      return (
        savedSessions.find((s) =>
          s.concepts.some((cp) => (cp.retrievalCards || []).some((rc) => dueCards.some((dc) => dc.id === rc.id))),
        ) || savedSessions[0]
      );
    }
    return savedSessions[0];
  }, [savedSessions, dueCards]);

  // Three.js references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const houseRef = useRef<HouseBuild | null>(null);
  const libRef = useRef<MaterialLibrary | null>(null);
  const skyRef = useRef<{ day: THREE.Texture; night: THREE.Texture } | null>(null);
  const labelsRef = useRef<CSS2DObject[]>([]);
  const tweenRef = useRef({ active: false, pos: new THREE.Vector3(), target: new THREE.Vector3() });
  const hoveredRef = useRef<HomeRoomId | null>(null);
  const finishRef = useRef({ wall: wallTexture, floor: floorTexture });
  const selectedRoomIdRef = useRef(selectedRoomId);
  const showLabelsRef = useRef(showLabels);
  const showRoofRef = useRef(showRoof);
  const wallsModeRef = useRef(wallsMode);
  const sunTimeRef = useRef(sunTime);
  const housingTierRef = useRef<HousingTier>(lifeSimService.getHousing().id);
  const previousTierRef = useRef<HousingTier>(lifeSimService.getHousing().id);
  const lastCompassDegRef = useRef(0);

  // Reload the room's furniture and score when the selected room changes
  // (adjusting state during render, rather than in an effect).
  const [roomDataFor, setRoomDataFor] = useState(selectedRoomId);
  if (roomDataFor !== selectedRoomId) {
    setRoomDataFor(selectedRoomId);
    setEquippedItems(lifeSimService.getEquippedFurniture(selectedRoomId));
    setEvaluation(lifeSimService.calculateRoomDesignScore(selectedRoomId));
  }

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId]);

  useEffect(() => {
    showLabelsRef.current = showLabels;
    showRoofRef.current = showRoof;
    wallsModeRef.current = wallsMode;
  }, [showLabels, showRoof, wallsMode]);

  useEffect(() => {
    sunTimeRef.current = sunTime;
  }, [sunTime]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  }, []);

  const handlePayRentDirect = useCallback(() => {
    const housing = lifeSimService.getHousing();
    const res = lifeSimService.payDailyRent();
    if (res.success) {
      showToast(`Rent paid. Your ${formatBonus(housing.wageMultiplier - 1)} home bonus is on until the day ends.`);
      setDailyLedger(lifeSimService.getDailyLedger());
      setWalletCoins(lifeSimService.getWalletBalance());
    } else {
      showToast(res.error || 'Could not pay the rent just now.');
    }
  }, [showToast]);

  // Sync with lifeSimService (global listener: updates wallet and equips without re-subscribing on room selection)
  useEffect(() => {
    const update = () => {
      setWalletCoins(lifeSimService.getWalletBalance());
      setHousingProperty(lifeSimService.getHousing());
      setDailyLedger(lifeSimService.getDailyLedger());
      setEquippedItems(lifeSimService.getEquippedFurniture(selectedRoomIdRef.current));
      setOwnedIds(lifeSimService.getOwnedFurnitureIds());
      setEvaluation(lifeSimService.calculateRoomDesignScore(selectedRoomIdRef.current));
      setFurnitureVersion((v) => v + 1);
      if (houseRef.current?.villaGrounds) {
        houseRef.current.villaGrounds.visible = lifeSimService.getHousing().id === 'penthouse';
      }
      if (rendererRef.current) {
        rendererRef.current.shadowMap.needsUpdate = true;
      }
    };
    const unsubLife = lifeSimService.subscribe(update);
    const unsubSound = soundEngine.subscribe((s) => setCurrentSound(s));
    update();
    return () => {
      unsubLife();
      unsubSound();
    };
  }, []);

  // ========================================================
  // SCENE INITIALISATION (runs once)
  // ========================================================
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const sky = { day: skyGradient('#7fb3e6', '#e8f1f7'), night: skyGradient('#070b18', '#1d2740') };
    skyRef.current = sky;
    scene.background = sky.day;
    scene.fog = new THREE.Fog(0xe8f1f7, 70, 150);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 400);
    cameraRef.current = camera;
    const initial = cameraPreset('dollhouse', 'study', lifeSimService.getHousing().id);
    camera.position.copy(initial.pos);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.inset = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.replaceChildren(renderer.domElement, labelRenderer.domElement);

    // Post-processing: ground-truth ambient occlusion grounds furniture and
    // darkens corners, then the output pass applies tone mapping.
    const composer = new EffectComposer(renderer);
    composerRef.current = composer;
    composer.addPass(new RenderPass(scene, camera));
    const gtao = new GTAOPass(scene, camera, width, height);
    gtao.blendIntensity = 0.85;
    gtao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12, distanceFallOff: 1 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    // Skip the occlusion pass on phones and low-core devices to keep it smooth.
    const lowPower =
      window.matchMedia?.('(pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 4) <= 4;
    if (!lowPower) composer.addPass(gtao);
    composer.addPass(new OutputPass());

    // Image-based lighting for realistic reflections on glass, metal and marble
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTexture = pmrem.fromScene(roomEnv, 0.04).texture;
    scene.environment = envTexture;
    scene.environmentIntensity = 0.45;

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.minDistance = 3;
    controls.maxDistance = 70;
    controls.target.copy(initial.target);
    controls.addEventListener('start', () => {
      tweenRef.current.active = false;
    });

    // Lighting
    const hemi = new THREE.HemisphereLight(0xdfefff, 0x6b7458, 1.1);
    hemiLightRef.current = hemi;
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff4e5, 2.6);
    sunLightRef.current = sun;
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -26;
    sun.shadow.camera.right = 26;
    sun.shadow.camera.top = 26;
    sun.shadow.camera.bottom = -26;
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);

    // Architecture
    const lib = createMaterialLibrary();
    lib.counterTop.userData.shared = true;
    libRef.current = lib;
    lib.setWallFinish(finishRef.current.wall);
    lib.setFloorFinish(finishRef.current.floor);
    const house = buildHouse(lib, lifeSimService.getHousing().id);
    houseRef.current = house;
    scene.add(house.root);

    // 3D User Character sitting / standing in study sanctuary
    // The avatar arrives from background workers; refresh shadows when it does.
    const char = buildCharacter3D(characterService.getCharacter(), {
      showPedestal: false,
      showShadow: true,
      onChange: () => {
        if (rendererRef.current) rendererRef.current.shadowMap.needsUpdate = true;
      },
    });
    char.root.position.set(-4.2, FLOOR_LEVEL, -3.2);
    char.root.rotation.y = Math.PI / 3.8;
    house.interior.add(char.root);
    charInstanceRef.current = char;

    // 3D Interactive Furniture Selection Halo
    const ringGeo = new THREE.RingGeometry(0.48, 0.54, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(0, 0.03, 0);
    ringMesh.visible = false;
    ringMesh.renderOrder = 3;
    scene.add(ringMesh);
    selectionRingRef.current = ringMesh;

    // Room labels (name + floor area or locked state)
    labelsRef.current = HOME_ROOMS.map((room) => {
      const el = document.createElement('div');
      const isUnlocked = lifeSimService.isRoomUnlocked(room.id);
      el.className =
        `px-2 py-0.5 rounded-md ${isUnlocked ? 'bg-white/90 text-slate-800' : 'bg-slate-900/90 text-amber-200 border border-amber-500/30'} text-[10px] font-semibold shadow-md ring-1 ring-black/10 whitespace-nowrap leading-tight text-center`;
      el.innerHTML = isUnlocked
        ? `${room.name}<br/><span style="font-weight:500;color:#64748b">${roomArea(room.id).toFixed(1)} m²</span>`
        : `🔒 ${room.name}<br/><span style="font-weight:500;color:#f59e0b">Locked</span>`;
      const label = new CSS2DObject(el);
      const r = ROOM_LAYOUT[room.id];
      label.position.set((r.x0 + r.x1) / 2, 0.1, (r.z0 + r.z1) / 2);
      house.interior.add(label);
      return label;
    });

    // Picking & Look
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const pickFurniture = (e: PointerEvent): FurnitureItemMeta | null => {
      const house = houseRef.current;
      if (!house) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(house.furnitureRoot.children, true);
      for (const hit of hits) {
        let cur: THREE.Object3D | null = hit.object;
        while (cur && cur !== house.furnitureRoot) {
          if (cur.userData?.id && cur.userData?.slotType) {
            return cur.userData as FurnitureItemMeta;
          }
          cur = cur.parent;
        }
      }
      return null;
    };

    const pickRoom = (e: PointerEvent): HomeRoomId | null => {
      const house = houseRef.current;
      if (!house) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(Array.from(house.pickers.values()), false)[0];
      return hit ? (hit.object.userData.roomId as HomeRoomId) : null;
    };

    let downX = 0;
    let downY = 0;
    let isDragging = false;

    const onDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
      isDragging = true;
    };

    const onUp = (e: PointerEvent) => {
      isDragging = false;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      if (modeRef.current === 'walk') return;

      const item = pickFurniture(e);
      if (item) {
        setSelectedFurniture(item);
        setSelectedRoomId(item.roomId);
        soundEngine.playTapPop();
        return;
      }

      setSelectedFurniture(null);
      const id = pickRoom(e);
      if (id) {
        if (!lifeSimService.isRoomUnlocked(id)) {
          // A locked wing opens the home upgrades, which say what it takes to add it.
          setIsHomeOpen(true);
        } else {
          setSelectedRoomId(id);
        }
        soundEngine.playTapPop();
      }
    };

    const onMove = (e: PointerEvent) => {
      if (modeRef.current === 'walk') {
        if (isDragging) {
          const dx = e.clientX - downX;
          const dy = e.clientY - downY;
          downX = e.clientX;
          downY = e.clientY;
          walkAnglesRef.current.yaw -= dx * 0.0035;
          walkAnglesRef.current.pitch = THREE.MathUtils.clamp(
            walkAnglesRef.current.pitch - dy * 0.0035,
            -1.05,
            1.05
          );
        }
        return;
      }

      if (e.buttons !== 0) return;
      const id = pickRoom(e);
      if (id !== hoveredRef.current) {
        hoveredRef.current = id;
        setHoveredRoom(id);
      }
    };

    const onLeave = () => {
      isDragging = false;
      hoveredRef.current = null;
      setHoveredRoom(null);
    };

    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerleave', onLeave);

    const onKeyDown = (e: KeyboardEvent) => {
      walkKeysRef.current[e.code] = true;
      if (e.code === 'Escape' && modeRef.current === 'walk') {
        setModeRef.current('dollhouse');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      walkKeysRef.current[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Render loop
    let frame = 0;
    let lastTime = performance.now();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (modeRef.current === 'walk') {
        controls.enabled = false;
        const keys = walkKeysRef.current;
        const angles = walkAnglesRef.current;

        const sinY = Math.sin(angles.yaw);
        const cosY = Math.cos(angles.yaw);
        const fwd = new THREE.Vector3(-sinY, 0, -cosY);
        const right = new THREE.Vector3(cosY, 0, -sinY);

        let moveZ = 0;
        let moveX = 0;
        if (keys['KeyW'] || keys['ArrowUp']) moveZ += 1;
        if (keys['KeyS'] || keys['ArrowDown']) moveZ -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;

        if (moveZ !== 0 || moveX !== 0) {
          const speed = 4.2;
          const moveDir = new THREE.Vector3()
            .addScaledVector(fwd, moveZ)
            .addScaledVector(right, moveX)
            .normalize();
          camera.position.addScaledVector(moveDir, speed * dt);
          camera.position.x = THREE.MathUtils.clamp(camera.position.x, -13.5, 14.5);
          camera.position.z = THREE.MathUtils.clamp(camera.position.z, -10.5, 19.5);
        }
        camera.position.y = 1.82;

        const cosP = Math.cos(angles.pitch);
        const sinP = Math.sin(angles.pitch);
        const lookDir = new THREE.Vector3(-sinY * cosP, sinP, -cosY * cosP);
        camera.lookAt(camera.position.clone().add(lookDir));

        const px = camera.position.x;
        const pz = camera.position.z;
        let currentRoomName = 'Terrace & Grounds';
        for (const [rid, rect] of Object.entries(ROOM_LAYOUT)) {
          if (px >= rect.x0 && px <= rect.x1 && pz >= rect.z0 && pz <= rect.z1) {
            const found = HOME_ROOMS.find((r) => r.id === rid);
            if (found) currentRoomName = found.name;
            break;
          }
        }
        if (currentRoomName !== activeRoomNameRef.current) {
          activeRoomNameRef.current = currentRoomName;
          setWalkCurrentRoom(currentRoomName);
        }
      } else {
        controls.enabled = true;
        const tw = tweenRef.current;
        if (tw.active) {
          camera.position.lerp(tw.pos, 0.085);
          controls.target.lerp(tw.target, 0.085);
          if (camera.position.distanceTo(tw.pos) < 0.02 && controls.target.distanceTo(tw.target) < 0.02) tw.active = false;
        }
        controls.update();
      }

      if (selectionRingRef.current?.visible) {
        selectionRingRef.current.rotation.z += 0.02;
      }

      lib.waterTexture.offset.x += 0.00025;
      lib.waterTexture.offset.y += 0.00015;
      lib.waterNormalTexture.offset.x += 0.00035;
      lib.waterNormalTexture.offset.y += 0.0002;
      if (compassRef.current) {
        const az = modeRef.current === 'walk' ? walkAnglesRef.current.yaw : controls.getAzimuthalAngle();
        const deg = Math.round(THREE.MathUtils.radToDeg(az));
        if (Math.abs(deg - lastCompassDegRef.current) >= 1) {
          lastCompassDegRef.current = deg;
          compassRef.current.style.transform = `rotate(${deg}deg)`;
        }
      }
      if (charInstanceRef.current) {
        charInstanceRef.current.update(dt, modeRef.current === 'walk' ? 'idle' : 'study');
      }

      composer.render(dt);
      if (showLabelsRef.current && modeRef.current !== 'walk' && !showRoofRef.current) {
        labelRenderer.render(scene, camera);
      }
    };
    animate();

    // Resize with the container (handles fullscreen toggle, sidebar, window)
    const observer = new ResizeObserver(() => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      labelRenderer.setSize(w, h);
    });
    observer.observe(container);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      if (charInstanceRef.current) {
        charInstanceRef.current.dispose();
        charInstanceRef.current = null;
      }
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      ringGeo.dispose();
      ringMat.dispose();
      controls.dispose();
      disposeObject(house.root);
      lib.glow.dispose();
      lib.dispose();
      envTexture.dispose();
      pmrem.dispose();
      sky.day.dispose();
      sky.night.dispose();
      gtao.dispose();
      composer.dispose();
      composerRef.current = null;
      renderer.dispose();
      container.replaceChildren();
      houseRef.current = null;
      libRef.current = null;
      labelsRef.current = [];
    };
  }, [showToast]); // showToast is stable, so this still runs once on mount

  // Rebuild furniture whenever equipment or custom rotations change
  useEffect(() => {
    const house = houseRef.current;
    const lib = libRef.current;
    if (!house || !lib) return;
    const root = house.furnitureRoot;
    [...root.children].forEach((child) => {
      root.remove(child);
      disposeObject(child);
    });
    HOME_ROOMS.forEach((room) => {
      root.add(
        buildRoomFurniture(
          room.id,
          lifeSimService.getEquippedFurniture(room.id),
          { glow: lib.glow },
          lib.counterTop,
          furnitureRotations,
          lifeSimService.isRoomUnlocked(room.id),
        ),
      );
    });

    // Update room labels text & locked styling
    HOME_ROOMS.forEach((room, idx) => {
      const label = labelsRef.current[idx];
      if (label && label.element) {
        const isUnlocked = lifeSimService.isRoomUnlocked(room.id);
        label.element.className =
          `px-2 py-0.5 rounded-md ${isUnlocked ? 'bg-white/90 text-slate-800' : 'bg-slate-900/90 text-amber-200 border border-amber-500/30'} text-[10px] font-semibold shadow-md ring-1 ring-black/10 whitespace-nowrap leading-tight text-center`;
        label.element.innerHTML = isUnlocked
          ? `${room.name}<br/><span style="font-weight:500;color:#64748b">${roomArea(room.id).toFixed(1)} m²</span>`
          : `🔒 ${room.name}<br/><span style="font-weight:500;color:#f59e0b">Locked</span>`;
      }
    });

    if (house.villaGrounds) {
      house.villaGrounds.visible = lifeSimService.getHousing().id === 'penthouse';
    }

    if (rendererRef.current) {
      rendererRef.current.shadowMap.needsUpdate = true;
    }
  }, [furnitureVersion, furnitureRotations]);

  // Update selection ring halo when selectedFurniture changes
  useEffect(() => {
    const ring = selectionRingRef.current;
    const house = houseRef.current;
    if (!ring || !house) return;
    if (!selectedFurniture) {
      ring.visible = false;
      return;
    }
    let targetObj: THREE.Object3D | null = null;
    house.furnitureRoot.traverse((child) => {
      if (child.userData?.id === selectedFurniture.id) {
        targetObj = child;
      }
    });
    if (targetObj) {
      const box = new THREE.Box3().setFromObject(targetObj);
      const center = new THREE.Vector3();
      box.getCenter(center);
      const size = new THREE.Vector3();
      box.getSize(size);
      const radius = Math.max(0.42, Math.hypot(size.x, size.z) / 2 + 0.08);
      ring.scale.set(radius, radius, 1);
      ring.position.set(center.x, 0.025, center.z);
      ring.visible = true;
    } else {
      ring.visible = false;
    }
  }, [selectedFurniture, furnitureVersion, furnitureRotations]);

  // Live wall / floor finishes
  useEffect(() => {
    finishRef.current = { wall: wallTexture, floor: floorTexture };
    libRef.current?.setWallFinish(wallTexture);
    libRef.current?.setFloorFinish(floorTexture);
    try {
      localStorage.setItem(FINISH_STORAGE_KEY, JSON.stringify({ wall: wallTexture, floor: floorTexture }));
    } catch {
      /* storage unavailable */
    }
  }, [wallTexture, floorTexture]);

  // Rebuild the physical house structure based on unlocked stages / housing tier
  const rebuildHouse = useCallback((tier: HousingTier) => {
    const scene = sceneRef.current;
    const lib = libRef.current;
    const oldHouse = houseRef.current;
    if (!scene || !lib || !oldHouse) return;

    // 1. Remove old house from scene and recursively dispose
    scene.remove(oldHouse.root);
    disposeObject(oldHouse.root);

    // 2. Build new house for the specific housing tier
    const newHouse = buildHouse(lib, tier);
    houseRef.current = newHouse;
    scene.add(newHouse.root);

    // 3. Rebuild furniture in new house
    const root = newHouse.furnitureRoot;
    HOME_ROOMS.forEach((room) => {
      root.add(
        buildRoomFurniture(
          room.id,
          lifeSimService.getEquippedFurniture(room.id),
          { glow: lib.glow },
          lib.counterTop,
          furnitureRotations,
          lifeSimService.isRoomUnlocked(room.id),
        ),
      );
    });

    // 4. Re-attach 3D User Character in new house
    if (charInstanceRef.current) {
      charInstanceRef.current.dispose();
      charInstanceRef.current = null;
    }
    const char = buildCharacter3D(characterService.getCharacter(), {
      showPedestal: false,
      showShadow: true,
      onChange: () => {
        if (rendererRef.current) rendererRef.current.shadowMap.needsUpdate = true;
      },
    });
    char.root.position.set(-4.2, FLOOR_LEVEL, -3.2);
    char.root.rotation.y = Math.PI / 3.8;
    newHouse.interior.add(char.root);
    charInstanceRef.current = char;

    // 5. Re-attach room labels to newHouse.interior
    labelsRef.current.forEach((label) => {
      if (label.parent) label.parent.remove(label);
      newHouse.interior.add(label);
    });

    // 5. Update label texts & styles
    HOME_ROOMS.forEach((room, idx) => {
      const label = labelsRef.current[idx];
      if (label && label.element) {
        const isUnlocked = lifeSimService.isRoomUnlocked(room.id);
        label.element.className =
          `px-2 py-0.5 rounded-md ${isUnlocked ? 'bg-white/90 text-slate-800' : 'bg-slate-900/90 text-amber-200 border border-amber-500/30'} text-[10px] font-semibold shadow-md ring-1 ring-black/10 whitespace-nowrap leading-tight text-center`;
        label.element.innerHTML = isUnlocked
          ? `${room.name}<br/><span style="font-weight:500;color:#64748b">${roomArea(room.id).toFixed(1)} m²</span>`
          : `🔒 ${room.name}<br/><span style="font-weight:500;color:#f59e0b">Unbuilt Wing</span>`;
      }
    });

    // 6. Sync roof and cutaway wall visibility
    newHouse.roof.visible = showRoofRef.current;
    const cut = wallsModeRef.current === 'cut' && !showRoofRef.current;
    newHouse.frontWalls.visible = !cut;
    newHouse.wallStubs.visible = cut;

    // 7. Sync lights with current sunTime
    const st = sunTimeRef.current;
    const night = st <= 6 || st >= 20 ? 1 : st < 7.5 ? (7.5 - st) / 1.5 : st > 18.5 ? (st - 18.5) / 1.5 : 0;
    const isNight = night > 0.05;
    newHouse.roomLights.forEach((l) => {
      l.intensity = isNight ? 1.0 + night * 7.5 : 0;
      l.visible = isNight;
    });
    newHouse.exteriorLights.forEach((l) => {
      l.intensity = night * 14;
      l.visible = isNight;
    });

    if (rendererRef.current) {
      rendererRef.current.shadowMap.needsUpdate = true;
    }
  }, [furnitureRotations]);

  // Smooth camera transitions (adapts to current house tier)
  const flyTo = useCallback((mode: CameraMode, room: HomeRoomId) => {
    const preset = cameraPreset(mode, room, housingTierRef.current);
    const tw = tweenRef.current;
    tw.pos.copy(preset.pos);
    tw.target.copy(preset.target);
    tw.active = true;
  }, []);

  // Watch for house tier changes (renovation upgrades or starter life reset)
  useEffect(() => {
    if (previousTierRef.current !== housingProperty.id) {
      previousTierRef.current = housingProperty.id;
      housingTierRef.current = housingProperty.id;
      rebuildHouse(housingProperty.id);

      // If currently selected room is not unlocked in the new tier, revert to study
      if (!lifeSimService.isRoomUnlocked(selectedRoomIdRef.current)) {
        setSelectedRoomId('study');
        selectedRoomIdRef.current = 'study';
      }
      setSelectedFurniture(null);
      flyTo(cameraMode, lifeSimService.isRoomUnlocked(selectedRoomIdRef.current) ? selectedRoomIdRef.current : 'study');
    }
  }, [housingProperty.id, rebuildHouse, flyTo, cameraMode]);

  // In room-focus mode, selecting another room (click or pill) re-frames the camera
  useEffect(() => {
    if (cameraMode === 'room_focus') flyTo('room_focus', selectedRoomId);
  }, [cameraMode, selectedRoomId, flyTo]);

  // Roof / wall cutaway / labels visibility
  useEffect(() => {
    const house = houseRef.current;
    if (!house) return;
    house.roof.visible = showRoof;
    const cut = wallsMode === 'cut' && !showRoof;
    house.frontWalls.visible = !cut;
    house.wallStubs.visible = cut;
    labelsRef.current.forEach((l) => {
      l.visible = showLabels && !showRoof && cameraMode !== 'walk';
    });
    if (rendererRef.current) {
      rendererRef.current.shadowMap.needsUpdate = true;
    }
  }, [showRoof, wallsMode, showLabels, cameraMode]);

  // Selection + hover highlight
  useEffect(() => {
    const house = houseRef.current;
    if (!house) return;
    house.pickers.forEach((mesh, id) => {
      const m = mesh.material as THREE.MeshBasicMaterial;
      if (id === selectedRoomId) {
        m.color.setHex(0xf59e0b);
        m.opacity = 0.12;
      } else if (id === hoveredRoom) {
        m.color.setHex(0xffffff);
        m.opacity = 0.16;
      } else {
        m.opacity = 0;
      }
    });
    house.outlines.forEach((o, id) => {
      o.visible = id === selectedRoomId;
    });
  }, [selectedRoomId, hoveredRoom]);

  // Sun path, sky and evening interior lighting
  useEffect(() => {
    const sun = sunLightRef.current;
    const hemi = hemiLightRef.current;
    const scene = sceneRef.current;
    const house = houseRef.current;
    const lib = libRef.current;
    if (!sun || !hemi || !scene || !house || !lib) return;

    const night = sunTime <= 6 || sunTime >= 20 ? 1 : sunTime < 7.5 ? (7.5 - sunTime) / 1.5 : sunTime > 18.5 ? (sunTime - 18.5) / 1.5 : 0;
    const t = THREE.MathUtils.clamp((sunTime - 6) / 14, 0, 1);
    const a = t * Math.PI;
    sun.position.set(Math.cos(a) * 32, Math.max(3, Math.sin(a) * 34), 18);
    const golden = sunTime < 9 || sunTime > 17;
    sun.color.setHex(night > 0.5 ? 0x9db8ff : golden ? 0xffc48a : 0xfff4e5);
    sun.intensity = 0.25 + 2.4 * (1 - night);
    hemi.intensity = 0.25 + 0.9 * (1 - night);
    scene.environmentIntensity = 0.12 + 0.33 * (1 - night);
    scene.background = night > 0.5 && skyRef.current ? skyRef.current.night : skyRef.current?.day ?? null;
    (scene.fog as THREE.Fog).color.setHex(night > 0.5 ? 0x1d2740 : 0xe8f1f7);
    lib.setNight(night);
    const isNight = night > 0.05;
    house.roomLights.forEach((l) => {
      l.intensity = isNight ? 1.0 + night * 7.5 : 0;
      l.visible = isNight;
    });
    house.exteriorLights.forEach((l) => {
      l.intensity = night * 14;
      l.visible = isNight;
    });
    if (rendererRef.current) {
      rendererRef.current.shadowMap.needsUpdate = true;
    }
  }, [sunTime]);

  // ---------------------------------------------------------------------
  // UI actions
  // ---------------------------------------------------------------------
  const setMode = (mode: CameraMode) => {
    modeRef.current = mode;
    setCameraMode(mode);
    if (mode === 'walk') {
      const c = roomCenter(selectedRoomId);
      if (cameraRef.current) {
        cameraRef.current.position.set(c.x, 1.82, c.z + 1.2);
        walkAnglesRef.current = { yaw: Math.PI, pitch: 0 };
      }
      setShowRoof(false);
      setWallsMode('cut');
      setShowLabels(false);
    } else {
      setShowLabels(true);
      flyTo(mode, selectedRoomId);
      setShowRoof(mode === 'exterior');
      setWallsMode(mode === 'exterior' ? 'full' : 'cut');
    }
    soundEngine.playTapPop();
  };

  useEffect(() => {
    setModeRef.current = setMode;
  });

  const handleRotateSelectedFurniture = () => {
    if (!selectedFurniture) return;
    const cur = furnitureRotations[selectedFurniture.id] || 0;
    const next = (cur + Math.PI / 2) % (Math.PI * 2);
    const updated = { ...furnitureRotations, [selectedFurniture.id]: next };
    setFurnitureRotations(updated);
    try {
      localStorage.setItem(ROTATION_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    soundEngine.playTapPop();
    showToast(`Turned the ${selectedFurniture.label.toLowerCase()} a quarter turn`);
  };

  const handleDpadPress = (code: string, active: boolean) => {
    walkKeysRef.current[code] = active;
  };

  const handleExport = () => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;
    if (composerRef.current) composerRef.current.render();
    else renderer.render(scene, camera);
    const link = document.createElement('a');
    link.download = `studify-home-${cameraMode}.png`;
    link.href = renderer.domElement.toDataURL('image/png');
    link.click();
    showToast('Render exported as PNG');
  };

  const currentRoom = useMemo(() => lifeSimService.getRoom(selectedRoomId), [selectedRoomId]);
  const effectiveSlotFilter =
    selectedSlotFilter !== 'all' && !currentRoom.slots.includes(selectedSlotFilter) ? 'all' : selectedSlotFilter;
  const hoveredName = hoveredRoom ? ROOM_LABELS[hoveredRoom] : null;
  const roomUnlocked = lifeSimService.isRoomUnlocked(selectedRoomId);
  const rentDue = housingProperty.rentPerDay > 0 && !dailyLedger.rentPaidToday;
  const isWalking = cameraMode === 'walk';

  const handleStudy = () => {
    if (!primaryDeck) {
      onOpenStarterCatalog?.();
      return;
    }
    onStartSession?.(
      dueCards.length > 0
        ? { ...primaryDeck, currentPhase: 'retrieval', casualFlashcardMode: true }
        : { ...primaryDeck, currentPhase: 'priming', casualFlashcardMode: false },
    );
  };

  const cycleSound = () => {
    const next = SOUND_CYCLE[(SOUND_CYCLE.indexOf(currentSound) + 1) % SOUND_CYCLE.length] ?? 'off';
    if (next === 'off') soundEngine.stop();
    else soundEngine.play(next);
    setCurrentSound(next);
  };

  const placeOrBuy = (item: (typeof FURNITURE_CATALOG)[number]) => {
    const isEquipped = equippedItems[item.category]?.id === item.id;
    if (isEquipped) return;
    if (ownedIds.includes(item.id)) {
      lifeSimService.equipFurniture(item.id, selectedRoomId);
      setEquippedItems(lifeSimService.getEquippedFurniture(selectedRoomId));
      setFurnitureVersion((v) => v + 1);
      showToast(`Placed the ${item.name}`);
      return;
    }
    const result = lifeSimService.buyFurniture(item.id, selectedRoomId);
    if (!result.success) {
      showToast(result.error || 'Could not buy that piece');
      return;
    }
    try {
      confetti({ particleCount: 30, spread: 50 });
    } catch {
      /* optional */
    }
    setEquippedItems(lifeSimService.getEquippedFurniture(selectedRoomId));
    setFurnitureVersion((v) => v + 1);
    showToast(`Bought and placed the ${item.name}`);
  };

  const selectionBar = selectedFurniture && !isWalking && (
    <div className="flex items-center gap-1">
      <span className="min-w-0 flex-1 pl-1">
        <span className="block truncate text-[13px] font-medium text-ink">{selectedFurniture.label}</span>
        <span className="block truncate text-xs text-ink-subtle">{selectedFurniture.brandStyle}</span>
      </span>
      <Button size="sm" variant="ghost" icon={RotateCw} onClick={handleRotateSelectedFurniture}>
        Rotate
      </Button>
      <Button
        size="sm"
        variant="ghost"
        icon={Repeat}
        onClick={() => {
          setSelectedSlotFilter(selectedFurniture.slotType);
          setSidebarTab('furniture');
          setIsSidebarOpen(true);
        }}
      >
        Swap
      </Button>
      <IconButton icon={X} label="Deselect" onClick={() => setSelectedFurniture(null)} className="h-8 w-8" />
    </div>
  );

  return (
    <div className={cn('relative h-full w-full flex-1 select-none overflow-hidden animate-fadeIn', className)}>
      {/* ===================== 3D VIEWPORT ===================== */}
      <div className="absolute inset-0 overflow-hidden bg-[#dfeaf3]">
        <div ref={containerRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
      </div>

      {toastMessage && (
        <div
          role="status"
          className={cn(PANEL, 'absolute left-1/2 top-[112px] z-50 max-w-[calc(100%-24px)] -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13px] text-ink animate-rise sm:top-[64px]')}
        >
          {toastMessage}
        </div>
      )}

      {/* Hovered room (mouse only) */}
      {hoveredName && hoveredRoom !== selectedRoomId && !selectedFurniture && !isWalking && (
        <div className={cn(PANEL, 'pointer-events-none absolute bottom-[84px] left-1/2 z-20 hidden -translate-x-1/2 rounded-lg px-3 py-1.5 text-xs text-ink sm:block')}>
          {hoveredName} · click to select
        </div>
      )}

      {/* ===================== TOP BAR ===================== */}
      <div
        className={cn(
          'pointer-events-none absolute inset-x-3 top-3 z-30 flex flex-wrap items-start justify-between gap-2 transition-opacity',
          isZenMode && 'opacity-0',
        )}
      >
        <div className={cn('flex items-center gap-2', !isZenMode && 'pointer-events-auto')}>
          {onToggleMobileSidebar && (
            <button
              type="button"
              onClick={onToggleMobileSidebar}
              aria-label="Open menu"
              className={cn(PANEL, 'flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted hover:text-ink md:hidden cursor-pointer')}
            >
              <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          )}
          <div role="radiogroup" aria-label="View" className={cn(PANEL, 'flex rounded-xl p-1')}>
            {VIEWS.map(({ mode, label, hint, icon: Icon }) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={cameraMode === mode}
                aria-label={label}
                title={hint}
                onClick={() => setMode(mode)}
                className={cn(
                  'flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors cursor-pointer',
                  cameraMode === mode ? 'bg-ink text-canvas' : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="hidden xl:inline">{label}</span>
              </button>
            ))}
          </div>
          <label className={cn(PANEL, 'hidden h-10 items-center gap-2 rounded-xl px-3 lg:flex')} title="Time of day">
            {sunTime < 7 || sunTime > 19 ? (
              <Moon className="h-4 w-4 text-brand-text" aria-hidden="true" />
            ) : (
              <Sun className="h-4 w-4 text-gold" aria-hidden="true" />
            )}
            <input
              type="range"
              min="6"
              max="22"
              step="0.5"
              value={sunTime}
              onChange={(e) => setSunTime(parseFloat(e.target.value))}
              className="w-24 cursor-pointer accent-[var(--brand)]"
              aria-label="Time of day"
            />
            <span className="w-10 text-xs tabular-nums text-ink-muted">
              {String(Math.floor(sunTime)).padStart(2, '0')}:{sunTime % 1 ? '30' : '00'}
            </span>
          </label>
        </div>

        <div className={cn('flex items-center gap-2', !isZenMode && 'pointer-events-auto')}>
          <button
            type="button"
            onClick={() => setIsMoneyOpen(true)}
            title="Today's money"
            className={cn(PANEL, 'flex h-10 items-center gap-2 rounded-xl px-3 text-[13px] transition-colors hover:bg-surface-hover cursor-pointer')}
          >
            <Tokens amount={walletCoins} className="text-ink" />
            <span className="h-4 w-px bg-line-strong" aria-hidden="true" />
            <span className="tabular-nums text-ink-muted">
              <span className="hidden sm:inline">Pay </span>
              <span className="sr-only sm:hidden">Pay </span>
              {formatMultiplier(activeMultiplier)}
            </span>
          </button>
          {rentDue && (
            <Button
              variant="gold"
              onClick={handlePayRentDirect}
              title={`Turns on your ${formatBonus(housingProperty.wageMultiplier - 1)} home bonus for today`}
              className="h-10"
            >
              Pay rent <Tokens amount={housingProperty.rentPerDay} />
            </Button>
          )}
          <button
            type="button"
            onClick={() => setIsHomeOpen(true)}
            title="Your home and upgrades"
            className={cn(PANEL, 'flex h-10 items-center gap-2 rounded-xl px-3 text-[13px] font-medium text-ink transition-colors hover:bg-surface-hover cursor-pointer')}
          >
            <span aria-hidden="true">{housingProperty.icon}</span>
            <span className="hidden sm:inline">Level {housingProperty.level}</span>
            <span className="sr-only sm:hidden">Your home, level {housingProperty.level}</span>
          </button>
        </div>
      </div>

      {/* ===================== VIEW TOOLS ===================== */}
      <div
        className={cn(
          'absolute right-3 top-[112px] z-30 flex flex-col items-center gap-2 transition-opacity sm:top-[64px]',
          isZenMode ? 'pointer-events-none opacity-0' : 'pointer-events-auto',
        )}
      >
        <button
          type="button"
          onClick={() => setMode('dollhouse')}
          aria-label="Reset the view"
          title="Reset the view"
          className={cn(PANEL, 'flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-95 cursor-pointer')}
        >
          <div ref={compassRef} className="relative flex h-8 w-8 items-center justify-center transition-none">
            <Compass className="h-6 w-6 text-ink-muted" aria-hidden="true" />
            <span className="absolute -top-1 text-[9px] font-bold text-danger">N</span>
          </div>
        </button>
        <div className={cn(PANEL, 'flex flex-col gap-0.5 rounded-xl p-1')}>
          <IconButton icon={Layers} label="Roof" active={showRoof} aria-pressed={showRoof} onClick={() => setShowRoof((v) => !v)} />
          <IconButton
            icon={PanelTop}
            label="Full front walls"
            active={wallsMode === 'full'}
            aria-pressed={wallsMode === 'full'}
            onClick={() => setWallsMode((v) => (v === 'cut' ? 'full' : 'cut'))}
          />
          <IconButton icon={Tag} label="Room names" active={showLabels} aria-pressed={showLabels} onClick={() => setShowLabels((v) => !v)} />
          <IconButton
            icon={currentSound === 'off' ? VolumeX : Volume2}
            label={currentSound === 'off' ? 'Background sound: off' : `Background sound: ${SOUND_LABELS[currentSound] ?? 'on'}`}
            active={currentSound !== 'off'}
            onClick={cycleSound}
          />
          <IconButton icon={Download} label="Save a picture" onClick={handleExport} />
          <IconButton icon={Maximize2} label="Hide the controls" onClick={() => setIsZenMode(true)} />
        </div>
      </div>

      {/* ===================== FURNISH PANEL ===================== */}
      {!isWalking && (
        <aside
          aria-label="Furnish"
          className={cn(
            'absolute left-3 top-[112px] z-20 flex transition-opacity sm:top-[64px]',
            isSidebarOpen ? 'bottom-[132px] w-[calc(100%-80px)] max-w-[340px] lg:bottom-[76px]' : '',
            isZenMode ? 'pointer-events-none opacity-0' : 'pointer-events-auto',
          )}
        >
          {isSidebarOpen ? (
            <div className={cn(PANEL, 'flex h-full w-full flex-col overflow-hidden rounded-2xl')}>
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line py-2 pl-4 pr-2">
                <h2 className="text-[13px] font-semibold text-ink">Furnish</h2>
                <IconButton icon={PanelLeftClose} label="Hide the panel" onClick={() => setIsSidebarOpen(false)} className="h-8 w-8" />
              </div>
              {selectionBar && <div className="shrink-0 border-b border-line bg-surface-hover/60 p-1.5">{selectionBar}</div>}
              <div role="tablist" aria-label="Furnish" className="flex shrink-0 gap-4 border-b border-line px-4 pt-2">
                {PANEL_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={sidebarTab === tab.id}
                    onClick={() => setSidebarTab(tab.id)}
                    className={cn(
                      'border-b-2 pb-2 text-[13px] font-medium transition-colors cursor-pointer',
                      sidebarTab === tab.id ? 'border-ink text-ink' : 'border-transparent text-ink-subtle hover:text-ink',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {sidebarTab === 'furniture' && (
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <div className="flex items-baseline justify-between gap-2 px-1">
                    <p className="truncate text-[13px] font-medium text-ink">{ROOM_LABELS[selectedRoomId]}</p>
                    <Tokens amount={walletCoins} className="shrink-0 text-xs text-ink-muted" iconClassName="h-3 w-3" />
                  </div>

                  {!roomUnlocked ? (
                    <div className="mt-3 rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center">
                      <Lock className="mx-auto h-5 w-5 text-ink-subtle" aria-hidden="true" />
                      <p className="mt-2 text-[13px] font-medium text-ink">Comes with a bigger home</p>
                      <p className="mt-1 text-xs leading-relaxed text-ink-subtle">Upgrade your home to add this room and furnish it.</p>
                      <Button size="sm" className="mt-3" onClick={() => setIsHomeOpen(true)}>
                        See home upgrades
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="mt-0.5 px-1 text-xs text-ink-subtle">Each piece changes the 3D room and adds to its rating.</p>
                      <div role="group" aria-label="Spot" className="-mx-1 mt-2.5 flex gap-1 overflow-x-auto px-1 pb-1 no-scrollbar">
                        {(['all', ...currentRoom.slots] as (DesignSlotType | 'all')[]).map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            aria-pressed={effectiveSlotFilter === slot}
                            onClick={() => setSelectedSlotFilter(slot)}
                            className={cn(
                              'h-7 shrink-0 rounded-lg px-2.5 text-xs font-medium transition-colors cursor-pointer',
                              effectiveSlotFilter === slot ? 'bg-ink text-canvas' : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
                            )}
                          >
                            {slot === 'all' ? 'All' : SLOT_LABELS[slot]}
                          </button>
                        ))}
                      </div>

                      <ul className="mt-2 space-y-1.5">
                        {FURNITURE_CATALOG.filter(
                          (f) => f.roomCompatibility.includes(selectedRoomId) && (effectiveSlotFilter === 'all' || f.category === effectiveSlotFilter),
                        ).map((item) => {
                          const isOwned = ownedIds.includes(item.id);
                          const isEquipped = equippedItems[item.category]?.id === item.id;
                          const short = item.cost - walletCoins;
                          return (
                            <li
                              key={item.id}
                              className={cn(
                                'flex items-center gap-2.5 rounded-xl border p-2',
                                isEquipped ? 'border-brand/40 bg-brand-soft' : 'border-line bg-canvas',
                              )}
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-lg" aria-hidden="true">
                                {item.emoji}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-medium text-ink">{item.name}</span>
                                <span className="block truncate text-xs text-ink-subtle">
                                  {item.brandStyle} · +{item.focusBonus} focus · +{item.comfortBonus} comfort
                                </span>
                              </span>
                              {isEquipped ? (
                                <Badge tone="brand">Placed</Badge>
                              ) : isOwned ? (
                                <Button size="sm" onClick={() => placeOrBuy(item)} aria-label={`Place the ${item.name}`}>
                                  Place
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="gold"
                                  disabled={short > 0}
                                  title={short > 0 ? `You need ${short} more tokens` : undefined}
                                  onClick={() => placeOrBuy(item)}
                                  aria-label={`Buy the ${item.name} for ${item.cost} tokens`}
                                >
                                  <Tokens amount={item.cost} />
                                </Button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </div>
              )}

              {sidebarTab === 'finishes' && (
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                  {[
                    { title: 'Walls', list: WALL_FINISHES, value: wallTexture, set: (id: string) => setWallTexture(id as WallFinishId) },
                    { title: 'Floors', list: FLOOR_FINISHES, value: floorTexture, set: (id: string) => setFloorTexture(id as FloorFinishId) },
                  ].map((group) => (
                    <div key={group.title} role="radiogroup" aria-label={group.title}>
                      <p className="text-xs font-medium text-ink-muted">{group.title}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {group.list.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            role="radio"
                            aria-checked={group.value === m.id}
                            onClick={() => {
                              group.set(m.id);
                              soundEngine.playTapPop();
                            }}
                            className={cn(
                              'flex flex-col items-start gap-1.5 rounded-xl border p-2 text-left transition-colors cursor-pointer',
                              group.value === m.id ? 'border-brand bg-brand-soft' : 'border-line bg-canvas hover:border-line-strong',
                            )}
                          >
                            <span className="h-8 w-full rounded-lg border border-black/10" style={{ backgroundColor: m.color }} />
                            <span className="text-xs font-medium leading-tight text-ink">{m.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="text-xs leading-relaxed text-ink-subtle">The kitchen keeps its tile floor. Finishes are free, and saved on this device.</p>
                </div>
              )}

              {sidebarTab === 'outdoors' && (
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                  {housingProperty.id !== 'penthouse' && (
                    <p className="rounded-xl bg-surface-hover px-3.5 py-3 text-xs leading-relaxed text-ink-muted">
                      The grounds below come with the {HOUSING_CATALOG[HOUSING_CATALOG.length - 1].name}, the level{' '}
                      {HOUSING_CATALOG.length} home.
                    </p>
                  )}
                  <ul className="space-y-1.5">
                    {SITE_FEATURES.map((f) => (
                      <li key={f.title} className="flex items-center gap-3 rounded-xl border border-line bg-canvas p-2.5">
                        <span className="text-lg" aria-hidden="true">
                          {f.icon}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-ink">{f.title}</span>
                          <span className="block text-xs text-ink-subtle">{f.desc}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => (housingProperty.id === 'penthouse' ? setMode('exterior') : setIsHomeOpen(true))}
                  >
                    {housingProperty.id === 'penthouse' ? 'View outside' : 'See home upgrades'}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className={cn(PANEL, 'flex h-10 items-center gap-2 rounded-xl px-3 text-[13px] font-medium text-ink transition-colors hover:bg-surface-hover cursor-pointer')}
              >
                <Armchair className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                Furnish
              </button>
              {selectionBar && <div className={cn(PANEL, 'w-[300px] max-w-[calc(100vw-96px)] rounded-2xl p-1.5 animate-rise')}>{selectionBar}</div>}
            </div>
          )}
        </aside>
      )}

      {/* ===================== WALK MODE ===================== */}
      {isWalking && (
        <>
          <div className={cn(PANEL, 'pointer-events-auto absolute left-1/2 top-[112px] z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl py-1.5 pl-4 pr-1.5 sm:top-[64px]')}>
            <span className="flex items-center gap-2 text-[13px] text-ink">
              <Footprints className="h-4 w-4 text-success" aria-hidden="true" />
              <span>
                Walking · <span className="font-medium">{walkCurrentRoom}</span>
              </span>
            </span>
            <Button size="sm" onClick={() => setMode('dollhouse')}>
              Stop <Kbd className="ml-0.5">Esc</Kbd>
            </Button>
          </div>
          <p className={cn(PANEL, 'pointer-events-none absolute bottom-[84px] left-3 z-20 hidden items-center gap-2 rounded-xl px-3 py-2 text-xs text-ink-muted sm:flex')}>
            <Kbd>W</Kbd>
            <Kbd>A</Kbd>
            <Kbd>S</Kbd>
            <Kbd>D</Kbd>
            or arrow keys to move · drag to look around
          </p>
          <div className={cn(PANEL, 'absolute bottom-[76px] left-3 z-30 flex touch-none flex-col items-center gap-1.5 rounded-2xl p-2 sm:hidden')}>
            <DpadButton icon={ChevronUp} label="Forward" code="KeyW" onPress={handleDpadPress} />
            <div className="flex items-center gap-1.5">
              <DpadButton icon={ChevronLeft} label="Left" code="KeyA" onPress={handleDpadPress} />
              <DpadButton icon={ChevronDown} label="Back" code="KeyS" onPress={handleDpadPress} />
              <DpadButton icon={ChevronRight} label="Right" code="KeyD" onPress={handleDpadPress} />
            </div>
          </div>
        </>
      )}

      {/* ===================== ROOMS ===================== */}
      <nav
        aria-label="Rooms"
        className={cn(
          PANEL,
          'absolute bottom-[72px] right-3 z-30 flex gap-0.5 rounded-xl p-1 transition-opacity lg:bottom-3',
          isZenMode ? 'pointer-events-none opacity-0' : 'pointer-events-auto',
        )}
      >
        {HOME_ROOMS.map((r) => {
          const isUnlocked = lifeSimService.isRoomUnlocked(r.id);
          const isSelected = selectedRoomId === r.id;
          return (
            <button
              key={r.id}
              type="button"
              aria-pressed={isSelected}
              aria-label={isUnlocked ? ROOM_LABELS[r.id] : `${ROOM_LABELS[r.id]}, comes with a bigger home`}
              title={isUnlocked ? ROOM_LABELS[r.id] : `${ROOM_LABELS[r.id]} comes with a bigger home`}
              onClick={() => {
                if (!isUnlocked) {
                  setIsHomeOpen(true);
                  return;
                }
                setSelectedRoomId(r.id);
                setCameraMode('room_focus');
                setShowRoof(false);
                setWallsMode('cut');
                soundEngine.playTapPop();
              }}
              className={cn(
                'flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors cursor-pointer',
                isSelected ? 'bg-brand text-brand-ink' : isUnlocked ? 'text-ink-muted hover:bg-surface-hover hover:text-ink' : 'text-ink-subtle hover:bg-surface-hover',
              )}
            >
              {isUnlocked ? <span aria-hidden="true">{r.icon}</span> : <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
              <span className="hidden 2xl:inline">{ROOM_LABELS[r.id]}</span>
            </button>
          );
        })}
      </nav>

      {/* ===================== DOCK ===================== */}
      <div
        className={cn(
          PANEL,
          'absolute bottom-3 left-3 right-3 z-30 flex items-center justify-between gap-3 rounded-2xl p-1.5 transition-opacity sm:right-auto',
          isZenMode ? 'pointer-events-none opacity-0' : 'pointer-events-auto',
        )}
      >
        <button
          type="button"
          onClick={() => setIsEvaluationOpen(true)}
          className="flex min-w-0 items-center gap-2.5 rounded-xl px-2 py-1 text-left transition-colors hover:bg-surface-hover cursor-pointer"
          aria-label={`${ROOM_LABELS[selectedRoomId]}, rated ${evaluation.starRating.toFixed(2)} of 5. See how the rating adds up`}
        >
          <span className="text-xl" aria-hidden="true">
            {currentRoom.icon}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-ink">{ROOM_LABELS[selectedRoomId]}</span>
            <span className="flex items-center gap-1 text-xs tabular-nums text-ink-subtle">
              <Star className="h-3 w-3 fill-gold text-gold" aria-hidden="true" />
              {evaluation.starRating.toFixed(2)}
              <span className="hidden whitespace-nowrap sm:inline"> · {roomArea(selectedRoomId).toFixed(0)} m²</span>
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" icon={Utensils} onClick={() => setIsCafeOpen(true)}>
            Café
          </Button>
          <Button size="sm" variant="primary" icon={Play} onClick={handleStudy}>
            {!primaryDeck ? 'Find a deck' : dueCards.length > 0 ? `Study · ${dueCards.length} due` : 'Study'}
          </Button>
        </div>
      </div>

      {isZenMode && (
        <Button className={cn(PANEL, 'absolute right-3 top-3 z-40')} icon={Minimize2} onClick={() => setIsZenMode(false)}>
          Show controls
        </Button>
      )}

      {/* ===================== DIALOGS ===================== */}
      {isCafeOpen && <CafeDialog onClose={() => setIsCafeOpen(false)} />}
      {isMoneyOpen && (
        <MoneyDialog
          onClose={() => setIsMoneyOpen(false)}
          onOpenCafe={() => {
            setIsMoneyOpen(false);
            setIsCafeOpen(true);
          }}
        />
      )}
      {isHomeOpen && (
        <HomeDialog
          reviews={totalCardsReviewed}
          onClose={() => setIsHomeOpen(false)}
          onUpgraded={(home) => {
            try {
              confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
            } catch {
              /* optional */
            }
            setHousingProperty(lifeSimService.getHousing());
            setFurnitureVersion((v) => v + 1);
            setIsHomeOpen(false);
            showToast(`Welcome to the ${home.name}. New rooms are ready to furnish.`);
          }}
        />
      )}
      {isEvaluationOpen && (
        <RoomRatingDialog roomName={ROOM_LABELS[selectedRoomId]} evaluation={evaluation} onClose={() => setIsEvaluationOpen(false)} />
      )}
    </div>
  );
};

/** A walk-mode arrow for touch screens; holds the key down while pressed. */
const DpadButton: React.FC<{
  icon: LucideIcon;
  label: string;
  code: string;
  onPress: (code: string, active: boolean) => void;
}> = ({ icon: Icon, label, code, onPress }) => (
  <button
    type="button"
    aria-label={label}
    onTouchStart={() => onPress(code, true)}
    onTouchEnd={() => onPress(code, false)}
    onMouseDown={() => onPress(code, true)}
    onMouseUp={() => onPress(code, false)}
    onMouseLeave={() => onPress(code, false)}
    className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-hover text-ink active:bg-brand-soft cursor-pointer"
  >
    <Icon className="h-5 w-5" aria-hidden="true" />
  </button>
);

export default HomeDesign3D;
