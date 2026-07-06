import Phaser from 'phaser';
import { SPECIES } from '../data/species';
import { VariantTier } from '../data/economy';

const TEXTURE_PREFIX = 'creature-';

/** One real sprite per species, reused across all four rarity tiers — an MVP
 * decision to skip separate art per variant (see CLAUDE.md DECISIONS). Rarity
 * shows up via the badge (`rarityBadgeColor`) in contexts that render one,
 * plus stats and catch difficulty; Shiny gets real distinct art post-MVP. */
export function creatureTextureKey(speciesId: string): string {
  return `${TEXTURE_PREFIX}${speciesId}`;
}

/** Queues every species' sprite for loading — call from a scene's preload(). */
export function preloadCreatureImages(scene: Phaser.Scene): void {
  SPECIES.forEach((species) => {
    scene.load.image(creatureTextureKey(species.id), `/creatures/${species.name.toLowerCase()}.png`);
  });
}

const BADGE_COLOR: Partial<Record<VariantTier, number>> = {
  uncommon: 0x42a5f5,
  rare: 0xab47bc,
  shiny: 0xffd54f,
};

/** Small rarity indicator color for non-common variants, or null for common
 * (no badge — common is the unmarked default). */
export function rarityBadgeColor(variant: VariantTier): number | null {
  return BADGE_COLOR[variant] ?? null;
}
