import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { DiceChess } from '@fortemate/dicechess-engine';
import { ActivityContext, createActivity } from '../src/activity';
import { useDanger } from '../src/useDanger';
import type { Level } from '../../src/core/danger';
import { newGame, type Game } from '../../src/core/game';

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

// The search asks the engine for the passed position as it starts, and for
// moves in every step.
for (const method of ['endTurn', 'generateMoves'] as const)
  test(`a danger search whose ${method} throws is heard as a calm turn, not a closed app`, (t) => {
    // The app's scheduler: a step waits for a timer, as it waits for a frame on
    // the device, so a throw in it happens outside any render.
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const background = (step: () => void) => {
      const timer = setTimeout(step, 0);
      return () => clearTimeout(timer);
    };
    const activity = createActivity(true);
    const reports: string[] = [];
    const report = (line: string) => {
      reports.push(line);
    };
    let level: Level | undefined;
    const Probe = ({ game }: { game: Game }) => {
      level = useDanger(game, background, report);
      return null;
    };
    const turn = (game: Game) => (
      <ActivityContext.Provider value={activity}>
        <Probe game={game} />
      </ActivityContext.Provider>
    );
    // Black to move can take White's king with its first action.
    const threat = '8/8/7p/p1p5/k5p1/5K2/n7/5b2 b - - 0 18';
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(turn(newGame('hotseat', 'game', threat)));
    });
    try {
      act(() => t.mock.timers.tick(1));
      assert.equal(level, 'critical');
      const fault = t.mock.method(DiceChess, method, () => {
        throw new Error('engine fault');
      });
      // The next turn of the same game.
      act(() => tree.update(turn(newGame('hotseat', 'game'))));
      act(() => t.mock.timers.tick(1));
      assert.equal(reports.at(-2), 'danger search failed: Error: engine fault');
      assert.match(reports.at(-1)!, /^danger calm in 1 steps, \d+ ms$/);
      // The music falls one step, as after a quiet turn.
      assert.equal(level, 'tense');
      // The failed search is over: nothing asks the engine again.
      act(() => t.mock.timers.tick(100));
      assert.equal(fault.mock.callCount(), 1);
    } finally {
      act(() => tree.unmount());
    }
  });
