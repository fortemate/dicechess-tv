// How often a key replays the turn (#367). A view of the game replays the
// actions played so far, one engine call each, and the screen asks for views
// many times a key: from the reducer, the prompt, the matchup and the save. Each
// state of the game is replayed once and every later view of it is kept, so a
// key replays the turn at most once: an arrow or a pick-up not at all, since
// the state they show was already on screen, and a played action once, for the
// state it leads to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DiceChess } from '@fortemate/dicechess-engine';
import { reset } from './stubs/react-native-mmkv.mjs';
import {
  fakeTimers,
  fixedOptions,
  launch,
  send,
  silentSounds,
} from './support';

// The voices run on the test's clock.
fakeTimers();

test('an arrow, a pick-up and a played action each replay the turn at most once', (t) => {
  reset();
  const applies = t.mock.method(DiceChess, 'applyMove');
  // Three pawns, so several pieces can move at every point of the turn. The
  // danger to the kings is never measured: it is a search of its own.
  const { state } = launch({
    options: fixedOptions({
      roll: () => [1, 1, 1],
      background: () => () => undefined,
    }),
    sounds: silentSounds(),
  });
  // Engine calls for one key, in turns' worth: with `played` actions on the
  // board, one replay of the turn is that many calls.
  const replays = (key: string, played: number) => {
    applies.mock.resetCalls();
    send(key);
    return applies.mock.callCount() / Math.max(played, 1);
  };
  // A new game for two friends, rolled, and a first pawn pushed.
  send('enter', 'enter', 'enter', 'enter');
  assert.match(state(), /phase move .*dice "PP" .*selected -/);

  for (const played of [1, 2]) {
    assert.equal(replays('right', played), 0, 'an arrow');
    assert.equal(replays('enter', played), 0, 'a pick-up');
    assert.match(state(), /selected [a-h][1-8]/);
    assert.equal(replays('down', played), 0, 'an arrow with a piece in hand');
    assert.equal(replays('back', played), 0, 'a put-down');
    send('enter');
    const play = replays('enter', played + 1);
    assert.ok(play <= 1, `a played action replayed the turn ${play} times`);
    assert.match(state(), new RegExp(`dice "${'P'.repeat(2 - played)}"`));
  }
});
