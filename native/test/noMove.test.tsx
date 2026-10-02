// A roll with nothing to play, through the whole app (#85): what the screen
// says, what is heard, and when OK passes the turn.
// Steps the app schedules wait in a queue here, with the wait they asked for,
// so a test can look at the screen in between.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { press, pressBack } from './stubs/react-native-kepler.mjs';
import { MMKV, reset } from './stubs/react-native-mmkv.mjs';
import { App } from '../src/App';
import { saveHost } from '../src/hostSetting';
import { NO_MOVE_LINE } from '../src/GameScreen';
import { BOT_STEP_MS, OK_GUARD_MS, type ScreenOptions } from '../src/screen';
import { DISMISS_DELAY_MS } from '../src/useBotVoice';
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
    say() {},
    stopLine() {},
    setVoices() {},
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

// Back arrives on its own channel on Vega, as in the other screen tests.
const send = (...keys: string[]) => {
  for (const key of keys)
    act(() => {
      if (key === 'back') pressBack();
      else press(key);
    });
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
  // Without the host, whose bubble would stand where the turn line is read.
  saveHost(new MMKV(), false);
  const clock = scheduler();
  const sounds = recorder();
  const tree = launch(optionsFor([5, 4, 6], clock), sounds);
  // A new hotseat game, then queen, rook and king: nothing can move.
  send('enter', 'enter');
  const shown = text(tree.root);
  assert.match(shown, /No legal moves/);
  assert.doesNotMatch(shown, /to play/);
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

test('against the bot both sides’ empty rolls are announced, and the bot’s waits for OK, which rolls', () => {
  // Rolly's opening line stands in the turn line's place while it shows
  // (#168), and it goes on the voice's own timer.
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    reset();
    const clock = scheduler();
    const sounds = recorder();
    const tree = launch(optionsFor([5, 4, 6], clock), sounds);
    // Play the computer, Rolly, on Random, which draws White; then roll.
    send('down', 'enter', 'enter', 'enter', 'enter');
    // Said aloud, the line stays until it has been said: under 6 s for the
    // longest (#159).
    act(() => mock.timers.tick(DISMISS_DELAY_MS * 3));
    assert.match(text(tree.root), /No legal moves · you/);
    assert.deepEqual(clock.waits(), [OK_GUARD_MS]);
    clock.next();
    send('enter');

    // The bot's roll comes at the usual pace, and its notice names it.
    assert.deepEqual(clock.waits(), [BOT_STEP_MS]);
    clock.next();
    let shown = text(tree.root);
    assert.match(shown, /Rolly can't move/);
    assert.doesNotMatch(shown, /No legal moves/);
    assert.ok(shown.includes(NO_MOVE_LINE));
    assert.match(shown, /OK: roll three dice/);
    assert.doesNotMatch(shown, /Rolly is playing/);
    assert.ok(faces(tree.root).every(dimmedWithoutRing));

    // Nothing passes the turn but the person: only the guard is waiting.
    assert.deepEqual(clock.waits(), [OK_GUARD_MS]);
    send('enter');
    assert.match(text(tree.root), /TURN 2/);
    clock.next();
    assert.deepEqual(clock.waits(), []);
    assert.match(text(tree.root), /Rolly can't move/);

    // One OK: the turn passes and the person's dice are thrown, heard as a roll.
    sounds.played.length = 0;
    send('enter');
    shown = text(tree.root);
    assert.match(shown, /TURN 3/);
    assert.match(shown, /No legal moves · you/);
    assert.deepEqual(sounds.played, [['dice_roll', 'no_move']]);
    act(() => tree.unmount());
  } finally {
    mock.timers.reset();
  }
});

test('a turn that ends with dice left dims them, with no notice, no cue and no guard', () => {
  reset();
  // Without the host, whose bubble would stand where the turn line is read.
  saveHost(new MMKV(), false);
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
  // Home, nothing saved: Settings is fifth, and without music in this build
  // the sound effects are its first row. Turn them off, go back up to a new
  // hotseat game, and roll.
  send('down', 'down', 'down', 'down', 'enter');
  send('enter');
  assert.equal(sounds.muted, true);
  send('back');
  send('up', 'up', 'up', 'up', 'enter', 'enter');
  const shown = text(tree.root);
  assert.match(shown, /No legal moves/);
  assert.ok(shown.includes(NO_MOVE_LINE));
  assert.ok(faces(tree.root).every(dimmedWithoutRing));
  act(() => tree.unmount());
});
