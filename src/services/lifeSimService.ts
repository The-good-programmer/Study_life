import { 
  type MealItem, 
  type ActiveBuff, 
  type DailyLedger, 
  type LifestyleTier, 
  type LifestyleTierMeta,
  type LedgerExpense,
  type LedgerWage,
  type HousingTier,
  type HousingProperty,
  type StudentGearItem,
  type AcademicRole,
  type HomeRoomId,
  type DesignSlotType,
  type RoomFurnitureItem,
  type HomeRoomDefinition,
  type EquippedFurnitureState,
  type PayBoost,
  type RoomDesignEvaluation
} from '../types/lifeSim';
import { characterService } from './characterService';
import { soundEngine } from './soundEngine';
import { LIFE_KEYS, StorageService } from './storageService';

/** What a streak freeze costs; it covers one missed day. */
export const STREAK_FREEZE_COST = 50;

export const HOUSING_CATALOG: HousingProperty[] = [
  {
    id: 'dorm',
    level: 1,
    name: 'Campus Starter Dorm',
    subtitle: 'Spartan single room with a bare study desk and student bed',
    // Rent pays for a home's pay bonus, and the dorm has none, so it is free.
    rentPerDay: 0,
    upgradeCost: 0,
    minCardsReviewed: 0,
    minNetWorth: 0,
    wageMultiplier: 1.0,
    perkDescription: 'No rent and no pay bonus: a study room to start in',
    unlockedRooms: ['study'],
    decor: ['Campus Twin Bed', 'Basic Oak Desk', 'Student Wooden Chair'],
    icon: '📦',
  },
  {
    id: 'studio',
    level: 2,
    name: 'Studio Suite & Living Lounge',
    subtitle: 'Private residence expanded with a relaxing living lounge, sofa, and turntable console',
    rentPerDay: 18,
    upgradeCost: 120,
    minCardsReviewed: 25,
    minNetWorth: 50,
    wageMultiplier: 1.15,
    perkDescription: '+15% pay on days the rent is paid · adds the living room',
    unlockedRooms: ['study', 'living'],
    decor: ['Italian Leather Sofa', 'Hi-Fi Turntable & Vinyl Console', 'Floor Arc Lamp'],
    icon: '🛋️',
  },
  {
    id: 'flat',
    level: 3,
    name: 'Scholar Residence & Gourmet Kitchen',
    subtitle: 'Expanded residence with master bedroom sanctuary and modern kitchen',
    rentPerDay: 40,
    upgradeCost: 320,
    minCardsReviewed: 75,
    minNetWorth: 150,
    wageMultiplier: 1.25,
    perkDescription: '+25% pay on days the rent is paid · adds the bedroom and kitchen',
    unlockedRooms: ['study', 'living', 'bedroom', 'kitchen'],
    decor: ['Bouclé Cloud Bed', 'Espresso Bar', 'Kitchen Island & Stools'],
    icon: '☕',
  },
  {
    id: 'penthouse',
    level: 4,
    name: "Dean's Skyline Penthouse Villa",
    subtitle: 'High-rise academic villa with skyline balcony, pool deck, pergola, and gardens',
    rentPerDay: 70,
    upgradeCost: 650,
    minCardsReviewed: 150,
    minNetWorth: 300,
    wageMultiplier: 1.40,
    perkDescription: '+40% pay on days the rent is paid · adds the balcony, pool and grounds',
    unlockedRooms: ['study', 'kitchen', 'bedroom', 'living', 'balcony'],
    decor: ['Panoramic Balcony & Loungers', 'In-ground Pool Basin', 'Timber Pergola Carport'],
    icon: '🏛️',
  },
];

export const STUDENT_GEAR_CATALOG: StudentGearItem[] = [
  {
    id: 'gear_headphones',
    name: 'ANC Studio Headphones',
    category: 'audio',
    cost: 45,
    emoji: '🎧',
    perk: '+10% Focus Multiplier on active card reviews',
    bonusMultiplier: 0.10,
  },
  {
    id: 'gear_keeb',
    name: 'Custom Mechanical Keyboard',
    category: 'tech',
    cost: 70,
    emoji: '⌨️',
    perk: '+15% Tokens on typing sprints & match games',
    bonusMultiplier: 0.15,
  },
  {
    id: 'gear_monitors',
    name: 'Dual 4K IPS Displays',
    category: 'tech',
    cost: 120,
    emoji: '🖥️',
    perk: '+20% Tokens on Feynman evaluations & mock tests',
    bonusMultiplier: 0.20,
  },
  {
    id: 'gear_espresso',
    name: 'Artisan Espresso Machine',
    category: 'desk',
    cost: 95,
    emoji: '☕',
    perk: 'Free daily espresso top-ups (+15% study speed boost)',
    bonusMultiplier: 0.15,
  },
  {
    id: 'gear_chair',
    name: 'Ergonomic Mesh Study Chair',
    category: 'comfort',
    cost: 80,
    emoji: '🪑',
    perk: '+10% Energy preservation & fatigue resistance',
    bonusMultiplier: 0.10,
  },
];

export const ACADEMIC_ROLES: AcademicRole[] = [
  {
    id: 'role_freshman',
    title: 'Undergraduate Freshman',
    minCardsReviewed: 0,
    baseWagePerSprint: 5,
    icon: '🎒',
    description: 'Taking introductory lectures and navigating campus life',
  },
  {
    id: 'role_peer_tutor',
    title: 'Peer Academic Tutor',
    minCardsReviewed: 50,
    baseWagePerSprint: 10,
    icon: '📚',
    description: 'Helping fellow students master core study concepts and flashcards',
  },
  {
    id: 'role_fellow',
    title: 'Undergraduate Research Fellow',
    minCardsReviewed: 150,
    baseWagePerSprint: 18,
    icon: '🔬',
    description: 'Conducting in-depth inquiry, synthesis, and Feynman evaluations',
  },
  {
    id: 'role_scholar',
    title: 'Distinguished Department Scholar',
    minCardsReviewed: 300,
    baseWagePerSprint: 30,
    icon: '🏛️',
    description: 'Top percentile academic standing with published notes and highest wages',
  },
];

export const CAFETERIA_MENU: MealItem[] = [
  // --- Breakfasts ---
  {
    id: 'oatmeal',
    name: 'Warm Instant Oatmeal',
    subtitle: 'Humble student breakfast to kickstart morning focus',
    emoji: '🥣',
    category: 'breakfast',
    cost: 0, // Free basic meal
    buffDescription: 'Standard morning sustenance (No extra buff)',
    buffType: 'none',
    buffValue: 1.0,
    buffDurationMinutes: 0,
    tierRequired: 1,
  },
  {
    id: 'pancakes',
    name: 'Blueberry Fluffy Pancakes',
    subtitle: 'Golden buttermilk pancakes drenched in pure maple syrup',
    emoji: '🥞',
    category: 'breakfast',
    cost: 15,
    buffDescription: '+15% Study Wage on all flashcards & sprints',
    buffType: 'coin_multiplier',
    buffValue: 1.15,
    buffDurationMinutes: 30,
    tierRequired: 1,
  },
  {
    id: 'avocado_toast',
    name: 'Artisan Avocado & Poached Egg Toast',
    subtitle: 'Toasted sourdough with Hass avocado, chili flakes, and cage-free egg',
    emoji: '🥑',
    category: 'breakfast',
    cost: 30,
    buffDescription: '+25% Study Wage on morning sessions',
    buffType: 'coin_multiplier',
    buffValue: 1.25,
    buffDurationMinutes: 45,
    tierRequired: 2,
  },

  // --- Lunches ---
  {
    id: 'student_sandwich',
    name: 'Campus Deli Sandwich',
    subtitle: 'Classic PB&J and crisp apple to get through midday lectures',
    emoji: '🥪',
    category: 'lunch',
    cost: 0, // Free basic meal
    buffDescription: 'Steady baseline energy for midday studying',
    buffType: 'none',
    buffValue: 1.0,
    buffDurationMinutes: 0,
    tierRequired: 1,
  },
  {
    id: 'bento_box',
    name: 'Tokyo Teriyaki Bento',
    subtitle: 'Glazed salmon, steamed koshihikari rice, tamagoyaki, and edamame',
    emoji: '🍱',
    category: 'lunch',
    cost: 20,
    buffDescription: '+20% Study Wage on afternoon sessions',
    buffType: 'coin_multiplier',
    buffValue: 1.20,
    buffDurationMinutes: 40,
    tierRequired: 1,
  },
  {
    id: 'ramen_bowl',
    name: 'Steaming Tonkotsu Chashu Ramen',
    subtitle: 'Rich 12-hour broth, handmade noodles, soft egg, and roasted seaweed',
    emoji: '🍜',
    category: 'lunch',
    cost: 35,
    buffDescription: '+30% Study Wage & Streak Shield against 1 lapse',
    buffType: 'coin_multiplier',
    buffValue: 1.30,
    buffDurationMinutes: 60,
    tierRequired: 2,
  },

  // --- Dinners ---
  {
    id: 'dorm_ramen',
    name: 'Dormitory Shoyu Ramen',
    subtitle: 'Quick comforting warm noodles after evening library session',
    emoji: '🍜',
    category: 'dinner',
    cost: 0, // Free basic evening meal
    buffDescription: 'Evening baseline sustenance (No extra buff)',
    buffType: 'none',
    buffValue: 1.0,
    buffDurationMinutes: 0,
    tierRequired: 1,
  },
  {
    id: 'pasta_bolognese',
    name: 'Hearty Rigatoni Bolognese',
    subtitle: 'Slow-simmered rich beef ragù with grated parmesan and garlic sourdough',
    emoji: '🍝',
    category: 'dinner',
    cost: 25,
    buffDescription: '+20% Study Wage on late-night review sprints',
    buffType: 'coin_multiplier',
    buffValue: 1.20,
    buffDurationMinutes: 45,
    tierRequired: 1,
  },
  {
    id: 'steak_dinner',
    name: 'Seared Prime Ribeye & Truffle Mash',
    subtitle: 'Garlic rosemary basted steak with truffle potato purée and roast asparagus',
    emoji: '🥩',
    category: 'dinner',
    cost: 45,
    buffDescription: '+35% Study Wage on evening deep work',
    buffType: 'coin_multiplier',
    buffValue: 1.35,
    buffDurationMinutes: 60,
    tierRequired: 2,
  },

  // --- Drinks & Snacks ---
  {
    id: 'mineral_water',
    name: 'Iced Mountain Spring Water',
    subtitle: 'Crisp glacial water infused with mint & lime for pure hydration',
    emoji: '💧',
    category: 'drink',
    cost: 0,
    buffDescription: 'Essential student hydration (Baseline cognitive clarity)',
    buffType: 'none',
    buffValue: 1.0,
    buffDurationMinutes: 0,
    tierRequired: 1,
  },
  {
    id: 'cold_brew',
    name: 'Nitro Cold Brew Coffee',
    subtitle: 'Velvety smooth single-origin cascade with micro-foam crown',
    emoji: '☕',
    category: 'drink',
    cost: 10,
    buffDescription: '+25% Coin Multiplier during rapid review sprints',
    buffType: 'coin_multiplier',
    buffValue: 1.25,
    buffDurationMinutes: 25,
    tierRequired: 1,
  },
  {
    id: 'matcha_latte',
    name: 'Ceremonial Uji Matcha Latte',
    subtitle: 'Stone-ground green tea whisked with oat milk for calm theta focus',
    emoji: '🍵',
    category: 'drink',
    cost: 15,
    buffDescription: '+20% Study Wage & Zen Theta focus buffer',
    buffType: 'coin_multiplier',
    buffValue: 1.20,
    buffDurationMinutes: 35,
    tierRequired: 1,
  },
  {
    id: 'boba_tea',
    name: 'Brown Sugar Tiger Boba',
    subtitle: 'Chewy warm tapioca pearls in caramelized milk tea',
    emoji: '🧋',
    category: 'drink',
    cost: 18,
    buffDescription: '+20% Coin Multiplier & Instant +25 Character Happiness',
    buffType: 'coin_multiplier',
    buffValue: 1.20,
    buffDurationMinutes: 30,
    tierRequired: 2,
  },
  {
    id: 'cookie',
    name: 'Freshly Baked Choc-Chip Cookie',
    subtitle: 'Warm gooey center with sea salt crystals',
    emoji: '🍪',
    category: 'snack',
    cost: 8,
    buffDescription: 'Quick delight snack (+15 Character Happiness & +10 Energy)',
    buffType: 'none',
    buffValue: 1.0,
    buffDurationMinutes: 15,
    tierRequired: 1,
  },
];

export const LIFESTYLE_TIERS: Record<LifestyleTier, LifestyleTierMeta> = {
  frugal: {
    tier: 'frugal',
    level: 1,
    title: 'Frugal Student',
    subtitle: 'Surviving on grit, instant meals, and library study sprints',
    minNetBalance: 0,
    roomAtmosphere: 'Cozy Spartan Dorm',
    deskStyle: 'Simple wooden study desk with desk lamp',
    wallStyle: 'Paper notes and sticky reminders',
    perks: ['Free basic meals available daily', 'Zero bankruptcy penalties'],
  },
  cozy: {
    tier: 'cozy',
    level: 2,
    title: 'Cozy Scholar',
    subtitle: 'Comfortable living with hot bakery pastries and warm ambiance',
    minNetBalance: 40,
    roomAtmosphere: 'Warm Lo-Fi Study Room',
    deskStyle: 'Solid oak desk with succulent plants and ceramic mug',
    wallStyle: 'Fairy lights and study milestone certificates',
    perks: ['Unlocks gourmet café menu items', '+10% passive student happiness'],
  },
  scholar: {
    tier: 'scholar',
    level: 3,
    title: "Dean's List Penthouse",
    subtitle: 'Living in academic luxury with artisan coffee and scenic city views',
    minNetBalance: 100,
    roomAtmosphere: 'Penthouse Study Sanctuary',
    deskStyle: 'Designer walnut workstation with retro record player',
    wallStyle: 'Floor-to-ceiling rainy city window view',
    perks: ['Unlocks exclusive penthouse aesthetics', 'Permanent +10% Wage Bonus on all study shifts'],
  },
};

export const HOME_ROOMS: HomeRoomDefinition[] = [
  {
    id: 'study',
    name: 'Study & Focus Studio',
    subtitle: 'Where deep cognitive encoding and active recall happen',
    icon: '💻',
    slots: ['desk', 'chair', 'bed', 'lighting', 'plant', 'rug', 'wall_art', 'shelf'],
    description: 'High-yield personal workstation optimized for flow state, zero distraction, and active spaced repetition.',
    defaultWallColor: '#0f172a',
    defaultFloorColor: '#1e293b',
  },
  {
    id: 'bedroom',
    name: 'Bedroom Sanctuary',
    subtitle: 'Restorative ultradian recovery & memory consolidation',
    icon: '🛏️',
    slots: ['bed', 'lighting', 'plant', 'rug', 'wall_art', 'shelf'],
    description: 'Calm restorative chamber designed for deep sleep, box breathing, and synaptic memory consolidation.',
    defaultWallColor: '#090d16',
    defaultFloorColor: '#1a1f2c',
  },
  {
    id: 'living',
    name: 'Lo-Fi Living Lounge',
    subtitle: 'Music, acoustic relaxation, and scholar reading',
    icon: '🛋️',
    slots: ['sofa', 'station', 'lighting', 'plant', 'rug', 'wall_art', 'shelf'],
    description: 'Comfortable living space with vinyl hi-fi turntable, acoustic panels, and warm ambient lighting.',
    defaultWallColor: '#121420',
    defaultFloorColor: '#1b1d2a',
  },
  {
    id: 'kitchen',
    name: 'Kitchenette & Coffee Bar',
    subtitle: 'Artisan caffeine ritual and high-protein brain fuel',
    icon: '☕',
    slots: ['station', 'lighting', 'shelf', 'plant', 'rug', 'wall_art'],
    description: 'Espresso workstation and nutrition hub to prepare cognitive meals before intense study blocks.',
    defaultWallColor: '#14141d',
    defaultFloorColor: '#20202d',
  },
  {
    id: 'balcony',
    name: 'Skyline Balcony Terrace',
    subtitle: 'Fresh air, panoramic skyline view, and mindful pauses',
    icon: '🌇',
    slots: ['chair', 'lighting', 'plant', 'rug', 'station'],
    description: 'Open-air balcony overlooking the city skyline for circadian light exposure and 20-20-20 eye rest.',
    defaultWallColor: '#0b1120',
    defaultFloorColor: '#172033',
  },
];

export const DEFAULT_EQUIPPED_FURNITURE: EquippedFurnitureState = {
  study: {
    desk: 'desk_basic_oak',
    chair: 'chair_wooden_student',
    bed: 'bed_campus_twin',
  },
  bedroom: {},
  living: {},
  kitchen: {},
  balcony: {},
};

export const FURNITURE_CATALOG: RoomFurnitureItem[] = [
  // --- STARTER ITEMS (Cost: 0) ---
  {
    id: 'desk_basic_oak',
    name: 'Standard Campus Pine Desk',
    subtitle: 'Sturdy wooden dorm table with notebook space',
    category: 'desk',
    brandStyle: 'Scandinavian',
    cost: 0,
    roomCompatibility: ['study'],
    focusBonus: 4,
    comfortBonus: 2,
    designValue: 30,
    wageMultiplier: 0,
    emoji: '🪵',
    description: 'Humble student starter desk for late-night exam prep.',
    interactiveAction: {
      type: 'study',
      label: 'Open Flashcards',
      tooltip: 'Launch active recall session',
    },
  },
  {
    id: 'chair_wooden_student',
    name: 'Classic Dorm Wood Chair',
    subtitle: 'Standard campus quad study seat',
    category: 'chair',
    brandStyle: 'Scandinavian',
    cost: 0,
    roomCompatibility: ['study', 'balcony'],
    focusBonus: 2,
    comfortBonus: 3,
    designValue: 20,
    wageMultiplier: 0,
    emoji: '🪑',
    description: 'Simple utilitarian chair from the university quad.',
  },
  {
    id: 'light_banker_brass',
    name: 'Emerald Glass Banker Lamp',
    subtitle: 'Classic retro green banker task light',
    category: 'lighting',
    brandStyle: 'Dark Academia',
    cost: 15,
    roomCompatibility: ['study', 'living', 'bedroom'],
    focusBonus: 5,
    comfortBonus: 4,
    designValue: 35,
    wageMultiplier: 0,
    emoji: '💡',
    description: 'Soothing emerald ambient beam focused directly onto your cards.',
    interactiveAction: {
      type: 'toggle_light',
      label: 'Switch Tone',
      tooltip: 'Toggle lighting warmth',
    },
  },
  {
    id: 'plant_succulent_pot',
    name: 'Glazed Jade Succulent',
    subtitle: 'Resilient desk plant that requires zero maintenance',
    category: 'plant',
    brandStyle: 'Scandinavian',
    cost: 10,
    roomCompatibility: ['study', 'living', 'bedroom', 'kitchen', 'balcony'],
    focusBonus: 3,
    comfortBonus: 4,
    designValue: 15,
    wageMultiplier: 0,
    emoji: '🪴',
    description: 'Tiny pot of jade plant radiating calm botanical presence.',
  },
  {
    id: 'rug_minimal_linen',
    name: 'Woven Oatmeal Linen Rug',
    subtitle: 'Textured neutral fiber floor mat',
    category: 'rug',
    brandStyle: 'Scandinavian',
    cost: 15,
    roomCompatibility: ['study', 'bedroom', 'living'],
    focusBonus: 2,
    comfortBonus: 5,
    designValue: 25,
    wageMultiplier: 0,
    emoji: '📜',
    description: 'Simple Scandinavian linen mat to warm up the floorboards.',
  },
  {
    id: 'art_anatomy_diagram',
    name: 'Vintage Neuro-Anatomy Print',
    subtitle: 'Framed cortical mapping diagram',
    category: 'wall_art',
    brandStyle: 'Dark Academia',
    cost: 20,
    roomCompatibility: ['study', 'bedroom', 'living'],
    focusBonus: 5,
    comfortBonus: 2,
    designValue: 25,
    wageMultiplier: 0,
    emoji: '🖼️',
    description: 'Classic Ramon y Cajal neuron diagram reminding you of neuroplasticity.',
  },
  {
    id: 'shelf_stacked_paperback',
    name: 'Open Pine Bookshelf',
    subtitle: 'Stacked textbooks, syllabus binders, and notes',
    category: 'shelf',
    brandStyle: 'Scandinavian',
    cost: 25,
    roomCompatibility: ['study', 'bedroom', 'living', 'kitchen'],
    focusBonus: 4,
    comfortBonus: 2,
    designValue: 25,
    wageMultiplier: 0,
    emoji: '📚',
    description: 'Open shelf housing your academic flashcards and reference guides.',
  },
  {
    id: 'bed_campus_twin',
    name: 'Campus Twin Bunk Frame',
    subtitle: 'Dormitory platform bed with cotton duvet',
    category: 'bed',
    brandStyle: 'Scandinavian',
    cost: 0,
    roomCompatibility: ['study', 'bedroom'],
    focusBonus: 0,
    comfortBonus: 10,
    designValue: 40,
    wageMultiplier: 0,
    emoji: '🛏️',
    description: 'Comfortable student mattress for restorative sleep.',
    interactiveAction: {
      type: 'nap_rest',
      label: 'Ultradian Nap',
      tooltip: 'Take a 4-4-4 breathing rest',
    },
  },
  {
    id: 'light_amber_night',
    name: 'Amber Glow Sconce',
    subtitle: 'Warm 2200K melatonin-friendly night light',
    category: 'lighting',
    brandStyle: 'Modern Lo-Fi',
    cost: 15,
    roomCompatibility: ['bedroom', 'living'],
    focusBonus: 2,
    comfortBonus: 8,
    designValue: 25,
    wageMultiplier: 0,
    emoji: '🕯️',
    description: 'Gentle amber backlight preserving nighttime circadian rhythm.',
    interactiveAction: {
      type: 'toggle_light',
      label: 'Night Dimmer',
      tooltip: 'Toggle ambient glow',
    },
  },
  {
    id: 'plant_lavender_pot',
    name: 'English French Lavender',
    subtitle: 'Fragrant purple sprigs that promote deep sleep',
    category: 'plant',
    brandStyle: 'Scandinavian',
    cost: 12,
    roomCompatibility: ['bedroom', 'balcony', 'living'],
    focusBonus: 2,
    comfortBonus: 8,
    designValue: 20,
    wageMultiplier: 0,
    emoji: '🪻',
    description: 'Soothing floral scent that lowers bedtime cortisol levels.',
  },
  {
    id: 'rug_plush_cloud',
    name: 'Cloud Fleece Bedside Runner',
    subtitle: 'Ultra-soft microfiber bedside mat',
    category: 'rug',
    brandStyle: 'Modern Lo-Fi',
    cost: 20,
    roomCompatibility: ['bedroom', 'living'],
    focusBonus: 1,
    comfortBonus: 10,
    designValue: 30,
    wageMultiplier: 0,
    emoji: '☁️',
    description: 'Silky smooth wool feel underfoot when stepping out of bed.',
  },
  {
    id: 'art_starry_constellation',
    name: 'Celestial Night Sky Chart',
    subtitle: 'Star map showing northern constellations',
    category: 'wall_art',
    brandStyle: 'Modern Lo-Fi',
    cost: 20,
    roomCompatibility: ['bedroom', 'study', 'living'],
    focusBonus: 3,
    comfortBonus: 7,
    designValue: 25,
    wageMultiplier: 0,
    emoji: '✨',
    description: 'Stargazer cartography inspiring vast curiosity.',
  },
  {
    id: 'shelf_bedside_nook',
    name: 'Floating Oak Nightstand',
    subtitle: 'Bedside drawer for Kindle, water glass & sleep mask',
    category: 'shelf',
    brandStyle: 'Scandinavian',
    cost: 20,
    roomCompatibility: ['bedroom'],
    focusBonus: 2,
    comfortBonus: 6,
    designValue: 25,
    wageMultiplier: 0,
    emoji: '🗄️',
    description: 'Minimal nightstand keeping sleep essentials within arm reach.',
  },
  {
    id: 'sofa_dorm_futon',
    name: 'Campus Linen Futon Sofa',
    subtitle: 'Modular dorm sofa for study breaks & movie nights',
    category: 'sofa',
    brandStyle: 'Modern Lo-Fi',
    cost: 35,
    roomCompatibility: ['living'],
    focusBonus: 1,
    comfortBonus: 12,
    designValue: 45,
    wageMultiplier: 0,
    emoji: '🛋️',
    description: 'Comfortable grey linen couch for resting your eyes between flashcard decks.',
  },
  {
    id: 'station_lofi_turntable',
    name: 'Vintage Lo-Fi Vinyl Turntable',
    subtitle: 'Belt-drive record player with built-in preamp',
    category: 'station',
    brandStyle: 'Modern Lo-Fi',
    cost: 40,
    roomCompatibility: ['living', 'study'],
    focusBonus: 8,
    comfortBonus: 10,
    designValue: 50,
    wageMultiplier: 0.05,
    emoji: '📻',
    description: 'Plays analog vinyl cracks and gentle alpha focus beats.',
    interactiveAction: {
      type: 'play_music',
      label: 'Drop Needle',
      tooltip: 'Toggle Lo-Fi study beats',
    },
  },
  {
    id: 'light_warm_floor_globe',
    name: 'Mid-Century Opal Globe Floor Lamp',
    subtitle: 'Frosted sphere emitting diffuse ambient glow',
    category: 'lighting',
    brandStyle: 'Modern Lo-Fi',
    cost: 25,
    roomCompatibility: ['living', 'bedroom', 'study'],
    focusBonus: 4,
    comfortBonus: 8,
    designValue: 35,
    wageMultiplier: 0,
    emoji: '🔮',
    description: 'Sculptural brass and opal glass lighting up the room corner.',
  },
  {
    id: 'plant_fiddle_leaf',
    name: 'Fiddle Leaf Fig in Ceramic Urn',
    subtitle: 'Broad textured leaves in matte terracotta',
    category: 'plant',
    brandStyle: 'Scandinavian',
    cost: 20,
    roomCompatibility: ['living', 'study', 'balcony'],
    focusBonus: 4,
    comfortBonus: 8,
    designValue: 35,
    wageMultiplier: 0,
    emoji: '🌿',
    description: 'Lush indoor tree purifying room air and providing natural green aesthetic.',
  },
  {
    id: 'rug_geometric_boho',
    name: 'Geometric Bauhaus Floor Tapestry',
    subtitle: 'Bold neutral shapes with hand-tufted fringe',
    category: 'rug',
    brandStyle: 'Modern Lo-Fi',
    cost: 25,
    roomCompatibility: ['living', 'study'],
    focusBonus: 3,
    comfortBonus: 9,
    designValue: 35,
    wageMultiplier: 0,
    emoji: '🧶',
    description: 'Artistic floor tapestry uniting the living lounge seating area.',
  },
  {
    id: 'art_abstract_mind',
    name: 'Synaptic Flow Abstract Canvas',
    subtitle: 'Textured oil print depicting cognitive pathways',
    category: 'wall_art',
    brandStyle: 'Modern Lo-Fi',
    cost: 25,
    roomCompatibility: ['living', 'study'],
    focusBonus: 6,
    comfortBonus: 5,
    designValue: 30,
    wageMultiplier: 0,
    emoji: '🎨',
    description: 'Vibrant indigo and amber brushstrokes illustrating neuroplastic growth.',
  },
  {
    id: 'shelf_vinyl_storage',
    name: 'Walnut Vinyl Record Credenza',
    subtitle: 'Low profile sideboard storing records & art books',
    category: 'shelf',
    brandStyle: 'Scandinavian',
    cost: 30,
    roomCompatibility: ['living', 'study'],
    focusBonus: 5,
    comfortBonus: 6,
    designValue: 40,
    wageMultiplier: 0,
    emoji: '📦',
    description: 'Low-slung wooden media cabinet that anchors the entertainment zone.',
  },
  {
    id: 'station_moka_pot',
    name: 'Italian Stovetop Moka Pot',
    subtitle: 'Octagonal aluminum brewer for rich morning espresso',
    category: 'station',
    brandStyle: 'Industrial Chic',
    cost: 25,
    roomCompatibility: ['kitchen', 'study'],
    focusBonus: 8,
    comfortBonus: 6,
    designValue: 35,
    wageMultiplier: 0.05,
    emoji: '☕',
    description: 'Brews thick aromatic espresso to wake up your neural circuits.',
    interactiveAction: {
      type: 'brew_coffee',
      label: 'Brew Stovetop',
      tooltip: 'Brew fresh espresso (+15% wage buff)',
    },
  },
  {
    id: 'light_brass_pendant',
    name: 'Industrial Spun Brass Pendant',
    subtitle: 'Cone shade hanging over the kitchen island',
    category: 'lighting',
    brandStyle: 'Industrial Chic',
    cost: 20,
    roomCompatibility: ['kitchen', 'living'],
    focusBonus: 4,
    comfortBonus: 5,
    designValue: 30,
    wageMultiplier: 0,
    emoji: '🏮',
    description: 'Warm directed light illuminating kitchen prep surfaces.',
  },
  {
    id: 'shelf_open_spice',
    name: 'Open Birch Spice & Tea Rack',
    subtitle: 'Tiered rack for matcha tins, beans & ceramic mugs',
    category: 'shelf',
    brandStyle: 'Scandinavian',
    cost: 20,
    roomCompatibility: ['kitchen'],
    focusBonus: 3,
    comfortBonus: 5,
    designValue: 25,
    wageMultiplier: 0,
    emoji: '🧂',
    description: 'Neatly organized display of artisan teas and study fuel ingredients.',
  },
  {
    id: 'plant_fresh_basil',
    name: 'Kitchen Garden Sweet Basil',
    subtitle: 'Aromatic culinary herb potted on the windowsill',
    category: 'plant',
    brandStyle: 'Scandinavian',
    cost: 12,
    roomCompatibility: ['kitchen', 'balcony'],
    focusBonus: 3,
    comfortBonus: 6,
    designValue: 15,
    wageMultiplier: 0,
    emoji: '🌱',
    description: 'Fresh green herb pot bringing life and culinary fragrance indoors.',
  },
  {
    id: 'rug_kitchen_runner',
    name: 'Anti-Fatigue Herringbone Runner',
    subtitle: 'Cushioned floor mat for standing comfort',
    category: 'rug',
    brandStyle: 'Scandinavian',
    cost: 18,
    roomCompatibility: ['kitchen'],
    focusBonus: 2,
    comfortBonus: 7,
    designValue: 25,
    wageMultiplier: 0,
    emoji: '🟫',
    description: 'Ergonomic kitchen runner that relieves lower back fatigue while cooking.',
  },
  {
    id: 'art_coffee_flavor_wheel',
    name: 'Specialty Coffee Flavor Wheel',
    subtitle: 'Specialty Coffee Association tasting glossary',
    category: 'wall_art',
    brandStyle: 'Modern Lo-Fi',
    cost: 20,
    roomCompatibility: ['kitchen', 'study'],
    focusBonus: 4,
    comfortBonus: 4,
    designValue: 20,
    wageMultiplier: 0,
    emoji: '🎡',
    description: 'Detailed chromatic taxonomy of fruity, floral, and nutty coffee notes.',
  },
  {
    id: 'chair_bistro_metal',
    name: 'Foldable Parisian Bistro Chair',
    subtitle: 'Wrought iron outdoor seating with slatted wood',
    category: 'chair',
    brandStyle: 'Industrial Chic',
    cost: 25,
    roomCompatibility: ['balcony', 'kitchen'],
    focusBonus: 2,
    comfortBonus: 6,
    designValue: 25,
    wageMultiplier: 0,
    emoji: '🪑',
    description: 'Charming terrace chair perfect for morning coffee in the sunlight.',
  },
  {
    id: 'light_fairy_string',
    name: 'Solar Amber Fairy String Lights',
    subtitle: 'Warm outdoor weatherproof micro-LED bulbs',
    category: 'lighting',
    brandStyle: 'Modern Lo-Fi',
    cost: 15,
    roomCompatibility: ['balcony', 'bedroom'],
    focusBonus: 2,
    comfortBonus: 10,
    designValue: 30,
    wageMultiplier: 0,
    emoji: '💡',
    description: 'Twinkling amber lights creating a magical terrace evening atmosphere.',
  },
  {
    id: 'plant_olive_tree',
    name: 'Potted Mediterranean Dwarf Olive',
    subtitle: 'Silvery green foliage in rustic clay planter',
    category: 'plant',
    brandStyle: 'Scandinavian',
    cost: 25,
    roomCompatibility: ['balcony', 'living'],
    focusBonus: 4,
    comfortBonus: 8,
    designValue: 35,
    wageMultiplier: 0,
    emoji: '🫒',
    description: 'Drought-tolerant dwarf olive tree thriving in outdoor sunlight.',
  },
  {
    id: 'rug_outdoor_jute',
    name: 'Weatherproof Woven Jute Mat',
    subtitle: 'Braided natural fiber terrace rug',
    category: 'rug',
    brandStyle: 'Scandinavian',
    cost: 20,
    roomCompatibility: ['balcony', 'living'],
    focusBonus: 2,
    comfortBonus: 6,
    designValue: 25,
    wageMultiplier: 0,
    emoji: '🌾',
    description: 'Durable earth-tone floor mat providing a cozy outdoor flooring.',
  },
  {
    id: 'station_stargazing_scope',
    name: 'Brass Astronomical Telescope',
    subtitle: 'Refractor telescope pointed at moon & planetary orbits',
    category: 'station',
    brandStyle: 'Dark Academia',
    cost: 45,
    roomCompatibility: ['balcony', 'study'],
    focusBonus: 10,
    comfortBonus: 6,
    designValue: 55,
    wageMultiplier: 0.05,
    emoji: '🔭',
    description: 'High-magnification optic telescope for inspecting craters and deep space.',
  },

  // --- PREMIUM DESIGNER UNLOCKS (Purchasable with study wages) ---

  // DESKS
  {
    id: 'desk_walnut_exec',
    name: 'Solid Walnut Electric Standing Desk',
    subtitle: 'Dual-motor memory frame with solid walnut edge',
    category: 'desk',
    brandStyle: 'Dark Academia',
    cost: 65,
    roomCompatibility: ['study'],
    focusBonus: 14,
    comfortBonus: 10,
    designValue: 120,
    wageMultiplier: 0.08,
    emoji: '🪵',
    description: 'Ergonomic height-adjustable desk seamlessly switching from sitting to standing.',
    interactiveAction: {
      type: 'study',
      label: 'Deep Study Sprint',
      tooltip: 'Launch active recall with +8% wage boost',
    },
  },
  {
    id: 'desk_cyber_matrix',
    name: 'Matte Obsidian Cyber Workstation',
    subtitle: 'Cable management race, carbon fiber finish & underglow',
    category: 'desk',
    brandStyle: 'Modern Lo-Fi',
    cost: 90,
    roomCompatibility: ['study'],
    focusBonus: 18,
    comfortBonus: 12,
    designValue: 160,
    wageMultiplier: 0.12,
    emoji: '🖥️',
    description: 'Aerodynamic black matte setup engineered for long deep work marathons.',
    interactiveAction: {
      type: 'study',
      label: 'Flow State Sprint',
      tooltip: 'Start high-yield review session',
    },
  },
  {
    id: 'desk_scandi_birch',
    name: 'Nordic Clean Birch Floating Desk',
    subtitle: 'Minimalist Scandinavian light wood with hidden docks',
    category: 'desk',
    brandStyle: 'Scandinavian',
    cost: 45,
    roomCompatibility: ['study'],
    focusBonus: 9,
    comfortBonus: 8,
    designValue: 85,
    wageMultiplier: 0.05,
    emoji: '🪵',
    description: 'Zero visual clutter, soft rounded corners, and natural daylight reflection.',
  },

  // CHAIRS
  {
    id: 'chair_aeron_mesh',
    name: 'Ergonomic Aeron Performance Mesh Chair',
    subtitle: 'Lumbar PostureFit SL with breathable elastomeric suspension',
    category: 'chair',
    brandStyle: 'Modern Lo-Fi',
    cost: 75,
    roomCompatibility: ['study'],
    focusBonus: 12,
    comfortBonus: 22,
    designValue: 140,
    wageMultiplier: 0.08,
    emoji: '🪑',
    description: 'Gold-standard ergonomic study chair preventing mental and physical fatigue.',
  },
  {
    id: 'chair_leather_scholar',
    name: 'Oxblood Leather Oxford Wingback',
    subtitle: 'Hand-burnished Italian top-grain leather with brass studs',
    category: 'chair',
    brandStyle: 'Dark Academia',
    cost: 85,
    roomCompatibility: ['study', 'living'],
    focusBonus: 10,
    comfortBonus: 24,
    designValue: 155,
    wageMultiplier: 0.08,
    emoji: '🪑',
    description: 'Distinguished scholar chair suited for hours of elaborative reading.',
  },
  {
    id: 'chair_boucle_swivel',
    name: 'Cream Bouclé Sculptural Swivel Armchair',
    subtitle: 'Curved cloud silhouette upholstered in tactile bouclé',
    category: 'chair',
    brandStyle: 'Scandinavian',
    cost: 55,
    roomCompatibility: ['study', 'living', 'bedroom'],
    focusBonus: 6,
    comfortBonus: 18,
    designValue: 100,
    wageMultiplier: 0.05,
    emoji: '🛋️',
    description: 'Inviting, plush sculptural chair providing cozy posture support.',
  },
  {
    id: 'chair_hanging_egg',
    name: 'Woven Rattan Hanging Swing Chair',
    subtitle: 'Suspended outdoor cocoon with weather-resistant cushions',
    category: 'chair',
    brandStyle: 'Scandinavian',
    cost: 70,
    roomCompatibility: ['balcony', 'living'],
    focusBonus: 6,
    comfortBonus: 22,
    designValue: 120,
    wageMultiplier: 0.06,
    emoji: '🪺',
    description: 'Gentle floating swing swaying in the breeze while reading cards.',
  },

  // BEDS
  {
    id: 'bed_japanese_tatami',
    name: 'Low Japanese Cypress Platform Bed',
    subtitle: 'Aromatic Hinoki cypress wood with natural woven tatami mats',
    category: 'bed',
    brandStyle: 'Japanese Zen',
    cost: 85,
    roomCompatibility: ['bedroom'],
    focusBonus: 5,
    comfortBonus: 24,
    designValue: 150,
    wageMultiplier: 0.06,
    emoji: '🛏️',
    description: 'Low-slung minimalist bed creating grounded zen sanctuary vibes.',
    interactiveAction: {
      type: 'nap_rest',
      label: 'Zen Reset',
      tooltip: 'Restorative breathing nap',
    },
  },
  {
    id: 'bed_scandi_boucle',
    name: 'Nordic Bouclé King Cloud Bed',
    subtitle: 'Floating padded headboard wrapped in warm textured wool',
    category: 'bed',
    brandStyle: 'Scandinavian',
    cost: 110,
    roomCompatibility: ['bedroom'],
    focusBonus: 5,
    comfortBonus: 28,
    designValue: 180,
    wageMultiplier: 0.08,
    emoji: '🛏️',
    description: 'Dreamlike softness maximizing slow-wave sleep and memory consolidation.',
    interactiveAction: {
      type: 'nap_rest',
      label: 'Deep Sleep Nap',
      tooltip: 'Consolidate memory with 20m rest',
    },
  },
  {
    id: 'bed_mahogany_canopy',
    name: 'Heritage Mahogany Scholar Canopy Bed',
    subtitle: 'Hand-carved solid mahogany with linen drapery',
    category: 'bed',
    brandStyle: 'Dark Academia',
    cost: 125,
    roomCompatibility: ['bedroom'],
    focusBonus: 8,
    comfortBonus: 30,
    designValue: 210,
    wageMultiplier: 0.10,
    emoji: '🏛️',
    description: 'Grand historic academic suite bed worthy of a Dean’s fellowship.',
    interactiveAction: {
      type: 'nap_rest',
      label: 'Scholar Rest',
      tooltip: 'Power reset with box breathing',
    },
  },

  // SOFAS
  {
    id: 'sofa_italian_leather',
    name: 'Cognac Full-Grain Italian Leather Sofa',
    subtitle: 'Buttery caramel aniline leather with feather-down core',
    category: 'sofa',
    brandStyle: 'Dark Academia',
    cost: 105,
    roomCompatibility: ['living'],
    focusBonus: 6,
    comfortBonus: 26,
    designValue: 175,
    wageMultiplier: 0.07,
    emoji: '🛋️',
    description: 'A timeless centerpiece that matures gracefully and supports comfortable posture.',
  },
  {
    id: 'sofa_cloud_modular',
    name: 'Modular Sand Bouclé Cloud Sectional',
    subtitle: 'Deep sink-in modular blocks for ultimate lounge comfort',
    category: 'sofa',
    brandStyle: 'Scandinavian',
    cost: 125,
    roomCompatibility: ['living'],
    focusBonus: 5,
    comfortBonus: 32,
    designValue: 200,
    wageMultiplier: 0.09,
    emoji: '🛋️',
    description: 'Luxurious organic seating with infinite rearrangement possibilities.',
  },
  {
    id: 'sofa_lofi_velvet',
    name: 'Midnight Navy Velvet Mid-Century Sofa',
    subtitle: 'Tapered brass legs with deep indigo ribbed velvet',
    category: 'sofa',
    brandStyle: 'Modern Lo-Fi',
    cost: 80,
    roomCompatibility: ['living'],
    focusBonus: 6,
    comfortBonus: 22,
    designValue: 140,
    wageMultiplier: 0.06,
    emoji: '🛋️',
    description: 'Vibrant jewel-tone sofa radiating cozy late-night jazz energy.',
  },

  // LIGHTING
  {
    id: 'light_halo_ambient',
    name: 'Minimalist Arc Floor Halo Lamp',
    subtitle: 'Brushed brass cantilever arm with dimmable warm 2700K ring',
    category: 'lighting',
    brandStyle: 'Scandinavian',
    cost: 45,
    roomCompatibility: ['study', 'living', 'bedroom'],
    focusBonus: 10,
    comfortBonus: 8,
    designValue: 80,
    wageMultiplier: 0.04,
    emoji: '💡',
    description: 'Sweeping arch delivering indirect ambient lighting without screen glare.',
    interactiveAction: {
      type: 'toggle_light',
      label: 'Dim/Brighten',
      tooltip: 'Cycle ambient intensity',
    },
  },
  {
    id: 'light_circadian_sunset',
    name: 'Circadian Sunset Projection Orb',
    subtitle: 'Optical glass prism projecting rich gradient twilight',
    category: 'lighting',
    brandStyle: 'Modern Lo-Fi',
    cost: 50,
    roomCompatibility: ['bedroom', 'living', 'study'],
    focusBonus: 8,
    comfortBonus: 14,
    designValue: 90,
    wageMultiplier: 0.04,
    emoji: '🌅',
    description: 'Fills the room with mesmerizing golden hour glow that calms racing thoughts.',
    interactiveAction: {
      type: 'toggle_light',
      label: 'Sunset Glow',
      tooltip: 'Toggle golden hour mode',
    },
  },
  {
    id: 'light_edison_chandelier',
    name: 'Industrial Filament Brass Chandelier',
    subtitle: 'Exposed warm Edison filaments suspended from black steel',
    category: 'lighting',
    brandStyle: 'Industrial Chic',
    cost: 60,
    roomCompatibility: ['living', 'kitchen', 'study'],
    focusBonus: 8,
    comfortBonus: 12,
    designValue: 110,
    wageMultiplier: 0.05,
    emoji: '🏮',
    description: 'Dramatic architectural ceiling lighting casting warm ambient shadows.',
  },

  // PLANTS
  {
    id: 'plant_monstera_huge',
    name: 'Giant Swiss Cheese Monstera Deliciosa',
    subtitle: 'Split leaves standing over 4 feet tall in fluted ceramic',
    category: 'plant',
    brandStyle: 'Modern Lo-Fi',
    cost: 40,
    roomCompatibility: ['living', 'study', 'balcony'],
    focusBonus: 7,
    comfortBonus: 14,
    designValue: 75,
    wageMultiplier: 0.04,
    emoji: '🪴',
    description: 'Iconic lush tropical plant creating a serene living botanical oasis.',
  },
  {
    id: 'plant_bonsai_juniper',
    name: '50-Year Ancient Juniper Bonsai',
    subtitle: 'Gnarled deadwood driftwood with cascading needle pads',
    category: 'plant',
    brandStyle: 'Japanese Zen',
    cost: 70,
    roomCompatibility: ['study', 'living', 'bedroom'],
    focusBonus: 16,
    comfortBonus: 12,
    designValue: 130,
    wageMultiplier: 0.06,
    emoji: '🌲',
    description: 'Masterwork living art piece promoting mindfulness and deliberate focus.',
  },
  {
    id: 'plant_zen_bamboo',
    name: 'Lush Japanese Clumping Bamboo',
    subtitle: 'Tall emerald culms rustling gently in natural breeze',
    category: 'plant',
    brandStyle: 'Japanese Zen',
    cost: 55,
    roomCompatibility: ['balcony', 'living'],
    focusBonus: 12,
    comfortBonus: 12,
    designValue: 95,
    wageMultiplier: 0.05,
    emoji: '🎋',
    description: 'Creates a natural privacy hedge and soothing wind chimes on your terrace.',
  },

  // RUGS
  {
    id: 'rug_persian_heriz',
    name: 'Handwoven Scholar Persian Heriz Rug',
    subtitle: 'Centuries-old geometric medallion in deep madder red & indigo',
    category: 'rug',
    brandStyle: 'Dark Academia',
    cost: 65,
    roomCompatibility: ['study', 'living'],
    focusBonus: 9,
    comfortBonus: 18,
    designValue: 120,
    wageMultiplier: 0.05,
    emoji: '🧿',
    description: 'Historic wool weave offering rich acoustic dampening and scholar dignity.',
  },
  {
    id: 'rug_moroccan_berber',
    name: 'Hand-Knotted Moroccan Beni Ourain Rug',
    subtitle: '100% undyed high-pile sheep wool with charcoal diamond lines',
    category: 'rug',
    brandStyle: 'Scandinavian',
    cost: 65,
    roomCompatibility: ['living', 'bedroom'],
    focusBonus: 6,
    comfortBonus: 20,
    designValue: 120,
    wageMultiplier: 0.05,
    emoji: '🧶',
    description: 'Extra plush high-pile rug that feels like walking on warm clouds.',
  },
  {
    id: 'rug_bauhaus_woven',
    name: 'Bauhaus Primary Geometric Flatweave',
    subtitle: 'Abstract color blocking inspired by Dessau modernism',
    category: 'rug',
    brandStyle: 'Modern Lo-Fi',
    cost: 45,
    roomCompatibility: ['study', 'living'],
    focusBonus: 8,
    comfortBonus: 12,
    designValue: 80,
    wageMultiplier: 0.04,
    emoji: '🟧',
    description: 'Inspiring graphic patterns invigorating creative cognitive thinking.',
  },

  // STATIONS (Interactive Food, Coffee, Music)
  {
    id: 'station_artisan_espresso',
    name: 'Dual-Boiler Italian Espresso Machine',
    subtitle: 'Rotary pump with chrome E61 grouphead & steam wand',
    category: 'station',
    brandStyle: 'Industrial Chic',
    cost: 100,
    roomCompatibility: ['kitchen', 'study'],
    focusBonus: 20,
    comfortBonus: 14,
    designValue: 180,
    wageMultiplier: 0.10,
    emoji: '☕',
    description: 'Extracts liquid gold espresso with rich golden crema for peak mental focus.',
    interactiveAction: {
      type: 'brew_coffee',
      label: 'Pull Espresso',
      tooltip: 'Brew double shot (+15% wage buff)',
    },
  },
  {
    id: 'station_ceremonial_matcha',
    name: 'Kyoto Bamboo Whisk & Matcha Table',
    subtitle: 'Chasen whisk, chawan ceramic bowl & stone-ground tencha',
    category: 'station',
    brandStyle: 'Japanese Zen',
    cost: 75,
    roomCompatibility: ['kitchen', 'living', 'study'],
    focusBonus: 18,
    comfortBonus: 14,
    designValue: 135,
    wageMultiplier: 0.08,
    emoji: '🍵',
    description: 'Rich in L-Theanine for calm, jitter-free sustained concentration.',
    interactiveAction: {
      type: 'brew_coffee',
      label: 'Whisk Matcha',
      tooltip: 'Whisk ceremonial tea (+15% wage buff)',
    },
  },
  {
    id: 'station_audiophile_hi_fi',
    name: 'Audiophile Hi-Fi Tube Amp & Vinyl Deck',
    subtitle: 'Warm analog glow from vacuum tubes driving magnetic cartridge',
    category: 'station',
    brandStyle: 'Dark Academia',
    cost: 95,
    roomCompatibility: ['living', 'study'],
    focusBonus: 16,
    comfortBonus: 18,
    designValue: 170,
    wageMultiplier: 0.08,
    emoji: '🎛️',
    description: 'Rich tube saturation masks room distractions and supports deep study immersion.',
    interactiveAction: {
      type: 'play_music',
      label: 'Warm Analog Beats',
      tooltip: 'Play lo-fi study soundscape',
    },
  },

  // SHELVES & WALL ART
  {
    id: 'shelf_walnut_library',
    name: 'Floor-to-Ceiling Walnut Library Tower',
    subtitle: 'Rolling brass ladder with integrated LED shelf runners',
    category: 'shelf',
    brandStyle: 'Dark Academia',
    cost: 70,
    roomCompatibility: ['study', 'living'],
    focusBonus: 15,
    comfortBonus: 10,
    designValue: 135,
    wageMultiplier: 0.06,
    emoji: '🏛️',
    description: 'Imposing academic library displaying entire volumes of medical & science notes.',
  },
  {
    id: 'art_synapse_blueprint',
    name: 'Architectural Neuro-Synapse Blueprint',
    subtitle: 'Cyanotype blueprint of dendritic spines and axon terminals',
    category: 'wall_art',
    brandStyle: 'Modern Lo-Fi',
    cost: 35,
    roomCompatibility: ['study', 'bedroom', 'living'],
    focusBonus: 10,
    comfortBonus: 6,
    designValue: 65,
    wageMultiplier: 0.03,
    emoji: '📐',
    description: 'Technical cyan print illustrating the biological basis of spaced repetition.',
  },
  {
    id: 'art_tokyo_night_photo',
    name: 'Tokyo Rainy Neon Fine Art Photograph',
    subtitle: 'Archival pigment print of reflections under Shibuya umbrellas',
    category: 'wall_art',
    brandStyle: 'Modern Lo-Fi',
    cost: 45,
    roomCompatibility: ['living', 'bedroom', 'study'],
    focusBonus: 8,
    comfortBonus: 14,
    designValue: 80,
    wageMultiplier: 0.04,
    emoji: '🌃',
    description: 'Calming lo-fi rain cityscape radiating moody nighttime study atmosphere.',
  },
];


type LifeSimListener = () => void;

class LifeSimService {
  private currentLedger: DailyLedger;
  private activeBuffs: ActiveBuff[] = [];
  private equippedFurniture: EquippedFurnitureState;
  private ownedFurniture: Set<string> = new Set();
  private listeners: Set<LifeSimListener> = new Set();

  constructor() {
    this.currentLedger = this.loadLedger();
    this.activeBuffs = this.loadBuffs();
    this.equippedFurniture = this.loadEquippedFurniture();
    this.ownedFurniture = this.loadOwnedFurniture();
    this.cleanExpiredBuffs();
    // Each profile has its own ledger, boosts and home; switch to them on sign-in and sign-out.
    StorageService.addProfileListener(() => {
      this.reloadFromStorage();
      this.notify();
    });
    // The wallet is kept by characterService; its changes (here or in another tab) are news here too.
    characterService.subscribe(() => this.notify());
    // Rent, meals or furniture bought in another tab: show them here too.
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', event => {
        const watched = [LIFE_KEYS.LEDGER, LIFE_KEYS.BUFFS, LIFE_KEYS.ROOM_DESIGNS, LIFE_KEYS.OWNED_FURNITURE];
        if (event.key === null || watched.some(base => event.key === StorageService.lifeKey(base))) {
          this.reloadFromStorage();
          this.notify();
        }
      });
    }
  }

  /**
   * Reads the saved ledger, boosts and home. Every change starts here, so it builds on
   * what another tab saved instead of overwriting it with this tab's older copy.
   */
  private reloadFromStorage(): void {
    this.currentLedger = this.loadLedger();
    this.activeBuffs = this.loadBuffs();
    this.equippedFurniture = this.loadEquippedFurniture();
    this.ownedFurniture = this.loadOwnedFurniture();
    this.cleanExpiredBuffs();
  }

  private getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private loadLedger(): DailyLedger {
    const today = this.getTodayDateString();
    const defaultLedger: DailyLedger = {
      date: today,
      breakfastId: null,
      lunchId: null,
      dinnerId: null,
      drinkId: null,
      eatenMeals: {},
      totalExpenses: 0,
      totalEarnings: 0,
      netBalance: 0,
      housingTier: 'dorm',
      rentPaidToday: false,
      ownedGear: [],
      academicRoleId: 'role_freshman',
      expenses: [],
      wages: [],
    };

    try {
      const raw = localStorage.getItem(StorageService.lifeKey(LIFE_KEYS.LEDGER));
      if (raw) {
        const parsed: DailyLedger = JSON.parse(raw);
        if (parsed.date === today) {
          if (!parsed.housingTier) parsed.housingTier = 'dorm';
          if (!parsed.ownedGear) parsed.ownedGear = [];
          if (!parsed.academicRoleId) parsed.academicRoleId = 'role_freshman';
          return parsed;
        } else {
          // It's a new day! Archive the previous day's ledger
          this.archiveLedger(parsed);
          defaultLedger.housingTier = parsed.housingTier || 'dorm';
          defaultLedger.ownedGear = parsed.ownedGear || [];
          defaultLedger.academicRoleId = parsed.academicRoleId || 'role_freshman';
          defaultLedger.rentPaidToday = false;
          this.saveLedger(defaultLedger);
          return defaultLedger;
        }
      }
    } catch {
      // Fallback
    }

    return defaultLedger;
  }

  private archiveLedger(ledger: DailyLedger) {
    try {
      const rawHistory = localStorage.getItem(StorageService.lifeKey(LIFE_KEYS.LEDGER_HISTORY));
      const history: DailyLedger[] = rawHistory ? JSON.parse(rawHistory) : [];
      // Keep up to 30 days
      const updated = [ledger, ...history.filter(h => h.date !== ledger.date)].slice(0, 30);
      localStorage.setItem(StorageService.lifeKey(LIFE_KEYS.LEDGER_HISTORY), JSON.stringify(updated));
    } catch {}
  }

  private saveLedger(ledger: DailyLedger) {
    try {
      localStorage.setItem(StorageService.lifeKey(LIFE_KEYS.LEDGER), JSON.stringify(ledger));
    } catch {}
  }

  private loadBuffs(): ActiveBuff[] {
    try {
      const raw = localStorage.getItem(StorageService.lifeKey(LIFE_KEYS.BUFFS));
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {}
    return [];
  }

  private saveBuffs() {
    try {
      localStorage.setItem(StorageService.lifeKey(LIFE_KEYS.BUFFS), JSON.stringify(this.activeBuffs));
    } catch {}
  }

  private loadEquippedFurniture(): EquippedFurnitureState {
    const fallback = JSON.parse(JSON.stringify(DEFAULT_EQUIPPED_FURNITURE));
    try {
      const raw = localStorage.getItem(StorageService.lifeKey(LIFE_KEYS.ROOM_DESIGNS));
      if (raw) {
        const parsed = JSON.parse(raw);
        // Ensure all rooms exist
        for (const room of HOME_ROOMS) {
          if (!parsed[room.id]) {
            parsed[room.id] = fallback[room.id] || {};
          }
        }
        return parsed;
      }
    } catch {}
    return fallback;
  }

  private saveEquippedFurniture() {
    try {
      localStorage.setItem(StorageService.lifeKey(LIFE_KEYS.ROOM_DESIGNS), JSON.stringify(this.equippedFurniture));
    } catch {}
  }

  private loadOwnedFurniture(): Set<string> {
    const owned = new Set<string>();
    // All zero-cost starter items are owned by default
    FURNITURE_CATALOG.filter(f => f.cost === 0).forEach(f => owned.add(f.id));
    try {
      const raw = localStorage.getItem(StorageService.lifeKey(LIFE_KEYS.OWNED_FURNITURE));
      if (raw) {
        const parsed: string[] = JSON.parse(raw);
        parsed.forEach(id => owned.add(id));
      }
    } catch {}
    return owned;
  }

  private saveOwnedFurniture() {
    try {
      localStorage.setItem(StorageService.lifeKey(LIFE_KEYS.OWNED_FURNITURE), JSON.stringify(Array.from(this.ownedFurniture)));
    } catch {}
  }

  private cleanExpiredBuffs(): boolean {
    const now = new Date().getTime();
    const countBefore = this.activeBuffs.length;
    this.activeBuffs = this.activeBuffs.filter(b => new Date(b.expiresAt).getTime() > now);
    if (this.activeBuffs.length !== countBefore) {
      this.saveBuffs();
      return true;
    }
    return false;
  }

  public subscribe(listener: LifeSimListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch {}
    });
  }

  /**
   * Starts a fresh ledger once the day has changed (in UTC, like the rest of the app's days),
   * so rent, meals and earnings never carry over from yesterday.
   */
  private rollOverIfNewDay(): void {
    if (this.currentLedger.date === this.getTodayDateString()) return;
    // The saved ledger is the one to roll over (loadLedger archives it and starts today's):
    // another tab may have added to it since, or already started today's.
    this.currentLedger = this.loadLedger();
    // Deferred: this can run while a component renders, and listeners set state.
    queueMicrotask(() => this.notify());
  }

  public getDailyLedger(): DailyLedger {
    this.rollOverIfNewDay();
    return { ...this.currentLedger };
  }

  public getWalletBalance(): number {
    return characterService.getWalletBalance();
  }

  public getActiveBuffs(): ActiveBuff[] {
    this.cleanExpiredBuffs();
    return [...this.activeBuffs];
  }

  public getHousing(): HousingProperty {
    const tier = this.currentLedger.housingTier || 'dorm';
    return HOUSING_CATALOG.find(h => h.id === tier) || HOUSING_CATALOG[0];
  }

  public getUnlockedRooms(): HomeRoomId[] {
    const housing = this.getHousing();
    return housing.unlockedRooms && housing.unlockedRooms.length > 0
      ? housing.unlockedRooms
      : ['study'];
  }

  public isRoomUnlocked(roomId: HomeRoomId): boolean {
    return this.getUnlockedRooms().includes(roomId);
  }

  public getOwnedGear(): StudentGearItem[] {
    const owned = this.currentLedger.ownedGear || [];
    return STUDENT_GEAR_CATALOG.filter(g => owned.includes(g.id));
  }

  public getAcademicRole(): AcademicRole {
    let totalReviewed = 0;
    try {
      const cards = StorageService.getAllCards();
      totalReviewed = cards.reduce((acc, c) => acc + (c.reps || 0), 0);
      if (totalReviewed === 0) {
        totalReviewed = StorageService.getStats().conceptsMastered || 0;
      }
    } catch {}

    let unlocked = ACADEMIC_ROLES[0];
    for (const role of ACADEMIC_ROLES) {
      if (totalReviewed >= role.minCardsReviewed) {
        unlocked = role;
      }
    }
    if (this.currentLedger.academicRoleId !== unlocked.id) {
      this.reloadFromStorage();
      this.currentLedger.academicRoleId = unlocked.id;
      this.saveLedger(this.currentLedger);
    }
    return unlocked;
  }

  /** Whether today's rent is paid, which is what turns on the home's pay bonus. */
  public isRentPaidToday(): boolean {
    this.rollOverIfNewDay();
    return Boolean(this.currentLedger.rentPaidToday);
  }

  /** Everything raising pay right now. The pay multiplier is 1 plus their bonuses. */
  public getPayBoosts(): PayBoost[] {
    this.rollOverIfNewDay();
    this.cleanExpiredBuffs();
    const boosts: PayBoost[] = [];

    // A home's bonus is what its rent pays for, so it counts only on days the rent is paid.
    const housing = this.getHousing();
    if (housing.wageMultiplier > 1 && this.currentLedger.rentPaidToday) {
      boosts.push({ id: 'home', label: `${housing.name} (rent paid)`, bonus: housing.wageMultiplier - 1 });
    }

    for (const gearId of this.currentLedger.ownedGear || []) {
      const gear = STUDENT_GEAR_CATALOG.find(g => g.id === gearId);
      if (gear) boosts.push({ id: gear.id, label: gear.name, bonus: gear.bonusMultiplier });
    }

    if (this.getLifestyleTier() === 'scholar') {
      boosts.push({
        id: 'scholar',
        label: `A strong day: ${LIFESTYLE_TIERS.scholar.minNetBalance}+ more earned than spent`,
        bonus: 0.1,
      });
    }

    for (const buff of this.activeBuffs) {
      if (buff.buffType === 'coin_multiplier' && buff.buffValue > 1) {
        boosts.push({ id: buff.id, label: buff.name, bonus: buff.buffValue - 1, endsAt: buff.expiresAt });
      }
    }
    return boosts;
  }

  /** What every token earned is multiplied by right now. */
  public getActiveMultiplier(): number {
    const total = this.getPayBoosts().reduce((sum, boost) => sum + boost.bonus, 1);
    return Number(total.toFixed(2));
  }

  public payDailyRent(): { success: boolean; error?: string } {
    this.reloadFromStorage();
    if (this.currentLedger.rentPaidToday) {
      return { success: false, error: "Today's rent has already been paid!" };
    }
    const housing = this.getHousing();
    if (housing.rentPerDay <= 0) {
      return { success: false, error: 'This home has no rent.' };
    }
    const balance = this.getWalletBalance();
    if (balance < housing.rentPerDay) {
      return {
        success: false,
        error: `Not enough tokens for rent! You have 🪙${balance}, but daily rent is 🪙${housing.rentPerDay}. Study to earn tokens!`,
      };
    }
    const spent = characterService.spendCoins(housing.rentPerDay);
    if (!spent) {
      return { success: false, error: 'Failed to process rent payment' };
    }
    const expenseEntry: LedgerExpense = {
      id: `rent_${Date.now()}`,
      mealId: housing.id,
      name: `${housing.name} Daily Rent`,
      emoji: housing.icon,
      cost: housing.rentPerDay,
      category: 'housing',
      purchasedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    this.currentLedger.expenses.unshift(expenseEntry);
    this.currentLedger.totalExpenses += housing.rentPerDay;
    this.currentLedger.netBalance = this.currentLedger.totalEarnings - this.currentLedger.totalExpenses;
    this.currentLedger.rentPaidToday = true;
    this.saveLedger(this.currentLedger);
    this.notify();
    try { soundEngine.playSuccess(); } catch {}
    return { success: true };
  }

  /** Moves up to a bigger home: needs the study milestone and the renovation cost. Homes are never rented outright. */
  public upgradeHousing(targetTier: HousingTier): { success: boolean; error?: string; property?: HousingProperty } {
    this.reloadFromStorage();
    const target = HOUSING_CATALOG.find(h => h.id === targetTier);
    if (!target) {
      return { success: false, error: 'Housing property not found' };
    }
    const current = this.getHousing();
    if (current.id === targetTier) {
      return { success: false, error: `You are already residing in the ${target.name}!` };
    }
    if (target.level < current.level) {
      return { success: false, error: 'Cannot downgrade your renovated residence!' };
    }
    // One level at a time, so every renovation on the way is paid for.
    if (target.level > current.level + 1) {
      return { success: false, error: `Upgrade to level ${current.level + 1} first.` };
    }

    // Check study requirement (cards reviewed)
    let totalCardsReviewed = 0;
    try {
      const cards = StorageService.getAllCards();
      totalCardsReviewed = cards.reduce((acc, c) => acc + (c.reps || 0), 0);
      if (totalCardsReviewed === 0) {
        totalCardsReviewed = StorageService.getStats().conceptsMastered || 0;
      }
    } catch {}

    if (totalCardsReviewed < target.minCardsReviewed) {
      return {
        success: false,
        error: `Study milestone required: ${totalCardsReviewed}/${target.minCardsReviewed} cards reviewed. Complete more study sessions to unlock!`,
      };
    }

    // Check token wallet balance
    const currentCoins = this.getWalletBalance();
    if (currentCoins < target.upgradeCost) {
      return {
        success: false,
        error: `Insufficient tokens! You have 🪙${currentCoins}, but this renovation requires 🪙${target.upgradeCost}. Keep studying to earn more!`,
      };
    }

    if (target.upgradeCost > 0) {
      const spent = characterService.spendCoins(target.upgradeCost);
      if (!spent) {
        return { success: false, error: 'Failed to process upgrade tokens' };
      }
    }

    this.currentLedger.housingTier = targetTier;
    this.currentLedger.rentPaidToday = true;

    if (target.upgradeCost > 0) {
      const expenseEntry: LedgerExpense = {
        id: `renovation_${Date.now()}`,
        mealId: target.id,
        name: `${target.name} Renovation`,
        emoji: target.icon,
        cost: target.upgradeCost,
        category: 'housing',
        purchasedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      this.currentLedger.expenses.unshift(expenseEntry);
      this.currentLedger.totalExpenses += target.upgradeCost;
      this.currentLedger.netBalance = this.currentLedger.totalEarnings - this.currentLedger.totalExpenses;
    }

    this.saveLedger(this.currentLedger);
    this.notify();

    try {
      soundEngine.playCoinCascade();
      soundEngine.playCompletionChime();
    } catch {}

    return { success: true, property: target };
  }

  public buyGear(gearId: string): { success: boolean; error?: string; item?: StudentGearItem } {
    this.reloadFromStorage();
    const item = STUDENT_GEAR_CATALOG.find(g => g.id === gearId);
    if (!item) {
      return { success: false, error: 'Gear item not found' };
    }
    if (!this.currentLedger.ownedGear) {
      this.currentLedger.ownedGear = [];
    }
    if (this.currentLedger.ownedGear.includes(gearId)) {
      return { success: false, error: 'You already own this desk gear!' };
    }
    const balance = this.getWalletBalance();
    if (balance < item.cost) {
      return {
        success: false,
        error: `Not enough tokens! You have 🪙${balance}, but this costs 🪙${item.cost}. Study to earn tokens!`,
      };
    }
    const spent = characterService.spendCoins(item.cost);
    if (!spent) {
      return { success: false, error: 'Failed to deduct tokens' };
    }
    this.currentLedger.ownedGear.push(gearId);
    const expenseEntry: LedgerExpense = {
      id: `gear_${Date.now()}`,
      mealId: item.id,
      name: item.name,
      emoji: item.emoji,
      cost: item.cost,
      category: 'gear',
      purchasedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    this.currentLedger.expenses.unshift(expenseEntry);
    this.currentLedger.totalExpenses += item.cost;
    this.currentLedger.netBalance = this.currentLedger.totalEarnings - this.currentLedger.totalExpenses;
    this.saveLedger(this.currentLedger);
    this.notify();
    try { soundEngine.playCoinCascade(); } catch {}
    return { success: true, item };
  }

  /** Buys a streak freeze, which covers one missed day. You can hold one at a time. */
  public buyStreakFreeze(): { success: boolean; error?: string } {
    this.reloadFromStorage();
    if (StorageService.hasSynapticFreeze()) {
      return { success: false, error: 'You already have a streak freeze ready.' };
    }
    const balance = this.getWalletBalance();
    if (balance < STREAK_FREEZE_COST) {
      return { success: false, error: `A streak freeze costs ${STREAK_FREEZE_COST} tokens. You have ${balance}.` };
    }
    if (!characterService.spendCoins(STREAK_FREEZE_COST)) {
      return { success: false, error: 'Could not take the tokens just now.' };
    }
    StorageService.setSynapticFreeze(true);
    this.currentLedger.expenses.unshift({
      id: `streak_${Date.now()}`,
      mealId: 'streak_freeze',
      name: 'Streak freeze',
      emoji: '❄️',
      cost: STREAK_FREEZE_COST,
      category: 'streak',
      purchasedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    this.currentLedger.totalExpenses += STREAK_FREEZE_COST;
    this.currentLedger.netBalance = this.currentLedger.totalEarnings - this.currentLedger.totalExpenses;
    this.saveLedger(this.currentLedger);
    this.notify();
    return { success: true };
  }

  public getLifestyleTier(): LifestyleTier {
    this.rollOverIfNewDay();
    const net = this.currentLedger.netBalance;
    if (net >= LIFESTYLE_TIERS.scholar.minNetBalance) {
      return 'scholar';
    }
    if (net >= LIFESTYLE_TIERS.cozy.minNetBalance) {
      return 'cozy';
    }
    return 'frugal';
  }

  public buyMeal(mealId: string): { success: boolean; error?: string; meal?: MealItem } {
    this.reloadFromStorage();
    const meal = CAFETERIA_MENU.find(m => m.id === mealId);
    if (!meal) {
      return { success: false, error: 'Meal item not found' };
    }

    // Check affordability
    const currentCoins = this.getWalletBalance();
    if (currentCoins < meal.cost) {
      return { 
        success: false, 
        error: `Not enough AxonCoins! You have 🪙${currentCoins}, but this costs 🪙${meal.cost}. Complete a study sprint to earn wages!` 
      };
    }

    // Deduct coins from unified wallet
    if (meal.cost > 0) {
      const spent = characterService.spendCoins(meal.cost);
      if (!spent) {
        return { success: false, error: 'Failed to deduct coins' };
      }
    }

    // Record expense in ledger
    const expenseEntry: LedgerExpense = {
      id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      mealId: meal.id,
      name: meal.name,
      emoji: meal.emoji,
      cost: meal.cost,
      category: meal.category,
      purchasedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    this.currentLedger.expenses.unshift(expenseEntry);
    this.currentLedger.totalExpenses += meal.cost;
    this.currentLedger.netBalance = this.currentLedger.totalEarnings - this.currentLedger.totalExpenses;

    if (meal.category === 'breakfast') {
      this.currentLedger.breakfastId = meal.id;
    } else if (meal.category === 'lunch') {
      this.currentLedger.lunchId = meal.id;
    } else if (meal.category === 'dinner') {
      this.currentLedger.dinnerId = meal.id;
    } else if (meal.category === 'drink' || meal.category === 'snack') {
      this.currentLedger.drinkId = meal.id;
    }

    this.saveLedger(this.currentLedger);

    // Apply active buff if applicable
    if (meal.buffType !== 'none' && meal.buffDurationMinutes > 0) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + meal.buffDurationMinutes * 60 * 1000).toISOString();

      // Replace or add buff
      this.activeBuffs = this.activeBuffs.filter(b => b.buffType !== meal.buffType);
      this.activeBuffs.push({
        id: `buff_${Date.now()}`,
        mealId: meal.id,
        name: meal.name,
        emoji: meal.emoji,
        buffType: meal.buffType,
        buffValue: meal.buffValue,
        startedAt: now.toISOString(),
        expiresAt,
      });
      this.saveBuffs();
    }

    // Boost character happiness and energy
    try {
      characterService.feed('berry'); // Boost companion mood
      soundEngine.playSuccess();
    } catch {}

    this.notify();
    return { success: true, meal };
  }

  public awardStudyWage(activity: string, rawAmount: number): {
    rawAmount: number;
    buffBonus: number;
    totalAmount: number;
    activity: string;
  } {
    this.reloadFromStorage();
    const multiplier = this.getActiveMultiplier();
    const totalAmount = Math.max(1, Math.round(rawAmount * multiplier));
    const buffBonus = Math.max(0, totalAmount - rawAmount);

    // Add coins to player's wallet
    characterService.addCoins(totalAmount);

    // Record in ledger
    const wageEntry: LedgerWage = {
      id: `wage_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      activity,
      rawAmount,
      buffBonus,
      totalAmount,
      earnedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    this.currentLedger.wages.unshift(wageEntry);
    this.currentLedger.totalEarnings += totalAmount;
    this.currentLedger.netBalance = this.currentLedger.totalEarnings - this.currentLedger.totalExpenses;
    this.saveLedger(this.currentLedger);

    try {
      soundEngine.playSuccess();
    } catch {}

    this.notify();

    // Dispatch global event for celebratory banner
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('study-wage-earned', {
          detail: { activity, rawAmount, buffBonus, totalAmount },
        })
      );
    }

    return { rawAmount, buffBonus, totalAmount, activity };
  }

  public getHistory(): DailyLedger[] {
    try {
      const raw = localStorage.getItem(StorageService.lifeKey(LIFE_KEYS.LEDGER_HISTORY));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  // ==========================================
  // DESIGN HOME & ROOM MANAGEMENT API
  // ==========================================

  public getRooms(): HomeRoomDefinition[] {
    return HOME_ROOMS;
  }

  public getRoom(roomId: HomeRoomId): HomeRoomDefinition {
    return HOME_ROOMS.find(r => r.id === roomId) || HOME_ROOMS[0];
  }

  public getEquippedFurniture(roomId: HomeRoomId): Record<DesignSlotType, RoomFurnitureItem | null> {
    const room = this.getRoom(roomId);
    const roomEquipped = this.equippedFurniture[roomId] || {};
    const result = {} as Record<DesignSlotType, RoomFurnitureItem | null>;

    for (const slot of room.slots) {
      const fId = roomEquipped[slot];
      const found = fId ? FURNITURE_CATALOG.find(f => f.id === fId) || null : null;
      result[slot] = found;
    }

    return result;
  }

  public getAllEquippedState(): EquippedFurnitureState {
    return JSON.parse(JSON.stringify(this.equippedFurniture));
  }

  public getFurnitureCatalog(filter?: { room?: HomeRoomId; slot?: DesignSlotType }): RoomFurnitureItem[] {
    return FURNITURE_CATALOG.filter(item => {
      if (filter?.room && !item.roomCompatibility.includes(filter.room)) {
        return false;
      }
      if (filter?.slot && item.category !== filter.slot) {
        return false;
      }
      return true;
    });
  }

  public getOwnedFurnitureIds(): string[] {
    return Array.from(this.ownedFurniture);
  }

  public isFurnitureOwned(furnitureId: string): boolean {
    return this.ownedFurniture.has(furnitureId);
  }

  public buyFurniture(
    furnitureId: string, 
    autoEquipRoom?: HomeRoomId
  ): { success: boolean; error?: string; item?: RoomFurnitureItem } {
    this.reloadFromStorage();
    const item = FURNITURE_CATALOG.find(f => f.id === furnitureId);
    if (!item) {
      return { success: false, error: 'Furniture item not found' };
    }

    if (this.isFurnitureOwned(furnitureId)) {
      if (autoEquipRoom) {
        return this.equipFurniture(furnitureId, autoEquipRoom).success 
          ? { success: true, item } 
          : { success: false, error: 'Failed to equip owned item', item };
      }
      return { success: false, error: 'You already own this furniture piece!', item };
    }

    const currentCoins = this.getWalletBalance();
    if (currentCoins < item.cost) {
      return {
        success: false,
        error: `Not enough tokens! You have 🪙${currentCoins}, but this piece costs 🪙${item.cost}. Complete study sessions to earn wages!`,
      };
    }

    if (item.cost > 0) {
      const spent = characterService.spendCoins(item.cost);
      if (!spent) {
        return { success: false, error: 'Failed to deduct tokens' };
      }
    }

    this.ownedFurniture.add(item.id);
    this.saveOwnedFurniture();

    // Log expense in ledger
    if (item.cost > 0) {
      const expenseEntry: LedgerExpense = {
        id: `decor_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        mealId: item.id,
        name: item.name,
        emoji: item.emoji,
        cost: item.cost,
        category: 'gear',
        purchasedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      this.currentLedger.expenses.unshift(expenseEntry);
      this.currentLedger.totalExpenses += item.cost;
      this.currentLedger.netBalance = this.currentLedger.totalEarnings - this.currentLedger.totalExpenses;
      this.saveLedger(this.currentLedger);
    }

    // Auto-equip if room specified and compatible
    if (autoEquipRoom && item.roomCompatibility.includes(autoEquipRoom)) {
      if (!this.equippedFurniture[autoEquipRoom]) {
        this.equippedFurniture[autoEquipRoom] = {};
      }
      this.equippedFurniture[autoEquipRoom][item.category] = item.id;
      this.saveEquippedFurniture();
    }

    try {
      soundEngine.playCoinCascade();
    } catch {}

    this.notify();
    return { success: true, item };
  }

  public equipFurniture(furnitureId: string, roomId: HomeRoomId): { success: boolean; error?: string } {
    this.reloadFromStorage();
    const item = FURNITURE_CATALOG.find(f => f.id === furnitureId);
    if (!item) {
      return { success: false, error: 'Furniture item not found' };
    }

    if (!this.isFurnitureOwned(furnitureId)) {
      return { success: false, error: 'You do not own this piece yet. Purchase it first!' };
    }

    if (!item.roomCompatibility.includes(roomId)) {
      return { success: false, error: `This piece cannot be placed in the ${this.getRoom(roomId).name}` };
    }

    if (!this.equippedFurniture[roomId]) {
      this.equippedFurniture[roomId] = {};
    }

    this.equippedFurniture[roomId][item.category] = item.id;
    this.saveEquippedFurniture();

    try {
      soundEngine.playSuccess();
    } catch {}

    this.notify();
    return { success: true };
  }

  public calculateRoomDesignScore(roomId: HomeRoomId): RoomDesignEvaluation {
    const room = this.getRoom(roomId);
    const equipped = this.getEquippedFurniture(roomId);
    const slots = room.slots;

    let totalValue = 0;
    let totalFocusBonus = 0;
    let totalComfortBonus = 0;
    let totalWageMultiplier = 0;
    let equippedCount = 0;
    const styleCounts: Record<string, number> = {};

    for (const slot of slots) {
      const item = equipped[slot];
      if (item) {
        equippedCount += 1;
        totalValue += item.designValue;
        totalFocusBonus += item.focusBonus;
        totalComfortBonus += item.comfortBonus;
        totalWageMultiplier += item.wageMultiplier;
        styleCounts[item.brandStyle] = (styleCounts[item.brandStyle] || 0) + 1;
      }
    }

    // Determine primary style and synergy
    let topStyle = 'Eclectic Student';
    let topCount = 0;
    for (const [st, count] of Object.entries(styleCounts)) {
      if (count > topCount) {
        topCount = count;
        topStyle = st;
      }
    }

    const harmonyBonus = topCount >= 3 ? 0.35 : 0;
    const completenessRatio = slots.length > 0 ? equippedCount / slots.length : 1;
    
    // Design Home Star Formula (3.0 to 5.0 scale)
    const baseStars = 3.2;
    const completenessStars = completenessRatio * 0.9;
    const valueStars = Math.min(0.65, (totalValue / 350) * 0.65);
    const calculatedRating = Math.min(5.0, Math.max(3.0, Number((baseStars + completenessStars + valueStars + harmonyBonus).toFixed(2))));

    // Juror feedback generation (Design Home style)
    const feedback: string[] = [];
    if (harmonyBonus > 0) {
      feedback.push(`Strong ${topStyle} style cohesion (+0.35 Harmony synergy).`);
    } else {
      feedback.push('Eclectic blend of styles creates an energetic student atmosphere.');
    }

    if (totalFocusBonus >= 20) {
      feedback.push(`Exceptional cognitive focus rating (+${totalFocusBonus} pts). Optimal for active recall sprints.`);
    } else {
      feedback.push(`Solid baseline study ergonomics (+${totalFocusBonus} Focus pts).`);
    }

    if (totalComfortBonus >= 25) {
      feedback.push(`Deep restorative comfort (+${totalComfortBonus} Comfort pts) to minimize cognitive fatigue.`);
    }

    // Furniture is decor: it raises the room's rating, not pay (see getPayBoosts).
    return {
      starRating: calculatedRating,
      totalValue,
      totalFocusBonus,
      totalComfortBonus,
      totalWageMultiplier: Number(totalWageMultiplier.toFixed(2)),
      harmonyTitle: `${topStyle} Synergy`,
      jurorFeedback: feedback,
      lastEvaluatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      breakdown: {
        base: baseStars,
        filledSlots: equippedCount,
        totalSlots: slots.length,
        completeness: completenessStars,
        value: valueStars,
        harmony: harmonyBonus,
        matchedStyle: harmonyBonus > 0 ? topStyle : null,
      },
    };
  }

  public resetToStarterLife() {
    this.reloadFromStorage();
    this.currentLedger.housingTier = 'dorm';
    this.currentLedger.ownedGear = [];
    this.currentLedger.rentPaidToday = false;
    this.saveLedger(this.currentLedger);

    this.equippedFurniture = JSON.parse(JSON.stringify(DEFAULT_EQUIPPED_FURNITURE));
    this.saveEquippedFurniture();

    this.ownedFurniture = new Set();
    FURNITURE_CATALOG.filter(f => f.cost === 0).forEach(f => this.ownedFurniture.add(f.id));
    this.saveOwnedFurniture();

    this.notify();
  }

  public resetForTesting() {
    localStorage.removeItem(StorageService.lifeKey(LIFE_KEYS.LEDGER));
    localStorage.removeItem(StorageService.lifeKey(LIFE_KEYS.BUFFS));
    localStorage.removeItem(StorageService.lifeKey(LIFE_KEYS.ROOM_DESIGNS));
    localStorage.removeItem(StorageService.lifeKey(LIFE_KEYS.OWNED_FURNITURE));
    this.currentLedger = this.loadLedger();
    this.activeBuffs = [];
    this.equippedFurniture = this.loadEquippedFurniture();
    this.ownedFurniture = this.loadOwnedFurniture();
  }
}

export const lifeSimService = new LifeSimService();
