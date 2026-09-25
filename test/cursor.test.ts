import { test } from 'node:test';
import assert from 'node:assert/strict';
import { central, jump, pressesFrom, steps } from '../src/core/cursor.ts';

// The pawns that can move in the worked example of #68.
const PAWNS = ['b2', 'd2', 'e2'];

test('a square per press costs the distance along files plus ranks', () => {
  assert.equal(steps('d2', 'b2'), 2);
  assert.equal(steps('a1', 'h8'), 14);
  assert.equal(steps('e4', 'e4'), 0);
});

test('a press jumps to the next option ahead, and stays when there is none', () => {
  assert.equal(jump('d2', PAWNS, 'left'), 'b2');
  assert.equal(jump('d2', PAWNS, 'right'), 'e2');
  assert.equal(jump('d2', PAWNS, 'up'), null);
  assert.equal(jump('d2', PAWNS, 'down'), null);
});

test('the rules differ on an option in line against a nearer one to the side', () => {
  // From d2 upwards: d6 is in line four ranks away; b3 is one rank up, two
  // files aside.
  const options = ['b3', 'd6'];
  assert.equal(jump('d2', options, 'up', { rule: 'axis' }), 'd6');
  assert.equal(jump('d2', options, 'up', { rule: 'cone' }), 'd6');
  assert.equal(jump('d2', options, 'up', { rule: 'nearest' }), 'b3');
});

test('a tie goes to reading order: higher first, then further left', () => {
  assert.equal(jump('d4', ['e5', 'c5'], 'up'), 'c5');
  assert.equal(jump('d4', ['e3', 'e5'], 'right'), 'e5');
});

test('on the board turned for Black, left is the way Black sees it', () => {
  const pawns = ['b7', 'd7', 'e7'];
  assert.equal(jump('d7', pawns, 'left', { flipped: true }), 'e7');
  assert.equal(jump('d7', pawns, 'right', { flipped: true }), 'b7');
});

test('presses count the jumps, from an option or from any square', () => {
  assert.deepEqual(Object.fromEntries(pressesFrom('d2', PAWNS)), {
    d2: 0,
    b2: 1,
    e2: 1,
  });
  assert.deepEqual(Object.fromEntries(pressesFrom('a1', PAWNS)), {
    a1: 0,
    b2: 1,
    d2: 2,
    e2: 3,
  });
});

test('the axis rule can leave an option out of reach; the cone rule does not', () => {
  // e6 sits inside a box of options that are each in line with another.
  const options = ['d5', 'd7', 'e6', 'g5', 'g7', 'h7'];
  assert.equal(pressesFrom('d5', options, { rule: 'axis' }).has('e6'), false);
  assert.equal(pressesFrom('d5', options, { rule: 'cone' }).get('e6'), 1);
  // Unreachable options weigh on the choice of where to wait: from e6 every
  // other option is in reach, so it is the centre under axis.
  assert.equal(central(options, null, { rule: 'axis' }), 'e6');
});

test('the cursor waits on the option the others are fewest presses from', () => {
  assert.equal(central(PAWNS), 'd2');
  assert.equal(central(PAWNS, null, { stepwise: true }), 'd2');
  assert.equal(central(['b7', 'd7', 'e7'], null, { flipped: true }), 'd7');
  assert.equal(central([]), null);
});

test('between equally central options, the one nearer the cursor wins', () => {
  // Two options: each is one press from the other.
  assert.equal(central(['c3', 'f3'], 'g1'), 'f3');
  assert.equal(central(['c3', 'f3'], 'b1'), 'c3');
  assert.equal(central(['c3', 'f3']), 'c3');
});
