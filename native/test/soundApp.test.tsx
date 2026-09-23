// Sound through the whole app: a step of a real game reaches the players, and
// turning sound off survives a relaunch. A test cannot hear, so what is checked
// is what was asked for; hearing it is checked on the virtual device.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { press, pressBack } from './stubs/react-native-kepler.mjs';
import { reset } from './stubs/react-native-mmkv.mjs';
import { App } from '../src/App';
import type { ScreenOptions } from '../src/screen';
import type { Sounds } from '../src/sound';
import type { Cue } from '../../src/core/cues';

type Instance = renderer.ReactTestInstance;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const options: ScreenOptions = {
  roll: () => [2, 2, 2],
  newId: () => 'soundtest',
  schedule: (step) => step(),
};

type Recorder = Sounds & { played: Cue[][]; muted: boolean | null };

const recorder = (): Recorder => {
  const self: Recorder = {
    played: [],
    muted: null,
    play(cues) {
      if (cues.length) self.played.push([...cues]);
    },
    setMuted(value) {
      self.muted = value;
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

  // Home, nothing saved: new hotseat, Play Random, How to play, Rules, Sound.
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
