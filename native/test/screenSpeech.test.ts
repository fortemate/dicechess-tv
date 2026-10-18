// What the game screen says from one step to the next (#257), without the app
// around it: test/voiceView.test.tsx plays the same through the whole app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screenSpeech, spokenHint, type Heard } from '../src/screenSpeech';
import { newGame, rollGame } from '../../src/core/game';

const game = newGame('hotseat', 'speech');
const board = (more: Partial<Heard> = {}): Heard => ({
  game,
  choice: null,
  prompt: null,
  cursor: null,
  ...more,
});
const menu = (index: number, options = ['Resume game', 'Resign', 'Settings']) =>
  board({ choice: { title: 'Menu', options, index } });

test('nothing changed is nothing said', () => {
  assert.equal(screenSpeech(menu(1), menu(1)), null);
  const there = board({
    prompt: 'OK: roll three dice',
    cursor: 'e2, white pawn',
  });
  assert.equal(screenSpeech(there, { ...there }), null);
});

test('a menu that opens says its title and note before the item', () => {
  assert.deepEqual(
    screenSpeech(
      board(),
      board({
        choice: {
          title: 'Resign?',
          note: 'The other player wins.',
          options: ['Cancel', 'Yes'],
          index: 0,
        },
      }),
    ),
    { text: 'Resign? The other player wins. Cancel, 1 of 2.', interrupt: true },
  );
});

test('a step of the game waits; focus alone cuts short', () => {
  const rolled = rollGame(game, [2, 2, 1]);
  const said = screenSpeech(
    board({ prompt: 'OK: roll three dice' }),
    board({ game: rolled, prompt: 'OK: pick up · Back: menu' }),
  );
  assert.deepEqual(said, {
    text: 'White rolled knight, knight and pawn. OK: pick up, Back: menu.',
    interrupt: false,
  });
  assert.deepEqual(
    screenSpeech(
      board({ cursor: 'e2, white pawn, can move' }),
      board({ cursor: 'd2, white pawn, can move' }),
    ),
    { text: 'd2, white pawn, can move.', interrupt: true },
  );
});

test('back on the board from a menu, the prompt and the square are said again', () => {
  const there = board({
    prompt: 'OK: pick up · Back: menu',
    cursor: 'g1, white knight, can move',
  });
  assert.deepEqual(screenSpeech(menu(0), there), {
    text: 'OK: pick up, Back: menu. g1, white knight, can move.',
    interrupt: true,
  });
});

test('the dots between a hint’s parts are said as pauses', () => {
  assert.equal(
    spokenHint('Arrows: choose · OK: play · Back: return'),
    'Arrows: choose, OK: play, Back: return',
  );
});

test('a new kind of setting says its controls, and a value change says only the value', () => {
  const before = board({
    choice: {
      title: 'Settings',
      spokenNote: 'Left and Right change the volume. OK mutes or unmutes.',
      options: ['Sounds: 10', 'Highlights: Standard'],
      index: 0,
    },
  });
  const focused = board({
    choice: {
      title: 'Settings',
      note: 'Left/Right or OK: change',
      spokenNote: 'Left, Right or OK change this setting.',
      options: ['Sounds: 10', 'Highlights: Standard'],
      index: 1,
    },
  });
  assert.deepEqual(screenSpeech(before, focused), {
    text: 'Highlights: Standard, 2 of 2. Left, Right or OK change this setting.',
    interrupt: true,
  });
  const changed = board({
    choice: {
      title: 'Settings',
      note: 'Left/Right or OK: change',
      spokenNote: 'Left, Right or OK change this setting.',
      options: ['Sounds: 10', 'Highlights: Enhanced'],
      index: 1,
    },
  });
  assert.deepEqual(screenSpeech(focused, changed), {
    text: 'Highlights: Enhanced.',
    interrupt: true,
  });
  assert.equal(screenSpeech(changed, { ...changed }), null);
});

test('a move between audio rows carries the controls even though it interrupts the last utterance', () => {
  const choice = {
    title: 'Settings',
    note: 'Left/Right: volume · OK: mute/unmute',
    spokenNote: 'Left and Right change the volume. OK mutes or unmutes.',
    options: ['Sounds: 10', 'Voices: 10'],
  };
  assert.deepEqual(
    screenSpeech(
      board({ choice: { ...choice, index: 0 } }),
      board({ choice: { ...choice, index: 1 } }),
    ),
    {
      text: 'Voices: 10, 2 of 2. Left and Right change the volume. OK mutes or unmutes.',
      interrupt: true,
    },
  );
});
