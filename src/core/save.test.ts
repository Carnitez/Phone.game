import { describe, expect, it } from 'vitest';
import { createDefaultSave, migrateSave, SaveDataV1, SAVE_SCHEMA_VERSION } from './save';
import { createAdState, createDailyGiftState } from './economy';
import { INCUBATOR_BASE_SLOTS } from '../data/economy';

describe('createDefaultSave', () => {
  it('produces a fresh, empty save at the current schema version', () => {
    const save = createDefaultSave(1000);
    expect(save.version).toBe(SAVE_SCHEMA_VERSION);
    expect(save.coins).toBe(0);
    expect(save.gems).toBe(0);
    expect(save.creatures).toEqual([]);
    expect(save.eggs).toEqual([]);
    expect(save.incubatorSlots).toBe(2);
  });
});

describe('migrateSave', () => {
  it('passes through a save already at the current version', () => {
    const original = createDefaultSave(500);
    original.coins = 42;
    const migrated = migrateSave(original, 1000);
    expect(migrated).toEqual(original);
  });

  it('recovers with a fresh save when given corrupted data', () => {
    const migrated = migrateSave({ garbage: true }, 1000);
    expect(migrated.version).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.coins).toBe(0);
  });

  it('recovers with a fresh save when given null/undefined', () => {
    expect(migrateSave(null, 1000).version).toBe(SAVE_SCHEMA_VERSION);
    expect(migrateSave(undefined, 1000).version).toBe(SAVE_SCHEMA_VERSION);
  });

  it('recovers with a fresh save when the version is newer than supported', () => {
    const fromTheFuture = { version: SAVE_SCHEMA_VERSION + 1 };
    const migrated = migrateSave(fromTheFuture, 1000);
    expect(migrated.version).toBe(SAVE_SCHEMA_VERSION);
  });

  it('recovers with a fresh save when the version is older than any known migration', () => {
    const ancient = { version: -1 };
    const migrated = migrateSave(ancient, 1000);
    expect(migrated.version).toBe(SAVE_SCHEMA_VERSION);
  });

  it('migrates a real v1 save, backfilling lifetime stats and unlocked biomes from existing creatures', () => {
    const v1: SaveDataV1 = {
      version: 1,
      coins: 250,
      gems: 3,
      creatures: [
        { id: 'c1', speciesId: 'meadow-hoplet', variant: 'common', stats: { charm: 10, vitality: 10, fortune: 10 }, caughtAt: 100, breedingCooldownUntil: 0 },
        { id: 'c2', speciesId: 'pond-glimmerfin', variant: 'rare', stats: { charm: 20, vitality: 20, fortune: 20 }, caughtAt: 200, breedingCooldownUntil: 0 },
      ],
      eggs: [],
      decorations: [],
      entitlements: [],
      incubatorSlots: INCUBATOR_BASE_SLOTS,
      lastOpenedAt: 900,
      adState: createAdState(900),
      dailyGift: createDailyGiftState(),
    };

    const migrated = migrateSave(v1, 1000);

    expect(migrated.version).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.coins).toBe(250);
    expect(migrated.gems).toBe(3);
    expect(migrated.creatures).toEqual(v1.creatures);
    expect(migrated.lifetimeStats).toEqual({ totalCatches: 2, totalHatches: 0 });
    expect(new Set(migrated.unlockedBiomes)).toEqual(new Set(['meadow', 'pond']));
    expect(migrated.claimedMilestones).toEqual([]);
    expect(migrated.claimedAchievements).toEqual([]);
    expect(migrated.dailyQuests.progress).toEqual({});
    expect(migrated.dailyQuests.claimed).toEqual([]);
  });

  it('always includes meadow in unlockedBiomes even if the player has no creatures yet', () => {
    const v1: SaveDataV1 = {
      version: 1,
      coins: 0,
      gems: 0,
      creatures: [],
      eggs: [],
      decorations: [],
      entitlements: [],
      incubatorSlots: INCUBATOR_BASE_SLOTS,
      lastOpenedAt: 900,
      adState: createAdState(900),
      dailyGift: createDailyGiftState(),
    };

    const migrated = migrateSave(v1, 1000);
    expect(migrated.unlockedBiomes).toEqual(['meadow']);
  });
});
