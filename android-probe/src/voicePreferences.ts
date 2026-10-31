import type { KeyValueStore } from '../../native/src/keyValueStore';
import type { BoardKey } from '../../src/core/boardInput';
import {
  readVoices,
  stepVoices,
  toggleVoices,
  VOICE_STEPS,
  type VoiceSetting,
} from '../../native/src/voiceSetting';
export const VOICE_KEY = 'voices.v1';
/** Read the atomic Android choice or canonical legacy keys without rewriting either. */
export function readAndroidVoices(store: KeyValueStore): VoiceSetting {
  const raw = store.getString(VOICE_KEY);
  if (raw === undefined) return readVoices(store);
  const value = JSON.parse(raw) as VoiceSetting;
  if (
    !value ||
    typeof value.on !== 'boolean' ||
    !Number.isInteger(value.volume) ||
    value.volume < 0 ||
    value.volume > VOICE_STEPS
  )
    throw new Error('Invalid saved voice preference');
  return { on: value.on, volume: value.volume };
}
/** Persist mute and volume atomically before publishing the changed preference. */
export function createVoicePreferences(store: KeyValueStore) {
  let value = readAndroidVoices(store);
  return {
    read: () => value,
    press(key: BoardKey) {
      const next =
        key === 'select'
          ? toggleVoices(value)
          : key === 'left' || key === 'right'
            ? stepVoices(value, key === 'left' ? -1 : 1)
            : value;
      if (next.on !== value.on || next.volume !== value.volume) {
        store.set(VOICE_KEY, JSON.stringify(next));
        value = next;
      }
      return value;
    },
  };
}
