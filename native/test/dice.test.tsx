import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Dice } from '../src/Dice';
import { PIECES } from '../src/pieces';
import { THEME } from '../src/theme';
import type { Die } from '../../src/core/dice';

type Instance = renderer.ReactTestInstance;
type Style = Record<string, string | number | undefined>;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const styleOf = (node: Instance): Style => (node.props.style ?? {}) as Style;
const isHost = (node: Instance) => (node.type as unknown as string) === 'View';

const mount = (dice: Die[], side: 'w' | 'b', size = 72): Instance => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(Dice, { dice, side, size }));
  });
  return tree.root;
};

// A face is the view that carries the die's colour; a slot outline has none.
const faces = (root: Instance) =>
  root.findAll(
    (node) => isHost(node) && styleOf(node).backgroundColor === THEME.die,
  );
const slots = (root: Instance) =>
  root.findAll(
    (node) => isHost(node) && styleOf(node).borderColor === THEME.dieSlot,
  );

test('before the roll there are three empty slots', () => {
  const root = mount([], 'w');
  assert.equal(slots(root).length, 3);
  assert.equal(faces(root).length, 0);
});

test('each face shows its piece in the colour of the side to move', () => {
  const dice = [
    { piece: 'Q', spent: false, leftover: false },
    { piece: 'R', spent: false, leftover: false },
    { piece: 'N', spent: false, leftover: false },
  ];
  const white = mount(dice, 'w');
  assert.equal(faces(white).length, 3);
  assert.equal(white.findAllByType(PIECES.Q as never).length, 1);
  assert.equal(white.findAllByType(PIECES.N as never).length, 1);
  const black = mount(dice, 'b');
  assert.equal(black.findAllByType(PIECES.q as never).length, 1);
  assert.equal(black.findAllByType(PIECES.Q as never).length, 0);
});

test('a spent die dims and shrinks, and only an unspent one carries a ring', () => {
  const root = mount(
    [
      { piece: 'P', spent: true, leftover: false },
      { piece: 'P', spent: false, leftover: false },
      { piece: 'B', spent: false, leftover: false },
    ],
    'w',
    72,
  );
  const [spent, unspent] = faces(root).map(styleOf);
  assert.equal(spent.opacity, 0.3);
  assert.ok((spent.width as number) < 72, `spent die ${spent.width}`);
  assert.equal(spent.borderWidth, 0);
  assert.equal(unspent.opacity, 1);
  assert.equal(unspent.width, 72);
  assert.equal(unspent.borderColor, THEME.dieRing);
  assert.ok((unspent.borderWidth as number) > 0);
  // The slot keeps its size, so nothing moves when a die shrinks.
  assert.equal(
    root.findAll(
      (node) =>
        isHost(node) &&
        styleOf(node).width === 72 &&
        styleOf(node).backgroundColor === undefined,
    ).length >= 3,
    true,
  );
});

test('a die the turn could not use dims and loses its ring, but keeps its size', () => {
  // A knight was played, and nothing could use the two kings left.
  const root = mount(
    [
      { piece: 'N', spent: true, leftover: false },
      { piece: 'K', spent: false, leftover: true },
      { piece: 'K', spent: false, leftover: true },
    ],
    'w',
    72,
  );
  const [spent, leftover] = faces(root).map(styleOf);
  assert.equal(leftover.borderWidth, 0);
  assert.equal(leftover.width, 72);
  // Dimmed, and still told apart from a spent die by more than colour: size.
  assert.ok((leftover.opacity as number) < 1, `opacity ${leftover.opacity}`);
  assert.ok((spent.width as number) < (leftover.width as number));
});
