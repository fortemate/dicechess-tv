import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pieceAt } from '../src/core/board.ts';

const INITIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const SPARSE = '8/8/8/3P4/8/8/8/8';

test('piece letters are read from both colors and both edges of the board', () => {
  assert.equal(pieceAt(INITIAL, 'a1'), 'R');
  assert.equal(pieceAt(INITIAL, 'b1'), 'N');
  assert.equal(pieceAt(INITIAL, 'd1'), 'Q');
  assert.equal(pieceAt(INITIAL, 'e1'), 'K');
  assert.equal(pieceAt(INITIAL, 'h1'), 'R');
  assert.equal(pieceAt(INITIAL, 'a2'), 'P');
  assert.equal(pieceAt(INITIAL, 'h7'), 'p');
  assert.equal(pieceAt(INITIAL, 'a8'), 'r');
  assert.equal(pieceAt(INITIAL, 'e8'), 'k');
  assert.equal(pieceAt(INITIAL, 'h8'), 'r');
});

test('every square agrees with an independent expansion of the rank fields', () => {
  const expand = (board: string) =>
    board
      .split('/')
      .map((rank) =>
        [...rank].map((c) => (Number(c) ? '.'.repeat(Number(c)) : c)).join(''),
      );
  for (const board of [INITIAL, SPARSE, '4k3/8/8/8/8/8/6PP/R3K2R']) {
    const rows = expand(board);
    for (let rank = 1; rank <= 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = String.fromCharCode(97 + file) + rank;
        const expected = rows[8 - rank][file];
        assert.equal(
          pieceAt(board, square),
          expected === '.' ? null : expected,
          `${board} at ${square}`,
        );
      }
    }
  }
});

test('empty squares on either side of a skipped run return null', () => {
  assert.equal(pieceAt(SPARSE, 'd5'), 'P');
  assert.equal(pieceAt(SPARSE, 'c5'), null);
  assert.equal(pieceAt(SPARSE, 'e5'), null);
  assert.equal(pieceAt(SPARSE, 'h5'), null);
  assert.equal(pieceAt(INITIAL, 'e4'), null);
});

test('malformed squares and malformed boards return null instead of throwing', () => {
  assert.equal(pieceAt(INITIAL, 'i1'), null);
  assert.equal(pieceAt(INITIAL, 'a9'), null);
  assert.equal(pieceAt(INITIAL, 'a0'), null);
  assert.equal(pieceAt(INITIAL, 'a'), null);
  assert.equal(pieceAt(INITIAL, ''), null);
  assert.equal(pieceAt(INITIAL, 'a1b2'), null);
  assert.equal(pieceAt('8/8/8/8/8/8/8', 'a1'), null);
  assert.equal(pieceAt('', 'a1'), null);
});
