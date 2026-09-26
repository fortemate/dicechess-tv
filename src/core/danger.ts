// The danger to a king at the start of a turn, which the music follows (#76).
//
// It is measured for the side about to roll, against one king:
//
// - critical: some roll lets that side take the king with its first action. The
//   king is attacked, and only the right die is missing;
// - tense: at least TENSE_WEIGHT of the 216 rolls let it take the king somewhere
//   in its turn, in up to three actions;
// - calm: neither.
//
// The first is one pseudo-legal move generation, 0.08 ms on the Vega Virtual
// Device. The second searches up to three actions for each of the 56 distinct
// rolls: a median of 427 ms there, and 1.6 s at worst (#76). That is far too long
// to do at once at a turn boundary, so it is a search the caller advances one
// roll at a time, between frames, and it stops as soon as the answer is known.
//
// Both use the engine's pseudo-legal generator rather than the legal turn tree:
// a path that takes the king is legal whatever the rule of using as many dice as
// possible says, and on 200 engine positions the two agreed every time.
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

const LETTER = ['', 'P', 'N', 'B', 'R', 'Q', 'K'];

// The 56 distinct rolls, each weighted by how many of the 216 ordered rolls it
// stands for.
export const ROLLS: readonly { dice: string; weight: number }[] = (() => {
  const rolls: { dice: string; weight: number }[] = [];
  for (let a = 1; a <= 6; a++)
    for (let b = a; b <= 6; b++)
      for (let c = b; c <= 6; c++)
        rolls.push({
          dice: LETTER[a] + LETTER[b] + LETTER[c],
          weight: a === b && b === c ? 1 : a === b || b === c ? 3 : 6,
        });
  return rolls;
})();

const PIECE: Readonly<Record<string, number>> = {
  p: 1,
  n: 2,
  b: 3,
  r: 4,
  q: 5,
  k: 6,
};

// What stands on a square of a position, or null.
function pieceAt(dfen: string, square: string): string | null {
  const rows = dfen.split(' ')[0].split('/');
  const row = rows[8 - Number(square[1])];
  const file = 'abcdefgh'.indexOf(square[0]);
  let at = 0;
  for (const ch of row) {
    if (/\d/.test(ch)) {
      at += Number(ch);
      if (at > file) return null;
    } else {
      if (at === file) return ch;
      at++;
    }
  }
  return null;
}

// Where a side's king stands, or null once it has been taken.
export function kingSquare(dfen: string, side: Side): string | null {
  const king = side === 'w' ? 'K' : 'k';
  const rows = dfen.split(' ')[0].split('/');
  for (let r = 0; r < 8; r++) {
    let file = 0;
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) file += Number(ch);
      else {
        if (ch === king) return 'abcdefgh'[file] + (8 - r);
        file++;
      }
    }
  }
  return null;
}

// How many of the 216 rolls let the side to move take the king on `target` with
// its first action: those showing a die of any piece type that attacks it.
export function firstActionWeight(dfen: string, target: string): number {
  const types = new Set<number>();
  for (const move of DiceChess.generateMoves(dfen)) {
    if (move.slice(2, 4) !== target) continue;
    const piece = pieceAt(dfen, move.slice(0, 2));
    if (piece) types.add(PIECE[piece.toLowerCase()]);
  }
  return 216 - (6 - types.size) ** 3;
}

// Whether some sequence of up to `depth` actions with the position's dice takes
// the king on `target`.
function reaches(dfen: string, target: string, depth: number): boolean {
  const moves = DiceChess.generateMoves(dfen);
  if (moves.some((move) => move.slice(2, 4) === target)) return true;
  if (depth === 1) return false;
  for (const move of moves) {
    const next = DiceChess.applyMove(
      dfen,
      move.slice(0, 2),
      move.slice(2, 4),
      move.slice(4) || undefined,
    );
    // No dice left: the turn is over.
    if (!next || !next.split(' ')[6]) continue;
    if (reaches(next, target, depth - 1)) return true;
  }
  return false;
}

// A search the caller advances with step() until it returns a level. Each step
// does a bounded piece of work: one roll, or the first-action check.
export type DangerSearch = { step(): Level | null };

const settled = (level: Level): DangerSearch => ({ step: () => level });

// The danger the side to move of `dfen`, a position before its roll, poses to
// the king on `target`.
export function searchDanger(
  dfen: string,
  target: string | null,
): DangerSearch {
  if (!target) return settled('calm');
  let index = -1;
  let hit = 0;
  let left = 216;
  let answer: Level | null = null;
  return {
    step() {
      if (answer) return answer;
      if (index < 0) {
        index = 0;
        if (firstActionWeight(dfen, target) > 0) answer = 'critical';
        return answer;
      }
      const { dice, weight } = ROLLS[index++];
      if (reaches(`${dfen} ${dice}`, target, 3)) hit += weight;
      left -= weight;
      if (hit >= TENSE_WEIGHT) answer = 'tense';
      // The rolls not yet tried cannot reach the threshold any more.
      else if (hit + left < TENSE_WEIGHT || index === ROLLS.length)
        answer = 'calm';
      return answer;
    },
  };
}

// Several searches run one after another; the answer is the highest level, and
// a critical answer ends the rest early.
function highest(searches: DangerSearch[]): DangerSearch {
  let at = 0;
  let best: Level = 'calm';
  return {
    step() {
      if (at === searches.length) return best;
      const level = searches[at].step();
      if (level === null) return null;
      if (RANK[level] > RANK[best]) best = level;
      at = best === 'critical' ? searches.length : at + 1;
      return at === searches.length ? best : null;
    },
  };
}

// The danger heard at the start of a turn, from the game's position before the
// roll.
//
// Against the computer it is the danger to the person's king: from the opponent
// now, when the opponent is about to roll, or from the opponent's next turn,
// when the person is, as if the person passed. The music says "your king", not
// "a king". In hotseat both players are people in the same room, so it is the
// greater danger to either king.
export function turnDanger(
  game: Pick<Game, 'phase' | 'start' | 'human'>,
): DangerSearch {
  if (game.phase === 'ended') return settled('calm');
  const dfen = game.start;
  const mover = dfen.split(' ')[1] as Side;
  // The same position with the other side to move, as if the side to move had
  // passed.
  const passed = () => DiceChess.endTurn(dfen) ?? null;
  const against = (attacker: Side): DangerSearch => {
    const target = kingSquare(dfen, opposite(attacker));
    if (attacker === mover) return searchDanger(dfen, target);
    const position = passed();
    return position ? searchDanger(position, target) : settled('calm');
  };
  if (game.human) return highest([against(opposite(game.human))]);
  return highest([against(mover), against(opposite(mover))]);
}

// Runs a search to its end at once. For tests, and for positions known to be
// cheap; the app spreads the steps over frames instead.
export function finish(search: DangerSearch): Level {
  for (;;) {
    const level = search.step();
    if (level) return level;
  }
}

// The level the music plays after a turn boundary, given the one it played and
// the one just measured. It rises at once, because a threat is news, and falls
// one step per turn, so one quiet turn in a tense game does not drop it to calm.
export function settle(playing: Level, measured: Level): Level {
  if (RANK[measured] >= RANK[playing]) return measured;
  return LEVELS[RANK[playing] - 1];
}
