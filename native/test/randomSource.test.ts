import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomSource } from '../src/randomSource';
import { rollDice } from '../../src/core/game';

test('it uses crypto when the runtime offers it, and says so', () => {
  const calls: number[] = [];
  const source = randomSource({
    crypto: {
      getRandomValues: (bytes: Uint8Array) => {
        calls.push(bytes.length);
        bytes.fill(7);
      },
    },
  });
  assert.equal(source.name, 'crypto.getRandomValues');
  const bytes = new Uint8Array(8);
  source.fill(bytes);
  assert.deepEqual(calls, [8]);
  assert.ok(bytes.every((byte) => byte === 7));
});

test('it falls back to Math.random and names that instead of hiding it', () => {
  const source = randomSource({});
  assert.equal(source.name, 'Math.random');
  const bytes = new Uint8Array(64);
  source.fill(bytes);
  assert.ok(bytes.every((byte) => byte >= 0 && byte <= 255));
  // Not a randomness test, only that it is not writing a constant.
  assert.ok(new Set(bytes).size > 1);
});

test('either source feeds the same rejection sampling, so dice stay in range', () => {
  for (const scope of [{}, globalThis]) {
    const source = randomSource(scope);
    for (let i = 0; i < 200; i++) {
      const dice = rollDice(source.fill);
      assert.equal(dice.length, 3);
      assert.ok(
        dice.every((die) => Number.isInteger(die) && die >= 1 && die <= 6),
      );
    }
  }
});
