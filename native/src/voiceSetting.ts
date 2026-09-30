// Whether the bots speak their lines aloud, remembered across launches (#159).
//
// On unless the viewer turned it off, as the owner decided. Anything but an
// explicit "off" reads as on, so a damaged value cannot silence the bots for
// good. The speech bubble shows either way.
import type { KeyValueStore } from './mmkvStore';

const KEY = 'dicechess-tv.voices.v1';

export const readVoices = (store: KeyValueStore): boolean =>
  store.getString(KEY) !== 'off';

export const saveVoices = (store: KeyValueStore, on: boolean): void =>
  store.set(KEY, on ? 'on' : 'off');
