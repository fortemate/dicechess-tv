import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DiceChess } from '@fortemate/dicechess-engine';
import {
  INITIAL,
  applyLegal,
  decode,
  derive,
  shiftSquare,
} from '../src/core/model.ts';

test('one human action hands the fixed knight fixture to a local random bot', () => {
  const after = { schema: 1 as const, humanMove: 'b1c3' };
  const state = derive(after);
  assert.equal(state.phase, 'bot');
  assert.equal(state.dfen.split(' ')[1], 'b');
  assert.equal(state.dfen.split(' ')[6], 'N');
  const reply = DiceChess.getBestMove(state.dfen, { algorithm: 'random' });
  assert.equal(reply.moves.length, 1);
  const move = reply.moves[0];
  const saved = {
    ...after,
    botMove: move.from + move.to + (move.promotion ?? '').toLowerCase(),
  };
  assert.equal(derive(saved).phase, 'done');
  assert.deepEqual(decode(JSON.stringify(saved)), saved);
  assert.equal(derive(decode(JSON.stringify(saved))).dfen, derive(saved).dfen);
});
test('damaged, incompatible and illegal saved actions are rejected', () => {
  for (const value of [
    null,
    {},
    { schema: 2 },
    { schema: 1, humanMove: 'e2e4' },
    { schema: 1, botMove: 'b8c6' },
    { schema: 1, humanMove: '' },
  ]) {
    assert.throws(() => decode(JSON.stringify(value)));
  }
  assert.throws(() => applyLegal(INITIAL, 'e2e4'));
});
test('D-pad cursor respects edges and board orientation', () => {
  assert.equal(shiftSquare('a1', 'ArrowLeft'), 'a1');
  assert.equal(shiftSquare('a1', 'ArrowDown'), 'a1');
  assert.equal(shiftSquare('h8', 'ArrowUp'), 'h8');
  assert.equal(shiftSquare('h8', 'ArrowRight'), 'h8');
  assert.equal(shiftSquare('b1', 'ArrowUp'), 'b2');
  // Any other key leaves the cursor where it is.
  assert.equal(shiftSquare('e4', 'Enter'), 'e4');
});
