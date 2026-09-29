// Whether the board turns to the side to move in hotseat (#120).
//
// Off by default: viewers sitting side by side on a sofa share a single
// perspective unless they choose otherwise. Remembered across launches.
import type { KeyValueStore } from './mmkvStore';

const KEY = 'dicechess-tv.turnBoard.v1';

export const readTurnBoard = (store: KeyValueStore): boolean =>
  store.getString(KEY) === 'on';

export const saveTurnBoard = (store: KeyValueStore, on: boolean): void =>
  store.set(KEY, on ? 'on' : 'off');
