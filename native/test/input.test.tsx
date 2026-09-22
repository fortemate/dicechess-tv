import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
  press,
  listenerCount,
  UserInputEventName,
} from './stubs/react-native-kepler.mjs';
import { GameScreen } from '../src/GameScreen';
import { PIECES } from '../src/pieces';
import { THEME } from '../src/theme';

type Instance = renderer.ReactTestInstance;
type Style = Record<string, string | number | undefined>;

const styleOf = (node: Instance): Style => (node.props.style ?? {}) as Style;
const isHost = (node: Instance, name: string) =>
  (node.type as unknown as string) === name;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mount = () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(GameScreen));
  });
  return tree.root;
};

const send = (...keys: string[]) => {
  for (const key of keys) act(() => press(key));
};

const text = (root: Instance) =>
  root
    .findAll((node) => isHost(node, 'Text'), { deep: true })
    .map((node) => String(node.props.children))
    .join('\n');

const overlays = (root: Instance, match: (style: Style) => boolean) =>
  root.findAll(
    (node) =>
      isHost(node, 'View') &&
      styleOf(node).position === 'absolute' &&
      match(styleOf(node)),
    { deep: true },
  );

const { Up, Down, Left, Right, Select, Back } = UserInputEventName;

test('the screen subscribes to all six remote keys', () => {
  mount();
  assert.equal(listenerCount(), 6);
});

test('it opens waiting for a roll, and OK rolls the instructional dice', () => {
  const root = mount();
  assert.match(text(root), /OK: roll three dice/);
  assert.match(text(root), /TURN 1/);

  send(Select);
  // Queen, rook, knight, and it is White's turn to act.
  assert.match(text(root), /Remaining: Queen · Rook · Knight/);
  assert.match(text(root), /White to play/);
  assert.match(text(root), /Arrows: move focus/);
});

test('arrows move the focus ring and OK picks a piece up', () => {
  const root = mount();
  send(Select);
  assert.match(text(root), /Cursor e2/);

  // e2 holds a pawn with no die for it, so OK there does nothing.
  send(Select);
  assert.match(text(root), /Arrows: move focus/);

  // Walk to b1 and select the knight.
  send(Down, Left, Left, Left, Select);
  assert.match(text(root), /Cursor b1/);
  assert.match(text(root), /Choose a destination for b1/);
  assert.equal(
    overlays(root, (s) => s.backgroundColor === THEME.selected).length,
    1,
  );
  // Its two legal destinations are marked.
  assert.equal(
    overlays(
      root,
      (s) => s.borderColor === THEME.destination && s.borderStyle === 'dashed',
    ).length,
    2,
  );
});

test('Back drops a selection without touching the position', () => {
  const root = mount();
  send(Select, Down, Left, Left, Left, Select);
  assert.match(text(root), /Choose a destination for b1/);

  send(Back);
  assert.match(text(root), /Arrows: move focus/);
  assert.equal(
    overlays(root, (s) => s.backgroundColor === THEME.selected).length,
    0,
  );
  // The knight is still home and the dice are untouched.
  assert.match(text(root), /Remaining: Queen · Rook · Knight/);
});

test('a complete turn plays out on the remote and hands over', () => {
  const root = mount();
  send(Select);

  // b1c3 with the knight die.
  send(Down, Left, Left, Left, Select, Up, Up, Right, Select);
  assert.match(text(root), /Remaining: Queen · Rook/);
  assert.equal(root.findAllByType(PIECES.N as never).length, 2);
  // Both ends of the move are marked.
  assert.equal(
    overlays(root, (s) => s.backgroundColor === THEME.lastMove).length,
    2,
  );

  // a1b1 with the rook die: the only action left.
  send(Left, Left, Down, Down, Select, Right, Select);
  assert.match(text(root), /Remaining: Queen/);

  // The queen die is unusable, so the turn ends and hands over.
  assert.match(text(root), /OK: continue/);
  send(Select);
  assert.match(text(root), /TURN 2/);
  assert.match(text(root), /Black to play/);
  assert.match(text(root), /OK: roll three dice/);
});

test('an illegal destination changes nothing', () => {
  const root = mount();
  send(Select, Down, Left, Left, Left, Select);
  const before = text(root);

  // d4 is not one of the knight's destinations and holds no piece that can act.
  send(Up, Up, Up, Right, Right, Select);
  assert.match(text(root), /Choose a destination for b1/);
  assert.match(text(root), /Remaining: Queen · Rook · Knight/);
  assert.notEqual(before, text(root)); // only the cursor moved
  assert.match(text(root), /Cursor d4/);
});
