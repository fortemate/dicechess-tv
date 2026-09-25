import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diceOf } from '../src/core/dice.ts';
import { moveGame, newGame, nextTurn, rollGame } from '../src/core/game.ts';

const faces = (dice: { piece: string; spent: boolean }[]) =>
  dice
    .map(({ piece, spent }) => (spent ? piece.toLowerCase() : piece))
    .join('');

test('there are no dice before the roll, and three after it', () => {
  const game = newGame('hotseat', 'dice');
  assert.deepEqual(diceOf(game), []);
  // Queen, rook, knight: upper case is unspent.
  assert.equal(faces(diceOf(rollGame(game, [5, 4, 2]))), 'QRN');
});

test('an action spends its die', () => {
  const rolled = rollGame(newGame('hotseat', 'dice'), [5, 4, 2]);
  assert.equal(faces(diceOf(moveGame(rolled, 'b1c3'))), 'QRn');
});

test('a repeated piece is spent from the left', () => {
  const rolled = rollGame(newGame('hotseat', 'dice'), [1, 1, 3]);
  assert.equal(faces(diceOf(moveGame(rolled, 'e2e4'))), 'pPB');
});

test('castling spends the king die and a rook die', () => {
  const rolled = rollGame(
    newGame(
      'hotseat',
      'castle',
      'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
    ),
    [6, 4, 1],
  );
  assert.equal(faces(diceOf(rolled)), 'KRP');
  assert.equal(faces(diceOf(moveGame(rolled, 'e1g1'))), 'krP');
});

test('a turn handed over clears the dice', () => {
  // Rook, rook, rook from the start: nothing can move, so the turn is handed on.
  const stuck = rollGame(newGame('hotseat', 'stuck'), [4, 4, 4]);
  assert.equal(stuck.phase, 'handoff');
  assert.equal(faces(diceOf(stuck)), 'RRR');
  assert.deepEqual(diceOf(nextTurn(stuck)), []);
});
