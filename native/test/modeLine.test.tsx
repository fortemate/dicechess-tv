// The line over the home screen and the menus names a game only when there is
// one to name (#234): the game Resume returns to, or, over the choice of
// colour, the opponent of the game about to start. A first launch, and a game
// that has ended, have none.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { press, pressBack } from './stubs/react-native-kepler.mjs';
import { reset } from './stubs/react-native-mmkv.mjs';
import { focusedLabel, optionViews } from './options';
import { App } from '../src/App';
import type { ScreenOptions } from '../src/screen';

type Instance = renderer.ReactTestInstance;
type Style = Record<string, string | number | undefined>;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const options: ScreenOptions = {
  // Queen, rook, knight: a knight can always move at the start.
  roll: () => [5, 4, 2],
  newId: () => 'modeline',
  schedule: (step) => step(),
  // Random draws White.
  side: () => 'w',
};

// A launch replaces the app a previous test left mounted, as a relaunch does;
// what was saved stays saved.
let mounted: renderer.ReactTestRenderer | null = null;
const launch = (): Instance => {
  if (mounted) act(() => mounted!.unmount());
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(App, { options }));
  });
  mounted = tree;
  return tree.root;
};

const send = (...keys: string[]) => {
  for (const key of keys)
    act(() => {
      if (key === 'back') pressBack();
      else press(key);
    });
};

// The mode line, drawn in spaced capitals: there is at most one.
const modeLines = (root: Instance): string[] =>
  root
    .findAll(
      (node) =>
        (node.type as unknown as string) === 'Text' &&
        (node.props.style as Style | undefined)?.letterSpacing === 2,
      { deep: true },
    )
    .map((node) => String(node.props.children));

const titles = (root: Instance) =>
  root
    .findAll(
      (node) =>
        (node.type as unknown as string) === 'Text' &&
        (node.props.style as Style | undefined)?.fontSize === 30,
      { deep: true },
    )
    .map((node) => String(node.props.children));

// From the home screen without a game to resume: Play the computer, then the
// cards, where Right moves from Rolly to Grabby.
const toGrabbyColours = () => send('down', 'enter', 'right', 'enter');

test('a first launch shows no mode line over the offer or the home screen', () => {
  reset({ firstLaunch: true });
  const root = launch();
  assert.deepEqual(modeLines(root), []);
  // Skip, to the home screen: still no game.
  send('down', 'enter');
  assert.deepEqual(titles(root), ['Dice Chess']);
  assert.deepEqual(modeLines(root), []);
});

test('a launch with no saved game shows no line over the home screen or its settings', () => {
  reset();
  const root = launch();
  assert.equal(focusedLabel(root), 'New Hot Seat game');
  assert.deepEqual(modeLines(root), []);
  // Settings is the fifth option.
  send('down', 'down', 'down', 'down', 'enter');
  assert.deepEqual(titles(root), ['Settings']);
  assert.deepEqual(modeLines(root), []);
  send('back');
  assert.deepEqual(modeLines(root), []);
});

test('the choice of colour names the opponent chosen', () => {
  reset();
  const root = launch();
  toGrabbyColours();
  assert.deepEqual(titles(root), ['Play Grabby as']);
  assert.deepEqual(modeLines(root), ['VS GRABBY']);
});

test('over a game to resume, the home screen and its settings name that game', () => {
  reset();
  let root = launch();
  // A new hotseat game, rolled, and the app closed and opened again.
  send('enter', 'enter');
  root = launch();
  assert.equal(focusedLabel(root), 'Resume game');
  assert.deepEqual(modeLines(root), ['HOT SEAT · TURN 1']);
  send('down', 'down', 'down', 'down', 'down', 'enter');
  assert.deepEqual(titles(root), ['Settings']);
  assert.deepEqual(modeLines(root), ['HOT SEAT · TURN 1']);
});

test('over a game to resume, the colour choice names the new opponent and the confirmation the game it replaces', () => {
  reset();
  let root = launch();
  // Rolly, as White, rolled; then the app closed and opened again.
  send('down', 'enter', 'enter', 'enter', 'enter');
  root = launch();
  assert.deepEqual(modeLines(root), ['VS ROLLY · TURN 1']);
  // Resume game is first, so Play the computer is two down. Grabby, Random.
  send('down', 'down', 'enter', 'right', 'enter');
  assert.deepEqual(modeLines(root), ['VS GRABBY']);
  send('enter');
  assert.deepEqual(titles(root), ['Replace this game?']);
  assert.deepEqual(modeLines(root), ['VS ROLLY · TURN 1']);
});

test('a game that has ended leaves the home screen without a line', () => {
  reset();
  const root = launch();
  // Rolly, as White: roll, resign, Yes; then Main menu.
  send('down', 'enter', 'enter', 'enter', 'enter');
  send('back', 'down', 'enter', 'down', 'enter');
  assert.ok(optionViews(root).some((option) => option.label === 'Rematch'));
  send('down', 'enter');
  assert.deepEqual(titles(root), ['Dice Chess']);
  assert.equal(focusedLabel(root), 'New Hot Seat game');
  assert.deepEqual(modeLines(root), []);
});

test('the menu of a game in play keeps its line', () => {
  reset();
  const root = launch();
  // A new hotseat game, before its first roll: Back opens its menu.
  send('enter', 'back');
  assert.deepEqual(titles(root), ['Menu']);
  assert.deepEqual(modeLines(root), ['HOT SEAT · TURN 1']);
});
