import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeSnapshot } from '../src/core/snapshotStore.ts';
import { newGame, rollGame, decodeGame } from '../src/core/game.ts';

test('a snapshot is validated before it is handed to a store', () => {
  const game = rollGame(newGame('hotseat', 'encode'), [5, 4, 2]);
  const raw = encodeSnapshot(game, decodeGame);
  assert.deepEqual(decodeGame(raw), game);
});

test('encoding throws exactly what decoding throws, so nothing is written', () => {
  const damaged = { ...newGame('hotseat', 'encode'), phase: 'nonsense' };
  assert.throws(
    () => encodeSnapshot(damaged, decodeGame),
    /Unsupported or damaged game save|Phase does not match/,
  );
});

test('the caller cannot change a snapshot after it has been encoded', () => {
  const game = rollGame(newGame('hotseat', 'encode'), [5, 4, 2]);
  const raw = encodeSnapshot(game, decodeGame);
  game.moves.push('b1c3');
  assert.deepEqual(decodeGame(raw).moves, []);
});
