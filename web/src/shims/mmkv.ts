// @amazon-devices/react-native-mmkv in the browser: the three calls the app
// makes, on localStorage. Synchronous like MMKV, so the saved game is still
// read before the first render. A browser that refuses storage (a private
// window, blocked site data) gets a store that forgets on reload instead of a
// game that does not start.
const PREFIX = 'dicechess-tv-web:';

const memory = new Map<string, string>();

const storage = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export class MMKV {
  getString(key: string): string | undefined {
    try {
      return storage()?.getItem(PREFIX + key) ?? memory.get(key);
    } catch {
      return memory.get(key);
    }
  }

  set(key: string, value: string): void {
    memory.set(key, value);
    try {
      storage()?.setItem(PREFIX + key, value);
    } catch {
      // Kept in memory for this visit.
    }
  }

  delete(key: string): void {
    memory.delete(key);
    try {
      storage()?.removeItem(PREFIX + key);
    } catch {
      // Nothing to remove.
    }
  }
}

// Everything the bench has saved: the game, the ledger and the settings.
export function clearSaved(): void {
  memory.clear();
  const store = storage();
  if (!store) return;
  try {
    for (const key of Object.keys(store))
      if (key.startsWith(PREFIX)) store.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}
