import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveManager } from './SaveManager';
import { SAVE_SCHEMA_VERSION } from '../core/save';

function installMemoryLocalStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => void store.clear(),
  });
}

describe('SaveManager', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  it('starts with a fresh default save when nothing is persisted', () => {
    const manager = new SaveManager();
    expect(manager.get().version).toBe(SAVE_SCHEMA_VERSION);
    expect(manager.get().coins).toBe(0);
  });

  it('persists mutations and reloads them in a new instance', () => {
    const first = new SaveManager();
    first.update((data) => {
      data.coins = 250;
    });

    const second = new SaveManager();
    expect(second.get().coins).toBe(250);
  });

  it('recovers with a fresh save if the persisted JSON is corrupted', () => {
    localStorage.setItem('critter-grove-save-v1', '{not valid json');
    const manager = new SaveManager();
    expect(manager.get().version).toBe(SAVE_SCHEMA_VERSION);
    expect(manager.get().coins).toBe(0);
  });
});
