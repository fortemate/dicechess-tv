// Focus and the app state through the whole app (#254): the Alexa overlay
// sends blur alone, and the game's effects, lines and music must all fall
// silent under it, not only the music. A test cannot hear, so what is checked
// is what the players were told; hearing it is checked on a device.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { appEvent, setAppState } from './stubs/react-native-kepler.mjs';
import { reset } from './stubs/react-native-mmkv.mjs';
import { App } from '../src/App';
import type { ScreenOptions } from '../src/screen';
import type { Sounds } from '../src/sound';
import type { Music } from '../src/music';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const options: ScreenOptions = {
  roll: () => [2, 2, 2],
  newId: () => 'lifecycletest',
  schedule: (step) => step(),
  side: () => 'w',
};

// What each player was last told: suspended or not, and null before anything.
const launch = () => {
  const told: { sounds: boolean | null; music: boolean | null } = {
    sounds: null,
    music: null,
  };
  const sounds: Sounds = {
    play() {},
    setMuted() {},
    say() {},
    stopLine() {},
    setVoices() {},
    setSuspended(value) {
      told.sounds = value;
    },
  };
  const music: Music = {
    setRole() {},
    setEnabled() {},
    setVolume() {},
    setCatalogue() {},
    setDucked() {},
    setSuspended(value) {
      told.music = value;
    },
  };
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      React.createElement(App, { options, sounds, music }),
    );
  });
  return { told, tree };
};

test('blur alone silences the effects and lines as well as the music', () => {
  reset();
  setAppState('active');
  const { told, tree } = launch();
  act(() => appEvent('blur'));
  assert.deepEqual(told, { sounds: true, music: true });
  act(() => appEvent('focus'));
  assert.deepEqual(told, { sounds: false, music: false });
  act(() => tree.unmount());
});

test('neither active nor focus alone brings sound back; both together do', () => {
  reset();
  setAppState('active');
  const { told, tree } = launch();
  // The overlay is up, and the app is told it is active: still silent.
  act(() => appEvent('blur'));
  act(() => setAppState('active'));
  assert.deepEqual(told, { sounds: true, music: true });
  act(() => appEvent('focus'));
  assert.deepEqual(told, { sounds: false, music: false });
  // Home: blur, then the background. Focus while still away: still silent.
  act(() => appEvent('blur'));
  act(() => setAppState('background'));
  act(() => appEvent('focus'));
  assert.deepEqual(told, { sounds: true, music: true });
  act(() => setAppState('active'));
  assert.deepEqual(told, { sounds: false, music: false });
  act(() => tree.unmount());
});
