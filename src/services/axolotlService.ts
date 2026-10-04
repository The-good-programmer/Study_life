import { soundEngine } from './soundEngine';
import { StorageService } from './storageService';

export type AxolotlSkinId = 
  | 'leucistic'    // Classic Axolotl Blush Pink
  | 'cyber'        // Bioluminescent Neon Cyan
  | 'golden'       // Golden Albino Shimmer
  | 'lavender'     // Dreamy Violet Mystic
  | 'midnight'     // Abyssal Obsidian & Electric Blue
  | 'starlight';    // Prismatic Iridescent Opal

export type AxolotlAccessoryId = 
  | 'none'
  | 'glasses'      // Study Wireframe Glasses
  | 'cap'          // Scholar Mortarboard Cap
  | 'headphones'   // Focus Beats Headphones
  | 'halo'         // Synaptic Golden Halo
  | 'crown'        // Memory Champion Crown
  | 'bowtie'       // Dapper Scholar Bowtie
  | 'snorkel';     // Aquatic Exploration Goggles

export type AxolotlEnvironmentId = 
  | 'sanctuary-reef' // Sunlit Coral Terrarium
  | 'deep-biolum'    // Deep-Sea Bioluminescent Trench
  | 'zen-pond'       // Serene Lotus Water Garden
  | 'cyber-matrix';  // Holographic Neural Grid

export type AxolotlMood = 'happy' | 'curious' | 'zen' | 'playful' | 'sleepy' | 'hungry';

export type AxolotlTreatType = 'shrimp' | 'berry' | 'bean' | 'pearl';

export interface SkinPalette {
  id: AxolotlSkinId;
  name: string;
  subtitle: string;
  bodyColor: string;
  bellyColor: string;
  gillStemColor: string;
  gillFrillColor: string;
  eyeColor: string;
  blushColor: string;
  glowColor: string;
  accentColor: string;
  roughness: number;
  metalness: number;
  translucent: boolean;
}

export interface AccessoryMeta {
  id: AxolotlAccessoryId;
  name: string;
  description: string;
  icon: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  requiredLevel: number;
}

export interface EnvironmentMeta {
  id: AxolotlEnvironmentId;
  name: string;
  subtitle: string;
  icon: string;
  fogColor: string;
  waterColor: string;
  ambientLight: string;
  caustics: boolean;
  bubbleCount: number;
}

export interface TreatMeta {
  id: AxolotlTreatType;
  name: string;
  emoji: string;
  description: string;
  hungerGain: number;
  happinessGain: number;
  xpReward: number;
  color: string;
}

export interface AxolotlState {
  name: string;
  skin: AxolotlSkinId;
  accessory: AxolotlAccessoryId;
  environment: AxolotlEnvironmentId;
  mood: AxolotlMood;
  happiness: number;      // 0 - 100
  hunger: number;         // 0 - 100 (100 = full)
  energy: number;         // 0 - 100
  friendshipLevel: number;
  friendshipXP: number;
  axonCoins: number;
  treatInventory: Record<AxolotlTreatType, number>;
  evolutionStage: 'hatchling' | 'juvenile' | 'adult' | 'celestial';
  totalPets: number;
  totalTreatsFed: number;
  unlockedSkins: AxolotlSkinId[];
  unlockedAccessories: AxolotlAccessoryId[];
  lastPettedAt?: string;
  lastFedAt?: string;
}

export const SKIN_PALETTES: Record<AxolotlSkinId, SkinPalette> = {
  leucistic: {
    id: 'leucistic',
    name: 'Leucistic Rosa',
    subtitle: 'The timeless, beloved Mexican Axolotl blush',
    bodyColor: '#ffb6d9',
    bellyColor: '#ffe4f0',
    gillStemColor: '#ff80bf',
    gillFrillColor: '#ff2d78',
    eyeColor: '#1a1020',
    blushColor: '#ff5c9d',
    glowColor: '#ff94c2',
    accentColor: '#ec4899',
    roughness: 0.35,
    metalness: 0.05,
    translucent: true,
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Bioluminescent',
    subtitle: 'Engineered with synthetic glowing deep-ocean photophores',
    bodyColor: '#00e5ff',
    bellyColor: '#b3f5ff',
    gillStemColor: '#0284c7',
    gillFrillColor: '#00f7ff',
    eyeColor: '#020617',
    blushColor: '#06b6d4',
    glowColor: '#00ffff',
    accentColor: '#06b6d4',
    roughness: 0.2,
    metalness: 0.25,
    translucent: true,
  },
  golden: {
    id: 'golden',
    name: 'Golden Albino',
    subtitle: 'Luminous honey-gold scales with ruby sunset frills',
    bodyColor: '#ffd54f',
    bellyColor: '#fff8e1',
    gillStemColor: '#ffb300',
    gillFrillColor: '#ff5252',
    eyeColor: '#880e4f',
    blushColor: '#ff7043',
    glowColor: '#ffe082',
    accentColor: '#f59e0b',
    roughness: 0.3,
    metalness: 0.2,
    translucent: false,
  },
  lavender: {
    id: 'lavender',
    name: 'Dreamy Lavender',
    subtitle: 'Ethereal twilight violet reflecting calm theta brainwaves',
    bodyColor: '#d8b4fe',
    bellyColor: '#f3e8ff',
    gillStemColor: '#a855f7',
    gillFrillColor: '#9333ea',
    eyeColor: '#3b0764',
    blushColor: '#c084fc',
    glowColor: '#e9d5ff',
    accentColor: '#a855f7',
    roughness: 0.35,
    metalness: 0.1,
    translucent: true,
  },
  midnight: {
    id: 'midnight',
    name: 'Abyssal Midnight',
    subtitle: 'Obsidian melanoid with electric neon neural pulses',
    bodyColor: '#0f172a',
    bellyColor: '#1e293b',
    gillStemColor: '#1e1b4b',
    gillFrillColor: '#38bdf8',
    eyeColor: '#38bdf8',
    blushColor: '#6366f1',
    glowColor: '#38bdf8',
    accentColor: '#38bdf8',
    roughness: 0.25,
    metalness: 0.4,
    translucent: false,
  },
  starlight: {
    id: 'starlight',
    name: 'Prismatic Starlight',
    subtitle: 'Chameleonic crystalline opal with rainbow diffraction',
    bodyColor: '#f1f5f9',
    bellyColor: '#ffffff',
    gillStemColor: '#f472b6',
    gillFrillColor: '#38bdf8',
    eyeColor: '#4f46e5',
    blushColor: '#fb7185',
    glowColor: '#c084fc',
    accentColor: '#818cf8',
    roughness: 0.15,
    metalness: 0.5,
    translucent: true,
  },
};

export const ACCESSORIES_META: Record<AxolotlAccessoryId, AccessoryMeta> = {
  none: {
    id: 'none',
    name: 'Natural / No Accessory',
    description: 'Au naturel, displaying pristine aquatic beauty',
    icon: '✨',
    rarity: 'Common',
    requiredLevel: 1,
  },
  glasses: {
    id: 'glasses',
    name: 'Study Spectacles',
    description: 'Round wireframe glasses granting +100 Socratic focus',
    icon: '👓',
    rarity: 'Common',
    requiredLevel: 1,
  },
  cap: {
    id: 'cap',
    name: 'Scholar Mortarboard',
    description: 'Academic graduation cap with an undulating golden tassel',
    icon: '🎓',
    rarity: 'Rare',
    requiredLevel: 2,
  },
  headphones: {
    id: 'headphones',
    name: 'Binaural Headphones',
    description: 'Sleek neon focus cans tuned directly to 40Hz Gamma',
    icon: '🎧',
    rarity: 'Rare',
    requiredLevel: 3,
  },
  halo: {
    id: 'halo',
    name: 'Synaptic Halo',
    description: 'A floating ring of pure enlightened cognitive energy',
    icon: '😇',
    rarity: 'Epic',
    requiredLevel: 4,
  },
  crown: {
    id: 'crown',
    name: 'Memory Monarch Crown',
    description: 'Cast in 24k gold, honoring master retention streaks',
    icon: '👑',
    rarity: 'Legendary',
    requiredLevel: 5,
  },
  bowtie: {
    id: 'bowtie',
    name: 'Gentleman Bowtie',
    description: 'Dapper satin bowtie for scholarly symposiums',
    icon: '🎀',
    rarity: 'Common',
    requiredLevel: 1,
  },
  snorkel: {
    id: 'snorkel',
    name: 'Aquanaut Goggles',
    description: 'High-visibility submarine lenses for deep retrieval dives',
    icon: '🤿',
    rarity: 'Rare',
    requiredLevel: 2,
  },
};

export const ENVIRONMENTS_META: Record<AxolotlEnvironmentId, EnvironmentMeta> = {
  'sanctuary-reef': {
    id: 'sanctuary-reef',
    name: 'Coral Terrarium',
    subtitle: 'Sunlit aquatic biome with river stones, moss, and warm caustics',
    icon: '🪸',
    fogColor: '#0a1628',
    waterColor: '#0d324d',
    ambientLight: '#8ee4af',
    caustics: true,
    bubbleCount: 30,
  },
  'deep-biolum': {
    id: 'deep-biolum',
    name: 'Abyssal Trench',
    subtitle: 'Midnight depths illuminated by glowing flora and crystal spires',
    icon: '🌌',
    fogColor: '#040714',
    waterColor: '#051329',
    ambientLight: '#38bdf8',
    caustics: false,
    bubbleCount: 45,
  },
  'zen-pond': {
    id: 'zen-pond',
    name: 'Lotus Zen Garden',
    subtitle: 'Tranquil mirror pond surrounded by floating petals and soft mist',
    icon: '🪷',
    fogColor: '#120f24',
    waterColor: '#23153c',
    ambientLight: '#d8b4fe',
    caustics: true,
    bubbleCount: 20,
  },
  'cyber-matrix': {
    id: 'cyber-matrix',
    name: 'Neural Grid',
    subtitle: 'Futuristic digital continuum pulsating with synapse data packets',
    icon: '⚡',
    fogColor: '#020b18',
    waterColor: '#041d38',
    ambientLight: '#00f0ff',
    caustics: false,
    bubbleCount: 35,
  },
};

export const TREATS_META: Record<AxolotlTreatType, TreatMeta> = {
  shrimp: {
    id: 'shrimp',
    name: 'Brine Shrimp Snack',
    emoji: '🦐',
    description: 'Fresh, succulent aquatic morsel loved by all salamanders.',
    hungerGain: 25,
    happinessGain: 15,
    xpReward: 10,
    color: '#fb923c',
  },
  berry: {
    id: 'berry',
    name: 'Synaptic Glow Berry',
    emoji: '🫐',
    description: 'Infused with antioxidant anthocyanins to sharpen recall.',
    hungerGain: 20,
    happinessGain: 30,
    xpReward: 20,
    color: '#818cf8',
  },
  bean: {
    id: 'bean',
    name: 'Cold-Brew Focus Bean',
    emoji: '☕',
    description: 'Natural gentle alertness booster to sustain flow state.',
    hungerGain: 15,
    happinessGain: 25,
    xpReward: 15,
    color: '#a16207',
  },
  pearl: {
    id: 'pearl',
    name: 'FSRS Diamond Pearl',
    emoji: '💎',
    description: 'Rare crystallized memory relic that consolidates intervals.',
    hungerGain: 40,
    happinessGain: 50,
    xpReward: 50,
    color: '#38bdf8',
  },
};

export const NEURO_AXOLOTL_LORE = [
  {
    title: "Neurogenesis & Regeneration",
    text: "Axolotls (Ambystoma mexicanum) are true biological wonders: they can completely regenerate damaged brain hemispheres, spine sections, and heart tissue without any scarring!",
    studyTieIn: "When you practice Active Recall, your brain undergoes neuroplasticity—strengthening real physical dendritic spines and synaptic pathways."
  },
  {
    title: "The Neoteny Advantage",
    text: "Axolotls remain in their juvenile aquatic form their entire lives (a phenomenon called neoteny). They never lose their youthful regenerative capacity.",
    studyTieIn: "Keep a growth mindset! The adult human brain remains neuroplastic throughout your entire life if consistently challenged with desirable difficulties."
  },
  {
    title: "Why Passive Reading Fails",
    text: "Reading notes passively lights up visual recognition, producing an 'illusion of competence'.",
    studyTieIn: "Testing yourself before peeking forces the hippocampus to reconstruct neural traces, producing 300% higher 1-week retention (Roediger & Karpicke)."
  },
  {
    title: "Cortical 40Hz Gamma Rhythms",
    text: "40Hz neural oscillations bind disparate sensory and memory modules across the cortex during intense focus.",
    studyTieIn: "Our built-in 40Hz audio provides steady acoustic masking to minimize distractibility and fatigue."
  },
  {
    title: "Memory Consolidation in Sleep & Rest",
    text: "Axolotls take peaceful micro-drifts in calm currents to conserve energy.",
    studyTieIn: "During short 5-minute rest breaks, your hippocampus replays studied concepts at 10x-20x normal speed to cement them into neocortical long-term storage."
  }
];

const STORAGE_KEY = 'studify_axolotl_sanctuary_v1';

type AxolotlListener = (state: AxolotlState) => void;

class AxolotlService {
  private state: AxolotlState;
  private listeners: Set<AxolotlListener> = new Set();

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): AxolotlState {
    const defaultState: AxolotlState = {
      name: 'Lottie',
      skin: 'leucistic',
      accessory: 'none',
      environment: 'sanctuary-reef',
      mood: 'happy',
      happiness: 85,
      hunger: 70,
      energy: 90,
      friendshipLevel: 1,
      friendshipXP: 25,
      axonCoins: 120,
      treatInventory: {
        shrimp: 8,
        berry: 12,
        bean: 10,
        pearl: 4,
      },
      evolutionStage: 'juvenile',
      totalPets: 0,
      totalTreatsFed: 0,
      unlockedSkins: ['leucistic', 'cyber', 'golden', 'lavender'],
      unlockedAccessories: ['none', 'glasses', 'cap', 'headphones', 'bowtie'],
    };

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { 
          ...defaultState, 
          ...parsed,
          treatInventory: { ...defaultState.treatInventory, ...(parsed.treatInventory || {}) },
        };
      }
    } catch {
      // Fallback
    }

    return defaultState;
  }

  public getState(): AxolotlState {
    return { ...this.state };
  }

  public subscribe(listener: AxolotlListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => fn(this.state));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('[AxolotlService] Failed to persist state:', e);
    }
  }

  public updateName(name: string) {
    const trimmed = name.trim().slice(0, 20);
    if (!trimmed) return;
    this.state.name = trimmed;
    this.notify();
  }

  public setSkin(skin: AxolotlSkinId) {
    if (this.state.skin === skin) return;
    this.state.skin = skin;
    try {
      soundEngine.playAxolotlBubble();
    } catch {
      // Audio context catch
    }
    this.notify();
  }

  public setAccessory(acc: AxolotlAccessoryId) {
    if (this.state.accessory === acc) return;
    this.state.accessory = acc;
    try {
      soundEngine.playAxolotlBubble();
    } catch {
      // Audio context catch
    }
    this.notify();
  }

  public setEnvironment(env: AxolotlEnvironmentId) {
    if (this.state.environment === env) return;
    this.state.environment = env;
    try {
      soundEngine.playAxolotlBubble();
    } catch {
      // Audio context catch
    }
    this.notify();
  }

  public setMood(mood: AxolotlMood) {
    this.state.mood = mood;
    this.notify();
  }

  public pet(): { happiness: number; xpGained: number; leveledUp: boolean } {
    this.state.happiness = Math.min(100, this.state.happiness + 8);
    this.state.totalPets += 1;
    this.state.lastPettedAt = new Date().toISOString();
    this.state.mood = 'happy';

    // Award friendship XP up to a reasonable cap (primary XP must be earned by studying)
    const canEarnPetXP = (this.state.totalPets % 5) === 1;
    const xpReward = canEarnPetXP ? 5 : 0;
    this.state.friendshipXP += xpReward;

    const requiredXP = this.state.friendshipLevel * 50;
    let leveledUp = false;

    if (this.state.friendshipXP >= requiredXP) {
      this.state.friendshipLevel += 1;
      this.state.friendshipXP -= requiredXP;
      leveledUp = true;
      // Unlock all accessories and skins as friendship increases
      if (this.state.friendshipLevel >= 3 && !this.state.unlockedAccessories.includes('halo')) {
        this.state.unlockedAccessories.push('halo');
      }
      if (this.state.friendshipLevel >= 4 && !this.state.unlockedAccessories.includes('crown')) {
        this.state.unlockedAccessories.push('crown');
      }
      if (this.state.friendshipLevel >= 2 && !this.state.unlockedSkins.includes('midnight')) {
        this.state.unlockedSkins.push('midnight');
      }
      if (this.state.friendshipLevel >= 3 && !this.state.unlockedSkins.includes('starlight')) {
        this.state.unlockedSkins.push('starlight');
      }
    }

    if (canEarnPetXP) {
      StorageService.addXP(2);
    }

    try {
      soundEngine.playAxolotlPurr();
      soundEngine.playAxolotlChirp();
    } catch {
      // Audio context catch
    }

    this.notify();
    return { happiness: this.state.happiness, xpGained: xpReward, leveledUp };
  }

  public feed(treatType: AxolotlTreatType): { hunger: number; happiness: number; xp: number; leveledUp: boolean } {
    const treat = TREATS_META[treatType];

    // Decrement inventory if available
    if (!this.state.treatInventory) {
      this.state.treatInventory = { shrimp: 5, berry: 5, bean: 5, pearl: 2 };
    }
    if (this.state.treatInventory[treatType] > 0) {
      this.state.treatInventory[treatType] -= 1;
    }

    this.state.hunger = Math.min(100, this.state.hunger + treat.hungerGain);
    this.state.happiness = Math.min(100, this.state.happiness + treat.happinessGain);
    this.state.energy = Math.min(100, (this.state.energy || 50) + 10);
    this.state.totalTreatsFed += 1;
    this.state.lastFedAt = new Date().toISOString();
    this.state.mood = 'happy';

    this.state.friendshipXP += treat.xpReward;
    const requiredXP = this.state.friendshipLevel * 50;
    let leveledUp = false;

    if (this.state.friendshipXP >= requiredXP) {
      this.state.friendshipLevel += 1;
      this.state.friendshipXP -= requiredXP;
      leveledUp = true;
      this.checkUnlocks();
    }

    // Also reward user study XP
    StorageService.addXP(treat.xpReward);

    try {
      soundEngine.playAxolotlChomp();
      soundEngine.playAxolotlBubble();
    } catch {
      // Audio context catch
    }

    this.notify();
    return {
      hunger: this.state.hunger,
      happiness: this.state.happiness,
      xp: treat.xpReward,
      leveledUp,
    };
  }

  public awardStudySessionRewards(cardsReviewed: number, durationMinutes: number = 5, accuracy: number = 0.85): {
    treatsEarned: Record<AxolotlTreatType, number>;
    coinsEarned: number;
    friendshipXPEarned: number;
    leveledUp: boolean;
  } {
    const shrimpCount = Math.max(1, Math.floor(cardsReviewed / 3));
    const berryCount = Math.max(1, Math.floor(durationMinutes / 2));
    const beanCount = Math.max(1, Math.floor(cardsReviewed / 5));
    const pearlCount = accuracy >= 0.8 || cardsReviewed >= 10 ? 1 : 0;

    const treatsEarned: Record<AxolotlTreatType, number> = {
      shrimp: shrimpCount,
      berry: berryCount,
      bean: beanCount,
      pearl: pearlCount,
    };

    const coinsEarned = Math.max(15, Math.round(cardsReviewed * 5 + durationMinutes * 3));
    const friendshipXPEarned = Math.max(10, Math.round(cardsReviewed * 4 + durationMinutes * 2));

    // Update inventory & coins
    if (!this.state.treatInventory) {
      this.state.treatInventory = { shrimp: 0, berry: 0, bean: 0, pearl: 0 };
    }
    this.state.treatInventory.shrimp += shrimpCount;
    this.state.treatInventory.berry += berryCount;
    this.state.treatInventory.bean += beanCount;
    this.state.treatInventory.pearl += pearlCount;

    this.state.axonCoins = (this.state.axonCoins || 0) + coinsEarned;
    this.state.energy = Math.min(100, (this.state.energy || 50) + 30);
    this.state.happiness = Math.min(100, this.state.happiness + 15);
    this.state.mood = 'happy';

    // Award friendship XP
    this.state.friendshipXP += friendshipXPEarned;
    const requiredXP = this.state.friendshipLevel * 50;
    let leveledUp = false;

    if (this.state.friendshipXP >= requiredXP) {
      this.state.friendshipLevel += 1;
      this.state.friendshipXP -= requiredXP;
      leveledUp = true;
      this.checkUnlocks();
    }

    // Update evolution stage
    if (this.state.friendshipLevel >= 6) {
      this.state.evolutionStage = 'celestial';
    } else if (this.state.friendshipLevel >= 3) {
      this.state.evolutionStage = 'adult';
    } else {
      this.state.evolutionStage = 'juvenile';
    }

    this.notify();
    return { treatsEarned, coinsEarned, friendshipXPEarned, leveledUp };
  }

  private checkUnlocks() {
    if (this.state.friendshipLevel >= 2 && !this.state.unlockedSkins.includes('midnight')) {
      this.state.unlockedSkins.push('midnight');
    }
    if (this.state.friendshipLevel >= 3 && !this.state.unlockedSkins.includes('starlight')) {
      this.state.unlockedSkins.push('starlight');
    }
    if (this.state.friendshipLevel >= 3 && !this.state.unlockedAccessories.includes('halo')) {
      this.state.unlockedAccessories.push('halo');
    }
    if (this.state.friendshipLevel >= 4 && !this.state.unlockedAccessories.includes('crown')) {
      this.state.unlockedAccessories.push('crown');
    }
    if (this.state.friendshipLevel >= 5 && !this.state.unlockedAccessories.includes('snorkel')) {
      this.state.unlockedAccessories.push('snorkel');
    }
  }

  public addCoins(amount: number) {
    this.state.axonCoins = Math.max(0, (this.state.axonCoins || 0) + amount);
    this.notify();
  }

  public doTrick(): { trickName: string } {
    this.state.mood = 'playful';
    this.state.happiness = Math.min(100, this.state.happiness + 5);
    try {
      soundEngine.playAxolotlChirp();
    } catch {
      // catch
    }
    this.notify();
    return { trickName: 'Acrobatic Barrel Roll & Fin Wave' };
  }
}

export const axolotlService = new AxolotlService();
