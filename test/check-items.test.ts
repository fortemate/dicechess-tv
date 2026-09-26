// The colour-vision check's pictures and scoring (site/src/check/items.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ITEMS,
  VARIANTS,
  decodeAnswers,
  encodeAnswers,
  isLight,
  scoreAnswers,
  scoreItem,
  squareName,
  type Item,
} from '../site/src/check/items.ts';

const item = (id: string) => ITEMS.find((each) => each.id === id) as Item;

test('squares are numbered in screen order from a8', () => {
  assert.equal(squareName(0), 'a8');
  assert.equal(squareName(7), 'h8');
  assert.equal(squareName(56), 'a1');
  assert.equal(squareName(63), 'h1');
  assert.equal(isLight(0), true);
  assert.equal(isLight(7), false);
  assert.equal(isLight(56), false);
  assert.equal(isLight(63), true);
});

test('each variant has two pictures that test both square colours', () => {
  assert.equal(new Set(ITEMS.map((each) => each.id)).size, ITEMS.length);
  for (const variant of VARIANTS) {
    assert.equal(
      ITEMS.filter((each) => each.variant === variant).length,
      2,
      variant,
    );
  }
  for (const each of ITEMS) {
    assert.ok(each.movable.includes(each.cursor), `${each.id}: the cursor`);
    const marked = each.movable.filter((cell) => cell !== each.cursor);
    assert.ok(
      marked.some((cell) => !isLight(cell)),
      `${each.id}: dark marks`,
    );
    assert.ok(each.movable.some(isLight), `${each.id}: light marks`);
    assert.deepEqual(
      each.lastMove.map(isLight).sort(),
      [false, true],
      `${each.id}: the last move`,
    );
  }
});

test('taps are sorted into found, missed, last move and other', () => {
  // a-many marks c7 e7 g7 h7 d6 and f6, the cursor; its last move is f3-g3.
  assert.deepEqual(scoreItem(item('a-many'), [10, 12, 45, 0]), {
    found: 2,
    missed: 3,
    lastMove: 1,
    other: 1,
  });
});

test('the square under the cursor counts neither way', () => {
  assert.deepEqual(scoreItem(item('a-many'), [21]), {
    found: 0,
    missed: 5,
    lastMove: 0,
    other: 0,
  });
  assert.deepEqual(scoreItem(item('a-few'), []), {
    found: 0,
    missed: 1,
    lastMove: 0,
    other: 0,
  });
});

test('totals add up per variant, over the pictures answered', () => {
  const totals = scoreAnswers({
    'a-many': [10, 12, 14, 15, 19],
    'a-few': [27],
    'c-few': [58],
    unknown: [1, 2, 3],
  });
  assert.deepEqual(totals.A, { found: 5, missed: 1, lastMove: 1, other: 0 });
  assert.deepEqual(totals.B, { found: 0, missed: 0, lastMove: 0, other: 0 });
  assert.deepEqual(totals.C, { found: 1, missed: 0, lastMove: 0, other: 0 });
});

test('an answer code reads back as the answers', () => {
  const answers = {
    v: 1 as const,
    id: '3f1c2b9e-8d4a-4c1e-9b7f-0a2d6e5c4b3a',
    vision: 'not-sure',
    screen: 'tv',
    order: ITEMS.map((each) => each.id),
    taps: { 'b-many': [46, 57], 'b-few': [] },
  };
  assert.deepEqual(decodeAnswers(` ${encodeAnswers(answers)}\n`), answers);
  assert.throws(() => decodeAnswers(btoa('{"v":2}')), /Not an answer code/);
});
