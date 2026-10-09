import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { mount, unmount } from './support';
import { useRemoteInput } from '../src/useRemoteInput';
import { ActivityContext, createActivity } from '../src/activity';
import type { BoardKey } from '../../src/core/boardInput';
import {
  hold,
  release,
  press,
  pressBack,
} from './stubs/react-native-kepler.mjs';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// The app's foreground gate, held by the test. App opens and closes it from
// Vega's app state and focus (lifecycle.test.tsx); the hook only obeys it.
const gated = () => {
  const activity = createActivity(true);
  const within = (element: React.ReactElement) => (
    <ActivityContext.Provider value={activity}>
      {element}
    </ActivityContext.Provider>
  );
  return { activity, within };
};

test('directions remain held across input-context changes until release', () => {
  const events: [BoardKey, boolean][] = [];
  const Probe = ({ scope }: { scope: string }) => {
    useRemoteInput((key, repeat) => events.push([key, repeat]), { scope });
    return null;
  };
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = mount(<Probe scope="board" />);
  });
  try {
    act(() => hold('right', 3));
    act(() => release('right'));
    act(() => press('right'));
    act(() => hold('left'));
    act(() => {
      tree.update(<Probe scope="menu" />);
    });
    act(() => hold('left', 1));
    act(() => release('left'));
    act(() => press('left'));
    assert.deepEqual(events, [
      ['right', false],
      ['right', true],
      ['right', true],
      ['right', false],
      ['left', false],
      ['left', true],
      ['left', true],
      ['left', false],
    ]);
  } finally {
    unmount();
  }
});

test('a closed gate cancels OK but preserves direction holds without exiting on Back', () => {
  const events: [BoardKey, boolean][] = [];
  const pressed: boolean[] = [];
  const { activity, within } = gated();
  const Probe = () => {
    useRemoteInput((key, repeat) => events.push([key, repeat]), {
      onPress: (p) => pressed.push(p),
      onBack: () => false,
    });
    return null;
  };
  act(() => {
    mount(within(<Probe />));
  });
  try {
    act(() => hold('right', 1));
    act(() => hold('select', 1));
    act(() => activity.setActive(false));
    assert.equal(pressed.at(-1), false);
    act(() => {
      hold('right');
      release('select');
    });
    act(() => assert.equal(pressBack(), true));
    // Still away: nothing pressed meanwhile is taken.
    act(() => press('left'));
    act(() => activity.setActive(true));
    act(() => {
      hold('right', 1);
      release('right');
      release('select');
      press('left');
      press('right');
      press('select');
    });
    assert.deepEqual(events, [
      ['right', false],
      ['right', true],
      ['left', false],
      ['right', false],
      ['select', false],
    ]);
    act(() => activity.setActive(false));
    act(() => hold('right', 1));
    act(() => activity.setActive(true));
    act(() => hold('right', 1));
    assert.deepEqual(events.at(-1), ['right', true]);
    // A release received while inactive still ends the physical hold.
    act(() => activity.setActive(false));
    act(() => release('right'));
    act(() => activity.setActive(true));
    act(() => press('right'));
    assert.deepEqual(events.at(-1), ['right', false]);
  } finally {
    unmount();
  }
});

test('a canceled OK cannot re-arm on held repeats after context or focus changes', () => {
  const events: [BoardKey, boolean][] = [];
  const pressed: boolean[] = [];
  const { activity, within } = gated();
  const Probe = ({ scope }: { scope: string }) => {
    useRemoteInput((key, repeat) => events.push([key, repeat]), {
      scope,
      onPress: (p) => pressed.push(p),
    });
    return null;
  };
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = mount(within(<Probe scope="board" />));
  });
  try {
    act(() => hold('enter', 3));
    assert.equal(pressed.at(-1), true);
    act(() => tree.update(within(<Probe scope="menu" />)));
    act(() => hold('select', 3));
    assert.equal(pressed.at(-1), false);
    act(() => release('select'));
    assert.deepEqual(events, []);
    act(() => press('select'));
    assert.deepEqual(events, [['select', false]]);

    act(() => hold('select', 1));
    act(() => activity.setActive(false));
    act(() => activity.setActive(true));
    act(() => hold('select', 3));
    assert.equal(pressed.at(-1), false);
    act(() => release('select'));
    assert.equal(events.length, 1);
    act(() => press('select'));
    assert.equal(events.length, 2);
  } finally {
    unmount();
  }
});
