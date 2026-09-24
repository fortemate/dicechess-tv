import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasExactKeys } from '../src/core/keys.ts';

test('exactly the given keys pass, in any order', () => {
  assert.equal(hasExactKeys({ b: 1, a: 2 }, ['a', 'b']), true);
  assert.equal(hasExactKeys({}, []), true);
});

test('a missing or an unexpected key fails', () => {
  assert.equal(hasExactKeys({ a: 1 }, ['a', 'b']), false);
  assert.equal(hasExactKeys({ a: 1, b: 2, c: 3 }, ['a', 'b']), false);
  assert.equal(hasExactKeys({ a: 1, c: 3 }, ['a', 'b']), false);
});
