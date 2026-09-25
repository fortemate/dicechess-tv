import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlights, movableSquares } from '../src/core/highlights.ts';
import {
  moveGame,
  newGame,
  nextTurn,
  resignGame,
  rollGame,
} from '../src/core/game.ts';

// Die faces as the engine reads them: 1 pawn, 3 bishop, 5 queen, 6 king.
const PAWN_BISHOP_QUEEN = [1, 3, 5];

test('the worked example in #68: pawns that open the way, and the pieces behind them', () => {
  const rolled = rollGame(newGame('hotseat', 'hl'), PAWN_BISHOP_QUEEN);
  assert.deepEqual(highlights(rolled), {
    now: ['b2', 'd2', 'e2'],
    later: ['c1', 'd1', 'f1'],
  });
});

test('after b2b3 only the bishop can move, and the queen waits for it', () => {
  const rolled = rollGame(newGame('hotseat', 'hl'), PAWN_BISHOP_QUEEN);
  assert.deepEqual(highlights(moveGame(rolled, 'b2b3')), {
    now: ['c1'],
    later: ['d1'],
  });
});

test('after d2d4 the bishop and the queen can both move, and nothing waits', () => {
  const rolled = rollGame(newGame('hotseat', 'hl'), PAWN_BISHOP_QUEEN);
  assert.deepEqual(highlights(moveGame(rolled, 'd2d4')), {
    now: ['c1', 'd1'],
    later: [],
  });
});

test('Black is marked from its own pieces, the mirror of White', () => {
  // White rolls queen, queen, king at the start and has nothing to play.
  const passed = nextTurn(rollGame(newGame('hotseat', 'hl'), [5, 5, 6]));
  assert.deepEqual(highlights(rollGame(passed, PAWN_BISHOP_QUEEN)), {
    now: ['b7', 'd7', 'e7'],
    later: ['c8', 'd8', 'f8'],
  });
});

test('nothing is marked before the roll, at a handoff, or once the game is over', () => {
  const fresh = newGame('hotseat', 'hl');
  assert.deepEqual(highlights(fresh), { now: [], later: [] });
  const empty = rollGame(fresh, [5, 5, 6]);
  assert.equal(empty.phase, 'handoff');
  assert.deepEqual(highlights(empty), { now: [], later: [] });
  const resigned = resignGame(rollGame(fresh, PAWN_BISHOP_QUEEN));
  assert.equal(resigned.phase, 'ended');
  assert.deepEqual(highlights(resigned), { now: [], later: [] });
});

test('the movable squares are the starts of the legal actions, once each', () => {
  assert.deepEqual(movableSquares(['e2e4', 'b1c3', 'e2e3', 'b1a3']), [
    'b1',
    'e2',
  ]);
});
