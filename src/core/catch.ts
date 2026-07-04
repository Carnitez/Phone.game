import { CATCH_BAND_WIDTH, VariantTier, VARIANT_TIERS, WILD_RARITY_WEIGHTS } from '../data/economy';
import { Rng, weightedIndex } from './rng';

export interface CatchBand {
  /** Center of the target band on the ring, 0..1. */
  center: number;
  /** Width of the target band on the ring, 0..1. */
  width: number;
}

/** Builds the catch-minigame target band for a given rarity. Band is centered
 * on the ring (callers may randomize `center` for variety; resolution only
 * cares about the offset from it). */
export function bandForVariant(variant: VariantTier, center = 0.5): CatchBand {
  return { center, width: CATCH_BAND_WIDTH[variant] };
}

/** Resolves a catch attempt: did the tap (ring value 0..1) land inside the band? */
export function resolveCatch(tapValue: number, band: CatchBand): boolean {
  const distance = Math.abs(tapValue - band.center);
  return distance <= band.width / 2;
}

/** Rolls a wild spawn's variant tier per the rarity table (70/20/9/1). */
export function rollWildVariant(rng: Rng): VariantTier {
  return VARIANT_TIERS[weightedIndex(rng, VARIANT_TIERS.map((tier) => WILD_RARITY_WEIGHTS[tier]))];
}
