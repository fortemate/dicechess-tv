// The result screen (#163): how a game ended, who won, and against the bot its
// last word under its badge, drawn in the matchup HUD like the game itself.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { press, pressBack } from './stubs/react-native-kepler.mjs';
import { reset } from './stubs/react-native-mmkv.mjs';
import { App } from '../src/App';
import { MmkvSnapshotStore } from '../src/mmkvStore';
import { DISMISS_DELAY_MS } from '../src/useBotVoice';
import { voiceLinesFor, type VoiceEvent } from '../../src/core/botVoice';
import { HOST_CATALOGUE } from '../../src/core/hostVoice';
import {
  decodeGame,
  newGame,
  rollGame,
  viewGame,
  type Game,
} from '../../src/core/game';
import type { ScreenOptions } from '../src/screen';

type Instance = renderer.ReactTestInstance;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Every game gets an id of its own, so a rematch is a new game to the voice.
const optionsWithIds = (): ScreenOptions => {
  let ids = 0;
  return {
    roll: () => [5, 4, 2],
    newId: () => 'resulttest' + ++ids,
    schedule: (step) => step(),
    // Random draws White.
    side: () => 'w',
  };
};

// A launch replaces the app a previous test left mounted, as a relaunch does.
let mounted: renderer.ReactTestRenderer | null = null;
const launch = (): Instance => {
  if (mounted) act(() => mounted!.unmount());
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      React.createElement(App, { options: optionsWithIds() }),
    );
  });
  mounted = tree;
  return tree.root;
};

const send = (...keys: string[]) => {
  for (const key of keys)
    act(() => {
      if (key === 'back') pressBack();
      else press(key);
    });
};

const text = (root: Instance) =>
  root
    .findAll((node) => (node.type as unknown as string) === 'Text', {
      deep: true,
    })
    .map((node) => String(node.props.children))
    .join('\n');

// Elements drawn with a testID, counted once: the stubs pass it on to the host
// element they render.
const drawn = (root: Instance, id: string) =>
  root.findAll(
    (node) => typeof node.type === 'string' && node.props?.testID === id,
  );

// What the bot says under its badge, or null when it says nothing.
const bubble = (root: Instance): string | null => {
  const found = drawn(root, 'speech-bubble-text');
  return found.length ? String(found[0].props.children) : null;
};

const linesOf = (event: VoiceEvent) =>
  voiceLinesFor('random', event).map((line) => line.text);

// From the home screen: play the computer, Rolly, on Random (drawn White).
const playRolly = () => send('down', 'enter', 'enter', 'enter');
// Resign through the menu: Back, Resign, then Yes on the confirmation.
const resign = () => send('back', 'down', 'select', 'down', 'select');

test('the result of a game against the bot says how it ended and who won', () => {
  reset();
  const root = launch();
  playRolly();
  resign();

  const shown = text(root);
  assert.match(shown, /Resigned/);
  assert.match(shown, /Black wins/);
  assert.match(shown, /Rematch/);
  assert.match(shown, /Main menu/);
  // The matchup stays up around it.
  assert.equal(drawn(root, 'opponent-badge').length, 1);
  assert.equal(drawn(root, 'player-badge').length, 1);
});

test("the bot's last word shows under its badge and stays with the result", () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    reset();
    const root = launch();
    playRolly();
    resign();

    const said = bubble(root);
    assert.ok(said, 'expected the bot to have the last word');
    assert.ok(linesOf('win').includes(said), `not a win line: ${said}`);

    // Long after an ordinary line would have gone, it is still there.
    act(() => {
      mock.timers.tick(DISMISS_DELAY_MS * 3);
    });
    assert.equal(bubble(root), said);
  } finally {
    mock.timers.reset();
  }
});

test('a rematch replaces the last word with the new game opening line', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    reset();
    const root = launch();
    playRolly();
    resign();
    assert.ok(linesOf('win').includes(bubble(root) ?? ''));

    // OK on Rematch, which has the focus.
    send('enter');
    const said = bubble(root);
    assert.ok(said && linesOf('intro').includes(said), `not an intro: ${said}`);
    assert.doesNotMatch(text(root), /What next\?/);
  } finally {
    mock.timers.reset();
  }
});

test('Main menu leaves the result, and the last word with it', () => {
  reset();
  const root = launch();
  playRolly();
  resign();
  assert.ok(bubble(root));

  send('down', 'enter');
  assert.match(text(root), /Dice Chess/);
  assert.equal(bubble(root), null);
});

test('a king taken from the bot is the result, with the bot conceding', () => {
  reset();
  // Rolly's king on d8, and White's only action with three knight dice is the
  // knight on b7 taking it: its other squares hold White's own pawns.
  const start = '3k4/1N6/3P4/P1P5/8/8/8/4K3 w - - 0 1';
  const saved = rollGame(
    newGame('random', 'kingtaken', start, 'w', 'w'),
    [2, 2, 2],
  );
  assert.deepEqual(viewGame(saved).legal, ['b7d8']);
  new MmkvSnapshotStore<Game>({
    key: 'dicechess-tv.game.v2',
    decode: decodeGame,
  }).save(saved);

  const root = launch();
  // Resume, pick up the knight, and take the king.
  send('enter', 'enter', 'enter');

  const shown = text(root);
  assert.match(shown, /King captured/);
  assert.match(shown, /White wins/);
  const said = bubble(root);
  assert.ok(said && linesOf('loss').includes(said), `not a loss: ${said}`);
});

// The Hot Seat host's last word is heard, not shown (#202): soundApp.test.tsx.
test('a hotseat result stays on the board, with the host’s last word beside her (#213)', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    reset();
    const root = launch();
    // A new hotseat game, and its first roll.
    send('enter', 'enter');
    resign();
    // Her result waits for her greeting to be said: she never talks over
    // herself (#202).
    act(() => {
      mock.timers.tick(10_000);
    });

    const shown = text(root);
    assert.match(shown, /HOTSEAT · TURN 1/);
    assert.match(shown, /Resigned/);
    assert.match(shown, /Black wins/);
    assert.match(shown, /OK: back to the menu/);
    assert.doesNotMatch(shown, /What next\?/);
    // No bot speaks in hotseat: the one bubble is the host's, with the result.
    const lastWord = bubble(root);
    assert.ok(
      HOST_CATALOGUE.some(
        (line) =>
          line.text === lastWord && /^host_(black_wins|win)_/.test(line.id),
      ),
      `the host cheers the result: ${lastWord}`,
    );
  } finally {
    mock.timers.reset();
  }
});
