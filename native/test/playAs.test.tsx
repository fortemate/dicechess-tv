// The colour a person plays against the computer, set once in Settings (#345):
// Random, White or Black starts a game from the opponent card with one OK, and
// Ask brings back the choice of colour before each game.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MMKV, reset, setStored } from './stubs/react-native-mmkv.mjs';
import {
  initialState,
  screenReducer,
  settingsOptions,
  type ScreenAction,
  type ScreenOptions,
  type ScreenState,
} from '../src/screen';
import {
  DEFAULT_PLAY_AS,
  cyclePlayAs,
  readPlayAs,
  savePlayAs,
  type PlayAs,
} from '../src/playAsSetting';
import { opponentHint } from '../src/OpponentScreen';
import type { KeyValueStore } from '../src/mmkvStore';
import type { BoardKey } from '../../src/core/boardInput';
import {
  moveGame,
  newGame,
  resignGame,
  rollGame,
  type Side,
} from '../../src/core/game';
import { fakeTimers, fixedOptions, launch, send, text } from './support';

// The bot's lines go on the voices' own timers.
fakeTimers();

// Random draws Black here, so a drawn colour cannot pass for White.
const options: ScreenOptions = fixedOptions({
  newId: () => 'play-as',
  side: () => 'b',
});

const act = (state: ScreenState, action: ScreenAction): ScreenState =>
  screenReducer(state, action, options);

const drive = (state: ScreenState, ...keys: BoardKey[]): ScreenState =>
  keys.reduce((current, key) => act(current, { kind: 'key', key }), state);

const home = (
  playAs: PlayAs,
  restored: Parameters<typeof initialState>[1] = null,
) => initialState(options, restored, { playAs });

// A Hot Seat game with a move played: in play, so a new game asks first.
const inPlay = () =>
  moveGame(rollGame(newGame('hotseat', 'in-play'), [5, 4, 2]), 'b1c3');

const memoryStore = (initial?: Record<string, string>): KeyValueStore => {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getString: (key: string) => map.get(key),
    set: (key: string, value: string) => {
      map.set(key, value);
    },
    delete: (key: string) => {
      map.delete(key);
    },
  };
};

const KEY = 'dicechess-tv.playAs.v1';

test('Random is the default, and anything unreadable reads as Random', () => {
  assert.equal(DEFAULT_PLAY_AS, 'random');
  assert.equal(readPlayAs(memoryStore()), 'random');
  assert.equal(readPlayAs(memoryStore({ [KEY]: 'purple' })), 'random');
  const store = memoryStore();
  for (const choice of ['ask', 'random', 'w', 'b'] as const) {
    savePlayAs(store, choice);
    assert.equal(readPlayAs(store), choice);
  }
});

test('the Play as row steps through Ask, Random, White and Black, after the voices', () => {
  assert.deepEqual(
    settingsOptions({ music: { on: true, volume: 7 } }).slice(0, 4),
    ['Music: 7', 'Sound effects: on', 'Voices: on', 'Play as: Random'],
  );
  assert.equal(cyclePlayAs('random'), 'w');
  assert.equal(cyclePlayAs('b'), 'ask');
  assert.equal(cyclePlayAs('ask', -1), 'b');
  // In Settings, without music in the build: the third row.
  const settings = drive(
    home('random'),
    'down',
    'down',
    'down',
    'down',
    'select',
  );
  assert.equal(settings.overlay.kind, 'settings');
  const row = drive(settings, 'down', 'down');
  assert.equal(drive(row, 'select').playAs, 'w');
  assert.equal(drive(row, 'right').playAs, 'w');
  assert.equal(drive(row, 'left').playAs, 'ask');
  assert.equal(drive(row, 'select', 'select').playAs, 'b');
  assert.equal(drive(row, 'select', 'select', 'select').playAs, 'ask');
  // Nothing else changes, and the screen stays.
  const white = drive(row, 'select');
  assert.equal(white.overlay.kind, 'settings');
  assert.equal(white.sound, row.sound);
  assert.equal(white.host, row.host);
});

test('Random, White or Black starts the game from the card with one OK', () => {
  const expected: Record<Exclude<PlayAs, 'ask'>, Side> = {
    random: 'b',
    w: 'w',
    b: 'b',
  };
  for (const [playAs, side] of Object.entries(expected) as [
    Exclude<PlayAs, 'ask'>,
    Side,
  ][]) {
    // Play the computer, then Grabby's card.
    const game = drive(home(playAs), 'down', 'select', 'right', 'select');
    assert.equal(game.overlay.kind, 'none', playAs);
    assert.equal(game.game.mode, 'greedy');
    assert.equal(game.game.human, side, playAs);
    assert.equal(game.game.colour, playAs);
  }
});

test('Ask opens the choice of colour, as before, and Back returns to the cards', () => {
  const colour = drive(home('ask'), 'down', 'select', 'right', 'select');
  assert.deepEqual(colour.overlay, {
    kind: 'colour',
    index: 0,
    mode: 'greedy',
    from: 'home',
  });
  assert.equal(drive(colour, 'down', 'select').game.human, 'w');
  assert.deepEqual(drive(colour, 'back').overlay, {
    kind: 'opponent',
    index: 1,
    from: 'home',
  });
});

test('over a game in play the confirmation comes last, from home and from the game menu', () => {
  // From home: the card, then the confirmation, on Cancel.
  const fromHome = drive(
    home('w', inPlay()),
    'down',
    'down',
    'select',
    'select',
  );
  assert.deepEqual(fromHome.overlay, {
    kind: 'confirm',
    action: 'replace',
    index: 0,
    mode: 'random',
    colour: 'w',
    from: 'home',
  });
  assert.equal(drive(fromHome, 'down', 'select').game.human, 'w');
  // Cancel returns to Play the computer, and the game in play is untouched.
  const cancelled = drive(fromHome, 'select');
  assert.equal(cancelled.overlay.kind, 'home');
  assert.equal(cancelled.game.id, 'in-play');

  // From the menu of a game against Rolly: New game, the card, the
  // confirmation, Yes.
  const rolly = moveGame(
    rollGame(newGame('random', 'rolly', undefined, 'w', 'w'), [5, 4, 2]),
    'b1c3',
  );
  const menu = drive(home('b', rolly), 'select', 'back');
  assert.equal(menu.overlay.kind, 'menu');
  const replaced = drive(
    menu,
    'down',
    'down',
    'select',
    'select',
    'down',
    'select',
  );
  assert.equal(replaced.overlay.kind, 'none');
  assert.equal(replaced.game.human, 'b');
  assert.equal(replaced.game.colour, 'b');
});

test('Rematch keeps the colour option of the game it repeats, whatever Play as says now', () => {
  const asWhite = resignGame(
    rollGame(newGame('random', 'old', undefined, 'w', 'w'), [5, 4, 2]),
  );
  const result = {
    ...home('b', asWhite),
    overlay: { kind: 'result', index: 0 },
  } as ScreenState;
  const rematch = drive(result, 'select');
  assert.equal(rematch.overlay.kind, 'none');
  assert.equal(rematch.game.human, 'w');
  assert.equal(rematch.game.colour, 'w');
});

test('the tutorial’s Play Rolly plays White, whatever the setting', () => {
  const game = act(home('b'), { kind: 'newGame', mode: 'random', colour: 'w' });
  assert.equal(game.overlay.kind, 'none');
  assert.equal(game.game.human, 'w');
});

test('the cards say what OK does with each setting', () => {
  assert.equal(
    opponentHint('random'),
    'Arrows: choose · OK: play · Back: return',
  );
  assert.equal(
    opponentHint('w'),
    'Arrows: choose · OK: play White · Back: return',
  );
  assert.equal(
    opponentHint('b'),
    'Arrows: choose · OK: play Black · Back: return',
  );
  assert.equal(
    opponentHint('ask'),
    'Arrows: choose · OK: choose a colour · Back: return',
  );
});

test('in the app, the setting is read at launch, shown on the cards, and saved when changed', () => {
  reset();
  setStored({ [KEY]: 'b' });
  let root = launch({ options }).root;
  // Play the computer: the cards say OK plays Black.
  send('down', 'enter');
  assert.match(text(root), /OK: play Black/);
  // Back to home, Settings, down to Play as, and on to Ask.
  send('back', 'down', 'down', 'down', 'enter', 'down', 'down', 'enter');
  assert.match(text(root), /Play as: Ask/);
  assert.equal(new MMKV().getString(KEY), 'ask');
  // A relaunch keeps it: the cards open the choice of colour.
  root = launch({ options }).root;
  send('down', 'enter');
  assert.match(text(root), /OK: choose a colour/);
  send('enter');
  assert.match(text(root), /Play Rolly as/);
});
