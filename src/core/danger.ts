// The danger to a king at the start of a turn, which the music follows (#76).
//
// It is measured for the side about to roll, against one king:
//
// - critical: some roll lets that side take the king with its first action. The
//   king is attacked, and only the right die is missing;
// - tense: at least TENSE_WEIGHT of the 216 rolls let it take the king within
//   its first two actions;
// - calm: neither.
//
// Both use the engine's pseudo-legal generator rather than the legal turn tree:
// a path that takes the king is legal whatever the rule of using as many dice as
// possible says, and on 200 engine positions the two agreed every time.
//
// Tense used to look three actions deep, searching each of the 56 distinct
// rolls on its own: thousands of engine calls a turn, which on a Fire TV Stick
// held the JavaScript thread, and the remote with it, for seconds at a time
// (#365). Now the two actions are searched once for every roll. A position
// without dice gives the moves of every piece type, each path to the king notes
// the dice it spends, and the rolls holding those dice are counted. That is a
// move generation and an application for each first action, a few dozen engine
// calls, so the level is known at once and nothing is left to run while the
// person plays. A threat that needs all three actions is no longer heard as
// tense; the owner chose that trade on 13 October 2026.
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

// The die that names each piece.
const DIE: Readonly<Record<string, number>> = {
  p: 1,
  n: 2,
  b: 3,
  r: 4,
  q: 5,
  k: 6,
};
const KING = DIE.k;
const ROOK = DIE.r;

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

// The dice a move spends: its piece's, and a rook's as well when the king
// castles, which moves it two files. A move from an empty square is an engine
// fault: no dice would make every roll play it.
function diceOf(pieces: Map<string, string>, move: string): number[] {
  const piece = pieces.get(move.slice(0, 2));
  if (!piece) throw new Error('No piece moves ' + move);
  const die = DIE[piece.toLowerCase()];
  const files = Math.abs(move.charCodeAt(0) - move.charCodeAt(2));
  return die === KING && files === 2 ? [KING, ROOK] : [die];
}

const takes = (move: string, target: string) => move.slice(2, 4) === target;

// How many of the 216 rolls let the side to move take the king on `target` with
// its first action: those showing a die of any piece type that attacks it.
export function firstActionWeight(dfen: string, target: string): number {
  const pieces = piecesOf(dfen);
  const types = new Set<number>();
  for (const move of DiceChess.generateMoves(dfen))
    if (takes(move, target)) types.add(diceOf(pieces, move)[0]);
  return 216 - (6 - types.size) ** 3;
}

// Whether a roll holds every die of `dice`, a die repeated as often as it is
// listed.
function holds(roll: readonly number[], dice: readonly number[]): boolean {
  const left = [...roll];
  for (const die of dice) {
    const at = left.indexOf(die);
    if (at === -1) return false;
    left.splice(at, 1);
  }
  return true;
}

// How many of the 216 rolls let the side to move of `dfen`, a position before
// its roll, take the king on `target` within its first two actions.
//
// The position has no dice, so the engine gives the moves of every piece type,
// and each path to the king is noted with the dice it spends: a roll that holds
// them can play it. A castling spends two dice, which leaves room for the second
// action and no more.
export function twoActionWeight(dfen: string, target: string): number {
  const paths: number[][] = [];
  const pieces = piecesOf(dfen);
  for (const first of DiceChess.generateMoves(dfen)) {
    const spent = diceOf(pieces, first);
    if (takes(first, target)) {
      paths.push(spent);
      continue;
    }
    const next = DiceChess.applyMove(
      dfen,
      first.slice(0, 2),
      first.slice(2, 4),
      first.slice(4) || undefined,
    );
    if (!next) continue;
    const after = piecesOf(next);
    for (const second of DiceChess.generateMoves(next)) {
      if (takes(second, target))
        paths.push([...spent, ...diceOf(after, second)]);
    }
  }
  let weight = 0;
  for (const { dice, weight: rolls } of ROLLS)
    if (paths.some((path) => holds(dice, path))) weight += rolls;
  return weight;
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
  return twoActionWeight(dfen, target) >= TENSE_WEIGHT ? 'tense' : 'calm';
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
