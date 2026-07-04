import { describe, expect, it } from 'vitest';
import { chance, createRng, randInt, weightedIndex } from './rng';

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a()).not.toEqual(b());
  });

  it('always returns values in [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('randInt', () => {
  it('stays within [min, max] and covers the range', () => {
    const rng = createRng(123);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = randInt(rng, 1, 5);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect(seen.size).toBe(5);
  });
});

describe('chance', () => {
  it('approximates the requested probability over many trials', () => {
    const rng = createRng(99);
    let hits = 0;
    const trials = 20000;
    for (let i = 0; i < trials; i++) {
      if (chance(rng, 0.3)) hits++;
    }
    expect(hits / trials).toBeGreaterThan(0.28);
    expect(hits / trials).toBeLessThan(0.32);
  });
});

describe('weightedIndex', () => {
  it('respects relative weights over many trials', () => {
    const rng = createRng(555);
    const counts = [0, 0, 0];
    const trials = 30000;
    for (let i = 0; i < trials; i++) {
      counts[weightedIndex(rng, [70, 20, 10])]++;
    }
    expect(counts[0] / trials).toBeGreaterThan(0.65);
    expect(counts[0] / trials).toBeLessThan(0.75);
    expect(counts[2] / trials).toBeGreaterThan(0.06);
    expect(counts[2] / trials).toBeLessThan(0.14);
  });
});
