// VoiceView (#257): what a screen reader is told, through the whole app with
// AccessibilityInfo stubbed. The remote's focus is the reducer's, not the
// platform's, so VoiceView has nothing to follow on its own: every screen says
// in words what changed. The words of a step of the game are checked against
// the engine in test/announcements.test.ts; these check when they are said, and
// that a move of focus cuts short what is being said while a step of the game
// waits its turn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react-test-renderer';
import { hold, release } from './stubs/react-native-kepler.mjs';
import { announced, setScreenReader } from './stubs/react-native.mjs';
import { optionAccessibility } from '../src/Option';
import { cardLabel } from '../src/OpponentScreen';
import { OPPONENTS } from '../../src/core/opponents';
import { fixedOptions, launch, send, type Instance } from './support';

// Every game a new id, so a rematch is a new game.
const options = () => {
  let ids = 0;
  return fixedOptions({ newId: () => 'voiceview' + ++ids });
};

// VoiceView on, as holding Back and Menu turns it on, before the app opens.
const withReader = () => act(() => setScreenReader(true));

// What was said from here on.
const listen = () => {
  const from = announced().length;
  return () => announced().slice(from);
};

const texts = (said: { text: string }[]) => said.map((line) => line.text);

test('nothing is announced while no screen reader is on', () => {
  launch({ options: options() });
  send('down', 'up', 'enter', 'enter', 'enter');
  assert.deepEqual(announced(), []);
});

test('a menu says its name, the focused item and its place, and a move of focus says the item', () => {
  withReader();
  launch({ options: options() });
  assert.deepEqual(announced(), [
    { text: 'Dice Chess. Play a friend, 1 of 6.', queue: false },
  ]);
  const said = listen();
  send('down', 'down');
  assert.deepEqual(said(), [
    { text: 'Play the computer, 2 of 6.', queue: false },
    { text: 'Learn to play, 3 of 6.', queue: false },
  ]);
});

test('a held arrow is said where it stops: each step cuts the last one short', () => {
  withReader();
  launch({ options: options() });
  const said = listen();
  // Each repeat arrives on its own, as the remote sends them.
  for (let i = 0; i < 4; i++) act(() => hold('down', 1));
  act(() => release('down'));
  const steps = said();
  assert.equal(steps.length, 4);
  assert.ok(steps.every((line) => !line.queue));
  assert.equal(steps.at(-1)?.text, 'Settings, 5 of 6.');
});

test('a game against a friend: the roll, the square under the cursor, the move and the hand-over', () => {
  withReader();
  launch({ options: options() });
  const said = listen();
  // Play a friend, then roll: queen, rook and knight.
  send('enter');
  assert.deepEqual(texts(said()), ['OK: roll three dice.']);

  const rolled = listen();
  send('enter');
  assert.deepEqual(rolled(), [
    {
      text: "White rolled queen, rook and knight. The queen can't be used. OK: pick up, Back: menu. g1, white knight, can move.",
      queue: true,
    },
  ]);

  // The cursor walks the pieces that can move, and each square is said.
  const walked = listen();
  send('left');
  assert.deepEqual(walked(), [
    { text: 'b1, white knight, can move.', queue: false },
  ]);

  const played = listen();
  send('enter', 'enter');
  assert.deepEqual(texts(played()), [
    'OK: move the knight here. a3, empty, can go here.',
    'White moved the knight from b1 to a3. OK: pick up, Back: menu. a1, white rook, can move.',
  ]);

  // The rook to b1 ends the turn: the queen has nowhere to go.
  const over = listen();
  send('enter', 'enter');
  assert.equal(
    texts(over()).at(-1),
    "White moved the rook from a1 to b1. White's turn is over. OK: Black's turn.",
  );

  // OK hands the remote over and rolls for Black.
  const handed = listen();
  send('enter');
  const [handover] = texts(handed());
  assert.match(
    handover,
    /^Black's turn\. Black rolled queen, rook and knight\./,
  );
});

test('a turn against the computer: each of its steps waits for the one before', () => {
  withReader();
  launch({ options: options() });
  // Play the computer, Rolly: Play as Random draws White. Roll, then the
  // knight to f3 and the rook to g1, which ends the turn.
  send('down', 'enter', 'enter', 'enter', 'enter', 'enter', 'enter', 'enter');
  const said = listen();
  send('enter');
  const steps = said();
  assert.ok(steps.every((line) => line.queue));
  // Rolly picks any legal turn: its knight and its rook, each said as moved.
  const [turn, roll, knight, rook, back] = texts(steps);
  assert.equal(steps.length, 5);
  assert.equal(turn, "Rolly's turn.");
  assert.equal(
    roll,
    "Rolly rolled queen, rook and knight. The queen can't be used.",
  );
  assert.match(knight, /^Rolly moved the knight from [a-h]8 to [a-h][36]\.$/);
  assert.match(rook, /^Rolly moved the rook from [ah]8 to [b-g]8\.$/);
  assert.equal(back, 'Your turn. OK: roll three dice.');
});

test('the result says who won and how, then what comes next', () => {
  withReader();
  launch({ options: options() });
  send('down', 'enter', 'enter');
  const said = listen();
  // Resign through the menu: Back, Resign, then Yes.
  send('back', 'down', 'select', 'down', 'select');
  assert.deepEqual(said(), [
    { text: 'Menu. Resume game, 1 of 6.', queue: false },
    { text: 'Resign, 2 of 6.', queue: false },
    { text: 'Resign? The other player wins. Cancel, 1 of 2.', queue: false },
    { text: 'Yes, 2 of 2.', queue: false },
    {
      text: 'Rolly wins. You resigned. What next? Rematch, 1 of 2.',
      queue: true,
    },
  ]);
});

test('a setting changed where focus stands is said with its new value', () => {
  withReader();
  launch({ options: options() });
  // Settings is the fifth item; the build in the tests has no music.
  send('down', 'down', 'down', 'down');
  const said = listen();
  send('enter');
  assert.deepEqual(texts(said()), [
    'Settings. Left and Right change the volume. OK mutes or unmutes. Sounds: 10, 1 of 7.',
  ]);
  const changed = listen();
  send('enter');
  assert.deepEqual(changed(), [{ text: 'Sounds: off.', queue: false }]);
});

test('Settings speaks new controls as focus moves, without repeating them for each value', () => {
  withReader();
  launch({ options: options() });
  send('up', 'up', 'enter');
  const said = listen();
  send('down', 'down', 'right', 'down', 'enter', 'down', 'down', 'down');
  assert.deepEqual(texts(said()), [
    'Voices: 10, 2 of 7. Left and Right change the volume. OK mutes or unmutes.',
    'Highlights: Standard, 3 of 7. Left, Right or OK change this setting.',
    'Highlights: Enhanced.',
    'Auto-play only move: off, 4 of 7. Left switches off. Right switches on. OK toggles. Plays the only legal move for you.',
    'Auto-play only move: on.',
    'Play as: Random, 5 of 7. Left, Right or OK change this setting. Your color in new computer games.',
    'Turn board for friends: off, 6 of 7. Left switches off. Right switches on. OK toggles.',
    'Host for friends: Prowla, 7 of 7. Left, Right or OK change this setting.',
  ]);
  assert.ok(said().every((line) => !line.queue));
});

test('enabling VoiceView in Settings speaks the controls for the current row', () => {
  launch({ options: options() });
  send('up', 'up', 'enter', 'down', 'down', 'down');
  assert.deepEqual(announced(), []);
  act(() => setScreenReader(true));
  assert.deepEqual(texts(announced()), [
    'Settings. Left switches off. Right switches on. OK toggles. Auto-play only move: off, 4 of 7. Plays the only legal move for you.',
  ]);
});

for (const from of ['home', 'game']) {
  test(`Play as scope is spoken from ${from}, while value changes only speak the colour`, () => {
    withReader();
    launch({ options: options() });
    if (from === 'game') send('enter', 'back', 'up', 'enter');
    else send('up', 'up', 'enter');
    send('down', 'down', 'down');
    const said = listen();
    send('down', 'right', 'enter', 'right', 'right');
    assert.deepEqual(texts(said()), [
      'Play as: Random, 5 of 7. Left, Right or OK change this setting. Your color in new computer games.',
      'Play as: White.',
      'Play as: Black.',
      'Play as: Ask.',
      'Play as: Random.',
    ]);
  });
}

test('a screen reader turned on mid-game is told where things stand', () => {
  launch({ options: options() });
  send('enter', 'enter');
  assert.deepEqual(announced(), []);
  act(() => setScreenReader(true));
  assert.deepEqual(texts(announced()), [
    'OK: pick up, Back: menu. g1, white knight, can move.',
  ]);
});

test('the rules guide says the topic focus moves to, and what it says', () => {
  withReader();
  launch({ options: options() });
  // Rules reference is the fourth item.
  send('down', 'down', 'down');
  const said = listen();
  send('enter');
  const [opened] = texts(said());
  assert.match(opened, /^Rules reference\. How a game ends, 1 of \d+\. /);
  const next = listen();
  send('down');
  const [moved] = next();
  assert.match(moved.text, /^Your turn, 2 of \d+\. /);
  assert.equal(moved.queue, false);
});

// The host elements that carry an accessibility label.
const labelled = (root: Instance) =>
  root.findAll(
    (node) =>
      typeof node.type === 'string' && node.props['aria-label'] !== undefined,
  );

test('the squares and the dice are named, and the menu items say what they are', () => {
  const { root } = launch({ options: options() });
  send('enter', 'enter');
  const labels = labelled(root).map((node) => node.props['aria-label']);
  assert.ok(labels.includes('e2, white pawn'));
  assert.ok(labels.includes('g1, white knight, can move'));
  assert.ok(labels.includes('e8, black king'));
  assert.ok(labels.includes('e4, empty'));
  assert.ok(labels.includes("queen die, can't be used"));
  assert.ok(labels.includes('knight die'));

  assert.deepEqual(optionAccessibility('Sounds: 10'), {
    role: 'slider',
    'aria-label': 'Sounds',
    'aria-valuetext': '10',
  });
  assert.deepEqual(optionAccessibility('Voices: off'), {
    role: 'slider',
    'aria-label': 'Voices',
    'aria-valuetext': 'off',
  });
  assert.deepEqual(optionAccessibility('Music: 7'), {
    role: 'slider',
    'aria-label': 'Music',
    'aria-valuetext': '7',
  });
  assert.deepEqual(optionAccessibility('Play a friend'), {
    role: 'menuitem',
  });
  assert.equal(
    cardLabel(OPPONENTS[0]),
    'Rolly, Easy. Plays at random, but never misses a king it can take',
  );
});

test('no element is made focusable for the platform: the remote stays the reducer’s', () => {
  const { root } = launch({ options: options() });
  send('enter', 'enter');
  const focusable = root.findAll(
    (node) => typeof node.type === 'string' && node.props.accessible === true,
  );
  assert.equal(focusable.length, 0);
});
