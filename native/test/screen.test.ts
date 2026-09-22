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
import { botToAct } from '../../src/core/bot';

// Arrow presses that walk the cursor from one square to another.
const walk = (from: string, to: string): string[] => {
  const keys: string[] = [];
  const file = to.charCodeAt(0) - from.charCodeAt(0);
  const rank = Number(to[1]) - Number(from[1]);
  for (let i = 0; i < Math.abs(file); i++)
    keys.push(file > 0 ? 'right' : 'left');
  for (let i = 0; i < Math.abs(rank); i++) keys.push(rank > 0 ? 'up' : 'down');
  return keys;
};

let ids = 0;
const options: ScreenOptions = {
  roll: () => [5, 4, 2],
  newId: () => 'g' + ++ids,
  schedule: (step) => step(),
};

const drive = (state: ScreenState, ...keys: BoardKey[]): ScreenState =>
  keys.reduce(
    (current, key) => screenReducer(current, { kind: 'key', key }, options),
    state,
  );

// Let the opponent take steps until it is the player's turn again.
const settle = (
  state: ScreenState,
  opts: ScreenOptions = options,
): ScreenState => {
  let current = state;
  for (let i = 0; i < 12; i++) {
    const next = screenReducer(current, { kind: 'bot' }, opts);
    if (next === current) return current;
    current = next;
  }
  throw new Error('the opponent did not finish its turn');
};

const fresh = () => initialState(options);

// A game mid-turn: rolled queen, rook, knight and played the knight.
const started = () =>
  moveGame(rollGame(newGame('hotseat', 'started'), [5, 4, 2]), 'b1c3');

test('every launch opens on the home screen, and resume is offered only when there is one', () => {
  assert.equal(fresh().overlay.kind, 'home');
  assert.equal(initialState(options, started()).overlay.kind, 'home');
  // Dropping a player straight into a turn they may not remember is worse than
  // asking them to choose it.
  assert.deepEqual(homeOptions(resumable(started())), [
    'Resume game',
    'New hotseat game',
    'Play Random',
  ]);
  assert.deepEqual(homeOptions(false), ['New hotseat game', 'Play Random']);
});

test('a game that has not started is not offered for resuming', () => {
  assert.equal(resumable(newGame('hotseat', 'x')), false);
  assert.equal(resumable(started()), true);
  assert.equal(resumable(drive(fresh(), 'select', 'select').game), true);
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
  const board = drive(fresh(), 'select', 'select');
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
  const menu = drive(fresh(), 'select', 'select', 'back');
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
  const menu = drive(fresh(), 'select', 'select', 'back');
  const drawn = drive(menu, 'down', 'down', 'select');
  assert.deepEqual(drawn.game.result, { winner: null, reason: 'agreed-draw' });
  assert.equal(drawn.overlay.kind, 'none');
});

test('an ended game returns to the menu on any of OK or Back', () => {
  const menu = drive(fresh(), 'select', 'select', 'back');
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
  const opts = { ...options, roll: () => rolls[next++] };
  const state = screenReducer(
    screenReducer(fresh(), { kind: 'key', key: 'select' }, opts),
    { kind: 'key', key: 'select' },
    opts,
  );
  // Three pawns: only pawn moves are legal.
  assert.equal(viewGame(state.game).remaining, 'PPP');
  assert.ok(viewGame(state.game).legal.every((move) => move[1] === '2'));
});

test('menu navigation wraps in both directions', () => {
  const menu = drive(fresh(), 'select', 'select', 'back');
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

test('Play Random starts a game the local opponent plays as Black', () => {
  const started = drive(fresh(), 'down', 'select');
  assert.equal(started.game.mode, 'random');
  assert.equal(started.overlay.kind, 'none');
  // White is the player, so the opponent owes nothing yet.
  assert.equal(botToAct(started.game), false);
});

test('the opponent takes its whole turn and hands back to the player', () => {
  // Start Random, then play White's turn out to the handoff.
  let state = drive(fresh(), 'down', 'select', 'select');
  while (state.game.phase === 'move') {
    const legal = viewGame(state.game).legal;
    const move = legal[0];
    state = drive(
      state,
      ...(walk(state.focus.cursor, move.slice(0, 2)) as BoardKey[]),
      'select',
      ...(walk(move.slice(0, 2), move.slice(2, 4)) as BoardKey[]),
      'select',
    );
  }
  assert.equal(state.game.phase, 'handoff');
  state = drive(state, 'select');
  assert.equal(viewGame(state.game).side, 'b');
  assert.equal(botToAct(state.game), true);

  const after = settle(state);
  // It rolled, played a complete legal path and ended its turn.
  assert.equal(viewGame(after.game).side, 'w');
  assert.equal(after.game.turn, 3);
  assert.equal(after.game.phase, 'roll');
  assert.equal(botToAct(after.game), false);
});

test('the board ignores play input while the opponent owes an action', () => {
  let state = drive(fresh(), 'down', 'select', 'select');
  while (state.game.phase === 'move') {
    const move = viewGame(state.game).legal[0];
    state = drive(
      state,
      ...(walk(state.focus.cursor, move.slice(0, 2)) as BoardKey[]),
      'select',
      ...(walk(move.slice(0, 2), move.slice(2, 4)) as BoardKey[]),
      'select',
    );
  }
  const handed = drive(state, 'select');
  assert.equal(botToAct(handed.game), true);

  // A player cannot roll or move for the opponent.
  assert.equal(drive(handed, 'select').game, handed.game);
  assert.equal(drive(handed, 'up').game, handed.game);
  // Back still reaches the menu, so the player is never stuck watching.
  assert.equal(drive(handed, 'back').overlay.kind, 'menu');
});

test('a draw cannot be agreed with the opponent, only with another player', () => {
  const random = drive(fresh(), 'down', 'select');
  assert.deepEqual(menuOptions(random.game), ['Resume', 'Resign', 'New game']);
  const hotseat = drive(fresh(), 'select');
  assert.ok(menuOptions(hotseat.game).includes('Agree a draw'));
});
