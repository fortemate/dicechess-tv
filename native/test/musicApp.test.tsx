// The adaptive music in the running app (#76): which theme the screens ask for,
// the settings reaching the player and surviving a relaunch, and leaving the
// foreground.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react-test-renderer';
import { setAppState, appEvent } from './stubs/react-native-kepler.mjs';
import { reset } from './stubs/react-native-mmkv.mjs';
import type { Music } from '../src/music';
import { RESULT_SILENCE_MS } from '../src/GameScreen';
import { musicGain } from '../src/musicSetting';
import { fakeTimers, fixedOptions, launch, send, text } from './support';

// The sounds and the voices are the app's own, on the test's clock.
fakeTimers();

const options = fixedOptions({ roll: () => [2, 2, 2] });

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

test('the home screen asks for the menu theme, and a new game for its level', () => {
  reset();
  const music = recorder();
  launch({ options, music });
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
});

test('a finished game falls silent before the menu theme returns', () => {
  reset();
  const music = recorder();
  const { root } = launch({ options, music });
  // A hotseat game, resigned from its menu.
  send('enter', 'back', 'down', 'enter', 'down', 'enter');
  assert.match(text(root), /White resigned/);
  assert.deepEqual(music.roles.at(-1), ['menu', RESULT_SILENCE_MS]);
});

test('music settings reach the player and survive a relaunch', () => {
  reset();
  const first = recorder();
  let root = launch({ options, music: first }).root;
  // Music starts on, at the default volume.
  assert.equal(first.enabled, true);
  assert.equal(first.volume, musicGain(7));
  // Settings, then music off, and the volume up two steps.
  send('down', 'down', 'down', 'down', 'enter');
  send('enter', 'down', 'right', 'right');
  assert.equal(first.enabled, false);
  assert.equal(first.volume, musicGain(9));
  assert.match(text(root), /Music: off/);
  assert.match(text(root), /Music volume: 9/);

  const second = recorder();
  root = launch({ options, music: second }).root;
  assert.equal(second.enabled, false, 'a relaunch starts with music off');
  assert.equal(second.volume, musicGain(9));
  send('down', 'down', 'down', 'down', 'enter');
  assert.match(text(root), /Music: off/);
  assert.match(text(root), /Music volume: 9/);
});

test('blur stops the music at once, and focus or a return to active brings it back', () => {
  reset();
  const music = recorder();
  launch({ options, music });
  act(() => appEvent('blur'));
  assert.equal(music.suspended, true);
  act(() => appEvent('focus'));
  assert.equal(music.suspended, false);
  act(() => setAppState('background'));
  assert.equal(music.suspended, true);
  act(() => setAppState('active'));
  assert.equal(music.suspended, false);
});

test('after a blur only focus brings the music back, and focus is also the way back from away', () => {
  reset();
  const music = recorder();
  launch({ options, music });
  // blur, then back to active without focus: still silent until focus returns.
  act(() => appEvent('blur'));
  act(() => setAppState('active'));
  assert.equal(music.suspended, true);
  act(() => appEvent('focus'));
  assert.equal(music.suspended, false);
  // Away, then focus alone: on a Fire TV Stick the return from the background
  // brings focus and no change to active (#254), so focus brings it back.
  act(() => setAppState('inactive'));
  assert.equal(music.suspended, true);
  act(() => appEvent('focus'));
  assert.equal(music.suspended, false);
});
