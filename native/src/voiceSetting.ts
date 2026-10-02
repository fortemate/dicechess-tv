// The Voices setting: whether every line is spoken aloud, the bots' (#159) and
// the Hot Seat host's (#202), remembered across launches.
//
// On unless the viewer turned it off, as the owner decided. Anything but an
// explicit "off" reads as on, so a damaged value cannot silence the voices for
// good. The speech bubbles show either way.
import type { KeyValueStore } from './mmkvStore';

const KEY = 'dicechess-tv.voices.v1';

export const readVoices = (store: KeyValueStore): boolean =>
  store.getString(KEY) !== 'off';

export const saveVoices = (store: KeyValueStore, on: boolean): void =>
  store.set(KEY, on ? 'on' : 'off');
