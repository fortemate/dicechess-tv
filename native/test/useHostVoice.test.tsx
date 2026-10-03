// The Hot Seat host in the game screen (#202): she picks lines only while the
// board is on screen and a host is chosen, a line waits for the one being said
// as long as the game waits too, and her last word holds with the result. The
// hook returns nothing, as the screen shows nothing of hers yet: what she says,
// and when, is read from `onVoiceLine`, and whether a line of hers still holds
// from `onStop` when she is turned off.
import { test, mock, beforeEach, afterEach } from 'node:test';
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
  const said: HostLine[] = [];
  let stops = 0;
  // What the hook returned on its last render: the line the screen shows.
  let shown: HostLine | null = null;
  const Harness = ({ game, options }: Props) => {
    shown = useHostVoice(game, options);
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
    said: () => said.map((line) => line.event),
    shown: () => shown?.event ?? null,
    stopped: () => stops,
    unmount: () => act(() => tree?.unmount()),
  };
};

const tick = (ms: number) =>
  act(() => {
    mock.timers.tick(ms);
  });

// Each test runs with the timers mocked, and unmounts what it rendered.
beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout'] });
});
afterEach(() => {
  mock.timers.reset();
});

test('an unstarted game behind the home screen says nothing', () => {
  const host = harness();
  host.show(newGame('hotseat', 'behind'), { live: false });
  assert.deepEqual(host.said(), []);
  // A new game on the board is greeted, once.
  const game = newGame('hotseat', 'started');
  host.show(game);
  assert.deepEqual(host.said(), ['intro']);
  // A menu opened and closed over it adds nothing.
  host.show(game, { live: false });
  host.show(game);
  assert.deepEqual(host.said(), ['intro']);
  host.unmount();
});

test('turned off mid-line, her voice stops', () => {
  const host = harness();
  const game = newGame('hotseat', 'stop');
  host.show(game);
  assert.deepEqual(host.said(), ['intro']);
  host.show(game, { on: false });
  assert.equal(host.stopped(), 1);
  // With no line of hers being said, there is nothing to stop.
  const rolled = rollGame(game, [2, 2, 2]);
  host.show(rolled, { on: false });
  host.show(rolled);
  host.show(rolled, { on: false });
  assert.equal(host.stopped(), 1);
  assert.deepEqual(host.said(), ['intro']);
  host.unmount();
});

test("a new game against the bot leaves the bot's line alone", () => {
  const host = harness();
  host.show(newGame('hotseat', 'before'));
  assert.deepEqual(host.said(), ['intro']);
  host.show(newGame('random', 'bot'));
  assert.equal(host.stopped(), 0);
  assert.deepEqual(host.said(), ['intro']);
  host.unmount();
});

test('off, she says nothing; turned on mid-game, she greets no one', () => {
  const host = harness();
  const game = newGame('hotseat', 'switch');
  host.show(game, { on: false });
  const rolled = rollGame(game, [2, 2, 2]);
  host.show(rolled, { on: false });
  assert.deepEqual(host.said(), []);
  host.show(rolled);
  assert.deepEqual(host.said(), [], 'no intro for a game under way');
  // The first White turn end of the session teaches the pass.
  const ended = moveGame(moveGame(moveGame(rolled, 'b1c3'), 'c3b5'), 'b5a7');
  assert.equal(ended.phase, 'handoff');
  host.show(ended);
  assert.deepEqual(host.said(), ['handoff']);
  // Turned off, her line ends at once.
  host.show(ended, { on: false });
  assert.equal(host.stopped(), 1);
  host.unmount();
});

test('a line waits for the one being said', () => {
  const host = harness();
  const game = newGame('hotseat', 'queue');
  host.show(game);
  assert.deepEqual(host.said(), ['intro']);
  // White's roll leaves nothing to play: the pass is taught, after the intro.
  const empty = rollGame(game, EMPTY);
  host.show(empty);
  assert.deepEqual(host.said(), ['intro']);
  tick(HOLD - 1);
  assert.deepEqual(host.said(), ['intro']);
  tick(1);
  assert.deepEqual(host.said(), ['intro', 'handoff']);
  // Once the pass has been said, she is saying nothing: turned off, nothing
  // is stopped.
  tick(HOLD);
  host.show(empty, { on: false });
  assert.equal(host.stopped(), 0);
  assert.deepEqual(host.said(), ['intro', 'handoff']);
  host.unmount();
});

test('a waiting pass of the remote is put back when the next turn begins', () => {
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
  assert.deepEqual(host.said(), ['intro'], 'nothing while Black is thinking');
  tick(HOLD);
  assert.deepEqual(host.said(), ['intro']);
  host.unmount();
});

test('a pass of the remote put back is taught at the next White turn end', () => {
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
  assert.deepEqual(host.said(), ['intro', 'handoff']);
  host.unmount();
});

test('a waiting rook is dropped when the next turn begins', () => {
  const host = harness();
  const resumed = { ...newGame('hotseat', 'drop'), turn: 5, revision: 7 };
  host.show(resumed, { holdMs: () => 60_000 });
  // The end of White's turn 5 teaches the pass, which stays a minute.
  host.show(rollGame(resumed, EMPTY), { holdMs: () => 60_000 });
  assert.deepEqual(host.said(), ['handoff']);
  // Two turns later White's rook takes a rook while she is still talking.
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
  assert.deepEqual(host.said(), ['handoff'], 'the rook waits');
  host.show(nextTurn(taken), { holdMs: () => 60_000 });
  tick(60_000);
  assert.deepEqual(host.said(), ['handoff'], 'and is never said');
  host.unmount();
});

test('a line that waits while a menu is up is said when the board returns', () => {
  const host = harness();
  const game = newGame('hotseat', 'menu');
  host.show(game);
  const empty = rollGame(game, EMPTY);
  host.show(empty);
  host.show(empty, { live: false });
  tick(HOLD);
  assert.deepEqual(host.said(), ['intro'], 'not behind the menu');
  host.show(empty);
  assert.deepEqual(host.said(), ['intro', 'handoff']);
  host.unmount();
});

test('a line she has begun is left to finish behind a menu or the home screen', () => {
  const host = harness();
  const game = newGame('hotseat', 'covered');
  host.show(game);
  assert.deepEqual(host.said(), ['intro']);
  // The game menu opens while she greets the players: her line is left to
  // finish.
  host.show(game, { live: false });
  assert.equal(host.stopped(), 0, 'a menu alone leaves the line alone');
  host.show(game);
  tick(HOLD);
  // White rolls and resigns. OK on the finished board goes to the home
  // screen, which leaves her last word alone too: it may still be waiting
  // for its jingle.
  const rolled = rollGame(game, [2, 2, 2]);
  host.show(rolled);
  const resigned = resignGame(rolled);
  host.show(resigned);
  const [, last] = host.said();
  assert.ok(['black_wins', 'win'].includes(last), last);
  host.show(resigned, { live: false });
  assert.equal(host.stopped(), 0, 'the home screen leaves her last word alone');
  assert.deepEqual(host.said(), ['intro', last]);
  host.unmount();
});

test('a waiting rook is said once the line before it ends, if the game waits too', () => {
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
  assert.deepEqual(host.said(), ['handoff'], 'the rook waits');
  tick(HOLD);
  assert.deepEqual(host.said(), ['handoff', 'capture_heavy']);
  host.unmount();
});

test('her last word holds until a new game replaces it', () => {
  const host = harness();
  const game = newGame('hotseat', 'result');
  host.show(game);
  tick(HOLD);
  const rolled = rollGame(game, [2, 2, 2]);
  host.show(rolled);
  const resigned = resignGame(rolled);
  host.show(resigned);
  const [, last] = host.said();
  assert.ok(['black_wins', 'win'].includes(last), last);
  // A minute on she is still saying it: turned off, it is stopped.
  tick(60_000);
  host.show(resigned, { on: false });
  assert.equal(host.stopped(), 1);
  host.show(newGame('hotseat', 'next'));
  assert.deepEqual(host.said(), ['intro', last, 'again']);
  host.unmount();
});

test('a game against the bot is not hers', () => {
  const host = harness();
  host.show(newGame('random', 'bot'));
  assert.deepEqual(host.said(), []);
  host.unmount();
});

test('unmounting cancels her timer', () => {
  const host = harness();
  host.show(newGame('hotseat', 'unmount'), { holdMs: undefined });
  assert.deepEqual(host.said(), ['intro']);
  const cleared = mock.method(globalThis, 'clearTimeout');
  host.unmount();
  assert.equal(cleared.mock.callCount(), 1);
  cleared.mock.restore();
  tick(DISMISS_DELAY_MS);
});

test('the line being said is the one to show: while it holds, until a new game for the last word, and not once she is off (#213)', () => {
  const host = harness();
  const game = newGame('hotseat', 'shown');
  host.show(game);
  assert.equal(host.shown(), 'intro');
  // Said, it leaves the screen.
  tick(HOLD);
  assert.equal(host.shown(), null);
  // The last word holds with the result, however long it stays up.
  const resigned = resignGame(rollGame(game, EMPTY));
  host.show(resigned);
  assert.match(String(host.shown()), /win/);
  tick(10 * HOLD);
  assert.match(String(host.shown()), /win/);
  // A new game replaces it with a greeting; turned off, she leaves at once.
  const next = newGame('hotseat', 'shown-again');
  host.show(next);
  assert.equal(host.shown(), 'again');
  host.show(next, { on: false });
  assert.equal(host.shown(), null);
  host.unmount();
});
