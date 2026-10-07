import type { HairStyle, Headwear } from '../../../../types/character';
import type { Sdf } from '../sdf/sdf';

/**
 * How far hair extends above and around the cranium for each style, so hats
 * can sit on top of the hair rather than inside it.
 */
export function hairVolume(style: HairStyle): { lift: number; grow: number } {
  switch (style) {
    case 'curly-afro': return { lift: 0.05, grow: 0.06 };
    case 'spiky': return { lift: 0.022, grow: 0.016 };
    case 'side-part':
    case 'short-fade': return { lift: 0.022, grow: 0.014 };
    case 'bob-cut':
    case 'long-wavy': return { lift: 0.02, grow: 0.022 };
    case 'ponytail': return { lift: 0.012, grow: 0.012 };
    case 'buzz':
    default: return { lift: 0.004, grow: 0.004 };
  }
}

/** Hats with a crown that covers the top of the head (hair is tucked inside). */
export function coversHair(kind: Headwear): boolean {
  return kind === 'cap' || kind === 'beanie' || kind === 'mortarboard';
}

/**
 * The region a hat's crown covers (head-bone space), or null for hats that
 * don't cover the hair: everything above the hat's edge line. Hair there is
 * removed so nothing pokes through; below the edge line hair still shows.
 */
export function hatInterior(kind: Headwear, hair: HairStyle): Sdf | null {
  if (!coversHair(kind)) return null;
  const { lift } = hairVolume(hair);
  // Edge line of each hat: front higher than back, as in headwearMeshSpec.
  // Offset slightly so the cut hair edge stays tucked under the brim/cuff.
  if (kind === 'beanie') return (_x, y, z) => 0.155 + lift * 0.3 + 0.2 * z - y + 0.006;
  if (kind === 'cap') return (_x, y, z) => 0.168 + lift * 0.4 + 0.22 * z - y + 0.006;
  return (_x, y, z) => 0.17 + lift * 0.3 + 0.18 * z - y + 0.006;
}
