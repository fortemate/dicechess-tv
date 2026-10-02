// Whether Rolly hosts Hot Seat games, remembered across launches (#202).
//
// On unless the viewer turned it off. Anything but an explicit "off" reads as
// on, like the voices. Off, Hot Seat is as it was before the host: no face, no
// bubble, no voice.
import type { KeyValueStore } from './mmkvStore';

const KEY = 'dicechess-tv.host.v1';

export const readHost = (store: KeyValueStore): boolean =>
  store.getString(KEY) !== 'off';

export const saveHost = (store: KeyValueStore, on: boolean): void =>
  store.set(KEY, on ? 'on' : 'off');
