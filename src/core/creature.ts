import type { VariantTier } from '../data/economy';
import { Rng, randInt } from './rng';
import { STAT_MAX, STAT_MIN } from '../data/economy';

export interface CreatureStats {
  charm: number;
  vitality: number;
  fortune: number;
}

export interface Creature {
  id: string;
  speciesId: string;
  variant: VariantTier;
  stats: CreatureStats;
  caughtAt: number;
  breedingCooldownUntil: number;
}

let nextCreatureSeq = 0;

/** Deterministic id generator — avoids Date.now()/Math.random() so callers
 * stay testable; seq resets per process which is fine, ids only need to be
 * unique within a single save. */
export function createCreatureId(): string {
  nextCreatureSeq += 1;
  return `creature-${nextCreatureSeq}`;
}

export function rollRandomStats(rng: Rng): CreatureStats {
  return {
    charm: randInt(rng, STAT_MIN, STAT_MAX),
    vitality: randInt(rng, STAT_MIN, STAT_MAX),
    fortune: randInt(rng, STAT_MIN, STAT_MAX),
  };
}

export function createCreature(
  speciesId: string,
  variant: VariantTier,
  stats: CreatureStats,
  now: number,
): Creature {
  return {
    id: createCreatureId(),
    speciesId,
    variant,
    stats,
    caughtAt: now,
    breedingCooldownUntil: 0,
  };
}
