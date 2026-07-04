import { createDefaultSave, migrateSave, SaveData } from '../core/save';

const STORAGE_KEY = 'critter-grove-save-v1';

/** Single abstraction over persistence. Everything else in the game reads
 * and writes through here so the storage backend (localStorage today, cloud
 * saves later) can change without touching callers. */
export class SaveManager {
  private data: SaveData;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    const now = Date.now();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultSave(now);
      return migrateSave(JSON.parse(raw), now);
    } catch {
      return createDefaultSave(now);
    }
  }

  get(): SaveData {
    return this.data;
  }

  persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  /** Mutate the save in place, then immediately persist. */
  update(mutator: (data: SaveData) => void): void {
    mutator(this.data);
    this.persist();
  }
}
