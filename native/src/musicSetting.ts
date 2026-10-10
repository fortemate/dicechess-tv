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

// Whether the music is heard: on, and above silence. Settings shows one row for
// it (#346), where a volume of 0 is off, so music stored as on at 0, which an
// earlier build could save, is off too.
export const musicHeard = (music: MusicSetting): boolean =>
  music.on && music.volume > 0;

// Left and Right on the music row (#346). The rings stand for the volume heard,
// and none for music that is off, so Right from off fills the first ring and
// Left from the first ring turns the music off. Off, the volume it had is kept
// for OK to bring back.
export const stepMusic = (music: MusicSetting, by: 1 | -1): MusicSetting => {
  if (!musicHeard(music)) return by > 0 ? { on: true, volume: 1 } : music;
  if (by < 0 && music.volume === 1) return { ...music, on: false };
  return { ...music, volume: Math.min(MUSIC_STEPS, music.volume + by) };
};

// OK on the music row (#346): a quick mute that keeps the level, and back at the
// volume it had, or at the default when it had none.
export const toggleMusic = (music: MusicSetting): MusicSetting =>
  musicHeard(music)
    ? { ...music, on: false }
    : {
        on: true,
        volume: music.volume > 0 ? music.volume : DEFAULT_MUSIC_VOLUME,
      };

export const readMusic = (store: KeyValueStore): MusicSetting => {
  const raw = store.getString(VOLUME);
  const step =
    raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
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
