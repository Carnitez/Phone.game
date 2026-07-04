import { describe, expect, it } from 'vitest';
import { createDefaultSave, migrateSave, SAVE_SCHEMA_VERSION } from './save';

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
});
