export type VariantTier = 'common' | 'uncommon' | 'rare' | 'shiny';

export const VARIANT_TIERS: VariantTier[] = ['common', 'uncommon', 'rare', 'shiny'];

/** Wild spawn rarity odds, 70/20/9/1, indexed by VARIANT_TIERS. */
export const WILD_RARITY_WEIGHTS: Record<VariantTier, number> = {
  common: 70,
  uncommon: 20,
  rare: 9,
  shiny: 1,
};

/** Catch minigame band width (fraction of the 0..1 ring). Narrower = harder. */
export const CATCH_BAND_WIDTH: Record<VariantTier, number> = {
  common: 0.35,
  uncommon: 0.25,
  rare: 0.15,
  shiny: 0.08,
};

export const COIN_REWARD_BY_VARIANT: Record<VariantTier, number> = {
  common: 5,
  uncommon: 12,
  rare: 30,
  shiny: 100,
};

/** Egg incubation time by offspring variant tier. */
export const EGG_TIMER_MS: Record<VariantTier, number> = {
  common: 10 * 60 * 1000,
  uncommon: 30 * 60 * 1000,
  rare: 2 * 60 * 60 * 1000,
  shiny: 8 * 60 * 60 * 1000,
};

// --- Stats & breeding ---

export const STAT_MIN = 1;
export const STAT_MAX = 100;

/** Chance a stat roll lands near the higher parent (vs. the lower parent). */
export const STAT_INHERIT_HIGH_PARENT_CHANCE = 0.65;
/** +/- jitter applied around the chosen parent's value. */
export const STAT_INHERIT_JITTER = 5;
/** Flat per-stat chance to ignore inheritance and roll fresh 1-100. */
export const STAT_MUTATION_CHANCE = 0.02;

/** Base chance offspring variant upgrades one tier above the higher parent's. */
export const VARIANT_UPGRADE_BASE_CHANCE = 0.15;
/** Extra upgrade chance at Fortune 100 (scales linearly with avg parent Fortune). */
export const VARIANT_UPGRADE_FORTUNE_BONUS_MAX = 0.10;

/** Baseline cooldown before a creature can breed again after producing an egg. */
export const BASE_BREEDING_COOLDOWN_MS = 5 * 60 * 1000;
/** Max cooldown reduction at Vitality 100 (scales linearly with avg parent Vitality). */
export const VITALITY_COOLDOWN_REDUCTION_MAX = 0.5;

// --- Passive income ---

/** Coins per second, per point of Charm, while a creature wanders the Grove. */
export const CHARM_COIN_RATE_PER_SEC = 0.02;

// --- Spawning ---

export const SPAWN_INTERVAL_MIN_MS = 60 * 1000;
export const SPAWN_INTERVAL_MAX_MS = 120 * 1000;
export const OFFLINE_SPAWN_CAP = 5;

// --- Catch minigame (rendering) ---

/** How long the ring takes to shrink from full to zero radius. */
export const CATCH_RING_DURATION_MS = 1600;

// --- Rewarded ad placements ---

export interface AdPlacementConfig {
  id: string;
  capPerDay: number | null;
  cooldownMs: number;
}

export const AD_PLACEMENTS: Record<string, AdPlacementConfig> = {
  doubleCatchReward: { id: 'doubleCatchReward', capPerDay: null, cooldownMs: 90 * 1000 },
  instantHatch: { id: 'instantHatch', capPerDay: 3, cooldownMs: 0 },
  spawnSurge: { id: 'spawnSurge', capPerDay: 4, cooldownMs: 0 },
  dailyGiftUpgrade: { id: 'dailyGiftUpgrade', capPerDay: 1, cooldownMs: 0 },
  secondChance: { id: 'secondChance', capPerDay: null, cooldownMs: 0 },
};

export const GLOBAL_AD_DAILY_CAP = 20;
export const AD_PROMPT_COOLDOWN_MS = 60 * 1000;
