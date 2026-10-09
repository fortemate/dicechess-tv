// What the native tests share: one app on screen at a time, as on a device,
// driven with the remote and read the way a viewer reads it; and after every
// test, the stubs put back as a fresh launch finds them.
import { afterEach, beforeEach, mock } from 'node:test';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
  listenerCount,
  press,
  pressBack,
  resetPlatform,
} from './stubs/react-native-kepler.mjs';
import { reset } from './stubs/react-native-mmkv.mjs';
import { resetFullyDrawnReports } from './stubs/kepler-performance-api.mjs';
import { App, type AppProps } from '../src/App';
import type { ScreenOptions } from '../src/screen';
import type { Sounds } from '../src/sound';

export type Instance = renderer.ReactTestInstance;
export type Style = Record<string, unknown>;

// The stubs render host elements named after the React Native components.
// React's own types only know DOM element names, so the comparison needs
// widening.
export const isHost = (node: Instance, name: string) =>
  (node.type as unknown as string) === name;

export const styleOf = (node: Instance): Style =>
  (node.props.style ?? {}) as Style;

// Every line of text on the screen, as a viewer reads it.
export const text = (root: Instance) =>
  root
    .findAll((node) => isHost(node, 'Text'), { deep: true })
    .map((node) => String(node.props.children))
    .join('\n');

// Presses on the remote, each one its own event. Vega's names: OK is `enter`
// from the Virtual Device keyboard, `kpenter` from its on-screen remote and
// `select` from a physical remote. Back arrives on a channel of its own: Vega
// routes it through a hook that lets the app claim the press, which is what
// stops the system closing the app.
export const send = (...keys: string[]) => {
  for (const key of keys)
    act(() => {
      if (key === 'back') pressBack();
      else press(key);
    });
};

// A fixed instructional roll: queen, rook, knight. The app itself uses the
// device's random source; a test must not. The opponent steps at once, where
// the app spaces its steps out, and Random draws White.
export const fixedOptions = (
  more: Partial<ScreenOptions> = {},
): ScreenOptions => ({
  roll: () => [5, 4, 2],
  newId: () => 'test',
  schedule: (step) => step(),
  side: () => 'w',
  ...more,
});

// Sounds that play nothing, for a test about something else.
export const silentSounds = (): Sounds => ({
  play() {},
  setMuted() {},
  say() {},
  stopLine() {},
  setVoices() {},
  setSuspended() {},
});

// One tree at a time, as on a device: mounting one unmounts the last, as a
// relaunch does, and what was saved stays saved. A tree left mounted would
// still hear every key, write the same storage and run its timers.
let mounted: renderer.ReactTestRenderer | null = null;

export const unmount = () => {
  const tree = mounted;
  mounted = null;
  if (tree) act(() => tree.unmount());
};

export const mount = (
  element: React.ReactElement,
): renderer.ReactTestRenderer => {
  unmount();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(element);
  });
  mounted = tree;
  return tree;
};

// What a screen reports about itself. state() is its latest report of the
// overlay, the turn and the board, which a test reads rather than the panel's
// wording, so it tests behaviour instead of copy.
export const reporter = () => {
  const lines: string[] = [];
  return {
    lines,
    onState: (line: string) => {
      lines.push(line);
    },
    state: () =>
      lines.filter((line) => line.startsWith('overlay ')).at(-1) ?? '',
  };
};

export type Launched = {
  tree: renderer.ReactTestRenderer;
  root: Instance;
  state: () => string;
};

// The app as index.js registers it, opened on whatever the storage stub holds,
// with the fixed roll unless a test brings options of its own.
export const launch = (props: AppProps = {}): Launched => {
  const reports = reporter();
  const tree = mount(
    React.createElement(App, {
      options: fixedOptions(),
      ...props,
      onState: (line: string) => {
        reports.onState(line);
        props.onState?.(line);
      },
    }),
  );
  return { tree, root: tree.root, state: reports.state };
};

// For a file that runs the app's own timers: the sounds' delays, the music's
// fades and the voices' lines. They run on node:test's clock instead of the
// wall clock, so nothing fires unless a test moves it on with
// mock.timers.tick(), and nothing is left running when a test ends to keep the
// process alive or update a tree nobody looks at.
export const fakeTimers = () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  });
};

const motion = globalThis as {
  __holdSlides?: boolean;
  __heldSlides?: unknown[];
  __reduceMotion?: boolean;
  __reduceMotionQuery?: string;
  __answerReduceMotion?: unknown;
};

// The platform as a launch finds it: the app in the foreground, the storage of
// an install that has answered the tutorial's offer, and a platform that
// answers at once that it does not ask for less motion.
const resetStubs = () => {
  resetPlatform();
  reset();
  resetFullyDrawnReports();
  delete motion.__holdSlides;
  delete motion.__heldSlides;
  delete motion.__reduceMotion;
  delete motion.__reduceMotionQuery;
  delete motion.__answerReduceMotion;
};

resetStubs();

// Each test leaves nothing behind for the next: nothing mounted, no timer
// waiting, and the platform as a launch finds it.
afterEach(() => {
  unmount();
  mock.timers.reset();
  resetStubs();
  // A screen still listening was mounted some other way and never unmounted:
  // it would claim the next test's presses.
  if (listenerCount())
    throw new Error(
      `${listenerCount()} screen(s) left listening to the remote`,
    );
});
