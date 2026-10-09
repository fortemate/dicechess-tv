// Tests for the rules guide screen and its reducer (#237, #245).
//
// Asserts that OK (select) keeps the guide open on the focused topic,
// Up and Down navigate between topics, and Back or Menu exits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
  press,
  pressBack,
  hold,
  release,
} from './stubs/react-native-kepler.mjs';
import {
  RulesScreen,
  rulesReducer,
  INITIAL_RULES_STATE,
  type RulesState,
} from '../src/RulesScreen';
import { RULES } from '../../src/core/rules';
import { Option } from '../src/Option';

test('rulesReducer: starts at index 0 and exit false', () => {
  assert.deepEqual(INITIAL_RULES_STATE, { index: 0, exit: false });
});

test('rulesReducer: OK (select) keeps the guide open on the current topic (#237)', () => {
  const atZero = rulesReducer(INITIAL_RULES_STATE, 'select');
  assert.deepEqual(atZero, { index: 0, exit: false });

  // On an arbitrary topic mid-list
  const state: RulesState = { index: 3, exit: false };
  const afterOk = rulesReducer(state, 'select');
  assert.deepEqual(afterOk, { index: 3, exit: false });
});

test('rulesReducer: left and right do not navigate and do not exit', () => {
  const state: RulesState = { index: 2, exit: false };
  assert.deepEqual(rulesReducer(state, 'left'), { index: 2, exit: false });
  assert.deepEqual(rulesReducer(state, 'right'), { index: 2, exit: false });
});

test('rulesReducer: up and down navigate topics and wrap around', () => {
  let state = INITIAL_RULES_STATE;

  state = rulesReducer(state, 'down');
  assert.equal(state.index, 1);
  assert.equal(state.exit, false);

  state = rulesReducer(state, 'down');
  assert.equal(state.index, 2);

  // Up wraps around from 0 to last topic
  const wrappedUp = rulesReducer(INITIAL_RULES_STATE, 'up');
  assert.equal(wrappedUp.index, RULES.length - 1);
  assert.equal(wrappedUp.exit, false);

  // Down from last topic wraps to 0
  const atLast: RulesState = { index: RULES.length - 1, exit: false };
  const wrappedDown = rulesReducer(atLast, 'down');
  assert.equal(wrappedDown.index, 0);
  assert.equal(wrappedDown.exit, false);
});

test('rulesReducer: back and menu request screen exit', () => {
  const state: RulesState = { index: 4, exit: false };
  assert.deepEqual(rulesReducer(state, 'back'), { index: 4, exit: true });
  assert.deepEqual(rulesReducer(state, 'menu'), { index: 4, exit: true });
});

test('rulesReducer: ignores keys once exit is true', () => {
  const exited: RulesState = { index: 1, exit: true };
  assert.deepEqual(rulesReducer(exited, 'down'), exited);
  assert.deepEqual(rulesReducer(exited, 'select'), exited);
  assert.deepEqual(rulesReducer(exited, 'back'), exited);
});

test('RulesScreen component: OK keeps topic open, Back exits (#237)', () => {
  let exitCalls = 0;
  const reports: string[] = [];

  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      React.createElement(RulesScreen, {
        onExit: () => {
          exitCalls++;
        },
        onState: (report: string) => reports.push(report),
      }),
    );
  });

  try {
    assert.equal(
      reports[reports.length - 1],
      `rules 1/${RULES.length} | topic winning`,
    );
    assert.equal(exitCalls, 0);

    // Pressing OK (enter) keeps the guide open on topic 1
    act(() => press('enter'));
    assert.equal(exitCalls, 0);
    assert.equal(
      reports[reports.length - 1],
      `rules 1/${RULES.length} | topic winning`,
    );

    // Pressing Down navigates to topic 2
    act(() => press('down'));
    assert.equal(exitCalls, 0);
    assert.equal(
      reports[reports.length - 1],
      `rules 2/${RULES.length} | topic turn`,
    );

    // Pressing OK on topic 2 still keeps the guide open
    act(() => press('enter'));
    assert.equal(exitCalls, 0);
    assert.equal(
      reports[reports.length - 1],
      `rules 2/${RULES.length} | topic turn`,
    );

    // Pressing Back exits
    act(() => {
      pressBack();
    });
    assert.equal(exitCalls, 1);
  } finally {
    act(() => tree.unmount());
  }
});

test('RulesScreen component: Menu exits the screen', () => {
  let exitCalls = 0;
  const reports: string[] = [];

  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      React.createElement(RulesScreen, {
        onExit: () => {
          exitCalls++;
        },
        onState: (report: string) => reports.push(report),
      }),
    );
  });

  try {
    assert.equal(exitCalls, 0);

    // Pressing Menu exits
    act(() => press('menu'));
    assert.equal(exitCalls, 1);
  } finally {
    act(() => tree.unmount());
  }
});

// Each OK key must reach the handler. Holding the key lights `pressed` on the
// options, so the assertion fails if the key mapping is broken, unlike an
// unchanged topic report.
for (const key of ['select', 'enter', 'kpenter']) {
  test(`RulesScreen component: ${key} reaches the handler and keeps topic open (#237)`, () => {
    let exitCalls = 0;
    const reports: string[] = [];
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        React.createElement(RulesScreen, {
          onExit: () => {
            exitCalls++;
          },
          onState: (report: string) => reports.push(report),
        }),
      );
    });
    const isPressed = () =>
      tree.root.findAllByType(Option).every((o) => o.props.pressed === true);

    try {
      act(() => press('down'));
      const topic = reports[reports.length - 1];
      assert.equal(topic, `rules 2/${RULES.length} | topic turn`);

      assert.equal(isPressed(), false);
      act(() => hold(key, 1));
      assert.equal(isPressed(), true, `${key} did not reach the handler`);
      act(() => release(key));
      assert.equal(isPressed(), false);

      assert.equal(reports[reports.length - 1], topic);
      assert.equal(exitCalls, 0);
    } finally {
      act(() => tree.unmount());
    }
  });
}
