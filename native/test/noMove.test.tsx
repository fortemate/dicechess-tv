// A roll with nothing to play, through the whole app (#85): what the screen
// says, what is heard, how long the bot holds it, and when OK passes the turn.
// Steps the app schedules wait in a queue here, with the wait they asked for,
// so a test can look at the screen in between.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { press } from './stubs/react-native-kepler.mjs';
import { reset } from './stubs/react-native-mmkv.mjs';
import { App } from '../src/App';
import { NO_MOVE_LINE } from '../src/GameScreen';
import {
  BOT_STEP_MS,
  OK_GUARD_MS,
  PASS_HOLD_MS,
  type ScreenOptions,
} from '../src/screen';
import type { Sounds } from '../src/sound';
import { THEME } from '../src/theme';
import type { Cue } from '../../src/core/cues';

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

// Every roll is the same one, and Random draws White.
const optionsFor = (
  roll: number[],
  clock: ReturnType<typeof scheduler>,
): ScreenOptions => ({
  roll: () => [...roll],
  newId: () => 'nomove',
  schedule: clock.schedule,
  side: () => 'w',
});

const recorder = () => {
  const self: Sounds & { played: Cue[][]; muted: boolean | null } = {
    played: [],
    muted: null,
    play(cues) {
      if (cues.length) self.played.push([...cues]);
    },
    setMuted(value) {
      self.muted = value;
    },
    setSuspended() {},
  };
  return self;
};

const launch = (options: ScreenOptions, sounds: Sounds) => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(App, { options, sounds }));
  });
  return tree;
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

// The dice faces, in order, by the colour only a face has.
const faces = (root: Instance): Style[] =>
  root
    .findAll(
      (node) =>
        (node.type as unknown as string) === 'View' &&
        (node.props.style as Style | undefined)?.backgroundColor === THEME.die,
    )
    .map((node) => node.props.style as Style);

const dimmedWithoutRing = (die: Style) =>
  die.borderWidth === 0 && (die.opacity as number) < 1;

test('a hotseat roll with nothing to play is announced and heard, and OK waits out the guard', () => {
  reset();
  const clock = scheduler();
  const sounds = recorder();
  const tree = launch(optionsFor([5, 4, 6], clock), sounds);
  // A new hotseat game, then queen, rook and king: nothing can move.
  send('enter', 'enter');
  const shown = text(tree.root);
  assert.match(shown, /White has no legal moves/);
  assert.ok(shown.includes(NO_MOVE_LINE));
  assert.deepEqual(sounds.played, [['dice_roll', 'no_move']]);
  const dice = faces(tree.root);
  assert.equal(dice.length, 3);
  assert.ok(dice.every(dimmedWithoutRing));

  // A second OK, as from a double press, is ignored until the guard runs out.
  assert.deepEqual(clock.waits(), [OK_GUARD_MS]);
  send('enter');
  assert.match(text(tree.root), /TURN 1/);
  clock.next();
  send('enter');
  assert.match(text(tree.root), /TURN 2/);
  assert.match(text(tree.root), /Black to play/);
  act(() => tree.unmount());
});

test('against the bot both sides’ empty rolls are announced, and the bot holds its own longer', () => {
  reset();
  const clock = scheduler();
  const tree = launch(optionsFor([5, 4, 6], clock), recorder());
  // Play Random, on Random, which draws White; then roll.
  send('down', 'enter', 'enter', 'enter');
  assert.match(text(tree.root), /White has no legal moves · you/);
  assert.deepEqual(clock.waits(), [OK_GUARD_MS]);
  clock.next();
  send('enter');

  // The bot's roll comes at the usual pace.
  assert.deepEqual(clock.waits(), [BOT_STEP_MS]);
  clock.next();
  const shown = text(tree.root);
  assert.match(shown, /Black has no legal moves/);
  assert.doesNotMatch(shown, /Black has no legal moves · you/);
  assert.ok(shown.includes(NO_MOVE_LINE));
  // Its pass waits longer, so the notice can be read first.
  assert.deepEqual(clock.waits(), [PASS_HOLD_MS]);
  clock.next();
  assert.match(text(tree.root), /White to play · you/);
  assert.match(text(tree.root), /TURN 3/);
  act(() => tree.unmount());
});

test('a turn that ends with dice left dims them, with no notice, no cue and no guard', () => {
  reset();
  const clock = scheduler();
  const sounds = recorder();
  const tree = launch(optionsFor([2, 6, 6], clock), sounds);
  // A new hotseat game and knight, king, king. The cursor waits on g1: OK picks
  // it up and lands on f3, OK plays it, and nothing can use the kings.
  send('enter', 'enter', 'enter', 'enter');
  const shown = text(tree.root);
  assert.match(shown, /White to play/);
  assert.match(shown, /OK: continue/);
  assert.ok(!shown.includes(NO_MOVE_LINE));
  assert.deepEqual(sounds.played, [['dice_roll'], ['piece_move']]);
  const [knight, ...kings] = faces(tree.root);
  assert.ok((knight.width as number) < 72, 'the spent knight shrinks');
  assert.equal(kings.length, 2);
  assert.ok(kings.every(dimmedWithoutRing));
  assert.ok(kings.every((king) => king.width === 72));

  // OK passes at once: there is nothing to guard.
  assert.deepEqual(clock.waits(), []);
  send('enter');
  assert.match(text(tree.root), /TURN 2/);
  act(() => tree.unmount());
});

test('with sound off, the empty roll still shows: the notice and the dimmed dice', () => {
  reset();
  const clock = scheduler();
  const sounds = recorder();
  const tree = launch(optionsFor([5, 4, 6], clock), sounds);
  // Home, nothing saved: Sound is fifth. Turn it off, go back up to a new
  // hotseat game, and roll.
  send('down', 'down', 'down', 'down', 'enter');
  assert.equal(sounds.muted, true);
  send('up', 'up', 'up', 'up', 'enter', 'enter');
  const shown = text(tree.root);
  assert.match(shown, /White has no legal moves/);
  assert.ok(shown.includes(NO_MOVE_LINE));
  assert.ok(faces(tree.root).every(dimmedWithoutRing));
  act(() => tree.unmount());
});
