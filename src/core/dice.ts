// The dice a turn shows: the three faces rolled, each with the piece it permits,
// whether an action has spent it, and, once the turn is over, whether it was
// left unused. There are none before the roll.
//
// Which dice are spent is read off the engine's own record of the dice still
// left, so castling, which spends a king and a rook die together, needs no rule
// of its own here. The caller passes that record in, as `viewGame(...).remaining`:
// every screen has already computed the view, and computing it again would
// replay the turn and generate its legal moves once more on every render.
import { DiceChess } from '@fortemate/dicechess-engine/rules';

export type Die = {
  // The piece the die permits, as an upper-case FEN letter: P, N, B, R, Q or K.
  piece: string;
  spent: boolean;
  // Unspent, and the turn has nothing left to play: no action could use it
  // (#85). Never true of a spent die.
  leftover: boolean;
};

// `over` says the turn has no action left, as in its handoff phase. Every die
// still unspent is then a leftover: all three after a roll with nothing to play,
// or the ones a partly played turn could not use.
export function diceOf(
  roll: readonly number[],
  remaining: string,
  over = false,
): Die[] {
  const dice = roll.map((face) => ({
    piece: (DiceChess.getPieceFromDice(face) ?? '').toUpperCase(),
    spent: true,
    leftover: false,
  }));
  // A die is unspent while its piece is still among the dice left. Walking from
  // the right, the rightmost of two equal dice stays unspent, so a repeated
  // piece is spent from the left, the order the dice are read in.
  const left = [...remaining];
  for (let i = dice.length - 1; i >= 0; i--) {
    const at = left.indexOf(dice[i].piece);
    if (at === -1) continue;
    dice[i].spent = false;
    dice[i].leftover = over;
    left.splice(at, 1);
  }
  return dice;
}
