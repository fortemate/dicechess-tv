import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boardInput,
  movableSquares,
  movesFrom,
  waitingFocus,
  type BoardFocus,
  type BoardKey,
} from '../src/core/boardInput.ts';
import { route } from '../src/core/cursor.ts';
import {
  newGame,
  rollGame,
  moveGame,
  nextTurn,
  viewGame,
} from '../src/core/game.ts';
import type { Square } from '../src/core/board.ts';

const at = (cursor: string, selected: string | null = null): BoardFocus => ({
  cursor: cursor as Square,
  selected: selected as Square | null,
});

// Drive a sequence of keys and return the final focus and the actions produced.
const drive = (
  focus: BoardFocus,
  keys: BoardKey[],
  legal: readonly string[],
  flipped = false,
) => {
  const actions = [];
  let current = focus;
  for (const key of keys) {
    const result = boardInput(current, key, legal, flipped);
    current = result.focus;
    if (result.action.type !== 'none') actions.push(result.action);
  }
  return { focus: current, actions };
};

// Knights only, as after a roll of queen, rook and knight at the start.
const OPENING = ['b1a3', 'b1c3', 'g1f3', 'g1h3'];

test('arrows jump between the pieces that can move, and stay when none lies ahead', () => {
  assert.equal(boardInput(at('b1'), 'right', OPENING).focus.cursor, 'g1');
  assert.equal(boardInput(at('g1'), 'left', OPENING).focus.cursor, 'b1');
  // Both knights stand on the first rank: nothing lies above or below them.
  assert.equal(boardInput(at('b1'), 'up', OPENING).focus.cursor, 'b1');
  assert.equal(boardInput(at('b1'), 'left', OPENING).focus.cursor, 'b1');
  // From a square that holds no choice, a press still lands on one.
  assert.equal(boardInput(at('e4'), 'down', OPENING).focus.cursor, 'g1');
});

test('with a piece picked up, arrows jump between its destinations only', () => {
  const result = boardInput(at('a3', 'b1'), 'right', OPENING);
  assert.deepEqual(result.focus, at('c3', 'b1'));
  assert.deepEqual(result.action, { type: 'none' });
  // g1 can move too, but it is not a destination of the b1 knight.
  assert.equal(boardInput(at('c3', 'b1'), 'right', OPENING).focus.cursor, 'c3');
});

test('select picks up a piece and lands on its central destination', () => {
  const picked = boardInput(at('b1'), 'select', OPENING);
  // a3 and c3 are one press apart and equally far from b1; reading order
  // takes the left one.
  assert.deepEqual(picked.focus, at('a3', 'b1'));
  assert.deepEqual(picked.action, { type: 'none' });

  // The a1 rook is blocked on the opening roll, so nothing happens.
  const ignored = boardInput(at('a1'), 'select', OPENING);
  assert.deepEqual(ignored.focus, at('a1'));
  assert.deepEqual(ignored.action, { type: 'none' });

  // Nor does an empty square pick anything up.
  assert.equal(boardInput(at('e4'), 'select', OPENING).focus.selected, null);
});

test('a piece with a single destination is played with OK, then OK', () => {
  const { focus, actions } = drive(at('e2'), ['select', 'select'], ['e2e4']);
  assert.deepEqual(actions, [{ type: 'move', move: 'e2e4' }]);
  assert.deepEqual(focus, at('e4', 'e2'));
});

test('select on a legal destination emits exactly that move', () => {
  const { focus, actions } = drive(at('b1'), ['select', 'right'], OPENING);
  assert.deepEqual(focus, at('c3', 'b1'));
  assert.deepEqual(actions, []);

  const result = boardInput(focus, 'select', OPENING);
  assert.deepEqual(result.action, { type: 'move', move: 'b1c3' });
  // The move is intent only: the focus is left for the controller to reset.
  assert.equal(result.focus.selected, 'b1');
});

test('select on a piece that is not a destination switches pieces instead', () => {
  // b1 is picked up, but the cursor stands on g1, which can act: g1 becomes the
  // piece in hand, and the cursor lands on its destinations.
  const result = boardInput(at('g1', 'b1'), 'select', OPENING);
  assert.deepEqual(result.focus, at('f3', 'g1'));
  assert.deepEqual(result.action, { type: 'none' });
});

test('select on a dead square with a piece selected changes nothing', () => {
  const result = boardInput(at('e4', 'b1'), 'select', OPENING);
  assert.deepEqual(result.focus, at('e4', 'b1'));
  assert.deepEqual(result.action, { type: 'none' });
});

test('an ambiguous destination is handed back as a promotion choice', () => {
  const promotions = ['a7a8q', 'a7a8r', 'a7a8b', 'a7a8n'];
  const result = boardInput(at('a8', 'a7'), 'select', promotions);
  assert.deepEqual(result.action, { type: 'promote', moves: promotions });
  // The board does not choose a piece on the player's behalf.
  assert.equal(result.focus.selected, 'a7');
});

test('back puts the piece down with the cursor on it, then asks to leave', () => {
  const dropped = boardInput(at('c3', 'b1'), 'back', OPENING);
  assert.deepEqual(dropped.focus, at('b1'));
  assert.deepEqual(dropped.action, { type: 'none' });

  const leaving = boardInput(dropped.focus, 'back', OPENING);
  assert.deepEqual(leaving.action, { type: 'exit' });
  assert.equal(leaving.focus.cursor, 'b1');
});

test('the cursor waits on its square while that piece can move, else on the central one', () => {
  assert.deepEqual(waitingFocus('b1', OPENING), at('b1'));
  // e2 holds no knight: of b1 and g1, g1 is nearer.
  assert.deepEqual(waitingFocus('e2', OPENING), at('g1'));
  // A picked-up piece is put down.
  assert.deepEqual(waitingFocus('b1', OPENING).selected, null);
  // With nothing to choose, the cursor stays.
  assert.deepEqual(waitingFocus('e2', []), at('e2'));
});

test('on the board turned for Black, the arrows follow the screen', () => {
  const black = ['b8a6', 'b8c6', 'g8f6', 'g8h6'];
  // Seen from Black, g8 is on the left of b8.
  assert.equal(boardInput(at('b8'), 'left', black, true).focus.cursor, 'g8');
  assert.equal(boardInput(at('b8'), 'right', black, true).focus.cursor, 'b8');
  // The picked-up knight lands on the destination further left on the screen.
  assert.deepEqual(
    boardInput(at('b8'), 'select', black, true).focus,
    at('c6', 'b8'),
  );
});

test('movesFrom and movableSquares report what the squares can do', () => {
  assert.deepEqual(movesFrom(OPENING, 'b1'), ['b1a3', 'b1c3']);
  assert.deepEqual(movesFrom(OPENING, 'a1'), []);
  assert.deepEqual(movableSquares(['g1f3', 'b1c3', 'g1h3']), ['b1', 'g1']);
});

test('a full remote-driven action against the engine produces a legal move', () => {
  // Queen, rook, knight: only the knights can act from the opening position.
  const game = rollGame(newGame('hotseat', 'input'), [5, 4, 2]);
  const legal = viewGame(game).legal;

  // A new game leaves the cursor on e2, where nothing can move: it waits on g1.
  const waiting = waitingFocus('e2', legal);
  assert.equal(waiting.cursor, 'g1');
  const toKnight = route('g1', 'b1', movableSquares(legal)) as BoardKey[];
  assert.deepEqual(toKnight, ['left']);
  const { focus } = drive(waiting, [...toKnight, 'select', 'right'], legal);
  assert.deepEqual(focus, at('c3', 'b1'));

  const result = boardInput(focus, 'select', legal);
  assert.deepEqual(result.action, { type: 'move', move: 'b1c3' });
  // The controller accepts it, which is the only proof that matters.
  const next = moveGame(game, 'b1c3');
  assert.equal(next.lastMove, 'b1c3');
  assert.equal(viewGame(next).remaining, 'QR');
});

test('the worked example in #68: the pieces that can move follow maximal dice use', () => {
  // Pawn, bishop and queen at the start (die faces 1, 3 and 5): only the pawns
  // that free both the bishop and the queen can move.
  const rolled = rollGame(newGame('hotseat', 'example'), [1, 3, 5]);
  const movable = (game = rolled) => movableSquares(viewGame(game).legal);
  assert.deepEqual(movable(), ['b2', 'd2', 'e2']);
  // The central pawn is d2: one press from each of the others.
  assert.deepEqual(waitingFocus('h8', viewGame(rolled).legal), at('d2'));
  // After b2b3 only the bishop can move; after d2d4 the bishop and the queen.
  assert.deepEqual(movable(moveGame(rolled, 'b2b3')), ['c1']);
  assert.deepEqual(movable(moveGame(rolled, 'd2d4')), ['c1', 'd1']);
  // Black gets the mirror, once White has passed on queen, queen, king.
  const passed = nextTurn(rollGame(newGame('hotseat', 'example'), [5, 5, 6]));
  assert.deepEqual(movable(rollGame(passed, [1, 3, 5])), ['b7', 'd7', 'e7']);
});
