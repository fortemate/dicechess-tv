// Optional opening rule variation (#534): when First-turn pawn is on, each
// side's first roll (turns 1 and 2) fixes the first die to a pawn and rolls the
// other two dice normally. Off by default; from turn 3 onward all three dice
// roll as usual.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MMKV, setStored } from './stubs/react-native-mmkv.mjs';
import {
  initialState,
  screenReducer,
  settingsOptions,
  type ScreenOptions,
  type ScreenState,
} from '../src/screen';
import {
  readFirstTurnPawn,
  saveFirstTurnPawn,
} from '../src/firstTurnPawnSetting';
import type { BoardKey } from '../../src/core/boardInput';
import { newGame, type Game } from '../../src/core/game';
import { focusedLabel } from './options';
import { fakeTimers, fixedOptions, launch, memoryStore, send } from './support';

fakeTimers();

const KEY = 'dicechess-tv.firstTurnPawn.v1';

// Queen, rook, king: no legal move at the initial position unless the first die
// becomes a pawn (#534).
const BLOCKED_OPENING = [5, 4, 6];

const makeOptions = (roll = () => BLOCKED_OPENING): ScreenOptions =>
  fixedOptions({ roll, newId: () => 'first-pawn' });

const drive = (
  state: ScreenState,
  options: ScreenOptions,
  ...keys: BoardKey[]
): ScreenState =>
  keys.reduce(
    (current, key) => screenReducer(current, { kind: 'key', key }, options),
    state,
  );

const onBoard = (
  game: Game,
  firstTurnPawn: boolean,
  options: ScreenOptions,
): ScreenState => ({
  ...initialState(options, game, { firstTurnPawn }),
  overlay: { kind: 'none' },
});

test('First-turn pawn is off by default, and damaged storage reads as off', () => {
  assert.equal(readFirstTurnPawn(memoryStore()), false);
  assert.equal(readFirstTurnPawn(memoryStore({ [KEY]: 'off' })), false);
  assert.equal(readFirstTurnPawn(memoryStore({ [KEY]: 'on' })), true);
  assert.equal(readFirstTurnPawn(memoryStore({ [KEY]: 'maybe' })), false);
  const store = memoryStore();
  saveFirstTurnPawn(store, true);
  assert.equal(readFirstTurnPawn(store), true);
  saveFirstTurnPawn(store, false);
  assert.equal(readFirstTurnPawn(store), false);
});

test('when off, opening rolls keep all three rolled dice', () => {
  const options = makeOptions();
  const state = onBoard(newGame('hotseat', 'off-game'), false, options);
  assert.equal(initialState(options).firstTurnPawn, false);
  const rolled = drive(state, options, 'select');
  assert.deepEqual(rolled.game.roll, [5, 4, 6]);
  assert.equal(rolled.game.phase, 'handoff');
});

test('when on in Hot Seat, turns 1 and 2 fix the first die to a pawn and turn 3 rolls all three dice', () => {
  const options = makeOptions();
  let state = onBoard(newGame('hotseat', 'hotseat-pawn'), true, options);

  // Turn 1 (White): [5, 4, 6] becomes [1, 4, 6]. White plays the pawn on e2
  // and the unblocked king on e1, then hands off to Black.
  state = drive(state, options, 'select');
  assert.equal(state.game.turn, 1);
  assert.deepEqual(state.game.roll, [1, 4, 6]);
  assert.equal(state.game.phase, 'move');
  state = drive(state, options, 'select', 'select', 'select', 'select');
  assert.equal(state.game.phase, 'handoff');

  // Turn 2 (Black): [5, 4, 6] also becomes [1, 4, 6] on the handoff roll.
  state = drive(state, options, 'select');
  assert.equal(state.game.turn, 2);
  assert.deepEqual(state.game.roll, [1, 4, 6]);
  assert.equal(state.game.phase, 'move');
  state = drive(state, options, 'select', 'select', 'select', 'select');
  assert.equal(state.game.phase, 'handoff');

  // Turn 3 (White): all three dice roll normally again.
  state = drive(state, options, 'select');
  assert.equal(state.game.turn, 3);
  assert.deepEqual(state.game.roll, [5, 4, 6]);
});

test('when on against the computer, both the person and the bot get a first-turn pawn on turns 1 and 2', () => {
  const options = makeOptions();

  // Person plays White, bot plays Black.
  let asWhite = onBoard(
    newGame('random', 'vs-bot-w', undefined, 'w', 'w'),
    true,
    options,
  );
  asWhite = drive(asWhite, options, 'select');
  assert.equal(asWhite.game.turn, 1);
  assert.deepEqual(asWhite.game.roll, [1, 4, 6]);
  // White plays the pawn on e2 and the king on e1, then hands off to the bot.
  asWhite = drive(
    asWhite,
    options,
    'select',
    'select',
    'select',
    'select',
    'select',
  );
  assert.equal(asWhite.game.turn, 2);
  // Bot rolls on turn 2: first die is a pawn.
  asWhite = screenReducer(asWhite, { kind: 'bot' }, options);
  assert.deepEqual(asWhite.game.roll, [1, 4, 6]);
  assert.equal(asWhite.game.phase, 'move');
  // Bot completes its turn and hands back to White for turn 3.
  while (asWhite.game.turn === 2)
    asWhite = screenReducer(asWhite, { kind: 'bot' }, options);
  assert.equal(asWhite.game.turn, 3);
  asWhite = drive(asWhite, options, 'select');
  assert.deepEqual(asWhite.game.roll, [5, 4, 6]);

  // Person plays Black, bot opens as White on turn 1.
  let asBlack = onBoard(
    newGame('random', 'vs-bot-b', undefined, 'b', 'b'),
    true,
    options,
  );
  asBlack = screenReducer(asBlack, { kind: 'bot' }, options);
  assert.equal(asBlack.game.turn, 1);
  assert.deepEqual(asBlack.game.roll, [1, 4, 6]);
  while (asBlack.game.turn === 1)
    asBlack = screenReducer(asBlack, { kind: 'bot' }, options);
  assert.equal(asBlack.game.turn, 2);
  // Person rolls on turn 2: first die is a pawn.
  asBlack = drive(asBlack, options, 'select');
  assert.deepEqual(asBlack.game.roll, [1, 4, 6]);
  assert.equal(asBlack.game.phase, 'move');
});

test('Settings toggles and persists First-turn pawn across launches', () => {
  setStored({});
  const options = makeOptions();
  assert.equal(
    settingsOptions({ ...initialState(options), musicAvailable: false })[4],
    'First-turn pawn: off',
  );
  let root = launch({ options }).root;
  // Open Settings from the home screen and move down to First-turn pawn.
  send('up', 'up', 'enter', 'down', 'down', 'down', 'down');
  assert.equal(focusedLabel(root), 'First-turn pawn: off');
  send('enter');
  assert.equal(focusedLabel(root), 'First-turn pawn: on');
  const store = new MMKV();
  assert.equal(store.getString(KEY), 'on');

  // Relaunch: the saved setting is restored and applies to a new game.
  root = launch({ options }).root;
  send('up', 'up', 'enter', 'down', 'down', 'down', 'down');
  assert.equal(focusedLabel(root), 'First-turn pawn: on');
  send('left');
  assert.equal(focusedLabel(root), 'First-turn pawn: off');
  assert.equal(store.getString(KEY), 'off');
});
