// Whether the game's sounds are heard, remembered across launches.
//
// On unless the viewer turned it off. Anything but an explicit "off" reads as
// on, so a damaged value cannot silence the game for good.
import type { KeyValueStore } from './mmkvStore';

const KEY = 'dicechess-tv.sound.v1';

export const readSound = (store: KeyValueStore): boolean =>
  store.getString(KEY) !== 'off';

export const saveSound = (store: KeyValueStore, on: boolean): void =>
  store.set(KEY, on ? 'on' : 'off');
