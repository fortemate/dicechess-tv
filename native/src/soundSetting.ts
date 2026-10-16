// Whether the game's sounds are heard and how loud, remembered across launches (#398).
//
// Sounds are on unless the viewer turned them off, and the volume is a step from
// 0 to SOUND_STEPS. Anything unreadable falls back to the default, so a damaged
// value cannot silence the sounds for good.
import type { KeyValueStore } from './mmkvStore';

const ON = 'dicechess-tv.sound.v1';
const VOLUME = 'dicechess-tv.soundVolume.v1';

export const SOUND_STEPS = 10;
export const DEFAULT_SOUND_VOLUME = 10;

export type SoundSetting = { on: boolean; volume: number };

export const DEFAULT_SOUND: SoundSetting = {
  on: true,
  volume: DEFAULT_SOUND_VOLUME,
};

// Whether the sounds are heard: on, and above silence. Settings shows one row
// for it (#398), where a volume of 0 is off.
export const soundHeard = (sound: SoundSetting): boolean =>
  sound.on && sound.volume > 0;

// Left and Right on the sounds row (#398). The rings stand for the volume heard,
// and none for sounds that are off, so Right from off fills the first ring and
// Left from the first ring turns sounds off. Off, the volume it had is kept
// for OK to bring back.
export const stepSound = (sound: SoundSetting, by: 1 | -1): SoundSetting => {
  if (!soundHeard(sound)) return by > 0 ? { on: true, volume: 1 } : sound;
  if (by < 0 && sound.volume === 1) return { ...sound, on: false };
  return { ...sound, volume: Math.min(SOUND_STEPS, sound.volume + by) };
};

// OK on the sounds row (#398): a quick mute that keeps the level, and back at
// the volume it had, or at the default when it had none.
export const toggleSound = (sound: SoundSetting): SoundSetting =>
  soundHeard(sound)
    ? { ...sound, on: false }
    : {
        on: true,
        volume: sound.volume > 0 ? sound.volume : DEFAULT_SOUND_VOLUME,
      };

export const readSound = (store: KeyValueStore): SoundSetting => {
  const raw = store.getString(VOLUME);
  const step =
    raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  return {
    on: store.getString(ON) !== 'off',
    volume: step <= SOUND_STEPS ? step : DEFAULT_SOUND_VOLUME,
  };
};

export const saveSound = (store: KeyValueStore, sound: SoundSetting): void => {
  store.set(ON, sound.on ? 'on' : 'off');
  store.set(VOLUME, String(sound.volume));
};

// The gain a step stands for: 3 dB less per step below the top, and silence at
// zero. Loudness is heard in decibels, so equal steps of gain would crowd the
// audible change into the lowest few.
export const soundGain = (step: number): number =>
  step <= 0
    ? 0
    : 10 ** (((Math.min(step, SOUND_STEPS) - SOUND_STEPS) * 3) / 20);
