// The dice a turn shows: the three faces rolled, each with the piece it permits,
// whether an action has spent it, and whether the turn will leave it unused.
// There are none before the roll.
//
// Which dice are spent is read off the engine's own record of the dice still
// left: the DFEN field `applyMove` returns since engine 0.13.0, which `viewGame`
// lists in roll order and upper case. So castling, which spends a king and a
// rook die together, needs no rule of its own here. Which of them a legal turn
// can still spend is the engine's `getPlayableDice` since 0.14.0, judged over
// the whole turn. The caller passes both in, as `viewGame(...).remaining` and
// `viewGame(...).playable`: every screen has already computed the view, and
// computing it again would replay the turn once more on every render.
import { DiceChess } from '@fortemate/dicechess-engine/rules';

export type Die = {
  // The piece the die permits, as an upper-case FEN letter: P, N, B, R, Q or K.
  piece: string;
  spent: boolean;
  // Unspent, and no legal turn left can spend it, so it dims: every unspent die
  // once the turn is over (#85), and before that any die that every turn still
  // open leaves unused (#140). Never true of a spent die.
  leftover: boolean;
};

export function diceOf(
  roll: readonly number[],
  remaining: string,
  playable: string,
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
    left.splice(at, 1);
  }
  // An unspent die is a leftover unless its piece is still among the playable
  // dice. Walking from the left, when only one of two equal dice can be spent,
  // the right one is the leftover, and the lit one is the next to be spent.
  const lit = [...playable];
  for (const die of dice) {
    if (die.spent) continue;
    const at = lit.indexOf(die.piece);
    if (at === -1) die.leftover = true;
    else lit.splice(at, 1);
  }
  return dice;
}
