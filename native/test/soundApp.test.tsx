// Sound through the whole app: a step of a real game reaches the players, and
// turning sound off survives a relaunch. A test cannot hear, so what is checked
// is what was asked for; hearing it is checked on the virtual device.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { press, pressBack, setAppState } from './stubs/react-native-kepler.mjs';
import {
  fullyDrawnReports,
  resetFullyDrawnReports,
} from './stubs/kepler-performance-api.mjs';
import { reset } from './stubs/react-native-mmkv.mjs';
import { App } from '../src/App';
import type { ScreenOptions } from '../src/screen';
import type { Sounds } from '../src/sound';
import type { Cue } from '../../src/core/cues';
import { MmkvSnapshotStore } from '../src/mmkvStore';
import { decodeGame, newGame, rollGame, type Game } from '../../src/core/game';

type Instance = renderer.ReactTestInstance;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const options: ScreenOptions = {
  roll: () => [2, 2, 2],
  newId: () => 'soundtest',
  schedule: (step) => step(),
  // Random draws White unless a test says otherwise.
  side: () => 'w',
};

type Recorder = Sounds & {
  played: Cue[][];
  muted: boolean | null;
  suspended: boolean | null;
};

const recorder = (): Recorder => {
  const self: Recorder = {
    played: [],
    muted: null,
    suspended: null,
    play(cues) {
      if (cues.length) self.played.push([...cues]);
    },
    setMuted(value) {
      self.muted = value;
    },
    setSuspended(value) {
      self.suspended = value;
    },
  };
  return self;
};

// Each launch unmounts at the end of its test. Trees left mounted would all
// answer the same key presses, and a relaunch would not be one.
const launch = (sounds: Sounds) => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(App, { options, sounds }));
  });
  return tree;
};

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

test('a real game step reaches the sounds as the cue it is', () => {
  reset();
  const sounds = recorder();
  const tree = launch(sounds);
  // Start a hotseat game, then roll.
  send('enter', 'enter');
  assert.deepEqual(sounds.played, [['dice_roll']]);
  act(() => tree.unmount());
});

test('turning sound off is remembered at the next launch', () => {
  reset();
  const first = recorder();
  let tree = launch(first);
  assert.equal(first.muted, false, 'sound starts on');
  assert.match(text(tree.root), /Sound: on/);

  // Home, nothing saved: new hotseat, Play the computer, How to play, Rules,
  // Sound.
  send('down', 'down', 'down', 'down', 'enter');
  assert.match(text(tree.root), /Sound: off/);
  assert.equal(first.muted, true);
  act(() => tree.unmount());

  const second = recorder();
  tree = launch(second);
  assert.match(text(tree.root), /Sound: off/);
  assert.equal(second.muted, true, 'a relaunch starts muted');
  act(() => tree.unmount());
});

test('a win as Black is heard as a win', () => {
  reset();
  // Saved mid-turn: the person plays Black, rolled three rooks, and the rook on
  // a1 can take the White king on a8.
  const saved = rollGame(
    newGame('random', 'asblack', 'K7/8/8/8/8/8/8/r3k3 b - - 0 1', 'b'),
    [4, 4, 4],
  );
  new MmkvSnapshotStore<Game>({
    key: 'dicechess-tv.game.v2',
    decode: decodeGame,
  }).save(saved);
  const sounds = recorder();
  const tree = launch(sounds);
  // Resume, then walk from e7 to a1 and on to a8 on the board seen from
  // Black's side, where up on the screen is towards rank 1.
  send('enter');
  send('up', 'up', 'up', 'up', 'up', 'up', 'right', 'right', 'right', 'right');
  send('enter');
  send('down', 'down', 'down', 'down', 'down', 'down', 'down');
  send('enter');
  assert.deepEqual(sounds.played.at(-1), ['piece_capture', 'game_win']);
  act(() => tree.unmount());
});

test('leaving the foreground stops the sound, and coming back is a warm start', () => {
  reset();
  resetFullyDrawnReports();
  const sounds = recorder();
  const tree = launch(sounds);
  // The cool start is fully drawn by the first render.
  assert.equal(fullyDrawnReports(), 1);

  act(() => setAppState('background'));
  assert.equal(sounds.suspended, true);
  act(() => setAppState('active'));
  assert.equal(sounds.suspended, false);
  assert.equal(fullyDrawnReports(), 2);

  // The screensaver or a system dialog leaves the app inactive: silent too.
  act(() => setAppState('inactive'));
  assert.equal(sounds.suspended, true);
  act(() => setAppState('active'));
  assert.equal(fullyDrawnReports(), 3);

  // Active again without having been away is not another start.
  act(() => setAppState('active'));
  assert.equal(fullyDrawnReports(), 3);
  act(() => tree.unmount());
});
