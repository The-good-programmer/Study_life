import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import confetti from 'canvas-confetti';
import {
  Home,
  ShoppingBag,
  Star,
  Coffee,
  Wind,
  Play,
  X,
  Volume2,
  VolumeX,
  Award,
  Maximize2,
  Minimize2,
  Coins,
  Compass,
  Eye,
  Layers,
  Sun,
  Moon,
  Camera,
  Grid,
  TrendingUp,
  Sliders,
  Tag,
  Download,
  PanelTop,
  Footprints,
  RotateCw,
  Sparkles,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  RotateCcw,
  Menu,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { lifeSimService, HOME_ROOMS, FURNITURE_CATALOG, HOUSING_CATALOG, LIFESTYLE_TIERS } from '../../services/lifeSimService';
import { type HomeRoomId, type DesignSlotType, type RoomDesignEvaluation, type HousingTier } from '../../types/lifeSim';
import { soundEngine, type SoundType } from '../../services/soundEngine';
import { StorageService } from '../../services/storageService';
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
import { CharacterCustomizerModal } from '../character/CharacterCustomizerModal';

export interface HomeDesign3DProps {
  onStartSession?: (session?: any) => void;
  onOpenDeckStation?: (session?: any) => void;
  onOpenStarterCatalog?: () => void;
  onOpenDashboard?: () => void;
  onOpenCafeteria?: () => void;
  onOpenHousing?: () => void;
  onToggleMobileSidebar?: () => void;
  onNavigateHome?: () => void;
  className?: string;
}

type CameraMode = 'dollhouse' | 'exterior' | 'blueprint' | 'room_focus' | 'walk';
type WallsMode = 'cut' | 'full';

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
  onOpenDeckStation: _onOpenDeckStation,
  onOpenStarterCatalog,
  onOpenDashboard: _onOpenDashboard,
  onOpenCafeteria,
  onOpenHousing,
  onToggleMobileSidebar,
  onNavigateHome,
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
  const [sidebarTab, setSidebarTab] = useState<'furniture' | 'materials' | 'landscape'>('furniture');

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
  const selectionRingRef = useRef<THREE.Mesh | null>(null);
  const walkKeysRef = useRef<Record<string, boolean>>({});
  const walkAnglesRef = useRef<{ yaw: number; pitch: number }>({ yaw: Math.PI, pitch: 0 });
  const activeRoomNameRef = useRef<string>('Study Sanctuary');
  const charInstanceRef = useRef<CharacterModelInstance | null>(null);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  // Synchronize 3D character customizations live
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
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [housingProperty, setHousingProperty] = useState(() => lifeSimService.getHousing());

  const currentRole = lifeSimService.getAcademicRole();
  const activeMultiplier = lifeSimService.getActiveMultiplier('coin_multiplier');

  const totalCardsReviewed = useMemo(() => {
    try {
      const cards = StorageService.getAllCards();
      const count = cards.reduce((acc, c) => acc + (c.reps || 0), 0);
      return count > 0 ? count : (StorageService.getStats().conceptsMastered || 0);
    } catch {
      return 0;
    }
  }, [furnitureVersion]);

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

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
    setEquippedItems(lifeSimService.getEquippedFurniture(selectedRoomId));
    setEvaluation(lifeSimService.calculateRoomDesignScore(selectedRoomId));
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
    const ledger = lifeSimService.getDailyLedger();
    const housing = lifeSimService.getHousing();
    if (ledger.rentPaidToday) {
      showToast(`Rent is already paid for today (🪙${housing.rentPerDay})`);
      return;
    }
    const res = lifeSimService.payDailyRent();
    if (res.success) {
      showToast(`Rent paid for today! (🪙${housing.rentPerDay})`);
      setDailyLedger(lifeSimService.getDailyLedger());
      setWalletCoins(lifeSimService.getWalletBalance());
    } else {
      showToast(res.error || 'Could not pay rent');
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
    renderer.shadowMap.type = THREE.PCFShadowMap;
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
    sun.shadow.mapSize.set(1536, 1536);
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
    const char = buildCharacter3D(characterService.getCharacter(), { showPedestal: false, showShadow: true });
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
          showToast(`🔒 ${lifeSimService.getRoom(id).name} is not yet built! Study and renovate your home to construct this wing.`);
          setIsUpgradeModalOpen(true);
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
        setMode('dollhouse');
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

      renderer.render(scene, camera);
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
      renderer.dispose();
      container.replaceChildren();
      houseRef.current = null;
      libRef.current = null;
      labelsRef.current = [];
    };
  }, []);

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
    const char = buildCharacter3D(characterService.getCharacter(), { showPedestal: false, showShadow: true });
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
    showToast(`Rotated ${selectedFurniture.label} 90°`);
  };

  const handleDpadPress = (code: string, active: boolean) => {
    walkKeysRef.current[code] = active;
  };

  const handleExport = () => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;
    renderer.render(scene, camera);
    const link = document.createElement('a');
    link.download = `studify-home-${cameraMode}.png`;
    link.href = renderer.domElement.toDataURL('image/png');
    link.click();
    showToast('Render exported as PNG');
  };

  const handleTriggerAction = (type: string) => {
    const res = lifeSimService.performInteractiveAction(type);
    if (res.success) {
      if (type === 'brew_coffee') {
        try {
          confetti({ particleCount: 35, spread: 60, origin: { y: 0.6 }, colors: ['#f59e0b', '#d97706', '#fbbf24'] });
        } catch {
          /* confetti optional */
        }
      }
      showToast(res.message);
    }
  };

  const currentRoom = useMemo(() => lifeSimService.getRoom(selectedRoomId), [selectedRoomId]);
  const effectiveSlotFilter =
    selectedSlotFilter !== 'all' && !currentRoom.slots.includes(selectedSlotFilter) ? 'all' : selectedSlotFilter;
  const hoveredName = hoveredRoom ? HOME_ROOMS.find((r) => r.id === hoveredRoom)?.name : null;
  const totalInteriorArea = (['study', 'bedroom', 'living', 'kitchen'] as HomeRoomId[]).reduce((s, id) => s + roomArea(id), 0);

  const toolBtn = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
      active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
    }`;

  return (
    <div className={`relative w-full h-full flex-1 overflow-hidden select-none animate-fadeIn ${className}`}>
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900/95 border border-white/10 text-slate-100 text-xs sm:text-sm font-medium shadow-2xl backdrop-blur-xl">
          {toastMessage}
        </div>
      )}

      {/* ===================== TOP FLOATING HUD ===================== */}
      <div
        className={`absolute top-3 left-3 right-3 z-30 flex flex-wrap items-center justify-between gap-2 p-2 rounded-2xl bg-slate-950/80 hover:bg-slate-950/95 border border-white/[0.1] backdrop-blur-xl shadow-2xl transition-all duration-300 pointer-events-auto ${
          isZenMode ? 'opacity-0 pointer-events-none hover:opacity-100 hover:pointer-events-auto' : ''
        }`}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Mobile Navigation Drawer Trigger */}
          {onToggleMobileSidebar && (
            <button
              type="button"
              onClick={onToggleMobileSidebar}
              className="md:hidden p-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Open Navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          {/* Home Button */}
          {onNavigateHome && (
            <button
              type="button"
              onClick={onNavigateHome}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
              title="Return to Today's Mission"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Home</span>
            </button>
          )}

          {/* Camera Modes */}
          <div className="flex items-center gap-0.5 bg-slate-900/90 p-0.5 rounded-xl border border-white/[0.06]">
            <button type="button" onClick={() => setMode('dollhouse')} className={toolBtn(cameraMode === 'dollhouse')} title="3D cutaway of all rooms">
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dollhouse</span>
            </button>
            <button type="button" onClick={() => setMode('exterior')} className={toolBtn(cameraMode === 'exterior')} title="Street-level exterior">
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exterior</span>
            </button>
            <button type="button" onClick={() => setMode('blueprint')} className={toolBtn(cameraMode === 'blueprint')} title="Top-down architectural view">
              <Grid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Top-Down</span>
            </button>
            <button type="button" onClick={() => setMode('room_focus')} className={toolBtn(cameraMode === 'room_focus')} title="Frame the selected room">
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Room</span>
            </button>
            <button type="button" onClick={() => setMode('walk')} className={toolBtn(cameraMode === 'walk')} title="First-person walk tour (WASD / touch)">
              <Footprints className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Walk</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-0.5 bg-slate-900/90 p-0.5 rounded-xl border border-white/[0.06]">
            <button type="button" onClick={() => setShowRoof((v) => !v)} className={toolBtn(showRoof)} title="Show / hide roof">
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Roof</span>
            </button>
            <button
              type="button"
              onClick={() => setWallsMode((v) => (v === 'cut' ? 'full' : 'cut'))}
              className={toolBtn(wallsMode === 'full')}
              title="Full-height or cutaway front walls"
            >
              <PanelTop className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{wallsMode === 'cut' ? 'Walls cut' : 'Walls full'}</span>
            </button>
            <button type="button" onClick={() => setShowLabels((v) => !v)} className={toolBtn(showLabels)} title="Room names & areas">
              <Tag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Labels</span>
            </button>
          </div>

          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-white/[0.06] text-xs">
            {sunTime < 7 || sunTime > 19 ? <Moon className="w-3.5 h-3.5 text-sky-300" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
            <input
              type="range"
              min="6"
              max="22"
              step="0.5"
              value={sunTime}
              onChange={(e) => setSunTime(parseFloat(e.target.value))}
              className="w-16 sm:w-20 accent-amber-400 cursor-pointer"
              aria-label="Time of day"
            />
            <span className="font-mono text-slate-300 text-[11px] w-9">
              {String(Math.floor(sunTime)).padStart(2, '0')}:{sunTime % 1 ? '30' : '00'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              const next: SoundType = currentSound === 'off' ? 'rain' : currentSound === 'rain' ? 'ambient-drone' : currentSound === 'ambient-drone' ? 'binaural-40hz' : 'off';
              soundEngine.play(next);
              setCurrentSound(next);
            }}
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/[0.06] text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1 text-xs"
            title={`Ambient soundscape: ${currentSound}`}
          >
            {currentSound !== 'off' ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 3D Character Customizer Button */}
          <button
            type="button"
            onClick={() => setIsCustomizerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs font-bold transition-all cursor-pointer shadow-md shadow-indigo-600/20 active:scale-95"
            title="Customize your 3D Student Character"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-300" />
            <span className="hidden sm:inline">My 3D Character</span>
          </button>

          {/* Housing Renovation & Tier Badge */}
          <button
            type="button"
            onClick={() => setIsUpgradeModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-400/15 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-400/40 text-amber-200 text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95"
            title="House Level & Renovation Upgrades"
          >
            <span>{housingProperty.icon}</span>
            <span>{housingProperty.name.split(' ')[0]} (Lvl {housingProperty.level})</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          </button>

          {/* Daily Rent Status Pill */}
          <button
            type="button"
            onClick={handlePayRentDirect}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              dailyLedger.rentPaidToday
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/20 border-amber-500/40 text-amber-200 hover:bg-amber-500/30 active:scale-95'
            }`}
            title={dailyLedger.rentPaidToday ? `Rent is paid for today (🪙${housingProperty.rentPerDay})` : `Click to pay daily rent (🪙${housingProperty.rentPerDay})`}
          >
            {dailyLedger.rentPaidToday ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
            <span className="hidden md:inline">{dailyLedger.rentPaidToday ? 'Rent Paid' : `Pay Rent (🪙${housingProperty.rentPerDay})`}</span>
          </button>

          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-white/[0.06] text-amber-300 text-xs font-semibold"
            title={`${currentRole.title} • ${LIFESTYLE_TIERS[lifeSimService.getLifestyleTier()].title}`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{activeMultiplier}x wage</span>
          </div>

          <button
            type="button"
            onClick={() => setIsEvaluationOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/[0.06] text-amber-300 text-xs font-semibold transition-all cursor-pointer"
            title="Design rating"
          >
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{evaluation.starRating.toFixed(2)}</span>
          </button>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-white/[0.06] text-amber-300 font-mono text-xs font-semibold">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>{walletCoins}</span>
          </div>

          <button
            type="button"
            onClick={handleExport}
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/[0.06] text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Export render (PNG)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsZenMode((v) => !v)}
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/[0.06] text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Toggle Zen full view"
          >
            {isZenMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ===================== 3D VIEWPORT (FULL-PAGE CANVAS) ===================== */}
      <div className="absolute inset-0 w-full h-full bg-[#dfeaf3] overflow-hidden">
        <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Compass (rotates with the camera) */}
        <button
          type="button"
          onClick={() => setMode('dollhouse')}
          className="absolute top-16 right-4 z-20 w-11 h-11 rounded-full bg-slate-950/85 hover:bg-slate-900 border border-white/10 backdrop-blur-xl shadow-xl flex items-center justify-center cursor-pointer pointer-events-auto transition-transform active:scale-95"
          title="Reset view (Dollhouse)"
        >
          <div ref={compassRef} className="relative w-8 h-8 flex items-center justify-center transition-none">
            <Compass className="w-6 h-6 text-slate-300" />
            <span className="absolute -top-1 text-[9px] font-bold text-red-500">N</span>
          </div>
        </button>

        {/* Hovered room tip */}
        {hoveredName && hoveredRoom !== selectedRoomId && !selectedFurniture && cameraMode !== 'walk' && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-xl bg-slate-900/90 text-white border border-white/10 text-xs font-semibold shadow-2xl backdrop-blur-xl">
            {hoveredName} — click to select
          </div>
        )}

        {/* Selected Furniture Quick Action Floating Pill */}
        {selectedFurniture && cameraMode !== 'walk' && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-950/90 border border-amber-500/40 backdrop-blur-xl shadow-2xl text-white text-xs animate-fadeIn pointer-events-auto">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <div className="flex flex-col">
                <span className="font-semibold text-white tracking-wide text-xs">{selectedFurniture.label}</span>
                <span className="text-[10px] text-amber-300/80">{selectedFurniture.brandStyle} style</span>
              </div>
            </div>
            <div className="h-6 w-[1px] bg-white/10 mx-1" />
            <button
              type="button"
              onClick={handleRotateSelectedFurniture}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-[11px] transition-all cursor-pointer border border-amber-500/30 active:scale-95"
              title="Rotate 90 degrees"
            >
              <RotateCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Rotate 90°</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedSlotFilter(selectedFurniture.slotType);
                setIsSidebarOpen(true);
                setSidebarTab('furniture');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-slate-200 font-semibold text-[11px] transition-all cursor-pointer border border-white/10 active:scale-95"
              title="Browse catalog styles for this slot"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Style</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedFurniture(null)}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer transition-colors"
              title="Deselect"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Walk Mode HUD Overlay */}
        {cameraMode === 'walk' && (
          <>
            {/* Top Walk Mode Location & Exit Bar */}
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-950/90 border border-emerald-500/40 backdrop-blur-xl shadow-2xl text-white pointer-events-auto">
              <div className="flex items-center gap-2">
                <Footprints className="w-4 h-4 text-emerald-400 animate-bounce" />
                <span className="font-semibold text-xs tracking-wide text-white">
                  Walking: <span className="text-emerald-400">{walkCurrentRoom}</span>
                </span>
              </div>
              <div className="h-4 w-[1px] bg-white/20" />
              <button
                type="button"
                onClick={() => setMode('dollhouse')}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-slate-200 hover:text-white transition-all cursor-pointer"
              >
                Exit Tour (Esc)
              </button>
            </div>

            {/* Desktop Controls Hint (bottom left) */}
            <div className="hidden sm:flex absolute bottom-20 left-4 z-20 items-center gap-2 px-3 py-2 rounded-xl bg-slate-950/80 border border-white/10 backdrop-blur-md text-[11px] text-slate-300">
              <span className="font-mono px-1.5 py-0.5 rounded bg-white/10 text-amber-300 font-bold">W A S D</span>
              <span>or Arrows to move · Drag mouse to look</span>
            </div>

            {/* Mobile Touch Virtual D-Pad (bottom left on small screens) */}
            <div className="sm:hidden absolute bottom-20 left-4 z-30 flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-slate-950/85 border border-white/10 backdrop-blur-xl shadow-2xl touch-none">
              <button
                type="button"
                onTouchStart={() => handleDpadPress('KeyW', true)}
                onTouchEnd={() => handleDpadPress('KeyW', false)}
                onMouseDown={() => handleDpadPress('KeyW', true)}
                onMouseUp={() => handleDpadPress('KeyW', false)}
                className="w-10 h-10 rounded-xl bg-white/10 active:bg-emerald-500/40 flex items-center justify-center text-white cursor-pointer"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onTouchStart={() => handleDpadPress('KeyA', true)}
                  onTouchEnd={() => handleDpadPress('KeyA', false)}
                  onMouseDown={() => handleDpadPress('KeyA', true)}
                  onMouseUp={() => handleDpadPress('KeyA', false)}
                  className="w-10 h-10 rounded-xl bg-white/10 active:bg-emerald-500/40 flex items-center justify-center text-white cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onTouchStart={() => handleDpadPress('KeyS', true)}
                  onTouchEnd={() => handleDpadPress('KeyS', false)}
                  onMouseDown={() => handleDpadPress('KeyS', true)}
                  onMouseUp={() => handleDpadPress('KeyS', false)}
                  className="w-10 h-10 rounded-xl bg-white/10 active:bg-emerald-500/40 flex items-center justify-center text-white cursor-pointer"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onTouchStart={() => handleDpadPress('KeyD', true)}
                  onTouchEnd={() => handleDpadPress('KeyD', false)}
                  onMouseDown={() => handleDpadPress('KeyD', true)}
                  onMouseUp={() => handleDpadPress('KeyD', false)}
                  className="w-10 h-10 rounded-xl bg-white/10 active:bg-emerald-500/40 flex items-center justify-center text-white cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}

        {/* Catalog sidebar */}
        <div className={`absolute top-16 left-3 bottom-16 z-30 transition-all duration-300 flex ${isSidebarOpen ? 'w-80 sm:w-88' : 'w-10'} pointer-events-auto ${isZenMode ? 'opacity-0 pointer-events-none' : ''}`}>
          <div className="w-full h-full rounded-2xl bg-slate-950/90 border border-white/[0.08] backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
            <div className="p-2.5 border-b border-white/[0.06] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsSidebarOpen((v) => !v)}
                className="p-1 rounded-md hover:bg-white/[0.08] text-slate-400 hover:text-white cursor-pointer"
                title="Toggle catalog"
              >
                <Sliders className="w-4 h-4" />
              </button>
              {isSidebarOpen && <span className="text-xs font-semibold text-white tracking-wide">Design Catalog</span>}
            </div>

            {isSidebarOpen && (
              <>
                <div className="flex items-center border-b border-white/[0.06] text-xs">
                  {(['furniture', 'materials', 'landscape'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setSidebarTab(tab)}
                      className={`flex-1 py-2 font-semibold capitalize transition-colors cursor-pointer ${
                        sidebarTab === tab ? 'text-white border-b-2 border-amber-400' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {sidebarTab === 'furniture' && (
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-none">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3 text-amber-400" />
                        {currentRoom.name}
                      </span>
                      <span className="text-[10px] text-amber-300 font-mono">🪙 {walletCoins}</span>
                    </div>

                    {!lifeSimService.isRoomUnlocked(selectedRoomId) ? (
                      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center space-y-2.5 my-3">
                        <span className="text-2xl block">🔒</span>
                        <h4 className="text-xs font-semibold text-white">{currentRoom.name} is Locked</h4>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          Renovate and upgrade your residence to unlock and furnish this room.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsUpgradeModalOpen(true)}
                          className="w-full py-2 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer hover:brightness-110 active:scale-95 flex items-center justify-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>View Renovation Upgrades</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-[10px] text-slate-500 leading-snug">Equipped pieces restyle the 3D room in their design aesthetic.</p>

                        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[10px]">
                          {(['all', ...currentRoom.slots] as (DesignSlotType | 'all')[]).map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setSelectedSlotFilter(slot)}
                              className={`px-2 py-0.5 rounded-md font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                                effectiveSlotFilter === slot ? 'bg-amber-400 text-slate-950' : 'bg-white/[0.05] text-slate-400 hover:text-white'
                              }`}
                            >
                              {slot === 'all' ? 'All' : slot.replace('_', ' ')}
                            </button>
                          ))}
                        </div>

                    {FURNITURE_CATALOG.filter(
                      (f) => f.roomCompatibility.includes(selectedRoomId) && (effectiveSlotFilter === 'all' || f.category === effectiveSlotFilter),
                    ).map((item) => {
                      const isOwned = ownedIds.includes(item.id);
                      const isEquipped = equippedItems[item.category]?.id === item.id;
                      const canAfford = walletCoins >= item.cost;
                      return (
                        <div
                          key={item.id}
                          className={`p-2.5 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                            isEquipped ? 'bg-amber-500/10 border-amber-500/40' : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.06]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-xl w-9 h-9 rounded-md bg-white/[0.05] flex items-center justify-center shrink-0">{item.emoji}</span>
                            <div className="min-w-0">
                              <h5 className="text-xs font-semibold text-white truncate">{item.name}</h5>
                              <div className="text-[10px] text-slate-500 truncate">
                                {item.brandStyle} · +{item.focusBonus} focus · +{item.comfortBonus} comfort
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (isEquipped) {
                                showToast(`${item.name} is already placed in the ${currentRoom.name}`);
                              } else if (isOwned) {
                                lifeSimService.equipFurniture(item.id, selectedRoomId);
                                setEquippedItems(lifeSimService.getEquippedFurniture(selectedRoomId));
                                setFurnitureVersion((v) => v + 1);
                                showToast(`Placed ${item.name} in the ${currentRoom.name}`);
                              } else if (canAfford) {
                                const res = lifeSimService.buyFurniture(item.id, selectedRoomId);
                                if (res.success) {
                                  try {
                                    confetti({ particleCount: 30, spread: 50 });
                                  } catch {
                                    /* optional */
                                  }
                                  setEquippedItems(lifeSimService.getEquippedFurniture(selectedRoomId));
                                  setFurnitureVersion((v) => v + 1);
                                  showToast(`Purchased and placed ${item.name}`);
                                } else {
                                  showToast(res.error || 'Could not purchase this item');
                                }
                              } else {
                                showToast(`Needs 🪙${item.cost} tokens`);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold shrink-0 cursor-pointer ${
                              isEquipped
                                ? 'bg-amber-500/20 text-amber-300'
                                : isOwned
                                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                  : canAfford
                                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                                    : 'bg-white/[0.05] text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {isEquipped ? 'Placed' : isOwned ? 'Place' : `🪙 ${item.cost}`}
                          </button>
                        </div>
                      );
                    })}
                    </>
                    )}
                  </div>
                )}

                {sidebarTab === 'materials' && (
                  <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-none text-xs">
                    {[
                      { title: 'Interior walls', list: WALL_FINISHES, value: wallTexture, set: (id: string) => setWallTexture(id as WallFinishId) },
                      { title: 'Flooring (living areas)', list: FLOOR_FINISHES, value: floorTexture, set: (id: string) => setFloorTexture(id as FloorFinishId) },
                    ].map((group) => (
                      <div key={group.title}>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">{group.title}</span>
                        <div className="grid grid-cols-2 gap-2">
                          {group.list.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                group.set(m.id);
                                soundEngine.playTapPop();
                              }}
                              className={`p-2 rounded-lg border flex flex-col items-start gap-1.5 cursor-pointer transition-all ${
                                group.value === m.id ? 'border-amber-400 bg-amber-500/10 text-white' : 'border-white/[0.08] hover:bg-white/[0.05] text-slate-300'
                              }`}
                            >
                              <span className="w-full h-8 rounded-md border border-white/10" style={{ backgroundColor: m.color }} />
                              <span className="text-[11px] font-medium leading-tight text-left">{m.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <p className="text-[10px] text-slate-500 leading-snug">The kitchen keeps its ceramic tile floor. Finishes are saved on this device.</p>
                  </div>
                )}

                {sidebarTab === 'landscape' && (
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs scrollbar-none">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">Site features</span>
                    {[
                      { icon: '🚗', title: 'Carport & driveway', desc: 'Slatted timber pergola over a paved drive' },
                      { icon: '🏊', title: 'In-ground pool', desc: '6 × 4.5 m basin with stone deck and umbrella' },
                      { icon: '🪴', title: 'Terrace', desc: 'Timber deck with frameless glass balustrade' },
                      { icon: '🌸', title: 'Planting', desc: 'Cherry blossoms, cypress screen, perimeter hedges' },
                    ].map((f) => (
                      <div key={f.title} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center gap-2.5">
                        <span className="text-lg">{f.icon}</span>
                        <div>
                          <div className="font-semibold text-white">{f.title}</div>
                          <p className="text-[10px] text-slate-500">{f.desc}</p>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setMode('exterior')}
                      className="w-full mt-1 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white font-semibold cursor-pointer"
                    >
                      View exterior
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Room selector */}
        <div className={`absolute bottom-3 right-3 z-30 flex items-center gap-1 p-1 rounded-xl bg-slate-950/85 border border-white/[0.1] backdrop-blur-xl shadow-2xl pointer-events-auto transition-all ${isZenMode ? 'opacity-0 pointer-events-none hover:opacity-100 hover:pointer-events-auto' : ''}`}>
          {HOME_ROOMS.map((r) => {
            const isUnlocked = lifeSimService.isRoomUnlocked(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  if (!isUnlocked) {
                    showToast(`🔒 ${r.name} is locked! Upgrade your house to unlock.`);
                    setIsUpgradeModalOpen(true);
                    return;
                  }
                  setSelectedRoomId(r.id);
                  setCameraMode('room_focus');
                  setShowRoof(false);
                  setWallsMode('cut');
                  soundEngine.playTapPop();
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedRoomId === r.id
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                    : isUnlocked
                      ? 'text-slate-300 hover:text-white hover:bg-white/[0.08]'
                      : 'text-slate-500 hover:text-slate-300 bg-white/[0.02]'
                }`}
                title={isUnlocked ? r.name : `${r.name} (Locked - Click to Upgrade)`}
              >
                <span>{isUnlocked ? r.icon : '🔒'}</span>
                <span className="hidden md:inline">{r.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================== ROOM ACTIONS FLOATING DOCK ===================== */}
      <div
        className={`absolute bottom-3 left-3 z-30 p-2 sm:p-2.5 rounded-2xl bg-slate-950/85 hover:bg-slate-950/95 border border-white/[0.1] backdrop-blur-xl shadow-2xl flex flex-wrap items-center gap-2.5 text-xs pointer-events-auto transition-all max-w-[calc(100%-120px)] sm:max-w-none ${
          isZenMode ? 'opacity-0 pointer-events-none hover:opacity-100 hover:pointer-events-auto' : ''
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-lg shrink-0">
            {currentRoom.icon}
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-xs">{currentRoom.name}</span>
              <span className="text-[10px] text-slate-500">
                {roomArea(selectedRoomId).toFixed(1)} m² · house {totalInteriorArea} m²
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="text-sky-300">+{evaluation.totalFocusBonus} focus</span>
              <span>·</span>
              <span className="text-emerald-300">+{evaluation.totalComfortBonus} comfort</span>
              <span>·</span>
              <span className="text-amber-300">{activeMultiplier}x wage</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsUpgradeModalOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 font-semibold cursor-pointer flex items-center gap-1.5"
            title="House Renovation & Progression"
          >
            <span>{housingProperty.icon}</span>
            <span>Renovate (Lvl {housingProperty.level})</span>
          </button>
          {onOpenHousing && (
            <button
              type="button"
              onClick={onOpenHousing}
              className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 font-semibold cursor-pointer flex items-center gap-1.5"
            >
              <span>{housingProperty.icon}</span>
              <span>Ledger</span>
            </button>
          )}
          {onOpenCafeteria && (
            <button
              type="button"
              onClick={onOpenCafeteria}
              className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 font-semibold cursor-pointer"
            >
              🍽️ Café
            </button>
          )}
          <button
            type="button"
            onClick={() => handleTriggerAction('brew_coffee')}
            className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 font-semibold cursor-pointer flex items-center gap-1.5"
            title="Brew espresso (+15% wage boost for 35m)"
          >
            <Coffee className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Espresso</span>
          </button>
          <button
            type="button"
            onClick={() => handleTriggerAction('nap_rest')}
            className="px-2.5 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-200 font-semibold cursor-pointer flex items-center gap-1.5"
            title="Restorative power nap"
          >
            <Wind className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Nap</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (primaryDeck && onStartSession) onStartSession(primaryDeck);
              else if (onOpenStarterCatalog) onOpenStarterCatalog();
            }}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-semibold cursor-pointer shadow-md shadow-indigo-600/25 flex items-center gap-1.5 active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Study ({dueCards.length} due)</span>
          </button>
        </div>
      </div>

      {/* Zen Mode Quick Exit Button */}
      {isZenMode && (
        <button
          type="button"
          onClick={() => setIsZenMode(false)}
          className="absolute top-4 right-4 z-40 px-3.5 py-1.5 rounded-full bg-slate-950/90 hover:bg-slate-900 border border-amber-500/40 text-amber-200 text-xs font-semibold backdrop-blur-xl transition-all flex items-center gap-1.5 shadow-2xl cursor-pointer pointer-events-auto animate-pulse"
          title="Exit Zen Mode"
        >
          <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
          <span>Exit Zen View</span>
        </button>
      )}

      {/* ===================== DESIGN RATING MODAL ===================== */}
      {isEvaluationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-semibold text-white">Design rating · {currentRoom.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEvaluationOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-center">
              <div className="text-3xl font-bold text-white">{evaluation.starRating.toFixed(2)} / 5.00</div>
              <p className="text-xs text-amber-300 font-medium mt-1">{evaluation.harmonyTitle}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                <span className="text-[10px] text-slate-400 block">Focus</span>
                <span className="text-sm font-semibold text-sky-300 font-mono">+{evaluation.totalFocusBonus}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                <span className="text-[10px] text-slate-400 block">Comfort</span>
                <span className="text-sm font-semibold text-emerald-300 font-mono">+{evaluation.totalComfortBonus}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                <span className="text-[10px] text-slate-400 block">Value</span>
                <span className="text-sm font-semibold text-amber-300 font-mono">🪙 {evaluation.totalValue}</span>
              </div>
            </div>
            <div className="space-y-2">
              {evaluation.jurorFeedback.map((fb, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-slate-300">
                  {fb}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIsEvaluationOpen(false)}
              className="w-full py-2.5 rounded-lg bg-white text-slate-900 font-semibold text-xs cursor-pointer hover:bg-slate-100"
            >
              Back to planner
            </button>
          </div>
        </div>
      )}

      {/* ===================== HOUSE RENOVATION & LIFE STAGES MODAL ===================== */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-slate-950 border border-white/[0.12] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 text-slate-100 my-8">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-2xl">
                    {housingProperty.icon}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      House Renovation & Life Stages
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">
                        Level {housingProperty.level}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Study flashcards, master concepts, and earn AxonCoins to renovate and expand your home.
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUpgradeModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Stats Ribbon */}
            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-xs">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Current Residence</span>
                <span className="font-semibold text-white truncate">{housingProperty.name}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Cards Reviewed</span>
                <span className="font-semibold text-sky-400 font-mono text-sm">{totalCardsReviewed} cards</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Unified Wallet</span>
                <span className="font-semibold text-amber-400 font-mono text-sm flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" />
                  🪙{walletCoins}
                </span>
              </div>
            </div>

            {/* Tiers List */}
            <div className="space-y-3.5 max-h-[50vh] overflow-y-auto pr-1 scrollbar-none">
              {HOUSING_CATALOG.map((tier) => {
                const isCurrent = tier.id === housingProperty.id;
                const isUnlocked = tier.level <= housingProperty.level;
                const isNext = tier.level === housingProperty.level + 1;
                const hasCards = totalCardsReviewed >= tier.minCardsReviewed;
                const hasCoins = walletCoins >= tier.upgradeCost;
                const canUpgrade = isNext && hasCards && hasCoins;

                return (
                  <div
                    key={tier.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/5'
                        : isUnlocked
                          ? 'bg-white/[0.02] border-white/[0.06] opacity-75'
                          : isNext
                            ? 'bg-slate-900/90 border-sky-500/40 shadow-xl ring-1 ring-sky-500/20'
                            : 'bg-white/[0.01] border-white/[0.04] opacity-50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="text-2xl p-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] shrink-0">
                          {tier.icon}
                        </span>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-white">{tier.name}</h4>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/[0.08] text-slate-300">
                              Lvl {tier.level}
                            </span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">{tier.subtitle}</p>
                          <p className="text-[11px] text-amber-300/90 font-medium">{tier.perkDescription}</p>

                          {/* Unlocked Rooms Badges */}
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            <span className="text-[10px] text-slate-500">Unlocks:</span>
                            {tier.unlockedRooms.map((rId) => {
                              const r = HOME_ROOMS.find((rm) => rm.id === rId);
                              return (
                                <span
                                  key={rId}
                                  className="px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-[10px] text-slate-300 flex items-center gap-1"
                                >
                                  <span>{r?.icon}</span>
                                  <span>{r?.name.split(' ')[0]}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Upgrade Action Section */}
                      <div className="shrink-0 flex flex-col sm:items-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.06]">
                        {isCurrent ? (
                          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Occupied</span>
                          </div>
                        ) : isUnlocked ? (
                          <div className="px-3.5 py-1.5 rounded-xl bg-white/[0.05] text-slate-400 text-xs font-semibold">
                            Completed
                          </div>
                        ) : (
                          <div className="space-y-1.5 w-full sm:w-auto">
                            {/* Requirement Indicators */}
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              <span className={hasCards ? 'text-emerald-400' : 'text-slate-400'}>
                                {hasCards ? '✓' : '•'} {totalCardsReviewed}/{tier.minCardsReviewed} cards
                              </span>
                              <span>·</span>
                              <span className={hasCoins ? 'text-amber-400' : 'text-slate-400'}>
                                {hasCoins ? '✓' : '•'} 🪙{tier.upgradeCost}
                              </span>
                            </div>

                            <button
                              type="button"
                              disabled={!canUpgrade}
                              onClick={() => {
                                const res = lifeSimService.upgradeHousing(tier.id);
                                if (res.success) {
                                  try {
                                    confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
                                  } catch {}
                                  showToast(`🎉 Congratulations! You upgraded to ${tier.name}!`);
                                  setHousingProperty(lifeSimService.getHousing());
                                  setFurnitureVersion((v) => v + 1);
                                  setIsUpgradeModalOpen(false);
                                } else {
                                  showToast(res.error || 'Failed to upgrade');
                                }
                              }}
                              className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                canUpgrade
                                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-bold hover:brightness-110 shadow-lg shadow-amber-500/25 active:scale-95'
                                  : 'bg-white/[0.05] text-slate-500 cursor-not-allowed border border-white/[0.05]'
                              }`}
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Renovate (🪙{tier.upgradeCost})</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer: Start Over / Reset Option */}
            <div className="flex items-center justify-between border-t border-white/[0.08] pt-4 text-xs">
              <span className="text-slate-500">Want to test starting from a basic dorm room again?</span>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Reset life to Campus Starter Dorm? Your house will return to Level 1 with just a study desk, chair, and twin bed.')) {
                    lifeSimService.resetToStarterLife();
                    setSelectedRoomId('study');
                    setHousingProperty(lifeSimService.getHousing());
                    setFurnitureVersion((v) => v + 1);
                    showToast('Returned to Campus Starter Dorm! Start studying to renovate.');
                    setIsUpgradeModalOpen(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-red-500/15 text-slate-400 hover:text-red-300 border border-white/[0.06] hover:border-red-500/30 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Starter Life</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3D Character Customizer Suite */}
      <CharacterCustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
      />
    </div>
  );
};

export default HomeDesign3D;
