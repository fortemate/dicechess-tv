import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { press, hold, isSubscribed } from './stubs/react-native-kepler.mjs';
import { GameScreen } from '../src/GameScreen';
import { THEME } from '../src/theme';
import type { ScreenOptions } from '../src/screen';

type Instance = renderer.ReactTestInstance;
type Style = Record<string, string | number | undefined>;

const styleOf = (node: Instance): Style => (node.props.style ?? {}) as Style;
const isHost = (node: Instance, name: string) =>
  (node.type as unknown as string) === name;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// A fixed instructional roll: queen, rook, knight. Not production randomness.
const options: ScreenOptions = {
  roll: () => [5, 4, 2],
  newId: () => 'test',
  // The opponent steps immediately in tests; the app spaces the steps out.
  schedule: (step) => step(),
};

// Assertions read the screen's own state report rather than panel wording, so
// they test behaviour instead of copy.
type Mounted = { root: Instance; state: () => string };

const mount = (): Mounted => {
  let tree!: renderer.ReactTestRenderer;
  const reports: string[] = [];
  act(() => {
    tree = renderer.create(
      React.createElement(GameScreen, {
        options,
        onState: (line: string) => reports.push(line),
      }),
    );
  });
  const mounted = {
    root: tree.root,
    state: () => reports[reports.length - 1] ?? '',
  };
  // Every launch opens on the home screen; these tests are about the board, so
  // they start a hotseat game first.
  act(() => press('enter'));
  return mounted;
};

// The same, stopped on the home screen.
const mountHome = (): Mounted => {
  let tree!: renderer.ReactTestRenderer;
  const reports: string[] = [];
  act(() => {
    tree = renderer.create(
      React.createElement(GameScreen, {
        options,
        onState: (line: string) => reports.push(line),
      }),
    );
  });
  return { root: tree.root, state: () => reports[reports.length - 1] ?? '' };
};

const send = (...keys: string[]) => {
  for (const key of keys) act(() => press(key));
};

const overlays = (root: Instance, match: (style: Style) => boolean) =>
  root.findAll(
    (node) =>
      isHost(node, 'View') &&
      styleOf(node).position === 'absolute' &&
      match(styleOf(node)),
    { deep: true },
  );

// Vega's own event names. The Virtual Device keyboard sends `enter` for OK; a
// physical remote sends `select`.
const Up = 'up';
const Down = 'down';
const Left = 'left';
const Right = 'right';
const Select = 'enter';
const Back = 'back';

test('the screen subscribes to the TV event channel', () => {
  mount();
  assert.equal(isSubscribed(), true);
});

test('OK arrives as either enter or select', () => {
  const first = mount();
  send('enter');
  assert.match(first.state(), /dice "QRN"/);

  const second = mount();
  send('select');
  assert.match(second.state(), /dice "QRN"/);
});

test('holding a direction walks the cursor; holding OK acts once', () => {
  const { state } = mount();
  send(Select);
  assert.match(state(), /cursor e2/);

  // Three down events without a release move three squares.
  act(() => hold('right', 3));
  assert.match(state(), /cursor h2/);

  // Holding OK repeats the down event, but nothing happens until release.
  act(() => hold('enter', 3));
  assert.match(state(), /selected -/);
});

test('an unknown key is ignored', () => {
  const { state } = mount();
  send(Select);
  const before = state();
  send('playpause');
  assert.equal(state(), before);
});

test('it opens on the home screen and starts the mode that was chosen', () => {
  const home = mountHome();
  assert.match(home.state(), /overlay home/);
  send(Select);
  assert.match(home.state(), /overlay none \| turn 1 \| phase roll/);

  const random = mountHome();
  send(Down, Select);
  assert.match(random.state(), /overlay none/);
});

test('OK on the board rolls the dice', () => {
  const { state } = mount();
  assert.match(state(), /overlay none \| turn 1 \| phase roll/);
  send(Select);
  assert.match(state(), /phase move \| side w \| dice "QRN" \| legal 4/);
});

test('arrows move the focus, OK picks a piece up and marks its destinations', () => {
  const { root, state } = mount();
  send(Select);

  // e2 holds a pawn with no die for it, so OK there selects nothing.
  send(Select);
  assert.match(state(), /selected -/);

  send(Down, Left, Left, Left, Select);
  assert.match(state(), /cursor b1 \| selected b1/);
  assert.equal(
    overlays(root, (s) => s.backgroundColor === THEME.selected).length,
    1,
  );
  assert.equal(
    overlays(
      root,
      (s) => s.borderColor === THEME.destination && s.borderStyle === 'dashed',
    ).length,
    2,
  );
});

test('Back cancels a selection before it opens the menu', () => {
  const { state } = mount();
  send(Select, Down, Left, Left, Left, Select);
  assert.match(state(), /selected b1/);

  send(Back);
  assert.match(state(), /overlay none/);
  assert.match(state(), /selected -/);
  assert.match(state(), /dice "QRN"/);

  send(Back);
  assert.match(state(), /overlay menu/);
});

test('a complete turn plays out on the remote and hands over', () => {
  const { root, state } = mount();
  send(Select);

  send(Down, Left, Left, Left, Select, Up, Up, Right, Select);
  assert.match(state(), /dice "QR" \| legal 1/);
  assert.match(state(), /last b1c3/);
  assert.equal(
    overlays(root, (s) => s.backgroundColor === THEME.lastMove).length,
    2,
  );

  send(Left, Left, Down, Down, Select, Right, Select);
  assert.match(state(), /dice "Q"/);
  assert.match(state(), /phase handoff/);

  send(Select);
  assert.match(state(), /turn 2 \| phase roll \| side b/);
});

test('an illegal destination changes nothing but the cursor', () => {
  const { state } = mount();
  send(Select, Down, Left, Left, Left, Select);

  send(Up, Up, Up, Right, Right, Select);
  assert.match(state(), /cursor d4 \| selected b1/);
  assert.match(state(), /dice "QRN"/);
});
