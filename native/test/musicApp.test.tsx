// The adaptive music in the running app (#76): which theme the screens ask for,
// the settings reaching the player and surviving a relaunch, and leaving the
// foreground.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
  press,
  pressBack,
  setAppState,
  appEvent,
} from './stubs/react-native-kepler.mjs';
import { reset } from './stubs/react-native-mmkv.mjs';
import { App } from '../src/App';
import type { ScreenOptions } from '../src/screen';
import type { Music } from '../src/music';
import { RESULT_SILENCE_MS } from '../src/GameScreen';
import { musicGain } from '../src/musicSetting';

type Instance = renderer.ReactTestInstance;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const options: ScreenOptions = {
  roll: () => [2, 2, 2],
  newId: () => 'musictest',
  schedule: (step) => step(),
  side: () => 'w',
};

type Recorder = Music & {
  roles: [string | null, number][];
  enabled: boolean | null;
  volume: number | null;
  suspended: boolean | null;
};

const recorder = (): Recorder => {
  const self: Recorder = {
    roles: [],
    enabled: null,
    volume: null,
    suspended: null,
    setRole(role, pauseMs = 0) {
      self.roles.push([role, pauseMs]);
    },
    setEnabled(on) {
      self.enabled = on;
    },
    setVolume(gain) {
      self.volume = gain;
    },
    setSuspended(value) {
      self.suspended = value;
    },
    setCatalogue() {},
    setDucked() {},
  };
  return self;
};

const launch = (music: Music) => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(App, { options, music }));
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

test('the home screen asks for the menu theme, and a new game for its level', () => {
  reset();
  const music = recorder();
  const tree = launch(music);
  assert.deepEqual(music.roles, [['menu', 0]]);
  // A new hotseat game: the opening is calm.
  send('enter');
  assert.deepEqual(music.roles, [
    ['menu', 0],
    ['calm', 0],
  ]);
  // The game's menu keeps the game's music.
  send('back');
  assert.equal(music.roles.length, 2);
  act(() => tree.unmount());
});

test('a finished game falls silent before the menu theme returns', () => {
  reset();
  const music = recorder();
  const tree = launch(music);
  // A hotseat game, resigned from its menu.
  send('enter', 'back', 'down', 'enter', 'down', 'enter');
  assert.match(text(tree.root), /Resigned/);
  assert.deepEqual(music.roles.at(-1), ['menu', RESULT_SILENCE_MS]);
  act(() => tree.unmount());
});

test('music settings reach the player and survive a relaunch', () => {
  reset();
  const first = recorder();
  let tree = launch(first);
  // Music starts on, at the default volume.
  assert.equal(first.enabled, true);
  assert.equal(first.volume, musicGain(7));
  // Settings, then music off, and the volume up two steps.
  send('down', 'down', 'down', 'down', 'enter');
  send('enter', 'down', 'right', 'right');
  assert.equal(first.enabled, false);
  assert.equal(first.volume, musicGain(9));
  assert.match(text(tree.root), /Music: off/);
  assert.match(text(tree.root), /Music volume: 9/);
  act(() => tree.unmount());

  const second = recorder();
  tree = launch(second);
  assert.equal(second.enabled, false, 'a relaunch starts with music off');
  assert.equal(second.volume, musicGain(9));
  send('down', 'down', 'down', 'down', 'enter');
  assert.match(text(tree.root), /Music: off/);
  assert.match(text(tree.root), /Music volume: 9/);
  act(() => tree.unmount());
});

test('blur stops the music at once, and focus or a return to active brings it back', () => {
  reset();
  const music = recorder();
  const tree = launch(music);
  act(() => appEvent('blur'));
  assert.equal(music.suspended, true);
  act(() => appEvent('focus'));
  assert.equal(music.suspended, false);
  act(() => setAppState('background'));
  assert.equal(music.suspended, true);
  act(() => setAppState('active'));
  assert.equal(music.suspended, false);
  act(() => tree.unmount());
});

test('music resumes only when the app is both active and focused, whatever the order', () => {
  reset();
  const music = recorder();
  const tree = launch(music);
  // blur, then back to active without focus: still silent until focus returns.
  act(() => appEvent('blur'));
  act(() => setAppState('active'));
  assert.equal(music.suspended, true);
  act(() => appEvent('focus'));
  assert.equal(music.suspended, false);
  // inactive, then focus while still inactive: silent until active again.
  act(() => setAppState('inactive'));
  act(() => appEvent('focus'));
  assert.equal(music.suspended, true);
  act(() => setAppState('active'));
  assert.equal(music.suspended, false);
  act(() => tree.unmount());
});
