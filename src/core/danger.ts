// The danger to a king at the start of a turn, which the music follows (#76).
//
// It is measured for the side about to roll, against one king:
//
// - critical: some roll lets that side take the king with its first action. The
//   king is attacked, and only the right die is missing;
// - tense: at least TENSE_WEIGHT of the 216 rolls let it take the king within
//   up to three actions (#382);
// - calm: neither.
//
// Both use the engine's exact `threatWeight` call (#382): an exact, low-allocation
// search sitting directly on the engine's bitboards, avoiding move generation and
// position serialization in JavaScript.
//
// Tense used to look three actions deep, searching each of the 56 distinct
// rolls on its own: thousands of engine calls a turn, which on a Fire TV Stick
// held the JavaScript thread, and the remote with it, for seconds at a time
// (#365). A two-action search was used briefly as a trade-off (#381); now with
// `DiceChess.threatWeight` in engine 0.14.6, three actions are restored with
// minimal overhead.
import { DiceChess } from '@fortemate/dicechess-engine';
import { opposite, type Game, type Side } from './game.ts';

export type Level = 'calm' | 'tense' | 'critical';
const RANK: Readonly<Record<Level, number>> = {
  calm: 0,
  tense: 1,
  critical: 2,
};
const LEVELS: readonly Level[] = ['calm', 'tense', 'critical'];

// Just over a tenth of the rolls. Any roll at all would do in a crowded middle
// game nearly every turn, and music that is always tense is not tense.
export const TENSE_WEIGHT = 22;

// How many of the 216 ordered rolls a sorted roll stands for: one when all
// three dice agree, three when two do, six when none do.
const weightOf = (a: number, b: number, c: number): number => {
  if (a === b && b === c) return 1;
  if (a === b || b === c) return 3;
  return 6;
};

// The 56 distinct rolls, each as its three faces in ascending order, with its
// weight.
export const ROLLS: readonly { dice: readonly number[]; weight: number }[] =
  (() => {
    const rolls: { dice: number[]; weight: number }[] = [];
    for (let a = 1; a <= 6; a++)
      for (let b = a; b <= 6; b++)
        for (let c = b; c <= 6; c++)
          rolls.push({ dice: [a, b, c], weight: weightOf(a, b, c) });
    return rolls;
  })();

// The pieces of a position, by square.
function piecesOf(dfen: string): Map<string, string> {
  const pieces = new Map<string, string>();
  const rows = dfen.split(' ')[0].split('/');
  for (let r = 0; r < 8; r++) {
    let file = 0;
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) file += Number(ch);
      else pieces.set('abcdefgh'[file++] + (8 - r), ch);
    }
  }
  return pieces;
}

// Where a side's king stands, or null once it has been taken.
export function kingSquare(dfen: string, side: Side): string | null {
  const king = side === 'w' ? 'K' : 'k';
  for (const [square, piece] of piecesOf(dfen))
    if (piece === king) return square;
  return null;
}

// How many of the 216 rolls let the side to move take the king on `target` with
// its first action: those showing a die of any piece type that attacks it.
export function firstActionWeight(dfen: string, target: string): number {
  return DiceChess.threatWeight(dfen, target, 1);
}

// How many of the 216 rolls let the side to move of `dfen`, a position before
// its roll, take the king on `target` within its first two actions.
export function twoActionWeight(dfen: string, target: string): number {
  return DiceChess.threatWeight(dfen, target, 2);
}

// How many of the 216 rolls let the side to move of `dfen`, a position before
// its roll, take the king on `target` within up to three actions (#382).
export function threeActionWeight(dfen: string, target: string): number {
  return DiceChess.threatWeight(dfen, target, 3);
}

// The danger the side to move of `dfen`, a position before its roll, poses to
// the king on `target`. Without `tense` it tells only critical from calm, with a
// single move generation.
export function measureDanger(
  dfen: string,
  target: string | null,
  tense = true,
): Level {
  if (!target) return 'calm';
  if (firstActionWeight(dfen, target) > 0) return 'critical';
  if (!tense) return 'calm';
  return threeActionWeight(dfen, target) >= TENSE_WEIGHT ? 'tense' : 'calm';
}

const highest = (a: Level, b: Level): Level => (RANK[a] >= RANK[b] ? a : b);

// The danger heard at the start of a turn, from the game's position before the
// roll.
//
// Against the computer it is the danger to the person's king: from the opponent
// now, when the opponent is about to roll, or from the opponent's next turn,
// when the person is, as if the person passed. The music says "your king", not
// "a king". In hotseat both players are people in the same room, so it is the
// greater danger to either king.
//
// Only the music tells tense from calm. A caller that needs only critical, for
// the opponent's threat line while no music is heard (#368), passes `tense`
// false, and the measure is one move generation per king.
export function turnDanger(
  game: Pick<Game, 'phase' | 'start' | 'human'>,
  tense = true,
): Level {
  if (game.phase === 'ended') return 'calm';
  const dfen = game.start;
  const mover = dfen.split(' ')[1] as Side;
  const against = (attacker: Side): Level => {
    const target = kingSquare(dfen, opposite(attacker));
    if (attacker === mover) return measureDanger(dfen, target, tense);
    // The same position with the other side to move, as if the side to move
    // had passed.
    const passed = DiceChess.endTurn(dfen);
    return passed ? measureDanger(passed, target, tense) : 'calm';
  };
  if (game.human) return against(opposite(game.human));
  const first = against(mover);
  return first === 'critical'
    ? first
    : highest(first, against(opposite(mover)));
}

// The level the music plays after a turn boundary, given the one it played and
// the one just measured. It rises at once, because a threat is news, and falls
// one step per turn, so one quiet turn in a tense game does not drop it to calm.
export function settle(playing: Level, measured: Level): Level {
  if (RANK[measured] >= RANK[playing]) return measured;
  return LEVELS[RANK[playing] - 1];
}
