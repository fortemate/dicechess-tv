// A die no legal turn can spend dims as soon as that is known, through the
// whole app (#140): at a person's roll and after their action, and at the
// opponent's roll, before it plays. Steps the app schedules wait in a queue
// here, so a test can look at the screen between the opponent's steps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { press } from './stubs/react-native-kepler.mjs';
import { reset } from './stubs/react-native-mmkv.mjs';
import { App } from '../src/App';
import { BOT_STEP_MS, type ScreenOptions } from '../src/screen';
import type { Sounds } from '../src/sound';
import { THEME } from '../src/theme';

type Instance = renderer.ReactTestInstance;
type Style = Record<string, string | number | undefined>;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const scheduler = () => {
  const queue: { step: () => void; wait: number }[] = [];
  return {
    schedule: (step: () => void, wait: number) => {
      queue.push({ step, wait });
    },
    waits: () => queue.map(({ wait }) => wait),
    // Runs what waits now; what those steps schedule in turn waits for the next
    // call.
    next: () => {
      for (const { step } of queue.splice(0)) act(() => step());
    },
  };
};

// Every roll is queen, rook and knight. From the opening only a knight can move
// first, a rook can follow it, and the queen die is lost.
const optionsFor = (
  clock: ReturnType<typeof scheduler>,
  side: 'w' | 'b',
): ScreenOptions => ({
  roll: () => [5, 4, 2],
  newId: () => 'playable',
  schedule: clock.schedule,
  side: () => side,
});

const silent: Sounds = {
  play() {},
  setMuted() {},
  say() {},
  setVoices() {},
  setSuspended() {},
};

// The app, and the last line the game screen reported about itself.
const launch = (options: ScreenOptions) => {
  const reports: string[] = [];
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      React.createElement(App, {
        options,
        sounds: silent,
        onState: (line: string) => reports.push(line),
      }),
    );
  });
  const state = () =>
    reports.filter((line) => line.startsWith('overlay ')).at(-1) ?? '';
  return { tree, state };
};

const send = (...keys: string[]) => {
  for (const key of keys) act(() => press(key));
};

const text = (root: Instance) =>
  root
    .findAll((node) => (node.type as unknown as string) === 'Text', {
      deep: true,
    })
    .map((node) => String(node.props.children))
    .join('\n');

// Each die in roll order, as the screen draws it: lit, with its ring; dim,
// without the ring but at full size and at 45 %; or spent, at 30 % and smaller.
const looks = (root: Instance): string[] =>
  root
    .findAll(
      (node) =>
        (node.type as unknown as string) === 'View' &&
        (node.props.style as Style | undefined)?.backgroundColor === THEME.die,
    )
    .map((node) => {
      const die = node.props.style as Style;
      if (die.opacity === 0.3 && (die.width as number) < 72) return 'spent';
      if (die.opacity === 0.45 && die.borderWidth === 0 && die.width === 72)
        return 'dim';
      if (die.opacity === 1 && (die.borderWidth as number) > 0) return 'lit';
      return JSON.stringify(die);
    });

test('on a person’s roll the lost die dims at once and stays dim after an action', () => {
  reset();
  const { tree, state } = launch(optionsFor(scheduler(), 'w'));
  // A new hotseat game, then the roll.
  send('enter', 'enter');
  assert.match(state(), /dice "QRN" \| playable "RN"/);
  assert.deepEqual(looks(tree.root), ['dim', 'lit', 'lit']);
  // Left to the b1 knight, OK picks it up and lands on a3, and OK plays it.
  send('left', 'enter', 'enter');
  assert.match(state(), /dice "QR" \| playable "R"/);
  assert.match(state(), /last b1a3/);
  assert.deepEqual(looks(tree.root), ['dim', 'lit', 'spent']);
  act(() => tree.unmount());
});

test('on the opponent’s roll the lost die dims before it plays', () => {
  reset();
  const clock = scheduler();
  const { tree } = launch(optionsFor(clock, 'b'));
  // Play the computer, Rolly, on Random, which draws Black: the computer opens.
  send('down', 'enter', 'enter', 'enter');
  assert.deepEqual(clock.waits(), [BOT_STEP_MS]);
  clock.next();
  assert.match(text(tree.root), /Rolly is playing/);
  assert.deepEqual(looks(tree.root), ['dim', 'lit', 'lit']);
  // Its first action is a knight, whichever it picks, and the queen stays dim.
  clock.next();
  assert.deepEqual(looks(tree.root), ['dim', 'lit', 'spent']);
  act(() => tree.unmount());
});
