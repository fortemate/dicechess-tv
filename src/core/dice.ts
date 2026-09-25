// The dice a turn shows: the three faces rolled, each with the piece it permits
// and whether an action has spent it. There are none before the roll.
//
// Which dice are spent is read off the engine's own record of the dice still
// left, so castling, which spends a king and a rook die together, needs no rule
// of its own here.
import { DiceChess } from '@fortemate/dicechess-engine/rules';
import { viewGame, type Game } from './game.ts';

export type Die = {
  // The piece the die permits, as an upper-case FEN letter: P, N, B, R, Q or K.
  piece: string;
  spent: boolean;
};

export function diceOf(game: Game): Die[] {
  const dice = game.roll.map((face) => ({
    piece: (DiceChess.getPieceFromDice(face) ?? '').toUpperCase(),
    spent: true,
  }));
  // A die is unspent while its piece is still among the dice left. Walking from
  // the right, the rightmost of two equal dice stays unspent, so a repeated
  // piece is spent from the left, the order the dice are read in.
  const left = [...viewGame(game).remaining];
  for (let i = dice.length - 1; i >= 0; i--) {
    const at = left.indexOf(dice[i].piece);
    if (at === -1) continue;
    dice[i].spent = false;
    left.splice(at, 1);
  }
  return dice;
}
