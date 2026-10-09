import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { ActivityContext, createActivity } from '../src/activity';
import { useDanger } from '../src/useDanger';
import { newGame } from '../../src/core/game';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

test('danger work pauses without advancing, resumes the same search, and abandons old positions', () => {
  const activity = createActivity(true);
  const waiting: (() => void)[] = [];
  const reports: string[] = [];
  const background = (run: () => void) => {
    waiting.push(run);
  };
  const report = (line: string) => {
    reports.push(line);
  };
  const Probe = ({ id }: { id: string }) => {
    const game = React.useMemo(() => newGame('hotseat', id), [id]);
    useDanger(game, background, report);
    return null;
  };
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <ActivityContext.Provider value={activity}>
        <Probe id="first" />
      </ActivityContext.Provider>,
    );
  });
  try {
    const old = waiting.shift()!;
    act(() => {
      activity.setActive(false);
      old();
    });
    assert.equal(waiting.length, 0, 'no next roll was searched while paused');
    assert.deepEqual(reports, [], 'no result was produced while paused');
    act(() => activity.setActive(true));
    assert.equal(waiting.length, 1, 'the unfinished step is rescheduled');
    const resumed = waiting.shift()!;
    act(() => resumed());
    // Completion or a next roll proves that the old task resumed.
    assert.ok(waiting.length + reports.length > 0);
    const stale = waiting.splice(0);
    act(() => activity.setActive(false));
    act(() =>
      tree.update(
        <ActivityContext.Provider value={activity}>
          <Probe id="second" />
        </ActivityContext.Provider>,
      ),
    );
    const before = reports.length;
    act(() => {
      for (const run of stale) run();
    });
    assert.equal(
      reports.length,
      before,
      'the first position cannot report after replacement',
    );
    assert.equal(waiting.length, 0);
    act(() => activity.setActive(true));
    assert.equal(waiting.length, 1, 'only the new position resumes');
  } finally {
    act(() => tree.unmount());
  }
});
