// The Voices setting: whether every line is spoken aloud, the bots' (#159) and
// the Hot Seat host's (#202), and how loud (#398), remembered across launches.
//
// On unless the viewer turned it off, as the owner decided, and the volume is a
// step from 0 to VOICE_STEPS. Anything unreadable falls back to the default, so
// a damaged value cannot silence the voices for good. A bot's speech bubble
// shows either way; the host has none yet.
import type { KeyValueStore } from './mmkvStore';

const ON = 'dicechess-tv.voices.v1';
const VOLUME = 'dicechess-tv.voiceVolume.v1';

export const VOICE_STEPS = 10;
export const DEFAULT_VOICE_VOLUME = 10;

export type VoiceSetting = { on: boolean; volume: number };

export const DEFAULT_VOICES: VoiceSetting = {
  on: true,
  volume: DEFAULT_VOICE_VOLUME,
};

// Whether the voices are heard: on, and above silence. Settings shows one row
// for it (#398), where a volume of 0 is off.
export const voicesHeard = (voices: VoiceSetting): boolean =>
  voices.on && voices.volume > 0;

// Left and Right on the voices row (#398). The rings stand for the volume heard,
// and none for voices that are off, so Right from off fills the first ring and
// Left from the first ring turns voices off. Off, the volume it had is kept
// for OK to bring back.
export const stepVoices = (voices: VoiceSetting, by: 1 | -1): VoiceSetting => {
  if (!voicesHeard(voices)) return by > 0 ? { on: true, volume: 1 } : voices;
  if (by < 0 && voices.volume === 1) return { ...voices, on: false };
  return { ...voices, volume: Math.min(VOICE_STEPS, voices.volume + by) };
};

// OK on the voices row (#398): a quick mute that keeps the level, and back at
// the volume it had, or at the default when it had none.
export const toggleVoices = (voices: VoiceSetting): VoiceSetting =>
  voicesHeard(voices)
    ? { ...voices, on: false }
    : {
        on: true,
        volume: voices.volume > 0 ? voices.volume : DEFAULT_VOICE_VOLUME,
      };

export const readVoices = (store: KeyValueStore): VoiceSetting => {
  const raw = store.getString(VOLUME);
  const step =
    raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  return {
    on: store.getString(ON) !== 'off',
    volume: step <= VOICE_STEPS ? step : DEFAULT_VOICE_VOLUME,
  };
};

export const saveVoices = (
  store: KeyValueStore,
  voices: VoiceSetting,
): void => {
  store.set(ON, voices.on ? 'on' : 'off');
  store.set(VOLUME, String(voices.volume));
};

// The gain a step stands for: 3 dB less per step below the top, and silence at
// zero. Loudness is heard in decibels, so equal steps of gain would crowd the
// audible change into the lowest few.
export const voiceGain = (step: number): number =>
  step <= 0
    ? 0
    : 10 ** (((Math.min(step, VOICE_STEPS) - VOICE_STEPS) * 3) / 20);
