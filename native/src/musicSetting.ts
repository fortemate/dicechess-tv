// Whether music plays and how loud, remembered across launches (#76).
//
// Music is on unless the viewer turned it off, as the owner decided, and the
// volume is a step from 0 to MUSIC_STEPS. Anything unreadable falls back to the
// default, so a damaged value cannot silence the music for good.
import type { KeyValueStore } from './mmkvStore';

const ON = 'dicechess-tv.music.v1';
const VOLUME = 'dicechess-tv.musicVolume.v1';

export const MUSIC_STEPS = 10;
// Below the effects: music is a bed under the game, not a soundtrack over it.
export const DEFAULT_MUSIC_VOLUME = 7;

export type MusicSetting = { on: boolean; volume: number };

export const DEFAULT_MUSIC: MusicSetting = {
  on: true,
  volume: DEFAULT_MUSIC_VOLUME,
};

export const readMusic = (store: KeyValueStore): MusicSetting => {
  const raw = store.getString(VOLUME);
  const step = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : NaN;
  return {
    on: store.getString(ON) !== 'off',
    volume: step <= MUSIC_STEPS ? step : DEFAULT_MUSIC_VOLUME,
  };
};

export const saveMusic = (store: KeyValueStore, music: MusicSetting): void => {
  store.set(ON, music.on ? 'on' : 'off');
  store.set(VOLUME, String(music.volume));
};

// The gain a step stands for: 3 dB less per step below the top, and silence at
// zero. Loudness is heard in decibels, so equal steps of gain would crowd the
// audible change into the lowest few.
export const musicGain = (step: number): number =>
  step <= 0
    ? 0
    : 10 ** (((Math.min(step, MUSIC_STEPS) - MUSIC_STEPS) * 3) / 20);
