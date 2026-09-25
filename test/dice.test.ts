import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diceOf } from '../src/core/dice.ts';
import {
  moveGame,
  newGame,
  nextTurn,
  rollGame,
  viewGame,
  type Game,
} from '../src/core/game.ts';

// As a screen calls it: with the view it has already computed.
const diceFor = (game: Game) => diceOf(game.roll, viewGame(game).remaining);

const faces = (dice: { piece: string; spent: boolean }[]) =>
  dice
    .map(({ piece, spent }) => (spent ? piece.toLowerCase() : piece))
    .join('');

test('there are no dice before the roll, and three after it', () => {
  const game = newGame('hotseat', 'dice');
  assert.deepEqual(diceFor(game), []);
  // Queen, rook, knight: upper case is unspent.
  assert.equal(faces(diceFor(rollGame(game, [5, 4, 2]))), 'QRN');
});

test('an action spends its die', () => {
  const rolled = rollGame(newGame('hotseat', 'dice'), [5, 4, 2]);
  assert.equal(faces(diceFor(moveGame(rolled, 'b1c3'))), 'QRn');
});

test('a repeated piece is spent from the left', () => {
  const rolled = rollGame(newGame('hotseat', 'dice'), [1, 1, 3]);
  assert.equal(faces(diceFor(moveGame(rolled, 'e2e4'))), 'pPB');
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
  assert.equal(faces(diceFor(rolled)), 'KRP');
  assert.equal(faces(diceFor(moveGame(rolled, 'e1g1'))), 'krP');
});

test('a turn handed over clears the dice', () => {
  // Rook, rook, rook from the start: nothing can move, so the turn is handed on.
  const stuck = rollGame(newGame('hotseat', 'stuck'), [4, 4, 4]);
  assert.equal(stuck.phase, 'handoff');
  assert.equal(faces(diceFor(stuck)), 'RRR');
  assert.deepEqual(diceFor(nextTurn(stuck)), []);
});

// As the game screen calls it once a turn can be over.
const diceAtEnd = (game: Game) =>
  diceOf(game.roll, viewGame(game).remaining, game.phase === 'handoff');

test('once the turn is over, the dice it could not use are leftovers', () => {
  // Rook, rook, rook from the start: all three are left over, none spent.
  const stuck = diceAtEnd(rollGame(newGame('hotseat', 'stuck'), [4, 4, 4]));
  assert.deepEqual(
    stuck.map(({ spent, leftover }) => [spent, leftover]),
    [
      [false, true],
      [false, true],
      [false, true],
    ],
  );
  // Knight, king, king: the knight is spent, and nothing can use the kings.
  const partial = moveGame(
    rollGame(newGame('hotseat', 'partial'), [2, 6, 6]),
    'b1c3',
  );
  assert.equal(partial.phase, 'handoff');
  assert.deepEqual(
    diceAtEnd(partial).map(({ piece, spent, leftover }) => [
      piece,
      spent,
      leftover,
    ]),
    [
      ['N', true, false],
      ['K', false, true],
      ['K', false, true],
    ],
  );
});

test('while an action remains, no die is a leftover', () => {
  const rolled = rollGame(newGame('hotseat', 'live'), [5, 4, 2]);
  assert.ok(diceAtEnd(rolled).every(({ leftover }) => !leftover));
  assert.ok(
    diceAtEnd(moveGame(rolled, 'b1c3')).every(({ leftover }) => !leftover),
  );
});
