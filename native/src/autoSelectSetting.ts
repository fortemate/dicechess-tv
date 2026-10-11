// Whether OK presses itself when the board offers only one move (#302, #360):
// the one piece that can move, with one square to go to, is picked up and
// played there.
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
