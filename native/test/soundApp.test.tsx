// Sound through the whole app: a step of a real game reaches the players, and
// turning sound off survives a relaunch. A test cannot hear, so what is checked
// is what was asked for; hearing it is checked on the virtual device.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { press, pressBack, setAppState } from './stubs/react-native-kepler.mjs';
import {
  fullyDrawnReports,
  resetFullyDrawnReports,
} from './stubs/kepler-performance-api.mjs';
import { MMKV, reset } from './stubs/react-native-mmkv.mjs';
import { App } from '../src/App';
import type { ScreenOptions } from '../src/screen';
import type { Sounds } from '../src/sound';
import type { Cue } from '../../src/core/cues';
import { MmkvSnapshotStore } from '../src/mmkvStore';
import { decodeGame, newGame, rollGame, type Game } from '../../src/core/game';
import { HOST_CATALOGUE } from '../../src/core/hostVoice';

type Instance = renderer.ReactTestInstance;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const options: ScreenOptions = {
  roll: () => [2, 2, 2],
  newId: () => 'soundtest',
  schedule: (step) => step(),
  // Random draws White unless a test says otherwise.
  side: () => 'w',
};

type Recorder = Sounds & {
  played: Cue[][];
  muted: boolean | null;
  suspended: boolean | null;
  said: string[];
  // How many times a line was stopped on its own (#202).
  stopped: number;
  voices: boolean | null;
};

const recorder = (): Recorder => {
  const self: Recorder = {
    played: [],
    muted: null,
    suspended: null,
    said: [],
    stopped: 0,
    voices: null,
    play(cues) {
      if (cues.length) self.played.push([...cues]);
    },
    setMuted(value) {
      self.muted = value;
    },
    say(line) {
      self.said.push(line.id);
    },
    stopLine() {
      self.stopped++;
    },
    setVoices(on) {
      self.voices = on;
    },
    setSuspended(value) {
      self.suspended = value;
    },
  };
  return self;
};

// Each launch unmounts at the end of its test. Trees left mounted would all
// answer the same key presses, and a relaunch would not be one.
const launch = (sounds: Sounds) => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(App, { options, sounds }));
  });
  return tree;
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

test('a real game step reaches the sounds as the cue it is', () => {
  reset();
  const sounds = recorder();
  const tree = launch(sounds);
  // Start a hotseat game, then roll.
  send('enter', 'enter');
  assert.deepEqual(sounds.played, [['dice_roll']]);
  act(() => tree.unmount());
});

test('turning sound off is remembered at the next launch', () => {
  reset();
  const first = recorder();
  let tree = launch(first);
  assert.equal(first.muted, false, 'sound starts on');

  // Home, nothing saved: new hotseat, Play the computer, How to play, Rules,
  // Settings. This build has no music, so the sound effects come first.
  send('down', 'down', 'down', 'down', 'enter');
  assert.match(text(tree.root), /Sound effects: on/);
  send('enter');
  assert.match(text(tree.root), /Sound effects: off/);
  assert.equal(first.muted, true);
  act(() => tree.unmount());

  const second = recorder();
  tree = launch(second);
  assert.equal(second.muted, true, 'a relaunch starts muted');
  send('down', 'down', 'down', 'down', 'enter');
  assert.match(text(tree.root), /Sound effects: off/);
  act(() => tree.unmount());
});

test('the bots speak by default, and turning their voices off is remembered (#159)', () => {
  reset();
  const first = recorder();
  let tree = launch(first);
  assert.equal(first.voices, true, 'voices start on');
  // Settings, then the row after the sound effects.
  send('down', 'down', 'down', 'down', 'enter');
  assert.match(text(tree.root), /Voices: on/);
  send('down', 'enter');
  assert.match(text(tree.root), /Voices: off/);
  assert.equal(first.voices, false);
  assert.equal(first.muted, false, 'the effects are left alone');
  act(() => tree.unmount());

  const second = recorder();
  tree = launch(second);
  assert.equal(second.voices, false, 'a relaunch starts without voices');
  act(() => tree.unmount());
});

test('Rolly hosts Hot Seat by default, and turning the host off is remembered (#202)', () => {
  reset();
  const first = recorder();
  let tree = launch(first);
  // Settings, then the row after the voices.
  send('down', 'down', 'down', 'down', 'enter');
  assert.match(text(tree.root), /Hot Seat host: Rolly/);
  send('down', 'down', 'enter');
  assert.match(text(tree.root), /Hot Seat host: off/);
  assert.match(text(tree.root), /Voices: on/, 'the voices are left alone');
  assert.equal(first.voices, true);
  // Stored as the choice itself, which a later host's id would replace.
  assert.equal(new MMKV().getString('dicechess-tv.host.v1'), 'off');
  act(() => tree.unmount());

  const second = recorder();
  tree = launch(second);
  send('down', 'down', 'down', 'down', 'enter');
  assert.match(text(tree.root), /Hot Seat host: off/);
  // Back to the home screen, up to a new hotseat game: she says nothing.
  send('back', 'up', 'up', 'up', 'up', 'enter');
  assert.match(text(tree.root), /HOTSEAT · TURN 1/);
  assert.deepEqual(second.said, []);
  act(() => tree.unmount());
});

test('turning the host off while she speaks stops her voice, and only hers (#202)', () => {
  reset();
  const sounds = recorder();
  let tree = launch(sounds);
  // A new hotseat game: she greets both players.
  send('enter');
  assert.match(sounds.said[0], /^host_intro_[1-5]$/);
  // The game menu, up to its Settings, and down to her row.
  send('back', 'up', 'enter', 'down', 'down');
  assert.match(text(tree.root), /Hot Seat host: Rolly/);
  assert.equal(sounds.stopped, 0, 'a menu alone leaves the line alone');
  send('enter');
  assert.match(text(tree.root), /Hot Seat host: off/);
  assert.equal(sounds.stopped, 1);
  assert.equal(sounds.voices, true, 'the Voices setting is left alone');
  act(() => tree.unmount());

  // Against the computer the line is the bot's, which the host's setting
  // never stops.
  reset();
  const bot = recorder();
  tree = launch(bot);
  send('down', 'enter', 'enter', 'enter');
  assert.match(bot.said[0], /^rolly_intro_[123]$/);
  send('back', 'up', 'enter', 'down', 'down', 'enter');
  assert.match(text(tree.root), /Hot Seat host: off/);
  assert.equal(bot.stopped, 0);
  act(() => tree.unmount());
});

test('a fresh launch says nothing behind the home screen (#202)', () => {
  const store = new MmkvSnapshotStore<Game>({
    key: 'dicechess-tv.game.v2',
    decode: decodeGame,
  });
  for (const saved of [
    null,
    newGame('hotseat', 'unstarted'),
    // A game against the bot that was never rolled: it used to greet the
    // home screen.
    newGame('random', 'unrolled'),
  ]) {
    reset();
    if (saved) store.save(saved);
    const sounds = recorder();
    const tree = launch(sounds);
    assert.match(text(tree.root), /Dice Chess/);
    assert.deepEqual(sounds.said, [], saved?.id ?? 'nothing saved');
    act(() => tree.unmount());
  }
});

test('a new hotseat game opens with the host greeting both players (#202)', () => {
  reset();
  const sounds = recorder();
  const tree = launch(sounds);
  send('enter');
  assert.equal(sounds.said.length, 1);
  assert.match(sounds.said[0], /^host_intro_[1-5]$/);
  act(() => tree.unmount());
});

test('the Hot Seat host is seen while she speaks, above the bottom badge, and nothing else moves (#213)', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  reset();
  const sounds = recorder();
  const tree = launch(sounds);
  const textOf = (id: string) =>
    HOST_CATALOGUE.find((line) => line.id === id)?.text;
  try {
    // Her portrait and her line stand in the free space above the bottom
    // badge, placed over it rather than in the flow, so the dice and the
    // prompt keep their place; the turn line stands where it always does.
    const speaking = (id: string, turn: RegExp) => {
      const [block] = drawn(tree.root, 'host-block');
      assert.ok(block, 'she shows while she speaks');
      assert.equal(block.props.style.position, 'absolute');
      assert.equal(drawn(block, 'portrait-rolly').length, 1);
      assert.equal(text(block), textOf(id));
      const [line] = drawn(tree.root, 'turn-line');
      assert.match(text(line), turn);
    };
    // A new hotseat game: she greets both players.
    send('enter');
    assert.equal(sounds.said.length, 1);
    assert.match(sounds.said[0], /^host_intro_[1-5]$/);
    speaking(sounds.said[0], /HOTSEAT · TURN 1/);
    // Her greeting said, she leaves the screen; the turn line stays.
    act(() => {
      mock.timers.tick(10_000);
    });
    assert.equal(drawn(tree.root, 'host-block').length, 0);
    assert.match(text(drawn(tree.root, 'turn-line')[0]), /HOTSEAT · TURN 1/);
    // White rolls and resigns: her last word shows with the result, and holds.
    send('enter', 'back', 'down', 'select', 'down', 'select');
    assert.match(text(tree.root), /Black wins/);
    assert.equal(sounds.said.length, 2);
    assert.match(sounds.said[1], /^host_(black_wins|win)_\d$/);
    speaking(sounds.said[1], /HOTSEAT · TURN 1/);
    act(() => {
      mock.timers.tick(10_000);
    });
    speaking(sounds.said[1], /HOTSEAT · TURN 1/);
  } finally {
    act(() => tree.unmount());
    mock.timers.reset();
  }
});

test('a line the bot says is handed to the voice', () => {
  reset();
  const sounds = recorder();
  const tree = launch(sounds);
  // Play the computer, Rolly, on Random: the game opens with Rolly's intro.
  send('down', 'enter', 'enter', 'enter');
  assert.equal(sounds.said.length, 1);
  assert.match(sounds.said[0], /^rolly_intro_[123]$/);
  act(() => tree.unmount());
});

test('a win as Black is heard as a win', () => {
  reset();
  // Saved mid-turn: the person plays Black, rolled three rooks, and the rook on
  // a1 can take the White king on a8.
  const saved = rollGame(
    newGame('random', 'asblack', 'K7/8/8/8/8/8/8/r3k3 b - - 0 1', 'b'),
    [4, 4, 4],
  );
  new MmkvSnapshotStore<Game>({
    key: 'dicechess-tv.game.v2',
    decode: decodeGame,
  }).save(saved);
  const sounds = recorder();
  const tree = launch(sounds);
  // Resume, then walk from e7 to a1 and on to a8 on the board seen from
  // Black's side, where up on the screen is towards rank 1.
  send('enter');
  send('up', 'up', 'up', 'up', 'up', 'up', 'right', 'right', 'right', 'right');
  send('enter');
  send('down', 'down', 'down', 'down', 'down', 'down', 'down');
  send('enter');
  assert.deepEqual(sounds.played.at(-1), ['piece_capture', 'game_win']);
  act(() => tree.unmount());
});

test('leaving the foreground stops the sound, and coming back is a warm start', () => {
  reset();
  resetFullyDrawnReports();
  const sounds = recorder();
  const tree = launch(sounds);
  // The cool start is fully drawn by the first render.
  assert.equal(fullyDrawnReports(), 1);

  act(() => setAppState('background'));
  assert.equal(sounds.suspended, true);
  act(() => setAppState('active'));
  assert.equal(sounds.suspended, false);
  assert.equal(fullyDrawnReports(), 2);

  // The screensaver or a system dialog leaves the app inactive: silent too.
  act(() => setAppState('inactive'));
  assert.equal(sounds.suspended, true);
  act(() => setAppState('active'));
  assert.equal(fullyDrawnReports(), 3);

  // Active again without having been away is not another start.
  act(() => setAppState('active'));
  assert.equal(fullyDrawnReports(), 3);
  act(() => tree.unmount());
});
