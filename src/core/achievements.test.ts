import { describe, expect, it } from 'vitest';
import { newlyCompletedAchievements } from './achievements';

describe('newlyCompletedAchievements', () => {
  it('returns achievements whose check is met and not yet claimed', () => {
    const result = newlyCompletedAchievements(
      { totalCatches: 1, totalHatches: 0, unlockedBiomes: ['meadow'], ownsShiny: false },
      [],
    );
    expect(result.map((a) => a.id)).toEqual(['first-catch']);
  });

  it('excludes achievements already claimed', () => {
    const result = newlyCompletedAchievements(
      { totalCatches: 1, totalHatches: 0, unlockedBiomes: ['meadow'], ownsShiny: false },
      ['first-catch'],
    );
    expect(result).toEqual([]);
  });

  it('unlocks biome-gated and shiny-ownership achievements independently', () => {
    const result = newlyCompletedAchievements(
      { totalCatches: 0, totalHatches: 0, unlockedBiomes: ['meadow', 'pond'], ownsShiny: true },
      [],
    );
    const ids = result.map((a) => a.id);
    expect(ids).toContain('unlock-pond');
    expect(ids).toContain('own-shiny');
    expect(ids).not.toContain('unlock-forest');
  });

  it('returns multiple newly-met achievements at once', () => {
    const result = newlyCompletedAchievements(
      { totalCatches: 50, totalHatches: 1, unlockedBiomes: ['meadow'], ownsShiny: false },
      [],
    );
    const ids = result.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['first-catch', 'catch-10', 'catch-50', 'first-hatch']));
  });
});
