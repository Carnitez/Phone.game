import { describe, expect, it } from 'vitest';
import {
  breed,
  breedingCooldownMs,
  canBreed,
  inheritStat,
  inheritVariant,
} from './breeding';
import { createRng } from './rng';
import {
  BASE_BREEDING_COOLDOWN_MS,
  EGG_TIMER_MS,
  STAT_INHERIT_HIGH_PARENT_CHANCE,
  STAT_MUTATION_CHANCE,
  VARIANT_UPGRADE_BASE_CHANCE,
  VARIANT_UPGRADE_FORTUNE_BONUS_MAX,
} from '../data/economy';
import { Creature, createCreature } from './creature';

const TOLERANCE = 0.02; // spec: "within 2%"
const TRIALS = 10000;

describe('inheritStat distribution (10,000 rolls)', () => {
  it('matches the 65/35 high/low split within 2%, jitter respected', () => {
    const rng = createRng(1234);
    const lower = 10;
    const higher = 90;
    let nearHigher = 0;
    let nearLower = 0;
    for (let i = 0; i < TRIALS; i++) {
      const value = inheritStat(rng, lower, higher);
      if (value >= higher - 5 && value <= higher + 5) nearHigher++;
      else if (value >= lower - 5 && value <= lower + 5) nearLower++;
    }
    const highRatio = nearHigher / TRIALS;
    const lowRatio = nearLower / TRIALS;
    // Mutation (2% of rolls, fresh 1-100) contributes a small share to both
    // bands too, so allow the full spec tolerance around the pure figures.
    expect(Math.abs(highRatio - STAT_INHERIT_HIGH_PARENT_CHANCE)).toBeLessThan(TOLERANCE);
    expect(Math.abs(lowRatio - (1 - STAT_INHERIT_HIGH_PARENT_CHANCE))).toBeLessThan(TOLERANCE);
  });

  it('matches the 2% flat mutation rate within 2%', () => {
    const rng = createRng(5678);
    const lower = 10;
    const higher = 90;
    // Values in (15, 85) are only reachable via a mutation's fresh 1-100 roll,
    // since inheritance-without-mutation only ever lands in [5,15] or [85,95].
    const gapLow = 16;
    const gapHigh = 84;
    const gapWidth = gapHigh - gapLow + 1;
    let inGap = 0;
    for (let i = 0; i < TRIALS; i++) {
      const value = inheritStat(rng, lower, higher);
      if (value >= gapLow && value <= gapHigh) inGap++;
    }
    const estimatedMutationRate = inGap / TRIALS / (gapWidth / 100);
    expect(Math.abs(estimatedMutationRate - STAT_MUTATION_CHANCE)).toBeLessThan(TOLERANCE);
  });

  it('never leaves the 1-100 range even with edge-value parents', () => {
    const rng = createRng(4242);
    for (let i = 0; i < TRIALS; i++) {
      const value = inheritStat(rng, 1, 100);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});

describe('inheritVariant distribution (10,000 rolls)', () => {
  it('upgrades from the higher parent tier at ~15% with zero Fortune', () => {
    const rng = createRng(111);
    let upgraded = 0;
    for (let i = 0; i < TRIALS; i++) {
      const variant = inheritVariant(rng, 'common', 'common', 0);
      if (variant !== 'common') upgraded++;
    }
    expect(Math.abs(upgraded / TRIALS - VARIANT_UPGRADE_BASE_CHANCE)).toBeLessThan(TOLERANCE);
  });

  it('upgrades more often as Fortune rises, per the bonus formula', () => {
    const rng = createRng(222);
    let upgraded = 0;
    for (let i = 0; i < TRIALS; i++) {
      const variant = inheritVariant(rng, 'common', 'common', 100);
      if (variant !== 'common') upgraded++;
    }
    const expected = VARIANT_UPGRADE_BASE_CHANCE + VARIANT_UPGRADE_FORTUNE_BONUS_MAX;
    expect(Math.abs(upgraded / TRIALS - expected)).toBeLessThan(TOLERANCE);
  });

  it('takes the higher of two different parent tiers as the base', () => {
    const rng = createRng(333);
    for (let i = 0; i < 100; i++) {
      const variant = inheritVariant(rng, 'common', 'rare', 0);
      expect(['rare', 'shiny']).toContain(variant);
    }
  });

  it('never upgrades past shiny', () => {
    const rng = createRng(444);
    for (let i = 0; i < TRIALS; i++) {
      expect(inheritVariant(rng, 'shiny', 'shiny', 100)).toBe('shiny');
    }
  });
});

describe('breedingCooldownMs', () => {
  it('applies no reduction at Vitality 0', () => {
    expect(breedingCooldownMs(0)).toBe(BASE_BREEDING_COOLDOWN_MS);
  });

  it('applies the max 50% reduction at Vitality 100', () => {
    expect(breedingCooldownMs(100)).toBe(BASE_BREEDING_COOLDOWN_MS * 0.5);
  });
});

describe('breed', () => {
  const now = 1000;
  const parentA: Creature = createCreature('meadow-hoplet', 'common', { charm: 10, vitality: 100, fortune: 100 }, now);
  const parentB: Creature = createCreature('meadow-hoplet', 'common', { charm: 90, vitality: 0, fortune: 0 }, now);

  it('assigns the egg timer matching the offspring variant tier', () => {
    const rng = createRng(9);
    const result = breed(rng, parentA, parentB);
    expect(result.eggTimerMs).toBe(EGG_TIMER_MS[result.variant]);
  });

  it('derives cooldown from the average parent Vitality', () => {
    const rng = createRng(9);
    const result = breed(rng, parentA, parentB);
    expect(result.cooldownMs).toBe(breedingCooldownMs(50));
  });
});

describe('canBreed', () => {
  const now = 10_000;
  const base = { charm: 50, vitality: 50, fortune: 50 };

  it('allows two distinct, off-cooldown creatures of the same species', () => {
    const a = createCreature('meadow-hoplet', 'common', base, now);
    const b = createCreature('meadow-hoplet', 'common', base, now);
    expect(canBreed(a, b, now)).toBe(true);
  });

  it('rejects breeding a creature with itself', () => {
    const a = createCreature('meadow-hoplet', 'common', base, now);
    expect(canBreed(a, a, now)).toBe(false);
  });

  it('rejects different species', () => {
    const a = createCreature('meadow-hoplet', 'common', base, now);
    const b = createCreature('pond-glimmerfin', 'common', base, now);
    expect(canBreed(a, b, now)).toBe(false);
  });

  it('rejects a creature still on its breeding cooldown', () => {
    const a = createCreature('meadow-hoplet', 'common', base, now);
    const b = createCreature('meadow-hoplet', 'common', base, now);
    a.breedingCooldownUntil = now + 1000;
    expect(canBreed(a, b, now)).toBe(false);
  });
});
