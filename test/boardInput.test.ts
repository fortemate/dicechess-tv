import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boardInput,
  movesFrom,
  type BoardFocus,
  type BoardKey,
} from '../src/core/boardInput.ts';
import { newGame, rollGame, moveGame, viewGame } from '../src/core/game.ts';
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
) => {
  const actions = [];
  let current = focus;
  for (const key of keys) {
    const result = boardInput(current, key, legal);
    current = result.focus;
    if (result.action.type !== 'none') actions.push(result.action);
  }
  return { focus: current, actions };
};

const OPENING = ['b1a3', 'b1c3', 'g1f3', 'g1h3'];

test('arrows move the cursor and clamp at the edges instead of trapping it', () => {
  assert.equal(boardInput(at('d4'), 'up', []).focus.cursor, 'd5');
  assert.equal(boardInput(at('d4'), 'down', []).focus.cursor, 'd3');
  assert.equal(boardInput(at('d4'), 'left', []).focus.cursor, 'c4');
  assert.equal(boardInput(at('d4'), 'right', []).focus.cursor, 'e4');

  // A cursor pinned to a corner still moves back off it.
  assert.equal(boardInput(at('a1'), 'down', []).focus.cursor, 'a1');
  assert.equal(boardInput(at('a1'), 'left', []).focus.cursor, 'a1');
  assert.equal(boardInput(at('a1'), 'up', []).focus.cursor, 'a2');
  assert.equal(boardInput(at('h8'), 'up', []).focus.cursor, 'h8');
  assert.equal(boardInput(at('h8'), 'left', []).focus.cursor, 'g8');
});

test('arrows never change the selection or ask the controller for anything', () => {
  const result = boardInput(at('d4', 'b1'), 'right', OPENING);
  assert.equal(result.focus.selected, 'b1');
  assert.deepEqual(result.action, { type: 'none' });
});

test('select picks up a piece that has a legal action, and ignores one that has none', () => {
  const picked = boardInput(at('b1'), 'select', OPENING);
  assert.equal(picked.focus.selected, 'b1');
  assert.deepEqual(picked.action, { type: 'none' });

  // The a1 rook is blocked on the opening roll, so nothing happens.
  const ignored = boardInput(at('a1'), 'select', OPENING);
  assert.equal(ignored.focus.selected, null);
  assert.deepEqual(ignored.action, { type: 'none' });

  // Nor does an empty square pick anything up.
  assert.equal(boardInput(at('e4'), 'select', OPENING).focus.selected, null);
});

test('select on a legal destination emits exactly that move', () => {
  const { focus, actions } = drive(
    at('b1'),
    ['select', 'up', 'up', 'right'],
    OPENING,
  );
  assert.equal(focus.selected, 'b1');
  assert.equal(focus.cursor, 'c3');
  assert.deepEqual(actions, []);

  const result = boardInput(focus, 'select', OPENING);
  assert.deepEqual(result.action, { type: 'move', move: 'b1c3' });
  // The move is intent only: the focus is left for the controller to reset.
  assert.equal(result.focus.selected, 'b1');
});

test('select on a square that is not a destination switches pieces instead', () => {
  // b1 selected, cursor on g1: g1 can act, so it becomes the new selection
  // rather than producing a move or forcing a Back press first.
  const result = boardInput(at('g1', 'b1'), 'select', OPENING);
  assert.equal(result.focus.selected, 'g1');
  assert.deepEqual(result.action, { type: 'none' });
});

test('select on a dead square with a piece selected changes nothing', () => {
  const result = boardInput(at('e4', 'b1'), 'select', OPENING);
  assert.equal(result.focus.selected, 'b1');
  assert.equal(result.focus.cursor, 'e4');
  assert.deepEqual(result.action, { type: 'none' });
});

test('an ambiguous destination is handed back as a promotion choice', () => {
  const promotions = ['a7a8q', 'a7a8r', 'a7a8b', 'a7a8n'];
  const result = boardInput(at('a8', 'a7'), 'select', promotions);
  assert.deepEqual(result.action, { type: 'promote', moves: promotions });
  // The board does not choose a piece on the player's behalf.
  assert.equal(result.focus.selected, 'a7');
});

test('back drops the selection, then asks to leave', () => {
  const dropped = boardInput(at('c3', 'b1'), 'back', OPENING);
  assert.equal(dropped.focus.selected, null);
  assert.equal(dropped.focus.cursor, 'c3');
  assert.deepEqual(dropped.action, { type: 'none' });

  const leaving = boardInput(dropped.focus, 'back', OPENING);
  assert.deepEqual(leaving.action, { type: 'exit' });
  assert.equal(leaving.focus.cursor, 'c3');
});

test('movesFrom reports what a square can do', () => {
  assert.deepEqual(movesFrom(OPENING, 'b1'), ['b1a3', 'b1c3']);
  assert.deepEqual(movesFrom(OPENING, 'a1'), []);
});

test('a full remote-driven action against the engine produces a legal move', () => {
  // Queen, rook, knight: only the knights can act from the opening position.
  const game = rollGame(newGame('hotseat', 'input'), [5, 4, 2]);
  const legal = viewGame(game).legal;

  // g1 is four presses right and one down from the starting cursor at c2.
  const path: BoardKey[] = [
    'down',
    'right',
    'right',
    'right',
    'right',
    'select',
    'up',
    'up',
    'left',
  ];
  const { focus } = drive(at('c2'), path, legal);
  assert.equal(focus.selected, 'g1');
  assert.equal(focus.cursor, 'f3');

  const result = boardInput(focus, 'select', legal);
  assert.equal(result.action.type, 'move');
  const move = (result.action as { move: string }).move;
  assert.equal(move, 'g1f3');
  // The controller accepts it, which is the only proof that matters.
  const next = moveGame(game, move);
  assert.equal(next.lastMove, 'g1f3');
  assert.equal(viewGame(next).remaining, 'QR');
});
