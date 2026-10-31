import type { ScreenSettings } from '../../native/src/screen';
import type { KeyValueStore } from '../../native/src/keyValueStore';
import { readAndroidSound, SOUND_KEY } from './soundPreferences';
import { readAndroidMusic, MUSIC_KEY } from './musicPreferences';
import { readAndroidVoices, VOICE_KEY } from './voicePreferences';
import { readGamePreferences, saveGamePreferences } from './gamePreferences';

/** Read the same independent preferences used by home Settings when the game opens its panel. */
export function readScreenPreferences(store: KeyValueStore): ScreenSettings {
  return {
    ...readGamePreferences(store),
    sound: readAndroidSound(store),
    music: readAndroidMusic(store),
    voices: readAndroidVoices(store),
    musicAvailable: true,
  };
}

/** Persist each changed row before the shared reducer's next state is published. */
export function saveScreenPreferences(
  store: KeyValueStore,
  next: ScreenSettings,
  before: ScreenSettings,
) {
  for (const [key, after, prior] of [
    [SOUND_KEY, next.sound, before.sound],
    [MUSIC_KEY, next.music, before.music],
    [VOICE_KEY, next.voices, before.voices],
  ] as const) {
    if (after.on !== prior.on || after.volume !== prior.volume)
      store.set(key, JSON.stringify(after));
  }
  saveGamePreferences(store, next, before);
}
