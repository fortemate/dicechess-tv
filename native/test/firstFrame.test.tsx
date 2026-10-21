// The app's first frame is a screen the remote can use (FL-07 in the friction
// log). On Vega, a root that drew nothing on its first frame and filled in from
// an effect never received a key press: every one was lost, with nothing in any
// log. Every other test looks only after act() has run the effects too, by
// which time such a root has caught up, so it passes them all.
//
// What the first commit drew is read by a probe mounted after the app. Its
// layout effect runs in that commit, after the app's own layout effects and
// before any useEffect has had the chance to change what is drawn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act } from 'react-test-renderer';
import { reset } from './stubs/react-native-mmkv.mjs';
import { audioLog, resetAudio } from './stubs/react-native-w3cmedia.mjs';
import { App, type AppProps } from '../src/App';
import { focusedLabel } from './options';
import { SPARE_PLAYERS } from '../src/sound';
import {
  fakeTimers,
  fixedOptions,
  mount,
  text,
  type Instance,
} from './support';

fakeTimers();

type Frame = { text: string; focused: string | undefined };

// The first frame of `Root`, and the tree it settles into.
const firstFrame = (Root: React.ComponentType<AppProps>) => {
  // An empty tree first, so the probe has a renderer to read when the app
  // mounts into it.
  const tree = mount(<></>);
  let frame: Frame | null = null;
  const read = (root: Instance) => {
    frame ??= { text: text(root), focused: focusedLabel(root) };
  };
  const Probe = () => {
    React.useLayoutEffect(() => read(tree.root));
    return null;
  };
  act(() =>
    tree.update(
      <>
        <Root options={fixedOptions()} />
        <Probe />
      </>,
    ),
  );
  assert.ok(frame, 'the probe never ran');
  return { first: frame as Frame, settled: tree.root };
};

test('a returning player’s first frame is the home screen, its first option in focus', () => {
  const { first } = firstFrame(App);
  assert.match(first.text, /Dice Chess/);
  assert.equal(first.focused, 'Play a friend');
});

test('a first launch’s first frame is Thinkle’s offer, its first answer in focus', () => {
  reset({ firstLaunch: true });
  const { first } = firstFrame(App);
  assert.match(first.text, /New to Dice Chess\?/);
  assert.equal(first.focused, 'Learn to play');
});

// The fault FL-07 records, built on purpose: the app drawn only once an effect
// has run, as when a root waited for storage before drawing.
const Late = (props: AppProps) => {
  const [ready, setReady] = React.useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setReady(true), []);
  return ready ? <App {...props} /> : null;
};

test('the probe catches a root that draws nothing until an effect has run', () => {
  const { first, settled } = firstFrame(Late);
  assert.equal(first.text, '');
  assert.equal(first.focused, undefined);
  // Yet once act() is over it shows the home screen like the app: a test that
  // only looks then cannot tell the two apart.
  assert.equal(focusedLabel(settled), 'Play a friend');
});

// The players were once made while the first frame was drawn: native work before
// it, done again whenever React dropped the cache (#313). They are made in an
// effect after the first commit, still before the first press can ask for a
// cue.
test('no media player is made while the first frame is drawn; the sounds’ players are made right after', () => {
  resetAudio();
  const tree = mount(<></>);
  let during: number | null = null;
  const Probe = () => {
    React.useLayoutEffect(() => {
      during ??= audioLog.length;
    });
    return null;
  };
  act(() =>
    tree.update(
      <>
        <App options={fixedOptions()} />
        <Probe />
      </>,
    ),
  );
  assert.equal(during, 0, 'nothing media-related in the first commit');
  assert.equal(
    audioLog.filter((entry) => entry.event === 'create').length,
    3 + SPARE_PLAYERS,
    'the three channels and the spare voices, once the effects have run',
  );
});
