import type { CharacterCustomization, Shoes } from '../../../../types/character';
import {
  HAIR_STYLE_META, FACIAL_HAIR_META, OUTFIT_TOP_META, OUTFIT_BOTTOM_META, ACCESSORY_META,
} from '../../../../types/character';
import type { BoneName } from '../avatar/rig';
import type { QualityTier } from './quality';
import type { JointMorphs } from './skeletonShape';

/**
 * The avatar asset manifest (`public/avatar/manifest.json`), written by the
 * offline pipeline in tools/avatar-pipeline. It lists one glTF per item and
 * quality tier, so the runtime never hard-codes asset paths.
 *
 * Asset conventions the pipeline guarantees:
 * - Metres, +Y up, facing +Z, feet on y = 0.
 * - The base is one skinned scene (body, eyes, teeth, brows, lashes). Body
 *   meshes carry a `_HIDE` vertex attribute: a bit mask of the items a vertex
 *   sits under (see ItemEntry.hideBit), so skin under clothes is not drawn.
 * - Body-shape morph targets are named `gender_male`, `gender_female`,
 *   `build_slender`, `build_athletic` (all zero = neutral, average build), and
 *   every skinned garment carries the same ones so it follows the body.
 *   Morphs that move joints list per-bone offsets in `jointMorphs`.
 * - Facial morph targets use the 52 ARKit blend-shape names (see expressions.ts).
 * - Material names start with a colour role (see MATERIAL_ROLES in materialsV2.ts).
 */
export const MANIFEST_URL = '/avatar/manifest.json';

export type Slot = 'hair' | 'facialHair' | 'top' | 'bottom' | 'shoes' | 'headwear' | 'eyewear';

export interface AssetRef {
  /** URL per quality tier; missing tiers fall back to the nearest one. */
  files: Partial<Record<QualityTier, string>>;
  bytes?: Partial<Record<QualityTier, number>>;
}

export interface ItemEntry extends AssetRef {
  /** Rigid items (hair, hats, glasses) are parented to this bone of the base. */
  attach?: string;
  /** Bit in the body's `_HIDE` mask for the skin this item covers. */
  hideBit?: number;
}

export interface AvatarManifest {
  version: 1;
  base: AssetRef;
  /** Base skeleton bone name for each bone the animator drives. */
  boneMap: Record<BoneName, string>;
  jointMorphs?: JointMorphs;
  items: Partial<Record<Slot, Record<string, ItemEntry>>>;
}

/** Which customization field picks each slot, and whether it may be empty. */
export const SLOT_FIELDS: Record<Slot, { field: keyof CharacterCustomization; required: boolean }> = {
  hair: { field: 'hairStyle', required: false },
  facialHair: { field: 'facialHair', required: false },
  top: { field: 'outfitTop', required: true },
  bottom: { field: 'outfitBottom', required: true },
  shoes: { field: 'shoes', required: true },
  headwear: { field: 'headwear', required: false },
  eyewear: { field: 'eyewear', required: false },
};

// Shoes have no META table; a Record keeps this list in step with the type.
const SHOES: Record<Shoes, true> = { sneakers: true, boots: true, loafers: true, running: true };

/** Every option id the customizer offers, per slot ('none' excluded). */
export const SLOT_IDS: Record<Slot, string[]> = {
  hair: Object.keys(HAIR_STYLE_META),
  facialHair: Object.keys(FACIAL_HAIR_META).filter((k) => k !== 'none'),
  top: Object.keys(OUTFIT_TOP_META),
  bottom: Object.keys(OUTFIT_BOTTOM_META),
  shoes: Object.keys(SHOES),
  headwear: Object.keys(ACCESSORY_META.headwear).filter((k) => k !== 'none'),
  eyewear: Object.keys(ACCESSORY_META.eyewear).filter((k) => k !== 'none'),
};

const TIER_FALLBACK: Record<QualityTier, QualityTier[]> = {
  high: ['high', 'medium', 'low'],
  medium: ['medium', 'low', 'high'],
  low: ['low', 'medium', 'high'],
};

export function assetUrl(ref: AssetRef, tier: QualityTier): string | null {
  for (const t of TIER_FALLBACK[tier]) if (ref.files[t]) return ref.files[t]!;
  return null;
}

export interface ResolvedItem {
  slot: Slot;
  /** The id actually used (differs from `requested` when it fell back). */
  id: string;
  requested: string;
  entry: ItemEntry;
  url: string;
}

/**
 * Picks the asset for every slot. Saved avatars may carry ids the manifest
 * doesn't have yet (or ever): a required slot then falls back to its first
 * item and an optional one is left empty, so loading never fails on data.
 */
export function resolveItems(m: AvatarManifest, c: CharacterCustomization, tier: QualityTier): ResolvedItem[] {
  const out: ResolvedItem[] = [];
  for (const slot of Object.keys(SLOT_FIELDS) as Slot[]) {
    const { field, required } = SLOT_FIELDS[slot];
    const requested = String(c[field] ?? 'none');
    if (requested === 'none') continue;
    const items = m.items[slot] ?? {};
    let id = requested in items ? requested : null;
    if (!id && required) id = Object.keys(items)[0] ?? null;
    if (!id) continue;
    const url = assetUrl(items[id], tier);
    if (url) out.push({ slot, id, requested, entry: items[id], url });
  }
  return out;
}

/** Option ids the customizer offers that the manifest has no asset for. */
export function missingItems(m: AvatarManifest): Partial<Record<Slot, string[]>> {
  const missing: Partial<Record<Slot, string[]>> = {};
  for (const slot of Object.keys(SLOT_IDS) as Slot[]) {
    const ids = SLOT_IDS[slot].filter((id) => !m.items[slot]?.[id]);
    if (ids.length) missing[slot] = ids;
  }
  return missing;
}

export function isManifest(x: unknown): x is AvatarManifest {
  const m = x as AvatarManifest;
  return Boolean(m && m.version === 1 && m.base?.files && m.boneMap && m.items);
}

let manifestPromise: Promise<AvatarManifest | null> | null = null;

/** Fetches the manifest once; resolves null when there isn't a valid one. */
export function loadManifest(url = MANIFEST_URL): Promise<AvatarManifest | null> {
  manifestPromise ??= fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (isManifest(j) ? j : null))
    .catch(() => null);
  return manifestPromise;
}
