// The opponent's search overlaps its step wait (#253), through the whole app: the
// roll is on screen before the search starts, the first action shows one step
// after the roll however long the search took, and a menu opened meanwhile
// pauses the wait without throwing the reply away.
// What the app schedules waits in a queue, with the wait it asked for, and the
// clock is the test's own, so a search of any length can be played.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react-test-renderer';
import { reset } from './stubs/react-native-mmkv.mjs';
import { BOT_STEP_MS, type ScreenOptions } from '../src/screen';
import {
  fakeTimers,
  isHost,
  launch,
  send,
  silentSounds,
  styleOf,
  type Instance,
} from './support';
import { botReply } from '../../src/core/bot';
import { newGame, rollGame } from '../../src/core/game';

// The opponent's voice runs on its own timer, here the test's clock.
fakeTimers();

const botStatus = (root: Instance): string | null => {
  const found = root.findAll(
    (node) => isHost(node, 'Text') && node.props.testID === 'bot-status',
  );
  return found.length ? String(found[0].props.children) : null;
};

const botStatusStyle = (root: Instance) => {
  const found = root.findAll(
    (node) => isHost(node, 'Text') && node.props.testID === 'bot-status',
  );
  return found.length ? styleOf(found[0]) : null;
};

const harness = () => {
  const waiting: { step: () => void; wait: number }[] = [];
  const searches: (() => void)[] = [];
  const state = { time: 0 };
  const options: ScreenOptions = {
    // Three pawns always have somewhere to go from the opening, so the
    // opponent spends all three dice: one search, then two plain steps.
    roll: () => [1, 1, 1],
    newId: () => 'pacing',
    schedule: (step, wait) => {
      waiting.push({ step, wait });
    },
    // The opponent plays White: the person is drawn Black.
    side: () => 'b',
    // Between frames: held until the test lets it run.
    background: (step) => {
      searches.push(step);
    },
    now: () => state.time,
  };
  return {
    options,
    waits: () => waiting.map(({ wait }) => wait),
    // Runs what waits now; what those steps schedule in turn waits for the next
    // call.
    next: () => {
      for (const { step } of waiting.splice(0)) act(() => step());
    },
    // The opponent's search, and the danger measure beside it, run `took`
    // milliseconds after the wait began.
    search: (took: number) => {
      state.time += took;
      while (searches.length) act(() => searches.shift()?.());
    },
    // Time passes with nothing running, as while a menu is open.
    pass: (ms: number) => {
      state.time += ms;
    },
  };
};

// Play the computer, Rolly, and Random, which draws Black: the opponent rolls
// first, after the usual step.
const opening = (rig: ReturnType<typeof harness>) => {
  reset();
  launch({ options: rig.options, sounds: silentSounds() });
  send('down', 'enter', 'enter', 'enter');
  assert.deepEqual(rig.waits(), [BOT_STEP_MS]);
  rig.next();
};

test('the roll is shown first, then the first action comes one step after it, less the search', () => {
  const rig = harness();
  opening(rig);

  // The roll is up and the search has not run: nothing is scheduled yet.
  assert.deepEqual(rig.waits(), []);

  // A quick search leaves the rest of the step to wait out.
  rig.search(150);
  assert.deepEqual(rig.waits(), [BOT_STEP_MS - 150]);
  rig.next();

  // The other two dice are plain steps, a full step apart.
  assert.deepEqual(rig.waits(), [BOT_STEP_MS]);
});

test('a search longer than the step shows the first action at once, not a step later', () => {
  const rig = harness();
  opening(rig);
  rig.search(BOT_STEP_MS * 3);
  assert.deepEqual(rig.waits(), [0]);
  rig.next();
  assert.deepEqual(rig.waits(), [BOT_STEP_MS]);
});

test('opening the menu pauses the wait, and closing it resumes the rest of it', () => {
  const rig = harness();
  opening(rig);
  rig.search(200);
  assert.deepEqual(rig.waits(), [BOT_STEP_MS - 200]);

  // 50 more milliseconds of the wait pass, then Back opens the menu.
  rig.pass(50);
  send('back');
  // The step that was waiting is dropped: it must not play behind the menu.
  rig.next();
  assert.deepEqual(rig.waits(), []);

  // However long the menu stays open, it costs the wait nothing: what resumes
  // is the 350 ms that were left, not a new step.
  rig.pass(60_000);
  send('back');
  rig.search(0);
  assert.deepEqual(rig.waits(), [BOT_STEP_MS - 250]);
  rig.next();
  assert.deepEqual(rig.waits(), [BOT_STEP_MS]);
});

test('a fast reply via options.reply shows no thinking indicator, and first action plays at one step wait', async () => {
  const waiting: { step: () => void; wait: number }[] = [];
  const state = { time: 0 };
  let resolveSearch!: () => void;
  let replyAsked = false;

  const options: ScreenOptions = {
    roll: () => [1, 1, 1],
    newId: () => 'fast-reply',
    schedule: (step, wait) => {
      waiting.push({ step, wait });
    },
    side: () => 'b',
    now: () => state.time,
    reply: (game) => {
      replyAsked = true;
      return new Promise((res) => {
        resolveSearch = () => res(botReply(game));
      });
    },
  };

  reset();
  const app = launch({ options, sounds: silentSounds() });
  send('down', 'enter', 'enter', 'enter');
  assert.deepEqual(
    waiting.map((w) => w.wait),
    [BOT_STEP_MS],
  );
  // Commit roll
  act(() => waiting.shift()!.step());
  assert.ok(replyAsked);
  assert.deepEqual(
    waiting.map((w) => w.wait),
    [BOT_STEP_MS],
  );

  // Reply arrives at 150 ms (within 600 ms step wait)
  state.time += 150;
  await act(async () => {
    resolveSearch();
  });
  // No thinking status shown
  assert.equal(botStatus(app.root), null);

  // Remaining wait elapses
  state.time += BOT_STEP_MS - 150;
  act(() => waiting.shift()!.step());

  // First action has played, no thinking status shown
  assert.equal(botStatus(app.root), null);
  assert.deepEqual(
    waiting.map((w) => w.wait),
    [BOT_STEP_MS],
  );
});

test('a slow search running past one step wait shows Thinking… at 20 dp, then plays and clears upon resolution', async () => {
  const waiting: { step: () => void; wait: number }[] = [];
  const state = { time: 0 };
  let resolveSearch!: () => void;

  const options: ScreenOptions = {
    roll: () => [1, 1, 1],
    newId: () => 'slow-reply',
    schedule: (step, wait) => {
      waiting.push({ step, wait });
    },
    side: () => 'b',
    now: () => state.time,
    reply: (game) =>
      new Promise((res) => {
        resolveSearch = () => res(botReply(game));
      }),
  };

  reset();
  const app = launch({ options, sounds: silentSounds() });
  send('down', 'enter', 'enter', 'enter');
  // Commit roll
  act(() => waiting.shift()!.step());
  assert.deepEqual(
    waiting.map((w) => w.wait),
    [BOT_STEP_MS],
  );

  // Step wait expires, but search has not resolved yet
  state.time += BOT_STEP_MS;
  act(() => waiting.shift()!.step());

  // Opponent is visibly thinking, readable at TV distance (20 dp text rule)
  assert.equal(botStatus(app.root), 'Thinking…');
  const style = botStatusStyle(app.root);
  assert.ok(style && Number(style.fontSize) >= 20, 'font size >= 20 dp');

  // Search resolves at 2000 ms
  state.time += 1400;
  await act(async () => {
    resolveSearch();
  });

  // Action plays immediately and thinking indicator disappears
  assert.equal(botStatus(app.root), null);
  assert.deepEqual(
    waiting.map((w) => w.wait),
    [BOT_STEP_MS],
  );
});

test('Back opens menu while opponent searches, pauses pacing, and resumes without losing search', async () => {
  const waiting: { step: () => void; wait: number }[] = [];
  const state = { time: 0 };
  let resolveSearch!: () => void;

  const options: ScreenOptions = {
    roll: () => [1, 1, 1],
    newId: () => 'menu-pause',
    schedule: (step, wait) => {
      const item = { step, wait };
      waiting.push(item);
      return () => {
        const idx = waiting.indexOf(item);
        if (idx >= 0) waiting.splice(idx, 1);
      };
    },
    side: () => 'b',
    now: () => state.time,
    reply: (game) =>
      new Promise((res) => {
        resolveSearch = () => res(botReply(game));
      }),
  };

  reset();
  const app = launch({ options, sounds: silentSounds() });
  send('down', 'enter', 'enter', 'enter');
  act(() => waiting.shift()!.step());
  assert.deepEqual(
    waiting.map((w) => w.wait),
    [BOT_STEP_MS],
  );

  // 200 ms pass, then player presses Back to open menu
  state.time += 200;
  send('back');
  assert.match(app.state(), /overlay menu/);
  // Waiting timer is canceled
  assert.equal(waiting.length, 0);

  // Time spent in menu does not count against search presentation wait
  state.time += 30_000;
  // Player closes menu
  send('back');
  assert.match(app.state(), /overlay none/);
  // Resumes remaining 400 ms
  assert.deepEqual(
    waiting.map((w) => w.wait),
    [BOT_STEP_MS - 200],
  );

  // Search resolves while remaining wait is counting down
  await act(async () => {
    resolveSearch();
  });
  assert.equal(botStatus(app.root), null);

  // Remaining wait expires
  state.time += BOT_STEP_MS - 200;
  act(() => waiting.shift()!.step());

  // Action plays
  assert.deepEqual(
    waiting.map((w) => w.wait),
    [BOT_STEP_MS],
  );
});

// Closed after both the wait and the search are over, the menu hands the
// opponent its step once: the wait and the search each find both done.
test('a reply that arrives behind the menu after the wait plays one action, not two', async () => {
  const waiting: { step: () => void; wait: number }[] = [];
  const state = { time: 0 };
  let resolveSearch!: () => void;
  const options: ScreenOptions = {
    roll: () => [1, 1, 1],
    newId: () => 'menu-done',
    schedule: (step, wait) => {
      const item = { step, wait };
      waiting.push(item);
      return () => {
        const idx = waiting.indexOf(item);
        if (idx >= 0) waiting.splice(idx, 1);
      };
    },
    side: () => 'b',
    now: () => state.time,
    reply: (game) =>
      new Promise((res) => {
        resolveSearch = () => res(botReply(game));
      }),
  };

  reset();
  const app = launch({ options, sounds: silentSounds() });
  send('down', 'enter', 'enter', 'enter');
  act(() => waiting.shift()!.step()); // the roll
  state.time += BOT_STEP_MS;
  act(() => waiting.shift()!.step()); // the wait is over; still searching
  send('back');
  assert.match(app.state(), /overlay menu/);
  await act(async () => {
    resolveSearch();
  });
  send('back');
  await act(async () => undefined);
  assert.match(app.state(), /dice "PP"/);
  assert.deepEqual(
    waiting.map((w) => w.wait),
    [BOT_STEP_MS],
  );
});

test('a reply that arrives after the game has moved on is discarded', async () => {
  let resolveFirstGame!: () => void;
  let replyCount = 0;

  const options: ScreenOptions = {
    roll: () => [1, 1, 1],
    newId: () => 'stale-id',
    schedule: (step) => step(),
    side: () => 'b',
    reply: (game) => {
      replyCount++;
      if (replyCount === 1) {
        return new Promise((res) => {
          resolveFirstGame = () => res(botReply(game));
        });
      }
      return new Promise(() => {});
    },
  };

  reset();
  const app = launch({ options, sounds: silentSounds() });
  // Start bot game 1
  send('down', 'enter', 'enter', 'enter');
  // While bot is searching in game 1, open menu and start a new game
  send('back');
  // Menu: Resume, Resign, New game
  send('down', 'down', 'enter'); // Select New game -> opens opponent cards
  send('enter'); // Select opponent -> opens confirm replace [Cancel, Yes]
  send('right', 'enter'); // Select Yes -> starts new game
  assert.match(app.state(), /turn 1 \| phase move/);

  // First game's reply resolves late
  await act(async () => {
    resolveFirstGame();
  });

  // Game remains at turn 1 of new game, not corrupted by first game's reply
  assert.match(app.state(), /turn 1 \| phase move/);
});

test('the non-blocking reply provider returns a valid reply fitting the game', async () => {
  const game = rollGame(
    newGame(
      'aggressive',
      'test-match',
      'rnB1k3/p1pp1ppN/7r/4p3/1b5q/8/PPPPPn1p/RNBQ1KR1 b - - 1 6',
      'w',
    ),
    [4, 1, 5],
  );
  const viaPromise = await Promise.resolve().then(() => botReply(game));
  assert.equal(viaPromise.gameId, game.id);
  assert.equal(viaPromise.revision, game.revision);
  assert.equal(
    viaPromise.dfen,
    'rnB1k3/p1pp1ppN/7r/4p3/1b5q/8/PPPPPn1p/RNBQ1KR1 b - - 1 6 RPQ',
  );
  assert.ok(viaPromise.moves.length > 0);
  assert.equal(viaPromise.moves[viaPromise.moves.length - 1], 'g1f1');
});
