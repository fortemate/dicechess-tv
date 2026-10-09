import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actionCost, CURRENT, type Strategy } from '../src/core/presses.ts';

// The worked example of #68: the start position after a roll of pawn, bishop
// and queen, with the cursor where a new game leaves it.
const LEGAL = ['b2b3', 'b2b4', 'd2d3', 'd2d4', 'e2e3', 'e2e4'];
const CURSOR = 'e2';

const strategy = (overrides: Partial<Strategy>): Strategy => ({
  ...CURRENT,
  ...overrides,
});

const cost = (s: Strategy, move = 'b2b4', legal = LEGAL, cursor = CURSOR) =>
  actionCost(s, cursor, legal, move).presses;

test('historical baseline: three squares to b2, OK, two squares to b4, OK', () => {
  assert.equal(cost(CURRENT), 7);
});

test('waiting on the central pawn saves a press even one square at a time', () => {
  assert.equal(cost(strategy({ start: 'central' })), 6);
});

test('jumping from the central pawn reaches b2 in one press', () => {
  assert.equal(cost(strategy({ pieces: 'jump', start: 'central' })), 5);
});

test('jumping between destinations as well makes b2b4 four presses', () => {
  const both = strategy({
    pieces: 'jump',
    start: 'central',
    destinations: 'jump',
  });
  // The cursor lands on b3, the destination nearer the pawn, and one press
  // reaches b4.
  assert.equal(cost(both), 4);
  // A move to the square it lands on needs no arrow at all.
  assert.equal(cost(both, 'b2b3'), 3);
});

test('with the board, a picked-up pawn lands on its two-square push', () => {
  const tv = strategy({
    pieces: 'jump',
    start: 'sticky',
    destinations: 'jump',
  });
  const board = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  const withBoard = (move: string) =>
    actionCost(tv, 'b2', LEGAL, move, false, board).presses;
  // OK on b2, then OK on b4 where the cursor lands.
  assert.equal(withBoard('b2b4'), 2);
  // The single step is now the one that takes an arrow.
  assert.equal(withBoard('b2b3'), 3);
});

test('with the board, a piece that can take lands on the capture', () => {
  const tv = strategy({
    pieces: 'jump',
    start: 'sticky',
    destinations: 'jump',
  });
  // The e4 pawn can push to e5 or take the pawn on d5.
  const board = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR';
  const legal = ['e4d5', 'e4e5'];
  // OK on e4, then OK on d5 where the cursor lands.
  assert.equal(actionCost(tv, 'e4', legal, 'e4d5', false, board).presses, 2);
  // Landing always on the central destination puts the cursor on e5, the
  // nearer one, and the capture takes an arrow.
  const central = { ...tv, landing: 'central' as const };
  assert.equal(
    actionCost(central, 'e4', legal, 'e4d5', false, board).presses,
    3,
  );
});

test('staying put jumps from wherever the cursor was left', () => {
  // e2 holds a movable pawn: two jumps left, through d2, reach b2.
  assert.equal(cost(strategy({ pieces: 'jump' })), 6);
  assert.equal(cost(strategy({ pieces: 'jump', start: 'sticky' })), 6);
  // From a square that holds no movable piece, sticky moves to the centre.
  assert.equal(
    cost(strategy({ pieces: 'jump', start: 'sticky' }), 'b2b4', LEGAL, 'h8'),
    5,
  );
});

test('a promotion adds the OK that confirms the piece', () => {
  const promotions = ['a7a8q', 'a7a8r', 'a7a8b', 'a7a8n'];
  assert.equal(cost(CURRENT, 'a7a8q', promotions, 'a7'), 4);
});

test('a choice jumps cannot reach is counted a square per press, and flagged', () => {
  // e6 sits in a box of pieces that are each in line with another, so the axis
  // rule never lands on it; the cursor waits on e6 only if it is the centre.
  const legal = ['d5d4', 'd7d8', 'e6e5', 'g5g4', 'g7g8', 'h7h8'];
  const axis = strategy({ pieces: 'jump', start: 'stay' });
  // Two squares to e6, OK, one square to e5, OK.
  const missed = actionCost(axis, 'd5', legal, 'e6e5');
  assert.deepEqual(missed, { presses: 5, reachable: false });
  // One jump to e6, OK, one square to e5, OK.
  const cone = actionCost({ ...axis, rule: 'cone' }, 'd5', legal, 'e6e5');
  assert.deepEqual(cone, { presses: 4, reachable: true });
});

test('the current cyclic strategy counts a boundary press and both OKs', () => {
  const legal = [...'abcdefgh'].map((file) => `${file}2${file}4`);
  const tv: Strategy = {
    pieces: 'jump',
    start: 'sticky',
    destinations: 'jump',
    rule: 'cone',
    wrap: true,
  };
  assert.deepEqual(actionCost(tv, 'h2', legal, 'a2a4'), {
    presses: 3,
    reachable: true,
  });
  assert.equal(
    actionCost({ ...tv, wrap: false }, 'h2', legal, 'a2a4').presses,
    9,
  );
  assert.equal(
    actionCost(
      tv,
      'a7',
      legal.map((m) => m.replaceAll('2', '7').replaceAll('4', '5')),
      'h7h5',
      true,
    ).presses,
    3,
  );
});
