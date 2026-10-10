// The colour a person plays against the computer, set once in Settings (#345).
// Random, White or Black starts a game from the opponent card with one OK; Ask
// brings back the choice of colour before each game, for a player who wants to
// choose game by game.
//
// Random unless the viewer chose otherwise, as the owner decided on 2026-10-10.
// Anything unreadable reads as Random, the default. Remembered across launches.
import type { ColourChoice } from '../../src/core/game';
import type { KeyValueStore } from './mmkvStore';

export type PlayAs = ColourChoice | 'ask';

export const DEFAULT_PLAY_AS: PlayAs = 'random';

// The order Settings steps through.
export const PLAY_AS_CHOICES: readonly PlayAs[] = ['ask', 'random', 'w', 'b'];

const NAMES: Readonly<Record<PlayAs, string>> = {
  ask: 'Ask',
  random: 'Random',
  w: 'White',
  b: 'Black',
};

// What the Settings row says the choice is.
export const playAsName = (choice: PlayAs): string => NAMES[choice];

// The next choice in Settings, or with `step` -1 the one before, round the
// list.
export const cyclePlayAs = (choice: PlayAs, step: 1 | -1 = 1): PlayAs => {
  const count = PLAY_AS_CHOICES.length;
  const at = PLAY_AS_CHOICES.indexOf(choice);
  return PLAY_AS_CHOICES[(at + step + count) % count] ?? DEFAULT_PLAY_AS;
};

const KEY = 'dicechess-tv.playAs.v1';

export const readPlayAs = (store: KeyValueStore): PlayAs => {
  const stored = store.getString(KEY);
  return PLAY_AS_CHOICES.find((choice) => choice === stored) ?? DEFAULT_PLAY_AS;
};

export const savePlayAs = (store: KeyValueStore, choice: PlayAs): void =>
  store.set(KEY, choice);
