// The game screen's fallback (#255): a throw while the game renders leaves a
// screen the player can read and a way back, and the saved game is still
// there. What a test cannot show is what Vega paints; that is checked on a
// device.
import { mock, test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act } from 'react-test-renderer';
import { DiceChess } from '@fortemate/dicechess-engine';
import { MmkvSnapshotStore } from '../src/mmkvStore';
import {
  FRESH_OPTION,
  GameBoundary,
  MENU_OPTION,
  RECOVERY_TITLE,
  recoveryReducer,
  type Recovery,
} from '../src/Recovery';
import { RESUME_OPTION } from '../src/screen';
import type { Music } from '../src/music';
import { decodeGame, newGame, rollGame, type Game } from '../../src/core/game';
import { hasExited, pressBack } from './stubs/react-native-kepler.mjs';
import { reset } from './stubs/react-native-mmkv.mjs';
import { focusedLabel, optionViews } from './options';
import {
  fakeTimers,
  fixedOptions,
  isHost,
  launch,
  mount,
  send,
  silentSounds,
  styleOf,
  text,
  type Instance,
} from './support';

// The app's sounds, music and voices run on the test's clock.
fakeTimers();

const store = () =>
  new MmkvSnapshotStore<Game>({
    key: 'dicechess-tv.game.v2',
    decode: decodeGame,
  });

// React logs every error a boundary catches. Here that is the point of the
// test, which reads what the player sees and what the app reports instead.
const quietBoundaries = (t: TestContext) => {
  const report = console.error;
  t.mock.method(console, 'error', (...args: unknown[]) => {
    const boundary = args.some(
      (arg) =>
        typeof arg === 'string' && arg.startsWith('The above error occurred'),
    );
    if (!boundary) report(...args);
  });
};

const Throws = (): React.ReactElement => {
  throw new Error('engine fault');
};

// A music player that plays nothing, so the settings list its rows at once
// rather than after a catalogue loads.
const quietMusic = (): Music => ({
  setRole() {},
  setEnabled() {},
  setVolume() {},
  setCatalogue() {},
  setDucked() {},
  setSuspended() {},
});

test('a child that throws renders the fallback, readable from the sofa', (t) => {
  quietBoundaries(t);
  const errors: unknown[] = [];
  const { root } = mount(
    <GameBoundary
      onError={(error) => errors.push(error)}
      onRecover={() => undefined}
    >
      <Throws />
    </GameBoundary>,
  );
  assert.match(text(root), new RegExp(RECOVERY_TITLE));
  assert.deepEqual(
    optionViews(root).map((option) => option.label),
    [MENU_OPTION, FRESH_OPTION],
  );
  // OK goes back to the menu unless the player moves first.
  assert.equal(focusedLabel(root), MENU_OPTION);
  // Every line is 20 dp or more, the smallest caption the game uses.
  const sizes = root
    .findAll((node: Instance) => isHost(node, 'Text'))
    .map((node) => Number(styleOf(node).fontSize));
  assert.ok(sizes.length > 0);
  assert.ok(
    sizes.every((size) => size >= 20),
    `font sizes ${sizes.join(', ')}`,
  );
  assert.equal(errors.length, 1);
  assert.match(String(errors[0]), /engine fault/);
});

test('on the fallback the arrows walk the options, OK takes one, and Back closes the app', (t) => {
  quietBoundaries(t);
  const chosen: Recovery[] = [];
  const { root } = mount(
    <GameBoundary
      onError={() => undefined}
      onRecover={(choice) => chosen.push(choice)}
    >
      <Throws />
    </GameBoundary>,
  );
  send('down');
  assert.equal(focusedLabel(root), FRESH_OPTION);
  send('down');
  assert.equal(focusedLabel(root), MENU_OPTION);
  send('up');
  assert.equal(focusedLabel(root), FRESH_OPTION);
  send('enter');
  assert.deepEqual(chosen, ['fresh']);

  // There is nothing behind the fallback, so Back closes the app as it does
  // on the home screen.
  assert.equal(pressBack(), false);
  assert.equal(hasExited(), true);
});

test('the fallback chooses once, however quickly OK is pressed again', () => {
  const chosen = recoveryReducer({ index: 0, chosen: null }, 'select');
  assert.equal(chosen.chosen, 'menu');
  assert.equal(recoveryReducer(chosen, 'down'), chosen);
  assert.equal(recoveryReducer(chosen, 'select'), chosen);
});

// A Hot Seat game whose first roll left nothing to play: three rooks, none of
// which can move from the starting position. OK on the board hands the turn
// over and rolls for Black, which is where the rigged roll below throws.
const savedGame = (): Game => rollGame(newGame('hotseat', 'kept'), [4, 4, 4]);

// The app as launched over that saved game, with a roll that throws while
// `failing` says so: the screen's reducer runs while the game screen renders,
// so the throw is a render error, as an engine rejecting a move would be.
const launchOverSave = () => {
  reset();
  const saved = savedGame();
  void store().save(saved);
  const rig = { failing: false };
  const lines: string[] = [];
  const launched = launch({
    options: fixedOptions({
      roll: () => {
        if (rig.failing) throw new Error('engine fault');
        return [4, 4, 4];
      },
    }),
    sounds: silentSounds(),
    music: quietMusic(),
    onState: (line) => lines.push(line),
  });
  return { ...launched, saved, rig, lines };
};

// Resumes the saved game and throws on the next OK.
const failInPlay = (app: ReturnType<typeof launchOverSave>) => {
  send('enter');
  assert.match(app.state(), /overlay none \| turn 1 \| phase handoff/);
  app.rig.failing = true;
  send('enter');
  app.rig.failing = false;
};

test('a throw in play shows the fallback, reports it, and keeps the saved game', (t) => {
  quietBoundaries(t);
  const app = launchOverSave();
  failInPlay(app);
  assert.match(text(app.root), new RegExp(RECOVERY_TITLE));
  assert.match(app.state(), /overlay recovery#0/);
  // Reported through the diagnostic seam.
  assert.ok(
    app.lines.includes('error Error: engine fault'),
    app.lines.join('\n'),
  );
  // Nothing was saved over the game, and nothing deleted it.
  assert.deepEqual(store().read(), app.saved);
});

test('OK on the fallback returns to the menu, and the saved game resumes', (t) => {
  quietBoundaries(t);
  const app = launchOverSave();
  failInPlay(app);
  send('enter');
  assert.match(app.state(), /overlay home#0/);
  assert.equal(focusedLabel(app.root), RESUME_OPTION);
  assert.deepEqual(store().read(), app.saved);
  // Resume opens the game where it was left, and play goes on.
  send('enter');
  assert.match(app.state(), /overlay none \| turn 1 \| phase handoff/);
  send('enter');
  assert.match(app.state(), /turn 2 \| phase handoff \| side b/);
});

test('Start fresh on the fallback deletes the saved game, and nothing else does', (t) => {
  quietBoundaries(t);
  const app = launchOverSave();
  failInPlay(app);
  send('down');
  assert.deepEqual(store().read(), app.saved, 'moving to it deletes nothing');
  send('enter');
  assert.match(app.state(), /overlay home#0/);
  assert.equal(store().read(), null);
  assert.ok(
    !optionViews(app.root).some((option) => option.label === RESUME_OPTION),
  );
});

test('Back on the fallback closes the app, and the saved game is there at the next launch', (t) => {
  quietBoundaries(t);
  const app = launchOverSave();
  failInPlay(app);
  assert.equal(pressBack(), false);
  assert.equal(hasExited(), true);
  const next = launch({ sounds: silentSounds(), music: quietMusic() });
  assert.match(next.state(), /overlay home#0/);
  assert.equal(focusedLabel(next.root), RESUME_OPTION);
});

test('a search that fails between frames reaches the fallback instead of closing the app', (t) => {
  quietBoundaries(t);
  reset();
  t.mock.method(DiceChess, 'getBestMove', () => {
    throw new Error('engine fault');
  });
  const lines: string[] = [];
  const app = launch({
    // Background work waits for the test's clock, as it waits for a frame on
    // the device, so the search runs outside any render.
    options: fixedOptions({
      background: (step) => {
        const timer = setTimeout(step, 0);
        return () => clearTimeout(timer);
      },
    }),
    sounds: silentSounds(),
    music: quietMusic(),
    onState: (line) => lines.push(line),
  });
  // Play the computer, the first opponent, as Black: the computer opens.
  send('down', 'enter', 'enter', 'down', 'down', 'enter');
  assert.match(app.state(), /overlay none \| turn 1 \| phase move \| side w/);
  act(() => mock.timers.tick(1));
  assert.match(text(app.root), new RegExp(RECOVERY_TITLE));
  assert.ok(
    lines.includes('error Error: engine fault'),
    lines.filter((line) => line.startsWith('error')).join('\n'),
  );
  // The game as it stood is saved: the computer's roll, nothing played.
  const saved = store().read()!;
  assert.equal(saved.human, 'b');
  assert.deepEqual(saved.moves, []);
});

test('the menu after a recovery has the settings the player changed before it', (t) => {
  quietBoundaries(t);
  const app = launchOverSave();
  // Home: Resume, Play a friend, Play the computer, Learn to play, Rules
  // reference, Settings. Sound effects is the second row of the settings,
  // under the music (#346).
  send('down', 'down', 'down', 'down', 'down', 'enter', 'down');
  assert.equal(focusedLabel(app.root), 'Sound effects: on');
  send('enter');
  assert.equal(focusedLabel(app.root), 'Sound effects: off');
  send('back');
  assert.match(app.state(), /overlay home/);
  send('up', 'up', 'up', 'up', 'up');
  failInPlay(app);
  send('enter');
  send('down', 'down', 'down', 'down', 'down', 'enter', 'down');
  assert.equal(focusedLabel(app.root), 'Sound effects: off');
});
