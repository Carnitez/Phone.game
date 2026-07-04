import { describe, expect, it } from 'vitest';
import { bandForVariant, resolveCatch, rollWildVariant } from './catch';
import { createRng } from './rng';
import { WILD_RARITY_WEIGHTS } from '../data/economy';

describe('resolveCatch', () => {
  it('succeeds when the tap lands inside the band', () => {
    const band = bandForVariant('common', 0.5);
    const edge = band.width / 2 - 0.001;
    expect(resolveCatch(0.5, band)).toBe(true);
    expect(resolveCatch(0.5 + edge, band)).toBe(true);
    expect(resolveCatch(0.5 - edge, band)).toBe(true);
  });

  it('fails when the tap lands outside the band', () => {
    const band = bandForVariant('shiny', 0.5);
    expect(resolveCatch(0.5 + band.width, band)).toBe(false);
  });

  it('narrows the band as rarity increases', () => {
    const common = bandForVariant('common');
    const uncommon = bandForVariant('uncommon');
    const rare = bandForVariant('rare');
    const shiny = bandForVariant('shiny');
    expect(common.width).toBeGreaterThan(uncommon.width);
    expect(uncommon.width).toBeGreaterThan(rare.width);
    expect(rare.width).toBeGreaterThan(shiny.width);
  });
});

describe('rollWildVariant', () => {
  it('matches the 70/20/9/1 rarity table within 2% over 10,000 rolls', () => {
    const rng = createRng(2024);
    const counts = { common: 0, uncommon: 0, rare: 0, shiny: 0 };
    const trials = 10000;
    for (let i = 0; i < trials; i++) {
      counts[rollWildVariant(rng)]++;
    }
    for (const tier of Object.keys(WILD_RARITY_WEIGHTS) as (keyof typeof WILD_RARITY_WEIGHTS)[]) {
      const expected = WILD_RARITY_WEIGHTS[tier] / 100;
      const actual = counts[tier] / trials;
      expect(Math.abs(actual - expected)).toBeLessThan(0.02);
    }
  });
});
