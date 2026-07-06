import { INCUBATOR_BASE_SLOTS, VariantTier } from '../data/economy';
import { Biome, getSpecies } from '../data/species';
import { AdState, createAdState, createDailyGiftState, DailyGiftState } from './economy';
import { createDailyQuestState, DailyQuestState } from './quests';
import { Creature, CreatureStats } from './creature';

export const SAVE_SCHEMA_VERSION = 2;

export interface Egg {
  id: string;
  speciesId: string;
  variant: VariantTier;
  stats: CreatureStats;
  parentAId: string;
  parentBId: string;
  hatchesAt: number;
}

let nextEggSeq = 0;

/** Deterministic id generator, matching creature.ts's approach — unique
 * within a save, no Date.now()/Math.random() needed. */
export function createEggId(): string {
  nextEggSeq += 1;
  return `egg-${nextEggSeq}`;
}

export interface LifetimeStats {
  totalCatches: number;
  totalHatches: number;
}

export interface SaveDataV1 {
  version: 1;
  coins: number;
  gems: number;
  creatures: Creature[];
  eggs: Egg[];
  decorations: string[];
  /** Owned IAP entitlement-kind product ids (stub — no real store wiring). */
  entitlements: string[];
  incubatorSlots: number;
  lastOpenedAt: number;
  adState: AdState;
  dailyGift: DailyGiftState;
}

export interface SaveDataV2 {
  version: 2;
  coins: number;
  gems: number;
  creatures: Creature[];
  eggs: Egg[];
  decorations: string[];
  /** Owned IAP entitlement-kind product ids (stub — no real store wiring). */
  entitlements: string[];
  incubatorSlots: number;
  lastOpenedAt: number;
  adState: AdState;
  dailyGift: DailyGiftState;
  lifetimeStats: LifetimeStats;
  claimedMilestones: number[];
  claimedAchievements: string[];
  unlockedBiomes: Biome[];
  dailyQuests: DailyQuestState;
}

export type SaveData = SaveDataV2;

export function createDefaultSave(now: number): SaveDataV2 {
  return {
    version: SAVE_SCHEMA_VERSION,
    coins: 0,
    gems: 0,
    creatures: [],
    eggs: [],
    decorations: [],
    entitlements: [],
    incubatorSlots: INCUBATOR_BASE_SLOTS,
    lastOpenedAt: now,
    adState: createAdState(now),
    dailyGift: createDailyGiftState(),
    lifetimeStats: { totalCatches: 0, totalHatches: 0 },
    claimedMilestones: [],
    claimedAchievements: [],
    unlockedBiomes: ['meadow'],
    dailyQuests: createDailyQuestState(now),
  };
}

type VersionedSave = { version: number };

/** Keyed by the version being migrated *from*. A live player save exists in
 * production, so every schema change from here on must go through a real
 * migration rather than assuming a fresh save. */
const MIGRATIONS: Record<number, (data: VersionedSave, now: number) => VersionedSave> = {
  1: (data, now) => {
    const v1 = data as unknown as SaveDataV1;
    const unlockedBiomes = new Set<Biome>(['meadow']);
    for (const creature of v1.creatures) {
      try {
        unlockedBiomes.add(getSpecies(creature.speciesId).biome);
      } catch {
        // Unknown species id (shouldn't happen) — skip rather than fail the migration.
      }
    }
    const v2: SaveDataV2 = {
      ...v1,
      version: 2,
      lifetimeStats: { totalCatches: v1.creatures.length, totalHatches: 0 },
      claimedMilestones: [],
      claimedAchievements: [],
      unlockedBiomes: Array.from(unlockedBiomes),
      dailyQuests: createDailyQuestState(now),
    };
    return v2;
  },
};

function isPlausibleSave(raw: unknown): raw is VersionedSave {
  return typeof raw === 'object' && raw !== null && typeof (raw as VersionedSave).version === 'number';
}

/** Parses arbitrary persisted JSON into the current save schema, running any
 * needed migrations. Falls back to a fresh save on corruption, an unknown
 * (older, unmigratable) version, or a save from a newer app version. */
export function migrateSave(raw: unknown, now: number): SaveDataV2 {
  if (!isPlausibleSave(raw)) return createDefaultSave(now);

  let data: VersionedSave = raw;
  while (data.version < SAVE_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[data.version];
    if (!migrate) return createDefaultSave(now);
    data = migrate(data, now);
  }
  if (data.version > SAVE_SCHEMA_VERSION) return createDefaultSave(now);

  return data as SaveDataV2;
}
