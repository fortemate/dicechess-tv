// Whether each side's first turn starts with a pawn on the first die (#534):
// on turns 1 and 2 the first die is a pawn and the other two are rolled at
// random, so both White and Black always have a legal pawn move on their
// opening turn. From turn 3 onward all three dice are rolled at random.
//
// Off by default, as the owner decided. Anything but an explicit "on" reads as
// off, so a damaged value keeps standard three-dice play. Remembered across
// launches.
import type { KeyValueStore } from './mmkvStore';

const KEY = 'dicechess-tv.firstTurnPawn.v1';

export const readFirstTurnPawn = (store: KeyValueStore): boolean =>
  store.getString(KEY) === 'on';

export const saveFirstTurnPawn = (store: KeyValueStore, on: boolean): void =>
  store.set(KEY, on ? 'on' : 'off');
