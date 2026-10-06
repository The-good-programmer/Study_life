export type CharacterGender = 'male' | 'female' | 'nonbinary';
export type BodyType = 'slender' | 'athletic' | 'average';

export type FacialHair = 'none' | 'stubble' | 'goatee' | 'beard';

export type HairStyle = 
  | 'short-fade' 
  | 'curly-afro' 
  | 'bob-cut' 
  | 'long-wavy' 
  | 'ponytail' 
  | 'spiky' 
  | 'side-part' 
  | 'buzz';

export type Eyewear = 
  | 'none' 
  | 'wireframe' 
  | 'thick-frame' 
  | 'round' 
  | 'sunglasses';

export type Headwear = 
  | 'none' 
  | 'cap' 
  | 'beanie' 
  | 'mortarboard' 
  | 'headphones' 
  | 'halo' 
  | 'crown';

export type OutfitTop = 
  | 'hoodie' 
  | 'varsity-jacket' 
  | 'button-down' 
  | 'sweater' 
  | 'lab-coat' 
  | 'casual-tee';

export type OutfitBottom = 
  | 'jeans' 
  | 'chinos' 
  | 'joggers' 
  | 'pleated-skirt' 
  | 'shorts';

export type Shoes = 
  | 'sneakers' 
  | 'boots' 
  | 'loafers' 
  | 'running';

export type CharacterPose = 'idle' | 'wave' | 'study' | 'cheer' | 'read';
export type CharacterMood = 'happy' | 'focused' | 'proud' | 'zen' | 'energetic' | 'sleepy';

export interface CharacterCustomization {
  name: string;
  gender: CharacterGender;
  bodyType: BodyType;
  skinTone: string;
  hairStyle: HairStyle;
  hairColor: string;
  facialHair?: FacialHair;
  facialHairColor?: string;
  eyeColor: string;
  eyewear: Eyewear;
  eyewearColor: string;
  headwear: Headwear;
  headwearColor: string;
  outfitTop: OutfitTop;
  topColor: string;
  topSecondaryColor: string;
  outfitBottom: OutfitBottom;
  bottomColor: string;
  shoes: Shoes;
  shoesColor: string;
  mood: CharacterMood;
  pose: CharacterPose;
  
  // Progression & Stats (synced with Campus Life & study rewards)
  level: number;
  xp: number;
  coins: number;
  energy: number;
  happiness: number;
  hunger: number;
  studyTitle: string;
  unlockedItems: string[];
}

export const SKIN_TONE_PALETTE = [
  { id: 'fair', label: 'Fair Alabaster', color: '#ffdfd3' },
  { id: 'peach', label: 'Warm Peach', color: '#fcd0ba' },
  { id: 'warm-sand', label: 'Warm Sand', color: '#e5b88f' },
  { id: 'olive', label: 'Sunlit Olive', color: '#d2996e' },
  { id: 'tan', label: 'Honey Tan', color: '#bb7e53' },
  { id: 'chestnut', label: 'Rich Chestnut', color: '#8c5332' },
  { id: 'espresso', label: 'Deep Espresso', color: '#54321d' },
  { id: 'ebony', label: 'Obsidian Ebony', color: '#321d13' },
];

export const HAIR_COLOR_PALETTE = [
  { id: 'black', label: 'Jet Black', color: '#171717' },
  { id: 'dark-brown', label: 'Dark Walnut', color: '#382212' },
  { id: 'chestnut', label: 'Warm Chestnut', color: '#66391a' },
  { id: 'auburn', label: 'Auburn Copper', color: '#963d1e' },
  { id: 'blonde', label: 'Golden Honey', color: '#e5b958' },
  { id: 'platinum', label: 'Platinum Silver', color: '#e2e8f0' },
  { id: 'neon-cyan', label: 'Electric Cyan', color: '#06b6d4' },
  { id: 'pastel-pink', label: 'Rose Quartz', color: '#f472b6' },
  { id: 'violet', label: 'Mystic Violet', color: '#8b5cf6' },
  { id: 'emerald', label: 'Deep Emerald', color: '#10b981' },
];

export const EYE_COLOR_PALETTE = [
  { id: 'dark-brown', label: 'Deep Amber Brown', color: '#3b2011' },
  { id: 'hazel', label: 'Golden Hazel', color: '#6e4719' },
  { id: 'sapphire', label: 'Ocean Sapphire', color: '#2563eb' },
  { id: 'emerald', label: 'Emerald Green', color: '#059669' },
  { id: 'slate-gray', label: 'Slate Gray', color: '#475569' },
  { id: 'amethyst', label: 'Amethyst Violet', color: '#7c3aed' },
];

export const TOP_COLOR_PALETTE = [
  { id: 'navy', label: 'Campus Navy', color: '#1e3a8a' },
  { id: 'crimson', label: 'Varsity Crimson', color: '#991b1b' },
  { id: 'emerald', label: 'Oxford Forest', color: '#065f46' },
  { id: 'slate', label: 'Minimalist Slate', color: '#334155' },
  { id: 'cream', label: 'Vanilla Cream', color: '#f1f5f9' },
  { id: 'amber', label: 'Goldenrod Amber', color: '#d97706' },
  { id: 'purple', label: 'Scholar Purple', color: '#581c87' },
  { id: 'coral', label: 'Neon Coral', color: '#e11d48' },
];

export const BOTTOM_COLOR_PALETTE = [
  { id: 'denim-blue', label: 'Classic Denim', color: '#1d4ed8' },
  { id: 'charcoal', label: 'Charcoal Black', color: '#1e293b' },
  { id: 'khaki', label: 'Classic Khaki', color: '#b49f82' },
  { id: 'white', label: 'Crisp White', color: '#f8fafc' },
  { id: 'olive', label: 'Military Olive', color: '#3f4f38' },
  { id: 'crimson', label: 'Burgundy', color: '#7f1d1d' },
];

export const SHOE_COLOR_PALETTE = [
  { id: 'white', label: 'Crisp White', color: '#ffffff' },
  { id: 'black', label: 'Stealth Black', color: '#0f172a' },
  { id: 'leather', label: 'Tan Leather', color: '#78350f' },
  { id: 'red', label: 'Sport Crimson', color: '#dc2626' },
  { id: 'royal', label: 'Royal Blue', color: '#2563eb' },
];

export const HAIR_STYLE_META: Record<HairStyle, { name: string; description: string; icon: string }> = {
  'short-fade': { name: 'Clean Fade', description: 'Modern tapered fade with textured top', icon: '✂️' },
  'curly-afro': { name: 'Curly Afro', description: 'Voluminous, natural defined coils', icon: '🌀' },
  'bob-cut': { name: 'Modern Bob', description: 'Sleek chin-length bob with subtle fringe', icon: '💇' },
  'long-wavy': { name: 'Flowing Waves', description: 'Layered wavy locks falling over shoulders', icon: '🌊' },
  'ponytail': { name: 'High Ponytail', description: 'Active, athletic high ponytail tie', icon: '🎀' },
  'spiky': { name: 'Stylized Spikes', description: 'Dynamic anime-inspired textured locks', icon: '⚡' },
  'side-part': { name: 'Scholar Part', description: 'Classic dapper academic side part', icon: '📖' },
  'buzz': { name: 'Minimal Buzz', description: 'Sharp, ultra-clean cropped buzz', icon: '⭐' },
};

export const FACIAL_HAIR_META: Record<FacialHair, { name: string; description: string; icon: string }> = {
  'none': { name: 'Clean Shaven', description: 'Smooth, clean-shaved jawline', icon: '✨' },
  'stubble': { name: 'Designer Stubble', description: 'Subtle textured 5 o\'clock shadow', icon: '🧔‍♂️' },
  'goatee': { name: 'Neat Goatee', description: 'Sculpted mustache and chin goatee', icon: '🎯' },
  'beard': { name: 'Trimmed Beard', description: 'Full masculine trimmed jawline beard', icon: '🧔' },
};

export const OUTFIT_TOP_META: Record<OutfitTop, { name: string; description: string; icon: string }> = {
  'hoodie': { name: 'Cozy Study Hoodie', description: 'Warm oversized fleece with drawstring hood', icon: '🧥' },
  'varsity-jacket': { name: 'Varsity Jacket', description: 'Collegiate letterman jacket with leather sleeves', icon: '🏆' },
  'button-down': { name: 'Oxford Button-Down', description: 'Tailored scholar shirt with collar', icon: '👔' },
  'sweater': { name: 'Cable Knit Sweater', description: 'Timeless library knit sweater', icon: '🧶' },
  'lab-coat': { name: 'Researcher Lab Coat', description: 'Crisp white coat with pocket pens', icon: '🥼' },
  'casual-tee': { name: 'Campus Relaxed Tee', description: 'Breathable minimalist cotton tee', icon: '👕' },
};

export const OUTFIT_BOTTOM_META: Record<OutfitBottom, { name: string; description: string; icon: string }> = {
  'jeans': { name: 'Straight Denim', description: 'Classic indigo blue wash jeans', icon: '👖' },
  'chinos': { name: 'Tailored Chinos', description: 'Smart casual pressed cotton trousers', icon: '🩳' },
  'joggers': { name: 'Athletic Joggers', description: 'Tapered fleece joggers with ankle ribs', icon: '🏃' },
  'pleated-skirt': { name: 'Pleated Skirt', description: 'Classic collegiate A-line pleated skirt', icon: '👗' },
  'shorts': { name: 'Sport Shorts', description: 'Lightweight summer campus shorts', icon: '🩲' },
};

export const ACCESSORY_META: {
  eyewear: Record<Eyewear, { name: string; icon: string }>;
  headwear: Record<Headwear, { name: string; icon: string }>;
} = {
  eyewear: {
    none: { name: 'None', icon: '🚫' },
    wireframe: { name: 'Wireframe Glasses', icon: '👓' },
    'thick-frame': { name: 'Bold Acetate', icon: '🕶️' },
    round: { name: 'Round Retro', icon: '🔬' },
    sunglasses: { name: 'Cool Shades', icon: '😎' },
  },
  headwear: {
    none: { name: 'None', icon: '🚫' },
    cap: { name: 'Baseball Cap', icon: '🧢' },
    beanie: { name: 'Slouch Beanie', icon: '🧶' },
    mortarboard: { name: 'Scholar Mortarboard', icon: '🎓' },
    headphones: { name: 'Focus Headphones', icon: '🎧' },
    halo: { name: 'Synaptic Halo', icon: '✨' },
    crown: { name: 'Valedictorian Crown', icon: '👑' },
  },
};
