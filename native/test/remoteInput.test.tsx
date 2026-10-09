import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { mount, unmount } from './support';
import { useRemoteInput } from '../src/useRemoteInput';
import type { BoardKey } from '../../src/core/boardInput';
import {
  hold,
  release,
  press,
  pressBack,
  appEvent,
  setAppState,
} from './stubs/react-native-kepler.mjs';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

test('direction releases and input-context changes reset the held press', () => {
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
    assert.deepEqual(events, [
      ['right', false],
      ['right', true],
      ['right', true],
      ['right', false],
      ['left', false],
      ['left', true],
      ['left', false],
    ]);
  } finally {
    unmount();
  }
});

test('blur and inactivity discard held state and stale OK without exiting on Back', () => {
  const events: [BoardKey, boolean][] = [];
  const pressed: boolean[] = [];
  const Probe = () => {
    useRemoteInput((key, repeat) => events.push([key, repeat]), {
      onPress: (p) => pressed.push(p),
      onBack: () => false,
    });
    return null;
  };
  act(() => {
    mount(<Probe />);
  });
  try {
    act(() => hold('right', 1));
    act(() => hold('select', 1));
    act(() => appEvent('blur'));
    assert.equal(pressed.at(-1), false);
    act(() => {
      hold('right');
      release('select');
    });
    act(() => assert.equal(pressBack(), true));
    act(() => setAppState('background'));
    // Focus may come first, but background input is still ignored.
    act(() => appEvent('focus'));
    act(() => press('left'));
    act(() => setAppState('active'));
    act(() => {
      release('select');
      press('right');
      press('select');
    });
    assert.deepEqual(events, [
      ['right', false],
      ['right', false],
      ['select', false],
    ]);
    act(() => setAppState('inactive'));
    act(() => press('right'));
    act(() => setAppState('active'));
    act(() => press('right'));
    assert.deepEqual(events.at(-1), ['right', false]);
  } finally {
    act(() => {
      setAppState('active');
      appEvent('focus');
      unmount();
    });
  }
});
