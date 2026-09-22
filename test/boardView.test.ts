import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardView } from '../src/core/boardView.ts';
import { newGame, rollGame, viewGame } from '../src/core/game.ts';

const INITIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const flat = (board: string, extra = {}) =>
  boardView({ board, ...extra }).flat();
const at = (board: string, square: string, extra = {}) =>
  flat(board, extra).find((view) => view.square === square)!;

test('the grid reads in render order with White at the bottom', () => {
  const rows = boardView({ board: INITIAL });
  assert.equal(rows.length, 8);
  assert.ok(rows.every((row) => row.length === 8));
  assert.equal(rows[0][0].square, 'a8');
  assert.equal(rows[0][7].square, 'h8');
  assert.equal(rows[7][0].square, 'a1');
  assert.equal(rows[7][7].square, 'h1');
});

test('pieces match the position and every square is covered once', () => {
  const squares = flat(INITIAL).map((view) => view.square);
  assert.equal(new Set(squares).size, 64);
  assert.equal(at(INITIAL, 'e1').piece, 'K');
  assert.equal(at(INITIAL, 'e8').piece, 'k');
  assert.equal(at(INITIAL, 'b1').piece, 'N');
  assert.equal(at(INITIAL, 'e4').piece, null);
  assert.equal(flat(INITIAL).filter((view) => view.piece).length, 32);
});

test('a1 is dark and colors alternate along a rank and a file', () => {
  assert.equal(at(INITIAL, 'a1').dark, true);
  assert.equal(at(INITIAL, 'b1').dark, false);
  assert.equal(at(INITIAL, 'a2').dark, false);
  assert.equal(at(INITIAL, 'h8').dark, true);
  assert.equal(flat(INITIAL).filter((view) => view.dark).length, 32);
});

test('destinations appear only for the selected piece', () => {
  const legal = ['b1a3', 'b1c3', 'g1f3', 'g1h3'];
  const none = flat(INITIAL, { legal });
  assert.equal(none.filter((view) => view.destination).length, 0);

  const chosen = flat(INITIAL, { legal, selected: 'b1' });
  const marked = chosen
    .filter((view) => view.destination)
    .map((view) => view.square);
  assert.deepEqual(marked.sort(), ['a3', 'c3']);
  assert.equal(chosen.filter((view) => view.selected).length, 1);
  assert.equal(at(INITIAL, 'b1', { legal, selected: 'b1' }).selected, true);
});

test('cursor and last move are marked independently of selection', () => {
  const view = flat(INITIAL, { cursor: 'd4', lastMove: 'b1c3' });
  assert.deepEqual(
    view.filter((v) => v.cursor).map((v) => v.square),
    ['d4'],
  );
  assert.deepEqual(
    view
      .filter((v) => v.lastMove)
      .map((v) => v.square)
      .sort(),
    ['b1', 'c3'],
  );
  assert.equal(view.filter((v) => v.selected).length, 0);
});

test('the grid tracks a real engine position and its legal actions', () => {
  // Queen, rook, knight: only the knights can act from the opening position.
  const game = rollGame(newGame('hotseat', 'view'), [5, 4, 2]);
  const state = viewGame(game);
  const board = state.dfen.split(' ')[0];
  const marked = boardView({ board, legal: state.legal, selected: 'g1' })
    .flat()
    .filter((view) => view.destination)
    .map((view) => view.square);
  assert.deepEqual(marked.sort(), ['f3', 'h3']);
  assert.equal(
    boardView({ board })
      .flat()
      .filter((view) => view.piece).length,
    32,
  );
});
