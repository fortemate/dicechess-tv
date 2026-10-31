import type { KeyValueStore } from '../../native/src/keyValueStore';
import type { BoardKey } from '../../src/core/boardInput';
import {
  readMusic,
  stepMusic,
  toggleMusic,
  MUSIC_STEPS,
  type MusicSetting,
} from '../../native/src/musicSetting';
export const MUSIC_KEY = 'music.v1';
/** Read the atomic Android choice or canonical legacy keys without rewriting either. */
export function readAndroidMusic(store: KeyValueStore): MusicSetting {
  const raw = store.getString(MUSIC_KEY);
  if (raw === undefined) return readMusic(store);
  const value = JSON.parse(raw) as MusicSetting;
  if (
    !value ||
    typeof value.on !== 'boolean' ||
    !Number.isInteger(value.volume) ||
    value.volume < 0 ||
    value.volume > MUSIC_STEPS
  )
    throw new Error('Invalid saved music preference');
  return { on: value.on, volume: value.volume };
}
/** Persist mute and volume atomically before publishing the changed preference. */
export function createMusicPreferences(store: KeyValueStore) {
  let value = readAndroidMusic(store);
  return {
    read: () => value,
    press(key: BoardKey) {
      const next =
        key === 'select'
          ? toggleMusic(value)
          : key === 'left' || key === 'right'
            ? stepMusic(value, key === 'left' ? -1 : 1)
            : value;
      if (next.on !== value.on || next.volume !== value.volume) {
        store.set(MUSIC_KEY, JSON.stringify(next));
        value = next;
      }
      return value;
    },
  };
}
