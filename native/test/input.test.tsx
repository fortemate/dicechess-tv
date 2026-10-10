import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act } from 'react-test-renderer';
import {
  press,
  pressBack,
  hold,
  release,
  isSubscribed,
  hasExited,
} from './stubs/react-native-kepler.mjs';
import { focusedLabel, optionViews } from './options';
import { GameScreen } from '../src/GameScreen';
import { THEME } from '../src/theme';
import { PIECES } from '../src/pieces';
import { newGame, rollGame } from '../../src/core/game';
import { Dice } from '../src/Dice';
import {
  fakeTimers,
  fixedOptions,
  isHost,
  mount,
  reporter,
  send,
  styleOf,
  type Instance,
  type Style,
} from './support';

// The host's lines run on the test's clock.
fakeTimers();

const options = fixedOptions();

type Mounted = { root: Instance; state: () => string };

// The screen on its own, stopped on the home screen where every launch opens.
const mountHome = (): Mounted => {
  const reports = reporter();
  const tree = mount(
    React.createElement(GameScreen, { options, onState: reports.onState }),
  );
  return { root: tree.root, state: reports.state };
};

// These tests are about the board, so most start a hotseat game first.
const hotseat = (): Mounted => {
  const view = mountHome();
  send('enter');
  return view;
};

const overlays = (root: Instance, match: (style: Style) => boolean) =>
  root.findAll(
    (node) =>
      isHost(node, 'View') &&
      styleOf(node).position === 'absolute' &&
      match(styleOf(node)),
    { deep: true },
  );

// Vega's own event names. OK is `enter` from the Virtual Device keyboard,
// `kpenter` from its on-screen remote and `select` from a physical remote.
const Up = 'up';
const Down = 'down';
const Left = 'left';
const Right = 'right';
const Select = 'enter';
const Back = 'back';
const Menu = 'menu';

test('the screen subscribes to the TV event channel', () => {
  hotseat();
  assert.equal(isSubscribed(), true);
});

test('OK arrives as enter, kpenter or select', () => {
  for (const ok of ['enter', 'kpenter', 'select']) {
    const { state } = hotseat();
    send(ok);
    assert.match(state(), /dice "QRN"/, ok);
  }
});

test('holding a direction repeats it; holding OK acts once', () => {
  // Three down events without a release are three presses: the home menu has
  // room for them.
  const home = mountHome();
  act(() => hold('down', 3));
  assert.match(home.state(), /overlay home#3/);

  const { state } = hotseat();
  send(Select);
  // Holding OK repeats the down event, but nothing happens until release.
  act(() => hold('enter', 3));
  assert.match(state(), /selected -/);
});

test('an unknown key is ignored', () => {
  const { state } = hotseat();
  send(Select);
  const before = state();
  send('playpause');
  assert.equal(state(), before);
});

// The screens ignore Back on the TV event channel, so a test that sent it there
// would pass without pressing it.
test('Back never arrives as a TV event', () => {
  hotseat();
  assert.throws(() => press('back'), /pressBack/);
});

test('it opens on the home screen and starts the mode that was chosen', () => {
  const home = mountHome();
  assert.match(home.state(), /overlay home/);
  send(Select);
  assert.match(home.state(), /overlay none \| turn 1 \| phase roll/);

  const random = mountHome();
  // Play the computer, Rolly, then Random on the colour choice.
  send(Down, Select, Select, Select);
  assert.match(random.state(), /overlay none/);
});

test('OK on the board rolls the dice', () => {
  const { state } = hotseat();
  assert.match(state(), /overlay none \| turn 1 \| phase roll/);
  send(Select);
  assert.match(
    state(),
    /phase move \| side w \| dice "QRN" \| playable "RN" \| legal 4/,
  );
});

test('no cursor frame before the roll; after it the frame waits on a movable piece (#206)', () => {
  const frames = (root: Instance) =>
    overlays(root, (s) => s.borderColor === THEME.cursor).length;

  // A hotseat turn: nothing to choose until the dice are rolled.
  const { root, state } = hotseat();
  assert.match(state(), /phase roll/);
  assert.equal(frames(root), 0, 'no frame before the roll');
  send(Select);
  assert.match(state(), /phase move \| side w/);
  assert.match(state(), /cursor g1/);
  assert.equal(frames(root), 1, 'one frame, on the knight the cursor waits on');

  // Against the bot, after its turn: the person's roll is next, with no frame.
  const bot = mountHome();
  // Play the computer, Rolly, then Random on the colour choice, which draws
  // White; the person rolls and plays, and the bot answers at once.
  send(Down, Select, Select, Select);
  assert.match(bot.state(), /phase roll/);
  assert.equal(frames(bot.root), 0, 'no frame before the first roll');
  send(Select);
  assert.equal(frames(bot.root), 1, 'a frame once the person chooses');
});

test('arrows move the focus, OK picks a piece up and marks its destinations', () => {
  const { root, state } = hotseat();
  send(Select);

  // e2 holds a pawn with no die for it, so after the roll the cursor waits on
  // a knight: g1, the nearer of the two.
  assert.match(state(), /cursor g1 \| selected -/);

  // Left jumps to the b1 knight; OK picks it up and lands on a3, the left of
  // its two destinations.
  send(Left, Select);
  assert.match(state(), /cursor a3 \| selected b1/);
  assert.equal(
    overlays(root, (s) => s.backgroundColor === THEME.selected).length,
    1,
  );
  // A dot on each of the knight's two empty destinations.
  assert.equal(
    overlays(root, (s) => s.backgroundColor === THEME.destination).length,
    2,
  );
});

test('Back cancels a selection before it opens the menu', () => {
  const { state } = hotseat();
  send(Select, Down, Left, Left, Left, Select);
  assert.match(state(), /selected b1/);

  send(Back);
  assert.match(state(), /overlay none/);
  assert.match(state(), /selected -/);
  assert.match(state(), /dice "QRN"/);

  send(Back);
  assert.match(state(), /overlay menu/);
});

test('Menu drops a selection and opens the menu immediately', () => {
  const { state } = hotseat();
  send(Select, Down, Left, Left, Left, Select);
  assert.match(state(), /selected b1/);

  send(Menu);
  assert.match(state(), /overlay menu/);
  assert.match(state(), /selected -/);
  assert.match(state(), /dice "QRN"/);

  send(Menu);
  assert.match(state(), /overlay none/);
});

test('HUD opponent and player badges hide when an in-game menu overlay is opened', () => {
  const { root, state } = hotseat();
  send(Select);
  assert.match(state(), /overlay none/);

  const hasBadges = () =>
    root.findAll((node) => node.props && node.props.testID === 'opponent-badge')
      .length > 0;

  assert.equal(hasBadges(), true, 'badges must be visible during gameplay');

  send(Menu);
  assert.match(state(), /overlay menu/);
  assert.equal(
    hasBadges(),
    false,
    'badges must be hidden when overlay menu is open',
  );

  send(Menu);
  assert.match(state(), /overlay none/);
  assert.equal(
    hasBadges(),
    true,
    'badges must return when overlay menu closes',
  );
});

test('a complete turn plays out on the remote and hands over', () => {
  const { root, state } = hotseat();
  send(Select);

  send(Down, Left, Left, Left, Select, Up, Up, Right, Select);
  assert.match(state(), /dice "QR" \| playable "R" \| legal 1/);
  assert.match(state(), /last b1c3/);
  assert.equal(
    overlays(root, (s) => s.backgroundColor === THEME.lastMove).length,
    2,
  );

  send(Left, Left, Down, Down, Select, Right, Select);
  assert.match(state(), /dice "Q"/);
  assert.match(state(), /phase handoff/);

  // One OK hands the turn over and rolls Black's dice
  send(Select);
  assert.match(state(), /turn 2 \| phase move \| side b/);
  assert.match(state(), /last -/);
  assert.equal(
    overlays(root, (s) => s.backgroundColor === THEME.lastMove).length,
    0,
  );
});

test('with a piece in hand the cursor lands only on its destinations', () => {
  const { state } = hotseat();
  send(Select, Left, Select);
  assert.match(state(), /cursor a3 \| selected b1/);

  // Nothing but c3 lies ahead of a3 among the knight's destinations, so no
  // press can reach a square the knight cannot go to.
  send(Up, Up, Right, Right, Down);
  assert.match(state(), /cursor a3 \| selected b1/);
  assert.match(state(), /dice "QRN"/);

  // Back puts the knight down and the cursor goes back to it.
  send(Back);
  assert.match(state(), /cursor b1 \| selected -/);
});

// pressBack returns whether the app claimed the press, which act() swallows, so
// it is captured rather than returned.
const back = (): boolean => {
  let handled = false;
  act(() => {
    handled = pressBack();
  });
  return handled;
};

test('Back at the home screen lets the app close, as it should on a TV', () => {
  mountHome();
  // Nothing claims it, so the platform does what Back means at the top of an
  // app. Suppressing that would trap a viewer in the app.
  assert.equal(back(), false);
  assert.equal(hasExited(), true);
});

test('Back anywhere else is claimed, so the app stays open', () => {
  const { state } = hotseat();
  send(Select);
  assert.equal(back(), true);
  assert.equal(hasExited(), false);
  assert.match(state(), /overlay menu/);
});

// Every line of text on the screen, as a viewer reads it.
const lines = (root: Instance): string[] =>
  root
    .findAll((node) => isHost(node, 'Text'), { deep: true })
    .map((node) => String(node.props.children));

test('the promotion choice names the pieces, with the queen first', () => {
  const reports: string[] = [];
  const tree = mount(
    React.createElement(GameScreen, {
      options,
      // One step from promotion, with pawns rolled.
      initial: rollGame(
        newGame('hotseat', 'promotion', '4k3/P7/8/8/8/8/8/4K3 w - - 0 1'),
        [1, 1, 1],
      ),
      onState: (line: string) => reports.push(line),
    }),
  );
  // Resume, walk from e2 to a7, pick the pawn up and put it on a8.
  send(Select, Left, Left, Left, Left, Up, Up, Up, Up, Up, Select, Up, Select);
  assert.match(reports[reports.length - 1], /overlay promotion#0/);
  assert.ok(lines(tree.root).includes('Promote to'));
  assert.deepEqual(
    optionViews(tree.root).map(({ label, focused }) => [label, focused]),
    [
      ['Queen', true],
      ['Rook', false],
      ['Bishop', false],
      ['Knight', false],
    ],
  );
  const optionsList = tree.root.findAll(
    (node) =>
      (node.type as unknown as string) === 'View' &&
      node.props.testID === 'option',
  );
  assert.equal(optionsList.length, 4);
  assert.equal(optionsList[0].findAllByType(PIECES.Q as never).length, 1);
  assert.equal(optionsList[1].findAllByType(PIECES.R as never).length, 1);
  assert.equal(optionsList[2].findAllByType(PIECES.B as never).length, 1);
  assert.equal(optionsList[3].findAllByType(PIECES.N as never).length, 1);
  send(Down);
  assert.equal(focusedLabel(tree.root), 'Rook');
});

test('the promotion choice draws Black pieces when Black promotes', () => {
  const reports: string[] = [];
  const tree = mount(
    React.createElement(GameScreen, {
      options,
      // One step from promotion for Black, with pawns rolled.
      initial: rollGame(
        newGame('hotseat', 'promotion-black', '4k3/8/8/8/8/8/p7/4K3 b - - 0 1'),
        [1, 1, 1],
      ),
      onState: (line: string) => reports.push(line),
    }),
  );
  // Resume, walk from e2 to a2, pick the pawn up and put it on a1.
  send(Select, Left, Left, Left, Left, Select, Down, Select);
  assert.match(reports[reports.length - 1], /overlay promotion#0/);
  assert.ok(lines(tree.root).includes('Promote to'));
  const optionsList = tree.root.findAll(
    (node) =>
      (node.type as unknown as string) === 'View' &&
      node.props.testID === 'option',
  );
  assert.equal(optionsList.length, 4);
  assert.equal(optionsList[0].findAllByType(PIECES.q as never).length, 1);
  assert.equal(optionsList[1].findAllByType(PIECES.r as never).length, 1);
  assert.equal(optionsList[2].findAllByType(PIECES.b as never).length, 1);
  assert.equal(optionsList[3].findAllByType(PIECES.n as never).length, 1);
  assert.equal(tree.root.findAllByType(PIECES.Q as never).length, 0);

  // Focus and order: Queen is first with focus, walking down moves focus to Rook.
  assert.equal(focusedLabel(tree.root), 'Queen');
  send(Down);
  assert.equal(focusedLabel(tree.root), 'Rook');

  // Back dismisses the promotion overlay without playing.
  send(Back);
  assert.match(reports[reports.length - 1], /overlay none/);
});

test('a focused option is framed, and holding OK shows it pressed until the release acts', () => {
  const reports: string[] = [];
  const tree = mount(
    React.createElement(GameScreen, {
      options,
      onState: (line: string) => reports.push(line),
    }),
  );
  // Home, nothing saved: the first option has focus, and nothing is held.
  assert.deepEqual(optionViews(tree.root)[0], {
    label: 'Play a friend',
    focused: true,
    pressed: false,
  });
  // OK goes down: the option shows the press, and nothing happens yet.
  act(() => hold(Select, 1));
  assert.equal(optionViews(tree.root)[0].pressed, true);
  assert.match(reports[reports.length - 1], /overlay home#0/);
  // OK comes up: the choice takes effect, and the press is gone with it.
  act(() => release(Select));
  assert.match(reports[reports.length - 1], /overlay none/);
  assert.equal(
    optionViews(tree.root).some((option) => option.pressed),
    false,
  );
});

test('a finished game says who won, then how it ended (#235)', () => {
  // From the menu of a hotseat game: Resume game, Resign, Agree a draw, New game.
  const drawn = hotseat();
  send(Back, Down, Down, Select);
  assert.match(drawn.state(), /result agreed-draw/);
  assert.ok(lines(drawn.root).includes('Draw'));
  assert.ok(lines(drawn.root).includes('Both players agreed'));

  // White is to move, so White resigns.
  const resigned = hotseat();
  send(Back, Down, Select, Down, Select);
  assert.match(resigned.state(), /result resigned/);
  assert.ok(lines(resigned.root).includes('Black wins'));
  assert.ok(lines(resigned.root).includes('White resigned'));
});

test('the panel shows the roll as dice, not words', () => {
  // The home screen is a menu and leaves the dice out.
  assert.equal(mountHome().root.findAllByType(Dice as never).length, 0);
  const { root } = hotseat();
  const dice = () => root.findByType(Dice as never).props.dice as unknown[];
  // Before the roll: three empty slots.
  assert.equal(dice().length, 0);
  send(Select);
  assert.equal(dice().length, 3);
  assert.ok(!lines(root).some((line) => line.startsWith('Remaining')));
});

test('the pieces that can move are marked until one is picked up', () => {
  const { root } = hotseat();
  const marked = () =>
    overlays(root, (s) => s.backgroundColor === THEME.movable).length;
  assert.equal(marked(), 0, 'nothing is marked before the roll');

  // Only the two knights can move on queen, rook and knight.
  send(Select);
  assert.equal(marked(), 2);

  // With a knight in hand only its destinations are shown.
  send(Select);
  assert.equal(marked(), 0);
  assert.equal(
    overlays(root, (s) => s.backgroundColor === THEME.destination).length,
    2,
  );
});

test('holding across a pawn row stops; release and a new press cycle once', () => {
  const reports: string[] = [];
  mount(
    React.createElement(GameScreen, {
      options: { ...options, roll: () => [1, 1, 1] },
      onState: (line: string) => reports.push(line),
    }),
  );
  const state = () => reports.at(-1) ?? '';
  send(Select, Select);
  assert.match(state(), /cursor e2/);
  act(() => hold(Right, 12));
  assert.match(state(), /cursor h2 \| selected -/);
  act(() => release(Right));
  // A fresh press starting at the end crosses once, then held repeats walk
  // the next row traversal and stop at the other end of that same cycle.
  act(() => hold(Right, 1));
  assert.match(state(), /cursor a2/);
  act(() => hold(Right, 12));
  assert.match(state(), /cursor h2 \| selected -/);
  act(() => release(Right));
  send(Right);
  assert.match(state(), /cursor a2/);
  act(() => hold(Left, 1));
  assert.match(state(), /cursor h2/);
  act(() => hold(Left, 12));
  assert.match(state(), /cursor a2/);
  act(() => release(Left));
  send(Left);
  assert.match(state(), /cursor h2/);
  // OK still picks up and confirms the pawn; arrows did not spend a die.
  assert.match(state(), /dice "PPP"/);
  send(Select);
  assert.match(state(), /cursor h4 \| selected h2/);
  send(Back);
  assert.match(state(), /cursor h2 \| selected -/);
  send(Select, Select);
  assert.match(state(), /last h2h4/);
});

test('selected destinations cycle on new presses and stop on held repeats', () => {
  const { state } = hotseat();
  send(Select, Left, Select);
  assert.match(state(), /cursor a3 \| selected b1/);
  act(() => hold(Right, 4));
  assert.match(state(), /cursor c3 \| selected b1/);
  act(() => release(Right));
  send(Right);
  assert.match(state(), /cursor a3 \| selected b1/);
  send(Left);
  assert.match(state(), /cursor c3 \| selected b1/);
  send(Back);
  assert.match(state(), /cursor b1 \| selected -/);
});

test('opening and closing a menu during a hold cannot enable cycling', () => {
  const reports = reporter();
  mount(
    React.createElement(GameScreen, {
      options: { ...options, roll: () => [1, 1, 1] },
      onState: reports.onState,
    }),
  );
  send(Select, Select);
  act(() => hold(Right, 12));
  assert.match(reports.state(), /cursor h2 \| selected -/);
  send(Menu);
  assert.match(reports.state(), /overlay menu/);
  send(Back);
  act(() => hold(Right, 3));
  assert.match(reports.state(), /cursor h2 \| selected -/);
  act(() => release(Right));
  send(Right);
  assert.match(reports.state(), /cursor a2 \| selected -/);
});
