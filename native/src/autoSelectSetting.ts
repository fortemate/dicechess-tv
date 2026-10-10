// Whether OK presses itself when the board offers only one choice (#302): the
// only piece that can move is picked up, and a piece in hand with only one
// destination is played there.
//
// Off by default, as the owner asked. Anything but an explicit "on" reads as
// off, so a damaged value cannot play moves nobody pressed OK for. Remembered
// across launches.
import type { KeyValueStore } from './mmkvStore';

const KEY = 'dicechess-tv.autoSelect.v1';

export const readAutoSelect = (store: KeyValueStore): boolean =>
  store.getString(KEY) === 'on';

export const saveAutoSelect = (store: KeyValueStore, on: boolean): void =>
  store.set(KEY, on ? 'on' : 'off');
