import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  screenReducer,
  initialState,
  homeOptions,
  menuOptions,
  confirmOptions,
  resumable,
  type ScreenOptions,
  type ScreenState,
} from '../src/screen';
import type { BoardKey } from '../../src/core/boardInput';
import { newGame, rollGame, moveGame, viewGame } from '../../src/core/game';

let ids = 0;
const options: ScreenOptions = {
  roll: () => [5, 4, 2],
  newId: () => 'g' + ++ids,
};

const drive = (state: ScreenState, ...keys: BoardKey[]): ScreenState =>
  keys.reduce((current, key) => screenReducer(current, key, options), state);

const fresh = () => initialState(options);

// A game mid-turn: rolled queen, rook, knight and played the knight.
const started = () =>
  moveGame(rollGame(newGame('hotseat', 'started'), [5, 4, 2]), 'b1c3');

test('a fresh launch opens on the board; a restored game opens on the menu', () => {
  assert.equal(fresh().overlay.kind, 'none');
  const resumed = initialState(options, started());
  assert.equal(resumed.overlay.kind, 'home');
  // Dropping a player straight into a turn they may not remember is worse than
  // asking them to choose it.
  assert.deepEqual(homeOptions(resumable(started())), [
    'Resume game',
    'New hotseat game',
  ]);
  assert.deepEqual(homeOptions(false), ['New hotseat game']);
});

test('a game that has not started is not offered for resuming', () => {
  assert.equal(resumable(newGame('hotseat', 'x')), false);
  assert.equal(resumable(started()), true);
  assert.equal(resumable(drive(fresh(), 'select').game), true);
});

test('Resume returns to the board with the position intact', () => {
  const resumed = drive(initialState(options, started()), 'select');
  assert.equal(resumed.overlay.kind, 'none');
  assert.deepEqual(resumed.game.moves, ['b1c3']);
  assert.equal(viewGame(resumed.game).remaining, 'QR');
});

test('starting over an unfinished game asks first, and Cancel keeps it', () => {
  const home = initialState(options, started());
  const asking = drive(home, 'down', 'select');
  assert.equal(asking.overlay.kind, 'confirm');
  assert.deepEqual(confirmOptions, ['Cancel', 'Yes']);
  // Cancel is selected first, so a stray OK cannot discard a game.
  assert.equal(
    asking.overlay.kind === 'confirm' ? asking.overlay.index : -1,
    0,
  );

  const kept = drive(asking, 'select');
  assert.deepEqual(kept.game.moves, ['b1c3']);

  const replaced = drive(asking, 'down', 'select');
  assert.deepEqual(replaced.game.moves, []);
  assert.equal(replaced.overlay.kind, 'none');
});

test('the menu opens from the board and closes back to it', () => {
  const board = drive(fresh(), 'select');
  const menu = drive(board, 'back');
  assert.equal(menu.overlay.kind, 'menu');
  assert.deepEqual(menuOptions(menu.game), [
    'Resume',
    'Resign',
    'Agree a draw',
    'New game',
  ]);

  assert.equal(drive(menu, 'select').overlay.kind, 'none');
  assert.equal(drive(menu, 'back').overlay.kind, 'none');
});

test('resigning asks first and hands the win to the other side', () => {
  const menu = drive(fresh(), 'select', 'back');
  const asking = drive(menu, 'down', 'select');
  assert.equal(asking.overlay.kind, 'confirm');

  // Cancel goes back to the menu without ending anything.
  const cancelled = drive(asking, 'select');
  assert.equal(cancelled.overlay.kind, 'menu');
  assert.equal(cancelled.game.result, null);

  const resigned = drive(asking, 'down', 'select');
  assert.equal(resigned.game.phase, 'ended');
  assert.deepEqual(resigned.game.result, {
    winner: 'b',
    reason: 'resigned',
  });
});

test('a draw is agreed without a confirmation, because it needs both players', () => {
  const menu = drive(fresh(), 'select', 'back');
  const drawn = drive(menu, 'down', 'down', 'select');
  assert.deepEqual(drawn.game.result, { winner: null, reason: 'agreed-draw' });
  assert.equal(drawn.overlay.kind, 'none');
});

test('an ended game returns to the menu on any of OK or Back', () => {
  const menu = drive(fresh(), 'select', 'back');
  const resigned = drive(menu, 'down', 'select', 'down', 'select');
  assert.equal(resigned.game.phase, 'ended');
  assert.equal(drive(resigned, 'select').overlay.kind, 'home');
  assert.equal(drive(resigned, 'back').overlay.kind, 'home');
});

test('the roll comes from the injected source, not from the screen', () => {
  const rolls = [
    [1, 1, 1],
    [6, 6, 6],
  ];
  let next = 0;
  const state = screenReducer(fresh(), 'select', {
    ...options,
    roll: () => rolls[next++],
  });
  // Three pawns: only pawn moves are legal.
  assert.equal(viewGame(state.game).remaining, 'PPP');
  assert.ok(viewGame(state.game).legal.every((move) => move[1] === '2'));
});

test('menu navigation wraps in both directions', () => {
  const menu = drive(fresh(), 'select', 'back');
  const length = menuOptions(menu.game).length;
  assert.equal(drive(menu, 'up').overlay.kind === 'menu' ? 0 : -1, 0);
  const wrapped = drive(menu, 'up');
  assert.equal(
    wrapped.overlay.kind === 'menu' ? wrapped.overlay.index : -1,
    length - 1,
  );
  const forward = drive(menu, ...(Array(length).fill('down') as BoardKey[]));
  assert.equal(forward.overlay.kind === 'menu' ? forward.overlay.index : -1, 0);
});
