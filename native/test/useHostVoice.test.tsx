// The Hot Seat host in the game screen (#202): he speaks only while the board
// is on screen and the host is on, a line waits for the one being said as long
// as the game waits too, and his last word stays with the result.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { useHostVoice, type UseHostVoiceOptions } from '../src/useHostVoice';
import { DISMISS_DELAY_MS } from '../src/useBotVoice';
import {
  moveGame,
  newGame,
  nextTurn,
  resignGame,
  rollGame,
  type Game,
} from '../../src/core/game';
import type { HostLine } from '../../src/core/hostVoice';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Queen, rook and king: nothing in the opening can move.
const EMPTY = [5, 4, 6];
const HOLD = 5000;

type Props = { game: Game; options: UseHostVoiceOptions };

const harness = () => {
  let latest: HostLine | null = null;
  const said: HostLine[] = [];
  let stops = 0;
  const Harness = ({ game, options }: Props) => {
    latest = useHostVoice(game, options);
    return null;
  };
  const base: UseHostVoiceOptions = {
    live: true,
    on: true,
    random: () => 0,
    holdMs: () => HOLD,
    onVoiceLine: (line) => said.push(line),
    onStop: () => {
      stops++;
    },
  };
  let tree: renderer.ReactTestRenderer | null = null;
  const show = (game: Game, options: Partial<UseHostVoiceOptions> = {}) =>
    act(() => {
      const element = <Harness game={game} options={{ ...base, ...options }} />;
      if (tree) tree.update(element);
      else tree = renderer.create(element);
    });
  return {
    show,
    line: () => latest,
    said: () => said.map((line) => line.event),
    stopped: () => stops,
    unmount: () => act(() => tree?.unmount()),
  };
};

const tick = (ms: number) =>
  act(() => {
    mock.timers.tick(ms);
  });

// Each test runs with the timers mocked, and unmounts what it rendered.
const withTimers = (name: string, body: () => void) =>
  test(name, () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      body();
    } finally {
      mock.timers.reset();
    }
  });

withTimers('an unstarted game behind the home screen says nothing', () => {
  const host = harness();
  host.show(newGame('hotseat', 'behind'), { live: false });
  assert.equal(host.line(), null);
  assert.deepEqual(host.said(), []);
  // A new game on the board is greeted, once.
  const game = newGame('hotseat', 'started');
  host.show(game);
  assert.equal(host.line()?.event, 'intro');
  assert.deepEqual(host.said(), ['intro']);
  // A menu opened and closed over it adds nothing.
  host.show(game, { live: false });
  host.show(game);
  assert.deepEqual(host.said(), ['intro']);
  host.unmount();
});

withTimers('turned off mid-line, his voice stops with his bubble', () => {
  const host = harness();
  const game = newGame('hotseat', 'stop');
  host.show(game);
  assert.equal(host.line()?.event, 'intro');
  host.show(game, { on: false });
  assert.equal(host.line(), null);
  assert.equal(host.stopped(), 1);
  // With no line of his showing, there is nothing to stop.
  const rolled = rollGame(game, [2, 2, 2]);
  host.show(rolled, { on: false });
  host.show(rolled);
  host.show(rolled, { on: false });
  assert.equal(host.stopped(), 1);
  host.unmount();
});

withTimers("a new game against the bot leaves the bot's line alone", () => {
  const host = harness();
  host.show(newGame('hotseat', 'before'));
  assert.ok(host.line());
  host.show(newGame('random', 'bot'));
  assert.equal(host.line(), null);
  assert.equal(host.stopped(), 0);
  host.unmount();
});

withTimers(
  'off, he shows and says nothing; turned on mid-game, he greets no one',
  () => {
    const host = harness();
    const game = newGame('hotseat', 'switch');
    host.show(game, { on: false });
    assert.equal(host.line(), null);
    const rolled = rollGame(game, [2, 2, 2]);
    host.show(rolled, { on: false });
    assert.deepEqual(host.said(), []);
    host.show(rolled);
    assert.equal(host.line(), null, 'no intro for a game under way');
    // The first White turn end of the session teaches the pass.
    const ended = moveGame(moveGame(moveGame(rolled, 'b1c3'), 'c3b5'), 'b5a7');
    assert.equal(ended.phase, 'handoff');
    host.show(ended);
    assert.equal(host.line()?.event, 'handoff');
    // Turned off, his bubble goes at once.
    host.show(ended, { on: false });
    assert.equal(host.line(), null);
    host.unmount();
  },
);

withTimers('a line waits for the one being said', () => {
  const host = harness();
  const game = newGame('hotseat', 'queue');
  host.show(game);
  const intro = host.line();
  assert.equal(intro?.event, 'intro');
  // White's roll leaves nothing to play: the pass is taught, after the intro.
  const empty = rollGame(game, EMPTY);
  host.show(empty);
  assert.equal(host.line(), intro);
  assert.deepEqual(host.said(), ['intro']);
  tick(HOLD - 1);
  assert.equal(host.line(), intro);
  tick(1);
  assert.equal(host.line()?.event, 'handoff');
  assert.deepEqual(host.said(), ['intro', 'handoff']);
  tick(HOLD);
  assert.equal(host.line(), null);
  host.unmount();
});

withTimers(
  'a waiting pass of the remote is put back when the next turn begins',
  () => {
    const host = harness();
    const game = newGame('hotseat', 'survive');
    host.show(game);
    // White's roll leaves nothing to play while the intro is said: the pass
    // waits. White passes, and Black rolls before the intro ends.
    const empty = rollGame(game, EMPTY);
    host.show(empty);
    const black = nextTurn(empty);
    host.show(black);
    const thinking = rollGame(black, [2, 2, 2]);
    assert.equal(thinking.phase, 'move');
    host.show(thinking);
    tick(HOLD);
    assert.equal(host.line(), null, 'nothing while Black is thinking');
    tick(HOLD);
    assert.deepEqual(host.said(), ['intro']);
    host.unmount();
  },
);

withTimers(
  'a pass of the remote put back is taught at the next White turn end',
  () => {
    const host = harness();
    const game = newGame('hotseat', 'later');
    host.show(game);
    const white = rollGame(game, EMPTY);
    host.show(white);
    const black = nextTurn(white);
    host.show(black);
    const blackEmpty = rollGame(black, EMPTY);
    host.show(blackEmpty);
    tick(HOLD);
    assert.deepEqual(host.said(), ['intro'], 'never at a Black turn end');
    const again = nextTurn(blackEmpty);
    host.show(again);
    host.show(rollGame(again, EMPTY));
    assert.equal(host.line()?.event, 'handoff');
    assert.deepEqual(host.said(), ['intro', 'handoff']);
    host.unmount();
  },
);

withTimers('a waiting rook is dropped when the next turn begins', () => {
  const host = harness();
  const resumed = { ...newGame('hotseat', 'drop'), turn: 5, revision: 7 };
  host.show(resumed, { holdMs: () => 60_000 });
  // The end of White's turn 5 teaches the pass, which stays a minute.
  host.show(rollGame(resumed, EMPTY), { holdMs: () => 60_000 });
  assert.equal(host.line()?.event, 'handoff');
  // Two turns later White's rook takes a rook while he is still talking.
  const rook = {
    ...rollGame(
      newGame('hotseat', 'drop', '4k3/8/8/r7/8/8/8/R3K3 w - - 0 1'),
      [4, 1, 1],
    ),
    turn: 7,
    revision: 20,
  };
  host.show(rook, { holdMs: () => 60_000 });
  const taken = moveGame(rook, 'a1a5');
  host.show(taken, { holdMs: () => 60_000 });
  assert.equal(host.line()?.event, 'handoff', 'the rook waits');
  host.show(nextTurn(taken), { holdMs: () => 60_000 });
  tick(60_000);
  assert.equal(host.line(), null, 'and is never said');
  assert.deepEqual(host.said(), ['handoff']);
  host.unmount();
});

withTimers(
  'a line that waits while a menu is up shows when the board returns',
  () => {
    const host = harness();
    const game = newGame('hotseat', 'menu');
    host.show(game);
    const empty = rollGame(game, EMPTY);
    host.show(empty);
    host.show(empty, { live: false });
    tick(HOLD);
    assert.equal(host.line(), null, 'not behind the menu');
    assert.deepEqual(host.said(), ['intro']);
    host.show(empty);
    assert.equal(host.line()?.event, 'handoff');
    host.unmount();
  },
);

withTimers(
  'a waiting rook is said once the line before it ends, if the game waits too',
  () => {
    const host = harness();
    const resumed = { ...newGame('hotseat', 'wait'), turn: 5, revision: 7 };
    host.show(resumed);
    host.show(rollGame(resumed, EMPTY));
    const rook = {
      ...rollGame(
        newGame('hotseat', 'wait', '4k3/8/8/r7/8/8/8/R3K3 w - - 0 1'),
        [4, 1, 1],
      ),
      turn: 7,
      revision: 20,
    };
    host.show(rook);
    host.show(moveGame(rook, 'a1a5'));
    tick(HOLD);
    assert.equal(host.line()?.event, 'capture_heavy');
    assert.deepEqual(host.said(), ['handoff', 'capture_heavy']);
    host.unmount();
  },
);

withTimers('his last word stays until a new game replaces it', () => {
  const host = harness();
  const game = newGame('hotseat', 'result');
  host.show(game);
  tick(HOLD);
  const rolled = rollGame(game, [2, 2, 2]);
  host.show(rolled);
  host.show(resignGame(rolled));
  const last = host.line();
  assert.ok(last);
  assert.ok(['black_wins', 'win'].includes(last.event), last.event);
  tick(60_000);
  assert.equal(host.line(), last);
  host.show(newGame('hotseat', 'next'));
  assert.equal(host.line()?.event, 'again');
  host.unmount();
});

withTimers('a game against the bot is not his', () => {
  const host = harness();
  host.show(newGame('random', 'bot'));
  assert.equal(host.line(), null);
  assert.deepEqual(host.said(), []);
  host.unmount();
});

withTimers('unmounting cancels his timer', () => {
  const host = harness();
  host.show(newGame('hotseat', 'unmount'), { holdMs: undefined });
  assert.ok(host.line());
  const cleared = mock.method(globalThis, 'clearTimeout');
  host.unmount();
  assert.equal(cleared.mock.callCount(), 1);
  cleared.mock.restore();
  tick(DISMISS_DELAY_MS);
});
