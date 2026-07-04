import { describe, expect, it } from 'vitest';
import { createCreature, createCreatureId, rollRandomStats } from './creature';
import { createRng } from './rng';

describe('createCreatureId', () => {
  it('produces unique ids across calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createCreatureId()));
    expect(ids.size).toBe(100);
  });
});

describe('rollRandomStats', () => {
  it('rolls each stat within 1-100', () => {
    const rng = createRng(1);
    for (let i = 0; i < 500; i++) {
      const stats = rollRandomStats(rng);
      for (const value of Object.values(stats)) {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('createCreature', () => {
  it('builds a creature with the given species, variant, and stats', () => {
    const stats = { charm: 10, vitality: 20, fortune: 30 };
    const creature = createCreature('meadow-hoplet', 'rare', stats, 12345);
    expect(creature.speciesId).toBe('meadow-hoplet');
    expect(creature.variant).toBe('rare');
    expect(creature.stats).toEqual(stats);
    expect(creature.caughtAt).toBe(12345);
    expect(creature.breedingCooldownUntil).toBe(0);
    expect(creature.id).toBeTruthy();
  });
});
