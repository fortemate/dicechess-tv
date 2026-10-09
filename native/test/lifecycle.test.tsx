// Focus and the app state through the whole app (#254): the Alexa overlay
// sends blur alone, and the game's effects, lines and music must all fall
// silent under it, not only the music, and the game must not move on behind
// it. A test cannot hear, so what is checked is what the players were told;
// hearing it is checked on a device.
//
// The game's half reproduces Alexa on a physical Stick, with controlled
// delivery of Vega events and already queued callbacks. No wall-clock wait or
// screenshot substitutes for checking the saved position, dice, revision and
// the pending bot path.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act } from 'react-test-renderer';
import { App } from '../src/App';
import { BOT_STEP_MS, type ScreenOptions } from '../src/screen';
import type { Sounds } from '../src/sound';
import type { Music } from '../src/music';
import { MMKV, reset } from './stubs/react-native-mmkv.mjs';
import {
  appEvent,
  hasExited,
  setAppState,
} from './stubs/react-native-kepler.mjs';
import { nextLineMs } from '../src/useTutorialVoice';
import { stepGame, TUTORIAL, tutorLinesAt } from '../../src/core/tutorial';
import { fixedOptions, launch, mount, send, unmount } from './support';

const options = fixedOptions({ roll: () => [2, 2, 2] });

// The app, with players that keep what they were last told: suspended or not,
// and null before anything.
const listen = () => {
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
  launch({ options, sounds, music });
  return told;
};

test('blur alone silences the effects and lines as well as the music', () => {
  reset();
  setAppState('active');
  const told = listen();
  act(() => appEvent('blur'));
  assert.deepEqual(told, { sounds: true, music: true });
  act(() => appEvent('focus'));
  assert.deepEqual(told, { sounds: false, music: false });
});

test('active alone does not bring sound back from behind the overlay; focus does', () => {
  reset();
  setAppState('active');
  const told = listen();
  // The overlay is up, and the app is told it is active: still silent.
  act(() => appEvent('blur'));
  act(() => setAppState('active'));
  assert.deepEqual(told, { sounds: true, music: true });
  act(() => appEvent('focus'));
  assert.deepEqual(told, { sounds: false, music: false });
  // Background and inactive are away; unknown, which a Stick reports at
  // launch, changes nothing.
  act(() => setAppState('inactive'));
  assert.deepEqual(told, { sounds: true, music: true });
  act(() => setAppState('active'));
  assert.deepEqual(told, { sounds: false, music: false });
  act(() => setAppState('unknown'));
  assert.deepEqual(told, { sounds: false, music: false });
});

// On a Fire TV Stick the return from Home brings focus and no change to
// active: Vega opens a new surface for the app, and `change` reaches only that
// one, while focus and blur still reach the app-state manager it started with.
test('back from Home on focus alone, sound returns', () => {
  reset();
  setAppState('active');
  const told = listen();
  act(() => appEvent('blur'));
  act(() => setAppState('background'));
  assert.deepEqual(told, { sounds: true, music: true });
  act(() => appEvent('focus'));
  assert.deepEqual(told, { sounds: false, music: false });
});

const harness = (initial: 'active' | 'inactive' | 'unknown' = 'active') => {
  reset();
  setAppState(initial);
  const waiting: { run: () => void; wait: number }[] = [];
  const background: (() => void)[] = [];
  const reports: string[] = [];
  const said: string[] = [];
  const soundStates: boolean[] = [];
  const musicStates: boolean[] = [];
  let time = 0;
  const options: ScreenOptions = {
    roll: () => [1, 1, 1],
    side: () => 'b',
    newId: () => 'lifecycle',
    schedule: (run, wait) => {
      waiting.push({ run, wait });
    },
    background: (run) => {
      background.push(run);
    },
    now: () => time,
  };
  const sounds: Sounds = {
    play() {},
    setMuted() {},
    setVoices() {},
    stopLine() {},
    say(line) {
      assert.equal(
        soundStates.at(-1),
        false,
        'a line is only selected while audible',
      );
      said.push(line.id);
    },
    setSuspended(on) {
      soundStates.push(on);
    },
  };
  const music: Music = {
    setRole() {},
    setEnabled() {},
    setVolume() {},
    setCatalogue() {},
    setDucked() {},
    setSuspended(on) {
      musicStates.push(on);
    },
  };
  const tree = mount(
    <App
      options={options}
      sounds={sounds}
      music={music}
      onState={(line) => reports.push(line)}
    />,
  );
  return {
    tree,
    waiting,
    background,
    said,
    soundStates,
    musicStates,
    reports,
    pass: (ms: number) => {
      time += ms;
    },
    send,
    event: (name: 'blur' | 'focus') => act(() => appEvent(name)),
    state: (name: 'active' | 'inactive' | 'background' | 'unknown') =>
      act(() => setAppState(name)),
    tick: () => {
      for (const { run } of waiting.splice(0)) act(() => run());
    },
    search: () => {
      for (const run of background.splice(0)) act(() => run());
    },
    save: () => new MMKV().getString('dicechess-tv.game.v2'),
    close: unmount,
  };
};

test('a bot roll cannot run behind Alexa, even before React commits the blur; the saved game is untouched', () => {
  const rig = harness();
  try {
    rig.send('down', 'enter', 'enter', 'enter');
    const saved = rig.save();
    const old = rig.waiting.shift()!;
    rig.pass(200);
    // Both events in one delivery turn, with no React render in between.
    act(() => {
      appEvent('blur');
      old.run();
    });
    rig.pass(60_000);
    rig.search();
    rig.send('enter', 'menu', 'right');
    assert.equal(rig.save(), saved);
    rig.event('focus');
    assert.equal(rig.waiting[0].wait, BOT_STEP_MS - 200);
    rig.tick();
    assert.notEqual(rig.save(), saved, 'one bot roll resumes');
    const rolled = rig.save();
    act(() => old.run());
    assert.equal(rig.save(), rolled, 'the stale roll cannot roll again');
  } finally {
    rig.close();
  }
});

test('a computed bot reply and its remaining dice survive repeated blur/focus at each move', () => {
  const rig = harness();
  try {
    rig.send('down', 'enter', 'enter', 'enter');
    rig.tick(); // bot roll
    rig.pass(150);
    rig.search(); // computed reply
    for (let move = 0; move < 3; move++) {
      const saved = rig.save();
      const old = rig.waiting.shift()!;
      const count = rig.said.length;
      rig.event('blur');
      rig.pass(30_000);
      act(() => old.run());
      rig.search();
      assert.equal(
        rig.save(),
        saved,
        'no move or remaining die is spent behind Alexa',
      );
      assert.equal(rig.said.length, count);
      rig.event('focus');
      rig.tick();
      assert.notEqual(rig.save(), saved, 'the pending path advances one move');
      const after = rig.save();
      act(() => old.run());
      assert.equal(rig.save(), after, 'stale delivery cannot repeat a move');
    }
  } finally {
    rig.close();
  }
});

test('a search not yet started waits for focus and does not spend its presentation wait in the background', () => {
  const rig = harness();
  try {
    rig.send('down', 'enter', 'enter', 'enter');
    rig.tick();
    const saved = rig.save();
    rig.pass(100);
    rig.event('blur');
    rig.pass(60_000);
    rig.search();
    assert.equal(rig.waiting.length, 0);
    assert.equal(rig.save(), saved);
    rig.event('focus');
    rig.search();
    assert.equal(rig.waiting[0].wait, BOT_STEP_MS - 100);
  } finally {
    rig.close();
  }
});

test('a launch reported as unknown, as on a Stick, takes the remote at once', () => {
  const rig = harness('unknown');
  try {
    assert.equal(rig.soundStates.at(-1), false);
    rig.send('enter');
    assert.ok(rig.save());
  } finally {
    rig.close();
  }
});

test('back from Home on focus alone, the remote works again', () => {
  const rig = harness();
  try {
    rig.event('blur');
    rig.state('background');
    rig.send('enter');
    assert.equal(rig.save(), undefined, 'no key is taken while away');
    rig.event('focus');
    rig.send('enter');
    assert.ok(rig.save(), 'the first key after the return is taken');
  } finally {
    rig.close();
  }
});

test('initially inactive, the app is silent and ignores keys until it becomes active', () => {
  const rig = harness('inactive');
  try {
    assert.equal(rig.soundStates.at(-1), true);
    rig.send('enter');
    assert.equal(rig.save(), undefined);
    assert.equal(rig.said.length, 0);
    rig.state('active');
    rig.send('enter');
    assert.ok(rig.save());
  } finally {
    rig.close();
  }
});

test('Back behind Alexa is ignored, not taken as leave to close the app', () => {
  const rig = harness();
  try {
    rig.event('blur');
    rig.send('back');
    assert.equal(hasExited(), false, 'the app stays open behind the overlay');
    rig.event('focus');
    rig.send('back');
    assert.equal(hasExited(), true, 'Back on the home screen closes it again');
  } finally {
    rig.close();
  }
});

test('tutorial speech waits behind Alexa and resumes its next sentence once, without a burst', () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const rig = harness();
  try {
    rig.send('down', 'down', 'enter');
    const opening = tutorLinesAt(TUTORIAL[0], stepGame(TUTORIAL[0]), false);
    assert.deepEqual(rig.said, [opening[0].id]);
    act(() => mock.timers.tick(100));
    rig.event('blur');
    act(() => mock.timers.tick(60_000));
    assert.deepEqual(rig.said, [opening[0].id]);
    rig.event('focus');
    act(() => mock.timers.tick(nextLineMs(opening[0])! - 100));
    assert.deepEqual(rig.said, [opening[0].id, opening[1].id]);
  } finally {
    rig.close();
    mock.timers.reset();
  }
});
