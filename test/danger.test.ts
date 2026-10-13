// The danger to a king that the music follows (#76), on engine positions whose
// answers were computed independently from the engine's legal turn tree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DiceChess } from '@fortemate/dicechess-engine';
import {
  ROLLS,
  TENSE_WEIGHT,
  firstActionWeight,
  kingSquare,
  measureDanger,
  settle,
  threeActionWeight,
  turnDanger,
  twoActionWeight,
  type Level,
} from '../src/core/danger.ts';
import { INITIAL_POSITION, newGame, resignGame } from '../src/core/game.ts';

// Positions from simulated games between engine bots. `first`, `two` and `three`
// are how many of the 216 rolls let the side to move take the king on `target`
// with its first action, within its first two, and within up to three actions,
// from the legal turn tree.
const POSITIONS: {
  dfen: string;
  target: string;
  first: number;
  two: number;
  three: number;
  level: Level;
}[] = [
  {
    dfen: '8/8/7p/p1p5/k5p1/5K2/n7/5b2 b - - 0 18',
    target: 'f3',
    first: 91,
    two: 104,
    three: 104,
    level: 'critical',
  },
  {
    dfen: 'r5r1/2pk2R1/p1nb4/1p4P1/NPP5/3PK3/P2BP3/R5N1 w - - 3 13',
    target: 'd7',
    first: 91,
    two: 104,
    three: 105,
    level: 'critical',
  },
  // Tense with the three-action search restored via the engine's exact
  // measure (#382), exactly at the threshold: 22 rolls take the king within
  // the turn, though only 16 within two actions (#365).
  {
    dfen: 'rn1q1bnr/pppkpppp/8/3p1b2/8/5N2/PPPPPPPP/RNBQKB1R w KQ d6 2 2',
    target: 'd7',
    first: 0,
    two: 16,
    three: 22,
    level: 'tense',
  },
  {
    dfen: '3rkb2/ppp3pp/3p2N1/4PP2/8/8/PPPK1PPP/RN5R b - - 1 7',
    target: 'd2',
    first: 0,
    two: 30,
    three: 34,
    level: 'tense',
  },
  // Some rolls take the king, but fewer than the threshold: the 16 that hold
  // two dice of one piece.
  {
    dfen: '8/k2B4/4n3/8/1R5R/8/8/3K4 w - - 7 55',
    target: 'a7',
    first: 0,
    two: 16,
    three: 16,
    level: 'calm',
  },
  {
    dfen: '1nb1k2r/3p1pp1/8/pBp1p1qp/8/b3PP2/PPPP3P/R1B1K2n w k h6 0 6',
    target: 'e8',
    first: 0,
    two: 16,
    three: 16,
    level: 'calm',
  },
  {
    dfen: '8/8/7p/p1p4p/k1b5/5pP1/n2p4/4K3 w - - 0 16',
    target: 'a4',
    first: 0,
    two: 0,
    three: 0,
    level: 'calm',
  },
];

test('the 56 distinct rolls stand for the 216 ordered ones', () => {
  assert.equal(ROLLS.length, 56);
  assert.equal(
    ROLLS.reduce((sum, roll) => sum + roll.weight, 0),
    216,
  );
  assert.ok(TENSE_WEIGHT > 216 / 10 && TENSE_WEIGHT < 216 / 9);
});

test('a king is found where it stands, and not once it is taken', () => {
  assert.equal(kingSquare(INITIAL_POSITION, 'w'), 'e1');
  assert.equal(kingSquare(INITIAL_POSITION, 'b'), 'e8');
  assert.equal(kingSquare('8/8/7p/p1p5/k5p1/5K2/n7/5b2 b - - 0 18', 'b'), 'a4');
  assert.equal(kingSquare('8/8/8/8/8/8/8/4K3 w - - 0 1', 'b'), null);
});

test('the first-action share matches the legal tree', () => {
  for (const p of POSITIONS)
    assert.equal(firstActionWeight(p.dfen, p.target), p.first, p.dfen);
  assert.equal(firstActionWeight(INITIAL_POSITION, 'e8'), 0);
});

test('the two-action share matches the legal tree', () => {
  for (const p of POSITIONS)
    assert.equal(twoActionWeight(p.dfen, p.target), p.two, p.dfen);
  assert.equal(twoActionWeight(INITIAL_POSITION, 'e8'), 0);
});

test('the three-action share matches the legal tree', () => {
  for (const p of POSITIONS)
    assert.equal(threeActionWeight(p.dfen, p.target), p.three, p.dfen);
  assert.equal(threeActionWeight(INITIAL_POSITION, 'e8'), 0);
});

test('each position gets the level its shares give', () => {
  for (const p of POSITIONS)
    assert.equal(measureDanger(p.dfen, p.target), p.level, p.dfen);
});

// The same share worked out the long way, as the search did before #365: each
// roll on its own, with its dice in the position, so the engine allows only the
// pieces they name and spends them as it goes.
const L = ['', 'P', 'N', 'B', 'R', 'Q', 'K'];
function reaches(dfen: string, target: string, depth: number): boolean {
  const moves = DiceChess.generateMoves(dfen);
  if (moves.some((move) => move.slice(2, 4) === target)) return true;
  if (depth === 1) return false;
  return moves.some((move) => {
    const next = DiceChess.applyMove(
      dfen,
      move.slice(0, 2),
      move.slice(2, 4),
      move.slice(4) || undefined,
    );
    return !!next?.split(' ')[6] && reaches(next, target, depth - 1);
  });
}
const rollByRoll = (dfen: string, target: string, depth = 3): number =>
  ROLLS.filter(({ dice }) =>
    reaches(`${dfen} ${dice.map((die) => L[die]).join('')}`, target, depth),
  ).reduce((sum, { weight }) => sum + weight, 0);

// Turn starts from games played with seeded dice, each turn a seeded path
// through the roll's legal tree, for both sides' kings.
function seededPositions(count: number): { dfen: string; target: string }[] {
  let seed = 365;
  const random = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const positions: { dfen: string; target: string }[] = [];
  while (positions.length < count) {
    let dfen = INITIAL_POSITION;
    for (let turn = 0; turn < 60 && positions.length < count; turn++) {
      const side = dfen.split(' ')[1] === 'w' ? 'w' : 'b';
      const target = kingSquare(dfen, side === 'w' ? 'b' : 'w');
      if (!target) break;
      positions.push({ dfen, target });
      const dice = [0, 0, 0]
        .map(() => L[1 + Math.floor(random() * 6)])
        .join('');
      let position = `${dfen} ${dice}`;
      let node = DiceChess.getLegalTurnTree(position);
      for (
        let keys = Object.keys(node);
        keys.length;
        keys = Object.keys(node)
      ) {
        const move = keys[Math.floor(random() * keys.length)];
        position = DiceChess.applyMove(
          position,
          move.slice(0, 2),
          move.slice(2, 4),
          move.slice(4) || undefined,
        ) as string;
        node = node[move];
      }
      const next = DiceChess.endTurn(position);
      if (!next || !kingSquare(next, 'w') || !kingSquare(next, 'b')) break;
      dfen = next;
    }
  }
  return positions;
}

test('on 200 positions from seeded games, the share matches a search of each roll on its own', () => {
  const levels = new Set<Level>();
  for (const { dfen, target } of seededPositions(200)) {
    const weight = threeActionWeight(dfen, target);
    assert.equal(weight, rollByRoll(dfen, target, 3), `${dfen} ${target}`);
    levels.add(measureDanger(dfen, target));
  }
  // The positions cover every level.
  assert.deepEqual([...levels].sort(), ['calm', 'critical', 'tense']);
});

test('a measure calls threatWeight at most twice, and once when critical or without tense (#368, #382)', (t) => {
  const threat = t.mock.method(DiceChess, 'threatWeight');
  for (const p of POSITIONS) {
    threat.mock.resetCalls();
    measureDanger(p.dfen, p.target);
    if (p.level === 'critical') {
      assert.equal(threat.mock.callCount(), 1, p.dfen);
    } else {
      assert.equal(threat.mock.callCount(), 2, p.dfen);
    }
  }
  for (const p of POSITIONS) {
    threat.mock.resetCalls();
    measureDanger(p.dfen, p.target, false);
    assert.equal(threat.mock.callCount(), 1, p.dfen);
  }
});

const TENSE = '3rkb2/ppp3pp/3p2N1/4PP2/8/8/PPPK1PPP/RN5R b - - 1 7';

test('without the tense measure, a turn against the computer costs one threat evaluation, and keeps a critical answer (#368)', (t) => {
  const threat = t.mock.method(DiceChess, 'threatWeight');
  // Black to move attacks the White king on f3. On Black's turn it is the
  // opponent's threat now, on White's as if White passed.
  for (const [position, human, level] of [
    ['8/8/7p/p1p5/k5p1/5K2/n7/5b2 b - - 0 18', 'w', 'critical'],
    ['8/8/7p/p1p5/k5p1/5K2/n7/5b2 b - - 0 18', 'b', 'calm'],
    ['8/8/7p/p1p5/k5p1/5K2/n7/5b2 w - - 0 18', 'w', 'critical'],
    // Tense with the music: 34 of the 216 rolls take the king within three
    // actions, and none with the first.
    [TENSE, 'w', 'calm'],
  ] as const) {
    threat.mock.resetCalls();
    const measured = turnDanger(
      newGame('greedy', 'danger', position, human),
      false,
    );
    assert.equal(measured, level, `${position} ${human}`);
    assert.equal(threat.mock.callCount(), 1, `${position} ${human}`);
  }
  assert.equal(turnDanger(newGame('greedy', 'danger', TENSE, 'w')), 'tense');
});

test('against the computer the music hears the danger to the person, in hotseat to either king', () => {
  // Black to move, and Black attacks the White king on f3. White has nothing
  // left but the king, so Black's own king is safe.
  const position = '8/8/7p/p1p5/k5p1/5K2/n7/5b2 b - - 0 18';
  const level = (mode: 'hotseat' | 'greedy', human: 'w' | 'b' | null) =>
    turnDanger(newGame(mode, 'danger', position, human));
  assert.equal(level('hotseat', null), 'critical');
  // The person plays White: the opponent is about to take their king.
  assert.equal(level('greedy', 'w'), 'critical');
  // The person plays Black: their own king is safe, whatever they threaten.
  assert.equal(level('greedy', 'b'), 'calm');
  // In hotseat a tense king is heard whichever side holds it.
  assert.equal(turnDanger(newGame('hotseat', 'danger', TENSE, null)), 'tense');
});

test("the danger to the person is also heard on their own turn, as the opponent's next threat", () => {
  // White to move, the person plays Black; the position with Black to move is
  // the critical one above, so as if White passed, Black is not in danger, and
  // White's king would be: with the person on White, it is critical.
  const position = '8/8/7p/p1p5/k5p1/5K2/n7/5b2 w - - 0 18';
  const level = (human: 'w' | 'b') =>
    turnDanger(newGame('greedy', 'danger', position, human));
  assert.equal(level('w'), 'critical');
  assert.equal(level('b'), 'calm');
});

test('the opening position is calm, and so is a finished game', () => {
  assert.equal(turnDanger(newGame('hotseat', 'start')), 'calm');
  assert.equal(turnDanger(newGame('aggressive', 'start')), 'calm');
  const over = resignGame(newGame('hotseat', 'over'));
  assert.equal(turnDanger(over), 'calm');
});

test('the music rises at once and falls one step per turn', () => {
  assert.equal(settle('calm', 'critical'), 'critical');
  assert.equal(settle('calm', 'tense'), 'tense');
  assert.equal(settle('tense', 'critical'), 'critical');
  assert.equal(settle('critical', 'calm'), 'tense');
  assert.equal(settle('tense', 'calm'), 'calm');
  assert.equal(settle('critical', 'tense'), 'tense');
  assert.equal(settle('calm', 'calm'), 'calm');
});
