import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { DiceChess } from '@fortemate/dicechess-engine';
import { ActivityContext, createActivity } from '../src/activity';
import { useBotVoice } from '../src/useBotVoice';
import { useDanger } from '../src/useDanger';
import type { VoiceLine } from '../../src/core/botVoice';
import { settle, turnDanger, type Level } from '../../src/core/danger';
import { newGame, type Game } from '../../src/core/game';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

test('a measure waits while the app is away, runs once it is back, and a replaced position never reports', () => {
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
    useDanger(game, background, true, report);
    return null;
  };
  const view = (id: string) => (
    <ActivityContext.Provider value={activity}>
      <Probe id={id} />
    </ActivityContext.Provider>
  );
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(view('first'));
  });
  try {
    const old = waiting.shift()!;
    act(() => {
      activity.setActive(false);
      old();
    });
    assert.equal(waiting.length, 0, 'nothing was measured while paused');
    assert.deepEqual(reports, [], 'no result was produced while paused');
    act(() => activity.setActive(true));
    assert.equal(waiting.length, 1, 'the measure is scheduled again');
    act(() => waiting.shift()!());
    assert.equal(reports.length, 1, 'one slot measures the whole turn');
    assert.match(reports[0], /^danger calm in \d+ ms$/);
    assert.equal(waiting.length, 0, 'and leaves nothing to run');
    // A second game, its measure still waiting when the app goes away and a
    // third game replaces it.
    act(() => tree.update(view('second')));
    const stale = waiting.splice(0);
    act(() => activity.setActive(false));
    act(() => tree.update(view('third')));
    act(() => {
      for (const run of stale) run();
    });
    assert.equal(reports.length, 1, 'the replaced position cannot report');
    assert.equal(waiting.length, 0);
    act(() => activity.setActive(true));
    assert.equal(waiting.length, 1, 'only the new position is measured');
  } finally {
    act(() => tree.unmount());
  }
});

// The measure asks the engine for threatWeight, and in Hot Seat for the position as
// if the side to move passed.
for (const method of ['endTurn', 'threatWeight'] as const)
  test(`a danger measure whose ${method} throws is heard as a calm turn, not a closed app`, (t) => {
    // The app's scheduler: the measure waits for a timer, as it waits for a
    // frame on the device, so a throw in it happens outside any render.
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
      level = useDanger(game, background, true, report);
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
      assert.match(reports.at(-1)!, /^danger calm in \d+ ms$/);
      // The music falls one step, as after a quiet turn.
      assert.equal(level, 'tense');
      // The failed measure is over: nothing asks the engine again.
      act(() => t.mock.timers.tick(100));
      assert.equal(fault.mock.callCount(), 1);
    } finally {
      act(() => tree.unmount());
    }
  });

// The level and the opponent's line over a game, with the danger measure held
// until the test runs it, as the app's scheduler holds it for a frame.
const rig = () => {
  const waiting: (() => void)[] = [];
  const reports: string[] = [];
  const activity = createActivity(true);
  let level: Level | undefined;
  let line: VoiceLine | null = null;
  const background = (run: () => void) => {
    waiting.push(run);
  };
  const report = (entry: string) => {
    reports.push(entry);
  };
  const Probe = ({ game, music }: { game: Game; music: boolean }) => {
    level = useDanger(game, background, music, report);
    line = useBotVoice(game, level);
    return null;
  };
  const view = (game: Game, music: boolean) => (
    <ActivityContext.Provider value={activity}>
      <Probe game={game} music={music} />
    </ActivityContext.Provider>
  );
  let tree: renderer.ReactTestRenderer | undefined;
  return {
    reports,
    waiting: () => waiting.length,
    level: () => level,
    line: () => line,
    show(game: Game, music: boolean) {
      act(() => {
        if (tree) tree.update(view(game, music));
        else tree = renderer.create(view(game, music));
      });
    },
    // Runs what is held, and anything it schedules, until the measure answers.
    // How many slots ran.
    finish() {
      let steps = 0;
      for (let run = waiting.shift(); run; run = waiting.shift()) {
        act(() => run());
        steps++;
      }
      return steps;
    },
    unmount() {
      if (tree) act(() => tree?.unmount());
    },
  };
};

// The person plays White. Rampage's rook on e4 attacks White's king on e1: one
// rook die, and it takes that king with its first action.
const THREATENED = '4k3/8/8/8/4r3/8/8/4K3 w - - 0 1';
// Here the person's rook on e5 attacks Rampage's king, and theirs is safe.
const SAFE = '4k3/8/8/4R3/8/8/8/4K3 w - - 0 1';
// Tense with the music, for the person on White: 30 of the 216 rolls take the
// king on d2 within two actions, and none with the first.
const TENSE = '3rkb2/ppp3pp/3p2N1/4PP2/8/8/PPPK1PPP/RN5R b - - 1 7';
// Black to move can take White's king with its first action.
const CRITICAL = '8/8/7p/p1p5/k5p1/5K2/n7/5b2 b - - 0 18';

// A turn of a game against Rampage, past its opening line.
const againstRampage = (id: string, start: string): Game => ({
  ...newGame('aggressive', id, start, 'w'),
  turn: 3,
});

test('with no music heard, a critical turn against the computer is one threat evaluation, and the threat is still said (#368)', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const threat = t.mock.method(DiceChess, 'threatWeight');
  const r = rig();
  try {
    r.show(againstRampage('threat', THREATENED), false);
    assert.equal(r.finish(), 1);
    assert.equal(threat.mock.callCount(), 1);
    assert.match(r.reports.at(-1)!, /^danger critical in \d+ ms$/);
    assert.equal(r.level(), 'critical');
    assert.equal(r.line()?.event, 'threat');
    // A turn the music would hear as tense is a calm one, also in one slot.
    r.show(againstRampage('quiet', TENSE), false);
    assert.equal(r.finish(), 1);
    assert.equal(r.level(), 'calm');
  } finally {
    r.unmount();
  }
});

test('Hot Seat with no music heard starts no search, and music turned on measures the turn at once (#368)', (t) => {
  const threat = t.mock.method(DiceChess, 'threatWeight');
  const r = rig();
  try {
    const game = newGame('hotseat', 'friends', CRITICAL);
    r.show(game, false);
    assert.equal(r.waiting(), 0);
    assert.equal(threat.mock.callCount(), 0);
    assert.deepEqual(r.reports, []);
    assert.equal(r.level(), 'calm');
    // In the middle of the turn, not from the next one.
    r.show(game, true);
    assert.equal(r.waiting(), 1);
    r.finish();
    assert.equal(r.level(), 'critical');
  } finally {
    r.unmount();
  }
});

test('with music heard, the levels are the ones the whole measure gives, settled turn by turn (#368)', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  // The turns of one game, each from its own position, against the computer
  // and in Hot Seat.
  const turns = [CRITICAL, TENSE, SAFE, THREATENED, TENSE];
  for (const mode of ['aggressive', 'hotseat'] as const) {
    const r = rig();
    let expected: Level | null = null;
    try {
      for (const start of turns) {
        const game = newGame(mode, mode, start);
        r.show(game, true);
        assert.equal(r.finish(), 1);
        // Every turn, the whole measure.
        const measured = turnDanger(game);
        expected = expected ? settle(expected, measured) : measured;
        assert.equal(r.level(), expected, `${mode} ${start}`);
      }
    } finally {
      r.unmount();
    }
  }
});

test('music turned on in the middle of a turn measures it again, and the level still falls one step that turn (#368)', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const r = rig();
  try {
    r.show(againstRampage('game', THREATENED), true);
    r.finish();
    assert.equal(r.level(), 'critical');
    // The next turn, heard without music: one generation, calm, and the level
    // falls.
    const next = againstRampage('game', SAFE);
    r.show(next, false);
    assert.equal(r.finish(), 1);
    assert.equal(r.level(), 'tense');
    // Music on: the whole measure runs at once. The turn is still calm, and it
    // still falls from critical, not a second time from tense.
    r.show(next, true);
    assert.equal(r.finish(), 1);
    assert.match(r.reports.at(-1)!, /^danger calm in \d+ ms$/);
    assert.equal(r.level(), 'tense');
  } finally {
    r.unmount();
  }
});
