import type { KeyValueStore } from '../../native/src/keyValueStore';
import type { BoardKey } from '../../src/core/boardInput';
import {
  readSound,
  SOUND_STEPS,
  type SoundSetting,
  stepSound,
  toggleSound,
} from '../../native/src/soundSetting.ts';

export const SETTINGS_STORE = 'dicechess-android-settings';
export const SOUND_KEY = 'sound.v1';

// Read legacy pairs until a successful change writes the complete choice once.
// Invalid new data must not silently enable sound or overwrite the saved value.
export function readAndroidSound(store: KeyValueStore): SoundSetting {
  const raw = store.getString(SOUND_KEY);
  if (raw === undefined) return readSound(store);
  const value: unknown = JSON.parse(raw);
  if (
    typeof value !== 'object' ||
    value === null ||
    !('on' in value) ||
    typeof value.on !== 'boolean' ||
    !('volume' in value) ||
    typeof value.volume !== 'number' ||
    !Number.isInteger(value.volume) ||
    value.volume < 0 ||
    value.volume > SOUND_STEPS
  )
    throw new Error('Invalid saved sound preference');
  return { on: value.on, volume: value.volume };
}

// Persist before publishing the next value. Navigation never writes preferences.
export function createSoundPreferences(store: KeyValueStore) {
  let sound = readAndroidSound(store);
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
        store.set(SOUND_KEY, JSON.stringify(next));
        sound = next;
      }
      return sound;
    },
  };
}
