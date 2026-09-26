// The local opponents a person can choose on their cards (#115): who each one
// is, how hard it is, and how it plays, in the words a player reads.
//
// Each plays the engine algorithm its mode names. The level follows the
// engine's own difficulty rating for that algorithm (DiceChess.getAvailableBots),
// which the tests check, so a card never promises more than the engine claims.
import type { BotMode, Side } from './game.ts';
import type { BotRecord, Ledger } from './ledger.ts';

export type Level = 'Easy' | 'Medium' | 'Hard';

export type Opponent = {
  mode: BotMode;
  name: string;
  level: Level;
  // One line on the card: how the opponent plays, not how strong it is.
  style: string;
};

// In order of difficulty, the order the cards are shown in.
export const OPPONENTS: readonly Opponent[] = [
  {
    mode: 'random',
    name: 'Rolly',
    level: 'Easy',
    style: 'Plays any legal turn, at random.',
  },
  {
    mode: 'greedy',
    name: 'Grabby',
    level: 'Medium',
    style: 'Takes the most valuable piece it can and never looks ahead.',
  },
  {
    mode: 'aggressive',
    name: 'Rampage',
    level: 'Hard',
    style: 'Hunts your pieces, pushes its pawns and goes for your king.',
  },
];

export function opponentOf(mode: BotMode): Opponent {
  const opponent = OPPONENTS.find((each) => each.mode === mode);
  if (!opponent) throw new Error('No opponent for ' + mode);
  return opponent;
}

// The person's results against one opponent, by the side they played.
export const recordAgainst = (
  ledger: Ledger,
  mode: BotMode,
): Partial<Record<Side, BotRecord>> => ledger.bots[mode] ?? {};
