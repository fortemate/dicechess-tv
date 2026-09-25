import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
  press,
  pressBack,
  hold,
  isSubscribed,
  hasExited,
  clearExit,
} from './stubs/react-native-kepler.mjs';
import { GameScreen } from '../src/GameScreen';
import { THEME } from '../src/theme';
import type { ScreenOptions } from '../src/screen';
import { newGame, rollGame } from '../../src/core/game';
import { Dice } from '../src/Dice';

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
  // Random draws White unless a test says otherwise.
  side: () => 'w',
};

// Assertions read the screen's own state report rather than panel wording, so
// they test behaviour instead of copy.
type Mounted = { root: Instance; state: () => string };

// One screen at a time, as on a device. A tree left mounted from an earlier
// test would still be listening, and would claim presses meant for this one.
let mounted: renderer.ReactTestRenderer | null = null;
const replace = (create: () => renderer.ReactTestRenderer) => {
  if (mounted) act(() => mounted!.unmount());
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = create();
  });
  mounted = tree;
  return tree;
};

const mount = (): Mounted => {
  const reports: string[] = [];
  const tree = replace(() =>
    renderer.create(
      React.createElement(GameScreen, {
        options,
        onState: (line: string) => reports.push(line),
      }),
    ),
  );
  const view = {
    root: tree.root,
    state: () => reports[reports.length - 1] ?? '',
  };
  // Every launch opens on the home screen; these tests are about the board, so
  // they start a hotseat game first.
  act(() => press('enter'));
  return view;
};

// The same, stopped on the home screen.
const mountHome = (): Mounted => {
  const reports: string[] = [];
  const tree = replace(() =>
    renderer.create(
      React.createElement(GameScreen, {
        options,
        onState: (line: string) => reports.push(line),
      }),
    ),
  );
  return { root: tree.root, state: () => reports[reports.length - 1] ?? '' };
};

// Back arrives on its own channel: Vega routes it through a hook that lets the
// app claim the press, which is what stops the system closing the app.
const send = (...keys: string[]) => {
  for (const key of keys)
    act(() => {
      if (key === 'back') pressBack();
      else press(key);
    });
};

const overlays = (root: Instance, match: (style: Style) => boolean) =>
  root.findAll(
    (node) =>
      isHost(node, 'View') &&
      styleOf(node).position === 'absolute' &&
      match(styleOf(node)),
    { deep: true },
  );

// Vega's own event names. OK is `enter` from the Virtual Device keyboard,
// `kpenter` from its on-screen remote and `select` from a physical remote.
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

test('OK arrives as enter, kpenter or select', () => {
  for (const ok of ['enter', 'kpenter', 'select']) {
    const { state } = mount();
    send(ok);
    assert.match(state(), /dice "QRN"/, ok);
  }
});

test('holding a direction repeats it; holding OK acts once', () => {
  // Three down events without a release are three presses: the home menu has
  // room for them.
  const home = mountHome();
  act(() => hold('down', 3));
  assert.match(home.state(), /overlay home#3/);

  const { state } = mount();
  send(Select);
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
  // Play Random, then Random on the colour choice.
  send(Down, Select, Select);
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

  // e2 holds a pawn with no die for it, so after the roll the cursor waits on
  // a knight: g1, the nearer of the two.
  assert.match(state(), /cursor g1 \| selected -/);

  // Left jumps to the b1 knight; OK picks it up and lands on a3, the left of
  // its two destinations.
  send(Left, Select);
  assert.match(state(), /cursor a3 \| selected b1/);
  assert.equal(
    overlays(root, (s) => s.backgroundColor === THEME.selected).length,
    1,
  );
  // A dot on each of the knight's two empty destinations.
  assert.equal(
    overlays(root, (s) => s.backgroundColor === THEME.destination).length,
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

test('with a piece in hand the cursor lands only on its destinations', () => {
  const { state } = mount();
  send(Select, Left, Select);
  assert.match(state(), /cursor a3 \| selected b1/);

  // Nothing but c3 lies ahead of a3 among the knight's destinations, so no
  // press can reach a square the knight cannot go to.
  send(Up, Up, Right, Right, Down);
  assert.match(state(), /cursor c3 \| selected b1/);
  assert.match(state(), /dice "QRN"/);

  // Back puts the knight down and the cursor goes back to it.
  send(Back);
  assert.match(state(), /cursor b1 \| selected -/);
});

// pressBack returns whether the app claimed the press, which act() swallows, so
// it is captured rather than returned.
const back = (): boolean => {
  let handled = false;
  act(() => {
    handled = pressBack();
  });
  return handled;
};

test('Back at the home screen lets the app close, as it should on a TV', () => {
  clearExit();
  mountHome();
  // Nothing claims it, so the platform does what Back means at the top of an
  // app. Suppressing that would trap a viewer in the app.
  assert.equal(back(), false);
  assert.equal(hasExited(), true);
});

test('Back anywhere else is claimed, so the app stays open', () => {
  clearExit();
  const { state } = mount();
  send(Select);
  assert.equal(back(), true);
  assert.equal(hasExited(), false);
  assert.match(state(), /overlay menu/);
});

// Every line of text on the screen, as a viewer reads it.
const lines = (root: Instance): string[] =>
  root
    .findAll((node) => isHost(node, 'Text'), { deep: true })
    .map((node) => String(node.props.children));

test('the promotion choice names the pieces, with the queen first', () => {
  const reports: string[] = [];
  const tree = replace(() =>
    renderer.create(
      React.createElement(GameScreen, {
        options,
        // One step from promotion, with pawns rolled.
        initial: rollGame(
          newGame('hotseat', 'promotion', '4k3/P7/8/8/8/8/8/4K3 w - - 0 1'),
          [1, 1, 1],
        ),
        onState: (line: string) => reports.push(line),
      }),
    ),
  );
  // Resume, walk from e2 to a7, pick the pawn up and put it on a8.
  send(Select, Left, Left, Left, Left, Up, Up, Up, Up, Up, Select, Up, Select);
  assert.match(reports[reports.length - 1], /overlay promotion#0/);
  const choices = (root: Instance) =>
    lines(root).filter((line) => /^(> | {2})\S/.test(line));
  assert.ok(lines(tree.root).includes('Promote to'));
  assert.deepEqual(choices(tree.root), [
    '> Queen',
    '  Rook',
    '  Bishop',
    '  Knight',
  ]);
  send(Down);
  assert.equal(choices(tree.root)[1], '> Rook');
});

test('a finished game says how it ended and who won', () => {
  // From the menu of a hotseat game: Resume, Resign, Agree a draw, New game.
  const drawn = mount();
  send(Back, Down, Down, Select);
  assert.match(drawn.state(), /result agreed-draw/);
  assert.ok(lines(drawn.root).includes('Draw agreed'));
  assert.ok(lines(drawn.root).includes('Drawn'));

  // White is to move, so White resigns.
  const resigned = mount();
  send(Back, Down, Select, Down, Select);
  assert.match(resigned.state(), /result resigned/);
  assert.ok(lines(resigned.root).includes('Resigned'));
  assert.ok(lines(resigned.root).includes('Black wins'));
});

test('the panel shows the roll as dice, not words', () => {
  // The home screen is a menu and leaves the dice out.
  assert.equal(mountHome().root.findAllByType(Dice as never).length, 0);
  const { root } = mount();
  const dice = () => root.findByType(Dice as never).props.dice as unknown[];
  // Before the roll: three empty slots.
  assert.equal(dice().length, 0);
  send(Select);
  assert.equal(dice().length, 3);
  assert.ok(!lines(root).some((line) => line.startsWith('Remaining')));
});

test('the pieces that can move are marked until one is picked up', () => {
  const { root } = mount();
  const marked = () =>
    overlays(root, (s) => s.backgroundColor === THEME.movable).length;
  assert.equal(marked(), 0, 'nothing is marked before the roll');

  // Only the two knights can move on queen, rook and knight.
  send(Select);
  assert.equal(marked(), 2);

  // With a knight in hand only its destinations are shown.
  send(Select);
  assert.equal(marked(), 0);
  assert.equal(
    overlays(root, (s) => s.backgroundColor === THEME.destination).length,
    2,
  );
});
