import { VariantTier } from '../data/economy';
import { AdState, createAdState } from './economy';
import { Creature } from './creature';

export const SAVE_SCHEMA_VERSION = 1;

export interface Egg {
  id: string;
  speciesId: string;
  variant: VariantTier;
  parentAId: string;
  parentBId: string;
  hatchesAt: number;
}

export interface SaveDataV1 {
  version: 1;
  coins: number;
  gems: number;
  creatures: Creature[];
  eggs: Egg[];
  decorations: string[];
  incubatorSlots: number;
  lastOpenedAt: number;
  adState: AdState;
}

export type SaveData = SaveDataV1;

export function createDefaultSave(now: number): SaveDataV1 {
  return {
    version: SAVE_SCHEMA_VERSION,
    coins: 0,
    gems: 0,
    creatures: [],
    eggs: [],
    decorations: [],
    incubatorSlots: 2,
    lastOpenedAt: now,
    adState: createAdState(now),
  };
}

type VersionedSave = { version: number };

/** Keyed by the version being migrated *from*. Empty today since v1 is the
 * first schema — future migrations (e.g. v1 -> v2) get added here without
 * touching callers of `migrateSave`. */
const MIGRATIONS: Record<number, (data: VersionedSave) => VersionedSave> = {};

function isPlausibleSave(raw: unknown): raw is VersionedSave {
  return typeof raw === 'object' && raw !== null && typeof (raw as VersionedSave).version === 'number';
}

/** Parses arbitrary persisted JSON into the current save schema, running any
 * needed migrations. Falls back to a fresh save on corruption, an unknown
 * (older, unmigratable) version, or a save from a newer app version. */
export function migrateSave(raw: unknown, now: number): SaveDataV1 {
  if (!isPlausibleSave(raw)) return createDefaultSave(now);

  let data: VersionedSave = raw;
  while (data.version < SAVE_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[data.version];
    if (!migrate) return createDefaultSave(now);
    data = migrate(data);
  }
  if (data.version > SAVE_SCHEMA_VERSION) return createDefaultSave(now);

  return data as SaveDataV1;
}
