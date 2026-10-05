// A first launch offers the tutorial (#244): Thinkle asks whether the game is
// new to the player, once. Answered either way, the offer is never made again,
// and a player who has a game saved is never asked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
  press,
  pressBack,
  hasExited,
  clearExit,
} from './stubs/react-native-kepler.mjs';
import { MMKV, reset } from './stubs/react-native-mmkv.mjs';
import { App } from '../src/App';
import { MmkvSnapshotStore } from '../src/mmkvStore';
import { readTutorialOffered } from '../src/tutorialOfferSetting';
import type { ScreenOptions } from '../src/screen';
import { portraitPath } from '../src/Portrait';
import { decodeGame, newGame, rollGame, type Game } from '../../src/core/game';
import { OFFER_SPEECH } from '../../src/core/tutorial';
import { focusedLabel, optionViews } from './options';

type Instance = renderer.ReactTestInstance;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const options: ScreenOptions = {
  roll: () => [5, 4, 2],
  newId: () => 'offer',
  schedule: (fn) => fn(),
  // Random draws White unless a test says otherwise.
  side: () => 'w',
};

// A launch replaces the app a previous launch left mounted, as a relaunch does.
let mounted: renderer.ReactTestRenderer | null = null;
const launch = (): Instance => {
  if (mounted) act(() => mounted!.unmount());
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(App, { options }));
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

const labels = (root: Instance) => optionViews(root).map(({ label }) => label);

const OFFER = /New to Dice Chess\? I can teach you to play in a few minutes\./;
const TUTORIAL_OPEN = /Lesson 1 of 6/;

const games = () =>
  new MmkvSnapshotStore<Game>({
    key: 'dicechess-tv.game.v2',
    decode: decodeGame,
  });

test('the stub keeps the answer under the key the app reads', () => {
  // Nearly every test starts past the offer, which the stub's reset presets;
  // a first launch starts with nothing.
  reset();
  assert.equal(readTutorialOffered(new MMKV()), true);
  reset({ firstLaunch: true });
  assert.equal(readTutorialOffered(new MMKV()), false);
});

test('a fresh install opens on Thinkle offering to teach the game', () => {
  reset({ firstLaunch: true });
  const root = launch();
  assert.match(text(root), /Dice Chess/);
  assert.match(text(root), /THINKLE\nYour teacher/);
  assert.match(text(root), OFFER);
  assert.equal(OFFER_SPEECH.join(' '), text(root).match(OFFER)![0]);
  const teacher = root.find(
    (node) => typeof node.type === 'string' && node.props.testID === 'teacher',
  );
  const portrait = teacher.find(
    (node) => (node.type as unknown as string) === 'Image',
  );
  assert.equal(portrait.props.source.uri, portraitPath('thinkle', 'card'));
  // Learn to play first, so OK alone starts the tutorial.
  assert.deepEqual(labels(root), ['Learn to play', 'Skip']);
  assert.equal(focusedLabel(root), 'Learn to play');
  // No game is in play, so no mode or turn is shown, and nothing is saved.
  assert.doesNotMatch(text(root), /HOTSEAT|TURN/);
  assert.equal(games().read(), null);
});

test('Learn to play opens the tutorial, and the offer is not made again', () => {
  reset({ firstLaunch: true });
  let root = launch();
  send('enter');
  assert.match(text(root), TUTORIAL_OPEN);
  assert.equal(readTutorialOffered(new MMKV()), true);
  // Leaving the tutorial goes to the home screen.
  send('back');
  assert.equal(focusedLabel(root), 'New hotseat game');

  root = launch();
  assert.doesNotMatch(text(root), OFFER);
  assert.equal(focusedLabel(root), 'New hotseat game');
});

test('Skip goes to the home screen, and the offer is not made again', () => {
  reset({ firstLaunch: true });
  let root = launch();
  // The arrows walk the two answers, wrapping.
  send('down');
  assert.equal(focusedLabel(root), 'Skip');
  send('down');
  assert.equal(focusedLabel(root), 'Learn to play');
  send('up', 'enter');
  assert.doesNotMatch(text(root), OFFER);
  assert.equal(focusedLabel(root), 'New hotseat game');
  // How to play is still on the home screen.
  assert.ok(labels(root).includes('How to play'));

  root = launch();
  assert.doesNotMatch(text(root), OFFER);
  assert.equal(focusedLabel(root), 'New hotseat game');
});

test('Back on the offer goes to the home screen and never closes the app', () => {
  reset({ firstLaunch: true });
  clearExit();
  let root = launch();
  send('back');
  assert.equal(hasExited(), false, 'Back on the offer closed the app');
  assert.doesNotMatch(text(root), OFFER);
  assert.equal(focusedLabel(root), 'New hotseat game');
  // Back on the home screen is the one that closes the app.
  send('back');
  assert.equal(hasExited(), true);
  clearExit();

  root = launch();
  assert.doesNotMatch(text(root), OFFER);
});

test('Menu on the offer goes to the home screen too', () => {
  reset({ firstLaunch: true });
  const root = launch();
  send('menu');
  assert.doesNotMatch(text(root), OFFER);
  assert.equal(focusedLabel(root), 'New hotseat game');
  assert.equal(readTutorialOffered(new MMKV()), true);
});

test('an offer left unanswered is made again on the next launch', () => {
  reset({ firstLaunch: true });
  launch();
  send('down');
  const root = launch();
  assert.match(text(root), OFFER);
  assert.equal(focusedLabel(root), 'Learn to play');
});

test('a player with a game saved is never offered the tutorial', () => {
  reset({ firstLaunch: true });
  void games().save(rollGame(newGame('hotseat', 'played'), [5, 4, 2]));
  const root = launch();
  assert.doesNotMatch(text(root), OFFER);
  assert.equal(focusedLabel(root), 'Resume game');
});

test('nor is one whose saved game no longer reads', () => {
  reset({ firstLaunch: true });
  new MMKV().set('dicechess-tv.game.v2', 'not a game');
  const root = launch();
  assert.doesNotMatch(text(root), OFFER);
  assert.equal(focusedLabel(root), 'New hotseat game');
});

test('a first launch can go from the offer, through every lesson, to a game against Rolly', () => {
  reset({ firstLaunch: true });
  const root = launch();
  send('enter');
  assert.match(text(root), TUTORIAL_OPEN);
  // Each OK rolls, picks up the piece the cursor waits on, plays the move it
  // lands on, passes the turn, or goes on: thirty play the six lessons, as
  // test/tutorial.test.tsx counts them, and one more finishes.
  send(...Array<string>(31).fill('enter'));
  assert.match(text(root), /That is the whole game/);
  assert.equal(focusedLabel(root), 'Play Rolly');
  send('enter');
  const game = games().read();
  assert.equal(game?.mode, 'random');
  assert.equal(game?.human, 'w');
  assert.match(text(root), /White to play · you/);
});
