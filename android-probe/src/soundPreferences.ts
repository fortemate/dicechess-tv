import type { KeyValueStore } from '../../native/src/keyValueStore';
import type { BoardKey } from '../../src/core/boardInput';
import {
  readSound,
  saveSound,
  stepSound,
  toggleSound,
} from '../../native/src/soundSetting.ts';

export const SETTINGS_STORE = 'dicechess-android-settings';

// Persist before publishing the next value. Navigation never writes preferences.
export function createSoundPreferences(store: KeyValueStore) {
  let sound = readSound(store);
  return {
    read: () => sound,
    press(key: BoardKey) {
      const next =
        key === 'select'
          ? toggleSound(sound)
          : key === 'left' || key === 'right'
            ? stepSound(sound, key === 'left' ? -1 : 1)
            : sound;
      if (next.on !== sound.on || next.volume !== sound.volume) {
        saveSound(store, next);
        sound = next;
      }
      return sound;
    },
  };
}
