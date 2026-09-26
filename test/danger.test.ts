// The danger to a king that the music follows (#76), on engine positions whose
// answers were computed independently from the engine's legal turn tree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLLS,
  TENSE_WEIGHT,
  finish,
  firstActionWeight,
  kingSquare,
  searchDanger,
  settle,
  turnDanger,
  type Level,
} from '../src/core/danger.ts';
import { INITIAL_POSITION, newGame, resignGame } from '../src/core/game.ts';

// Positions from simulated games between engine bots. `first` and `turn` are how
// many of the 216 rolls let the side to move take the king on `target` with its
// first action and anywhere in its turn, from the legal turn tree.
const POSITIONS: {
  dfen: string;
  target: string;
  first: number;
  turn: number;
  level: Level;
}[] = [
  {
    dfen: '8/8/7p/p1p5/k5p1/5K2/n7/5b2 b - - 0 18',
    target: 'f3',
    first: 91,
    turn: 104,
    level: 'critical',
  },
  {
    dfen: 'r5r1/2pk2R1/p1nb4/1p4P1/NPP5/3PK3/P2BP3/R5N1 w - - 3 13',
    target: 'd7',
    first: 91,
    turn: 105,
    level: 'critical',
  },
  // Exactly at the threshold.
  {
    dfen: 'rn1q1bnr/pppkpppp/8/3p1b2/8/5N2/PPPPPPPP/RNBQKB1R w KQ d6 2 2',
    target: 'd7',
    first: 0,
    turn: 22,
    level: 'tense',
  },
  {
    dfen: '3rkb2/ppp3pp/3p2N1/4PP2/8/8/PPPK1PPP/RN5R b - - 1 7',
    target: 'd2',
    first: 0,
    turn: 34,
    level: 'tense',
  },
  // Some rolls take the king, but fewer than the threshold.
  {
    dfen: '8/k2B4/4n3/8/1R5R/8/8/3K4 w - - 7 55',
    target: 'a7',
    first: 0,
    turn: 16,
    level: 'calm',
  },
  {
    dfen: '1nb1k2r/3p1pp1/8/pBp1p1qp/8/b3PP2/PPPP3P/R1B1K2n w k h6 0 6',
    target: 'e8',
    first: 0,
    turn: 16,
    level: 'calm',
  },
  {
    dfen: '8/8/7p/p1p4p/k1b5/5pP1/n2p4/4K3 w - - 0 16',
    target: 'a4',
    first: 0,
    turn: 0,
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

test('each position gets the level its shares give', () => {
  for (const p of POSITIONS)
    assert.equal(finish(searchDanger(p.dfen, p.target)), p.level, p.dfen);
});

test('the search is spread over bounded steps and stops once the answer is known', () => {
  for (const p of POSITIONS) {
    const search = searchDanger(p.dfen, p.target);
    let steps = 0;
    let level: Level | null = null;
    while (!level) {
      level = search.step();
      steps++;
    }
    // The first-action check, then at most one step per roll.
    assert.ok(steps <= ROLLS.length + 1, p.dfen);
    if (p.level === 'critical') assert.equal(steps, 1, p.dfen);
    // Once answered, it stays answered and does no more work.
    assert.equal(search.step(), level);
  }
  // A tense position stops as soon as the threshold is reached.
  const tense = searchDanger(POSITIONS[3].dfen, POSITIONS[3].target);
  let steps = 0;
  while (!tense.step()) steps++;
  assert.ok(steps < ROLLS.length, `took ${steps} steps`);
});

test('against the computer the music hears the danger to the person, in hotseat to either king', () => {
  // Black to move, and Black attacks the White king on f3. White has nothing
  // left but the king, so Black's own king is safe.
  const position = '8/8/7p/p1p5/k5p1/5K2/n7/5b2 b - - 0 18';
  const level = (mode: 'hotseat' | 'greedy', human: 'w' | 'b' | null) =>
    finish(turnDanger(newGame(mode, 'danger', position, human)));
  assert.equal(level('hotseat', null), 'critical');
  // The person plays White: the opponent is about to take their king.
  assert.equal(level('greedy', 'w'), 'critical');
  // The person plays Black: their own king is safe, whatever they threaten.
  assert.equal(level('greedy', 'b'), 'calm');
});

test("the danger to the person is also heard on their own turn, as the opponent's next threat", () => {
  // White to move, the person plays Black; the position with Black to move is
  // the critical one above, so as if White passed, Black is not in danger, and
  // White's king would be: with the person on White, it is critical.
  const position = '8/8/7p/p1p5/k5p1/5K2/n7/5b2 w - - 0 18';
  const level = (human: 'w' | 'b') =>
    finish(turnDanger(newGame('greedy', 'danger', position, human)));
  assert.equal(level('w'), 'critical');
  assert.equal(level('b'), 'calm');
});

test('the opening position is calm, and so is a finished game', () => {
  assert.equal(finish(turnDanger(newGame('hotseat', 'start'))), 'calm');
  assert.equal(finish(turnDanger(newGame('aggressive', 'start'))), 'calm');
  const over = resignGame(newGame('hotseat', 'over'));
  assert.equal(finish(turnDanger(over)), 'calm');
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
