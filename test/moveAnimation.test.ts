// What a renderer slides after one action (#131): the pieces that travelled,
// the piece that was taken, and nothing at all when the board was reset.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { movePlan } from '../src/core/moveAnimation.ts';

const INITIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR';

test('a move slides one piece, and nothing is taken', () => {
  assert.deepEqual(movePlan(INITIAL, AFTER_E4, 'e2e4'), {
    slides: [{ from: 'e2', to: 'e4', piece: 'P' }],
    taken: null,
  });
});

test('a capture keeps the taken piece on the destination until the mover lands', () => {
  assert.deepEqual(
    movePlan('4k3/8/8/3p4/4P3/8/8/4K3', '4k3/8/8/3P4/8/8/8/4K3', 'e4d5'),
    {
      slides: [{ from: 'e4', to: 'd5', piece: 'P' }],
      taken: { square: 'd5', piece: 'p' },
    },
  );
});

test('castling slides the king, then the rook, on either side', () => {
  assert.deepEqual(
    movePlan('r3k2r/8/8/8/8/8/8/R3K2R', 'r3k2r/8/8/8/8/8/8/R4RK1', 'e1g1'),
    {
      slides: [
        { from: 'e1', to: 'g1', piece: 'K' },
        { from: 'h1', to: 'f1', piece: 'R' },
      ],
      taken: null,
    },
  );
  assert.deepEqual(
    movePlan('r3k2r/8/8/8/8/8/8/R3K2R', '2kr3r/8/8/8/8/8/8/R3K2R', 'e8c8'),
    {
      slides: [
        { from: 'e8', to: 'c8', piece: 'k' },
        { from: 'a8', to: 'd8', piece: 'r' },
      ],
      taken: null,
    },
  );
});

test('en passant takes the pawn behind the destination', () => {
  assert.deepEqual(
    movePlan('4k3/8/8/3pP3/8/8/8/4K3', '4k3/8/3P4/8/8/8/8/4K3', 'e5d6'),
    {
      slides: [{ from: 'e5', to: 'd6', piece: 'P' }],
      taken: { square: 'd5', piece: 'p' },
    },
  );
});

test('a promoted pawn slides as a pawn, with or without a capture', () => {
  assert.deepEqual(
    movePlan('7k/4P3/8/8/8/8/8/4K3', '4Q2k/8/8/8/8/8/8/4K3', 'e7e8q'),
    { slides: [{ from: 'e7', to: 'e8', piece: 'P' }], taken: null },
  );
  assert.deepEqual(
    movePlan('3r3k/4P3/8/8/8/8/8/4K3', '3Q3k/8/8/8/8/8/8/4K3', 'e7d8q'),
    {
      slides: [{ from: 'e7', to: 'd8', piece: 'P' }],
      taken: { square: 'd8', piece: 'r' },
    },
  );
});

test('a new game, a rematch or a resumed game is redrawn, not slid', () => {
  // They report no last move, however few squares changed.
  assert.equal(movePlan(AFTER_E4, INITIAL, null), null);
  assert.equal(movePlan(INITIAL, INITIAL, 'e2e4'), null);
});

test('only the action the game reports is slid', () => {
  // The squares say e2e4, the game says d2d4: something else happened.
  assert.equal(movePlan(INITIAL, AFTER_E4, 'd2d4'), null);
  // Two pieces moved, and not by castling.
  assert.equal(
    movePlan(
      INITIAL,
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR',
      'e7e5',
    ),
    null,
  );
});
