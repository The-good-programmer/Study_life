/**
 * Rendering quality tiers, shared by every 3D canvas. Phones get a lighter
 * tier (fewer pixels, smaller shadow maps, no screen-space AO, 1K textures)
 * so the avatar stays smooth on mid-range hardware.
 */
export type QualityTier = 'high' | 'medium' | 'low';

export const QUALITY_OVERRIDE_KEY = 'studify_avatar_quality';

export interface DeviceSignals {
  coarsePointer: boolean;
  cores: number;
  /** navigator.deviceMemory in GB (Chromium only); undefined elsewhere. */
  memoryGb?: number;
  override?: string | null;
}

export interface TierSettings {
  maxPixelRatio: number;
  shadowMapSize: number;
  /** Screen-space ambient occlusion (GTAO) post-process. */
  ambientOcclusion: boolean;
  /** Texture set loaded from the avatar asset manifest. */
  textureTier: QualityTier;
}

export const TIER_SETTINGS: Record<QualityTier, TierSettings> = {
  high: { maxPixelRatio: 2, shadowMapSize: 2048, ambientOcclusion: true, textureTier: 'high' },
  medium: { maxPixelRatio: 1.5, shadowMapSize: 1024, ambientOcclusion: false, textureTier: 'medium' },
  low: { maxPixelRatio: 1, shadowMapSize: 512, ambientOcclusion: false, textureTier: 'low' },
};

const isTier = (v: unknown): v is QualityTier => v === 'high' || v === 'medium' || v === 'low';

export function tierFromSignals(s: DeviceSignals): QualityTier {
  if (isTier(s.override)) return s.override;
  if (s.cores <= 2 || (s.memoryGb !== undefined && s.memoryGb <= 2)) return 'low';
  if (s.coarsePointer || s.cores <= 4 || (s.memoryGb !== undefined && s.memoryGb <= 4)) return 'medium';
  return 'high';
}

export function readDeviceSignals(): DeviceSignals {
  let override: string | null = null;
  try {
    override = localStorage.getItem(QUALITY_OVERRIDE_KEY);
  } catch {
    // Storage blocked (private mode): no override.
  }
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { deviceMemory?: number });
  return {
    coarsePointer: typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches),
    cores: nav?.hardwareConcurrency ?? 4,
    memoryGb: nav?.deviceMemory,
    override,
  };
}

let cached: QualityTier | null = null;

/** The device's tier, detected once per page load. */
export function getQualityTier(): QualityTier {
  cached ??= tierFromSignals(readDeviceSignals());
  return cached;
}

export const getTierSettings = (tier: QualityTier = getQualityTier()) => TIER_SETTINGS[tier];
