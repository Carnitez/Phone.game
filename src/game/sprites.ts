import Phaser from 'phaser';
import { VariantTier, VARIANT_TIERS } from '../data/economy';

const TEXTURE_PREFIX = 'creature-';
const SPRITE_SIZE = 64;

const VARIANT_COLOR: Record<VariantTier, number> = {
  common: 0x8bc34a,
  uncommon: 0x42a5f5,
  rare: 0xab47bc,
  shiny: 0xffd54f,
};

export function creatureTextureKey(variant: VariantTier): string {
  return `${TEXTURE_PREFIX}${variant}`;
}

/**
 * Generates one placeholder texture per variant tier — a colored blob with
 * eyes, drawn in code (no image assets). Real art can replace this later by
 * loading a sprite sheet and swapping what `creatureTextureKey` returns to
 * atlas frame names; nothing calling it needs to change.
 */
export function generateCreatureTextures(scene: Phaser.Scene): void {
  for (const variant of VARIANT_TIERS) {
    const key = creatureTextureKey(variant);
    if (scene.textures.exists(key)) continue;

    const g = scene.add.graphics();
    const center = SPRITE_SIZE / 2;

    g.fillStyle(VARIANT_COLOR[variant], 1);
    g.fillCircle(center, center, center - 4);

    if (variant === 'shiny') {
      g.lineStyle(3, 0xffffff, 0.9);
      g.strokeCircle(center, center, center - 2);
    }

    g.fillStyle(0x222222, 1);
    g.fillCircle(center - 12, center - 6, 5);
    g.fillCircle(center + 12, center - 6, 5);

    g.generateTexture(key, SPRITE_SIZE, SPRITE_SIZE);
    g.destroy();
  }
}
