import {
  BASE_BREEDING_COOLDOWN_MS,
  EGG_TIMER_MS,
  STAT_INHERIT_HIGH_PARENT_CHANCE,
  STAT_INHERIT_JITTER,
  STAT_MAX,
  STAT_MIN,
  STAT_MUTATION_CHANCE,
  VARIANT_TIERS,
  VARIANT_UPGRADE_BASE_CHANCE,
  VARIANT_UPGRADE_FORTUNE_BONUS_MAX,
  VITALITY_COOLDOWN_REDUCTION_MAX,
  VariantTier,
} from '../data/economy';
import { Creature, CreatureStats } from './creature';
import { Rng, chance, randInt } from './rng';

function clampStat(value: number): number {
  return Math.min(STAT_MAX, Math.max(STAT_MIN, value));
}

/** One stat's inheritance roll: 2% flat mutation (fresh 1-100), else 65%
 * toward the higher parent's value (+/-5 jitter), 35% toward the lower. */
export function inheritStat(rng: Rng, parentA: number, parentB: number): number {
  if (chance(rng, STAT_MUTATION_CHANCE)) {
    return randInt(rng, STAT_MIN, STAT_MAX);
  }
  const higher = Math.max(parentA, parentB);
  const lower = Math.min(parentA, parentB);
  const target = chance(rng, STAT_INHERIT_HIGH_PARENT_CHANCE) ? higher : lower;
  const jitter = randInt(rng, -STAT_INHERIT_JITTER, STAT_INHERIT_JITTER);
  return clampStat(target + jitter);
}

export function inheritStats(rng: Rng, a: CreatureStats, b: CreatureStats): CreatureStats {
  return {
    charm: inheritStat(rng, a.charm, b.charm),
    vitality: inheritStat(rng, a.vitality, b.vitality),
    fortune: inheritStat(rng, a.fortune, b.fortune),
  };
}

/** Offspring variant = the higher parent's tier, with a 15% (+Fortune bonus)
 * chance to upgrade one tier (capped at Shiny). */
export function inheritVariant(rng: Rng, a: VariantTier, b: VariantTier, avgFortune: number): VariantTier {
  const baseIndex = Math.max(VARIANT_TIERS.indexOf(a), VARIANT_TIERS.indexOf(b));
  const fortuneBonus = (avgFortune / STAT_MAX) * VARIANT_UPGRADE_FORTUNE_BONUS_MAX;
  const upgradeChance = VARIANT_UPGRADE_BASE_CHANCE + fortuneBonus;
  const upgraded = baseIndex < VARIANT_TIERS.length - 1 && chance(rng, upgradeChance);
  return VARIANT_TIERS[upgraded ? baseIndex + 1 : baseIndex];
}

/** Higher Vitality shortens the cooldown before parents can breed again,
 * up to a 50% reduction at Vitality 100. */
export function breedingCooldownMs(avgVitality: number): number {
  const reduction = (avgVitality / STAT_MAX) * VITALITY_COOLDOWN_REDUCTION_MAX;
  return BASE_BREEDING_COOLDOWN_MS * (1 - reduction);
}

export interface BreedResult {
  stats: CreatureStats;
  variant: VariantTier;
  eggTimerMs: number;
  cooldownMs: number;
}

export function breed(rng: Rng, parentA: Creature, parentB: Creature): BreedResult {
  const stats = inheritStats(rng, parentA.stats, parentB.stats);
  const avgFortune = (parentA.stats.fortune + parentB.stats.fortune) / 2;
  const avgVitality = (parentA.stats.vitality + parentB.stats.vitality) / 2;
  const variant = inheritVariant(rng, parentA.variant, parentB.variant, avgFortune);
  return {
    stats,
    variant,
    eggTimerMs: EGG_TIMER_MS[variant],
    cooldownMs: breedingCooldownMs(avgVitality),
  };
}
