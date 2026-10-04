// The opponent's search overlaps its step wait (#253), through the whole app: the
// roll is on screen before the search starts, the first action shows one step
// after the roll however long the search took, and a menu opened meanwhile
// pauses the wait without throwing the reply away.
// What the app schedules waits in a queue, with the wait it asked for, and the
// clock is the test's own, so a search of any length can be played.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { press, pressBack } from './stubs/react-native-kepler.mjs';
import { reset } from './stubs/react-native-mmkv.mjs';
import { App } from '../src/App';
import { BOT_STEP_MS, type ScreenOptions } from '../src/screen';
import type { Sounds } from '../src/sound';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const harness = () => {
  const waiting: { step: () => void; wait: number }[] = [];
  const searches: (() => void)[] = [];
  const state = { time: 0 };
  const options: ScreenOptions = {
    // Three pawns always have somewhere to go from the opening, so the
    // opponent spends all three dice: one search, then two plain steps.
    roll: () => [1, 1, 1],
    newId: () => 'pacing',
    schedule: (step, wait) => {
      waiting.push({ step, wait });
    },
    // The opponent plays White: the person is drawn Black.
    side: () => 'b',
    // Between frames: held until the test lets it run.
    background: (step) => {
      searches.push(step);
    },
    now: () => state.time,
  };
  return {
    options,
    waits: () => waiting.map(({ wait }) => wait),
    // Runs what waits now; what those steps schedule in turn waits for the next
    // call.
    next: () => {
      for (const { step } of waiting.splice(0)) act(() => step());
    },
    // The opponent's search, and the danger search beside it, run `took`
    // milliseconds after the wait began.
    search: (took: number) => {
      state.time += took;
      while (searches.length) act(() => searches.shift()?.());
    },
    // Time passes with nothing running, as while a menu is open.
    pass: (ms: number) => {
      state.time += ms;
    },
  };
};

const silent = (): Sounds => ({
  play() {},
  setMuted() {},
  say() {},
  stopLine() {},
  setVoices() {},
  setSuspended() {},
});

// Play the computer, Rolly, and Random, which draws Black: the opponent rolls
// first, after the usual step.
const opening = (rig: ReturnType<typeof harness>) => {
  reset();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      React.createElement(App, { options: rig.options, sounds: silent() }),
    );
  });
  for (const key of ['down', 'enter', 'enter', 'enter']) act(() => press(key));
  assert.deepEqual(rig.waits(), [BOT_STEP_MS]);
  rig.next();
  return tree;
};

const withTimers = (body: () => void) => {
  // The opponent's voice runs on its own timer.
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    body();
  } finally {
    mock.timers.reset();
  }
};

test('the roll is shown first, then the first action comes one step after it, less the search', () => {
  withTimers(() => {
    const rig = harness();
    const tree = opening(rig);

    // The roll is up and the search has not run: nothing is scheduled yet.
    assert.deepEqual(rig.waits(), []);

    // A quick search leaves the rest of the step to wait out.
    rig.search(150);
    assert.deepEqual(rig.waits(), [BOT_STEP_MS - 150]);
    rig.next();

    // The other two dice are plain steps, a full step apart.
    assert.deepEqual(rig.waits(), [BOT_STEP_MS]);
    act(() => tree.unmount());
  });
});

test('a search longer than the step shows the first action at once, not a step later', () => {
  withTimers(() => {
    const rig = harness();
    const tree = opening(rig);
    rig.search(BOT_STEP_MS * 3);
    assert.deepEqual(rig.waits(), [0]);
    rig.next();
    assert.deepEqual(rig.waits(), [BOT_STEP_MS]);
    act(() => tree.unmount());
  });
});

test('opening the menu pauses the wait, and closing it resumes the rest of it', () => {
  withTimers(() => {
    const rig = harness();
    const tree = opening(rig);
    rig.search(200);
    assert.deepEqual(rig.waits(), [BOT_STEP_MS - 200]);

    // 50 more milliseconds of the wait pass, then Back opens the menu.
    rig.pass(50);
    act(() => {
      pressBack();
    });
    // The step that was waiting is dropped: it must not play behind the menu.
    rig.next();
    assert.deepEqual(rig.waits(), []);

    // However long the menu stays open, it costs the wait nothing: what resumes
    // is the 350 ms that were left, not a new step.
    rig.pass(60_000);
    act(() => {
      pressBack();
    });
    rig.search(0);
    assert.deepEqual(rig.waits(), [BOT_STEP_MS - 250]);
    rig.next();
    assert.deepEqual(rig.waits(), [BOT_STEP_MS]);
    act(() => tree.unmount());
  });
});
