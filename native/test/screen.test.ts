import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  screenReducer,
  initialState,
  homeOptions,
  menuOptions,
  confirmOptions,
  colourOptions,
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
  // Random draws White unless a test says otherwise.
  side: () => 'w',
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
    'How to play',
    'Rules',
    'Sound: on',
    'About',
  ]);
  assert.deepEqual(homeOptions(false), [
    'New hotseat game',
    'Play Random',
    'How to play',
    'Rules',
    'Sound: on',
    'About',
  ]);
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

  // Cancel calls the whole action off: back to the home screen, on the option
  // that started it. Back does the same.
  const kept = drive(asking, 'select');
  assert.deepEqual(kept.game.moves, ['b1c3']);
  assert.deepEqual(kept.overlay, {
    kind: 'home',
    index: homeOptions(true).indexOf('New hotseat game'),
  });
  assert.deepEqual(drive(asking, 'back'), kept);

  const replaced = drive(asking, 'down', 'select');
  assert.deepEqual(replaced.game.moves, []);
  assert.equal(replaced.overlay.kind, 'none');
});

test('cancelling a new bot game from the home screen returns there, on Play Random', () => {
  const home = initialState(options, started());
  // Play Random, then Random as the colour, then the confirmation.
  const asking = drive(home, 'down', 'down', 'select', 'select');
  assert.equal(asking.overlay.kind, 'confirm');
  const cancelled = drive(asking, 'select');
  assert.deepEqual(cancelled.overlay, {
    kind: 'home',
    index: homeOptions(true).indexOf('Play Random'),
  });
  assert.deepEqual(cancelled.game.moves, ['b1c3']);
});

test('cancelling a new game from the menu returns to the menu', () => {
  const board = drive(initialState(options, started()), 'select');
  const at = menuOptions(board.game).indexOf('New game');
  const asking = drive(
    board,
    'back',
    ...(Array(at).fill('down') as BoardKey[]),
    'select',
  );
  assert.equal(asking.overlay.kind, 'confirm');
  assert.deepEqual(drive(asking, 'select').overlay, { kind: 'menu', index: 0 });
  assert.deepEqual(drive(asking, 'back').overlay, { kind: 'menu', index: 0 });
});

test('Back on the home screen stays there', () => {
  const home = initialState(options, started());
  assert.equal(drive(home, 'back'), home);
});

test('Back on a confirmation does what Cancel does', () => {
  const board = drive(initialState(options, started()), 'select');
  const asking = drive(board, 'back', 'down', 'select');
  assert.equal(asking.overlay.kind, 'confirm');
  const back = drive(asking, 'back');
  assert.deepEqual(back.overlay, { kind: 'menu', index: 0 });
  assert.equal(back.game.phase, 'move');
  assert.deepEqual(back, drive(asking, 'select'));
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
    'Sound: on',
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
  const started = drive(fresh(), 'down', 'select', 'select');
  assert.equal(started.game.mode, 'random');
  assert.equal(started.overlay.kind, 'none');
  // White is the player, so the opponent owes nothing yet.
  assert.equal(botToAct(started.game), false);
});

test('the opponent takes its whole turn and hands back to the player', () => {
  // Start Random, then play White's turn out to the handoff.
  let state = drive(fresh(), 'down', 'select', 'select', 'select');
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
  let state = drive(fresh(), 'down', 'select', 'select', 'select');
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
  const random = drive(fresh(), 'down', 'select', 'select');
  assert.deepEqual(menuOptions(random.game), [
    'Resume',
    'Resign',
    'New game',
    'Sound: on',
  ]);
  const hotseat = drive(fresh(), 'select');
  assert.ok(menuOptions(hotseat.game).includes('Agree a draw'));
});

// Every state the opponent passes through, in order.
const settleSteps = (
  state: ScreenState,
  opts: ScreenOptions = options,
): ScreenState[] => {
  const seen: ScreenState[] = [];
  let current = state;
  for (let i = 0; i < 12; i++) {
    const next = screenReducer(current, { kind: 'bot' }, opts);
    if (next === current) return seen;
    seen.push(next);
    current = next;
  }
  throw new Error('the opponent did not finish its turn');
};

// A game in Random mode handed to Black, with a roll the opponent can spend in
// full: three pawns always have somewhere to go from the opening.
const handedToBot = (): ScreenState => {
  let state = drive(fresh(), 'down', 'select', 'select', 'select');
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
  return drive(state, 'select');
};

test('a three-dice turn is three visible actions, not one jump', () => {
  const pawns: ScreenOptions = { ...options, roll: () => [1, 1, 1] };
  const steps = settleSteps(handedToBot(), pawns);

  // One state per action played, rather than one state for the whole path.
  const played = steps.filter((s) => s.game.moves.length > 0);
  assert.deepEqual(
    played.map((s) => s.game.moves.length),
    [1, 2, 3],
    'one state per die spent',
  );

  // Each state shows a different last move and one die fewer.
  assert.equal(new Set(played.map((s) => s.game.lastMove)).size, 3);
  assert.deepEqual(
    played.map((s) => viewGame(s.game).remaining.length),
    [2, 1, 0],
  );
  assert.equal(steps[steps.length - 1].game.turn, 3);
});

test('the path is decided as a whole before any of it is shown', () => {
  const pawns: ScreenOptions = { ...options, roll: () => [1, 1, 1] };
  const rolled = screenReducer(handedToBot(), { kind: 'bot' }, pawns);
  const first = screenReducer(rolled, { kind: 'bot' }, pawns);
  // Two more actions are already committed to, not chosen later.
  assert.equal(first.pending.length, 2);
  assert.equal(first.game.moves.length, 1);
});

test('an interrupted turn is recomputed rather than resumed half-played', () => {
  const pawns: ScreenOptions = { ...options, roll: () => [1, 1, 1] };
  const rolled = screenReducer(handedToBot(), { kind: 'bot' }, pawns);
  const midway = screenReducer(rolled, { kind: 'bot' }, pawns);
  assert.ok(midway.pending.length > 0);

  // A relaunch keeps the game and drops the pending path, as a restart would.
  const relaunched = initialState(pawns, midway.game);
  assert.deepEqual(relaunched.pending, []);
  const resumed = drive(relaunched, 'select');
  const finished = settle(resumed, pawns);
  assert.equal(viewGame(finished.game).side, 'w');
  assert.equal(finished.game.turn, 3);
});

test('the sound toggle flips in the home menu and the cursor stays on it', () => {
  const start = fresh();
  const at = homeOptions(false).indexOf('Sound: on');
  const onIt = drive(start, ...(Array(at).fill('down') as BoardKey[]));
  const off = drive(onIt, 'select');
  assert.equal(off.sound, false);
  assert.equal(off.overlay.kind, 'home');
  assert.equal(off.overlay.kind === 'home' ? off.overlay.index : -1, at);
  assert.equal(homeOptions(false, off.sound)[at], 'Sound: off');
  assert.equal(drive(off, 'select').sound, true);
});

test('the sound toggle in the game menu never asks to replace the game', () => {
  // Everything in that menu that is not handled explicitly falls through to a
  // confirmation, so an unhandled toggle would offer to throw the game away.
  const menu = drive(fresh(), 'select', 'select', 'back');
  // Up from Resume wraps to the last item, which is the toggle.
  const onIt = drive(menu, 'up');
  const off = drive(onIt, 'select');
  assert.equal(off.overlay.kind, 'menu');
  assert.equal(off.sound, false);
  assert.deepEqual(off.game, menu.game);
});

test('a new game keeps the sound setting', () => {
  const at = homeOptions(false).indexOf('Sound: on');
  const muted = drive(
    fresh(),
    ...(Array(at).fill('down') as BoardKey[]),
    'select',
  );
  assert.equal(muted.sound, false);
  // Back to the top and start a hotseat game.
  const top = drive(muted, ...(Array(at).fill('up') as BoardKey[]));
  const started = drive(top, 'select');
  assert.equal(started.overlay.kind, 'none');
  assert.equal(started.sound, false);
});

// ── The colour against the bot (#53) ───────────────────────────────────────────

test('Play Random opens the choice of colour, on Random', () => {
  const choosing = drive(fresh(), 'down', 'select');
  assert.equal(choosing.overlay.kind, 'colour');
  assert.equal('index' in choosing.overlay && choosing.overlay.index, 0);
  assert.deepEqual(colourOptions, ['Random', 'White', 'Black']);
  // Nothing has started yet.
  assert.equal(choosing.game.mode, 'hotseat');
});

test('Random takes the drawn colour; White and Black are taken as chosen', () => {
  const drawsBlack: ScreenOptions = { ...options, side: () => 'b' };
  const choose = (...keys: BoardKey[]) =>
    keys.reduce(
      (state, key) => screenReducer(state, { kind: 'key', key }, drawsBlack),
      initialState(drawsBlack),
    );
  assert.equal(choose('down', 'select', 'select').game.human, 'b');
  assert.equal(choose('down', 'select', 'down', 'select').game.human, 'w');
  assert.equal(
    choose('down', 'select', 'down', 'down', 'select').game.human,
    'b',
  );
});

test('Back from the choice returns to Play Random on the home screen', () => {
  const back = drive(fresh(), 'down', 'select', 'back');
  assert.deepEqual(back.overlay, {
    kind: 'home',
    index: homeOptions(false).indexOf('Play Random'),
  });
});

test('playing Black: the bot opens, the cursor starts on e7, and the arrows follow the turned board', () => {
  const black = drive(fresh(), 'down', 'select', 'down', 'down', 'select');
  assert.equal(black.game.human, 'b');
  assert.equal(black.focus.cursor, 'e7');
  assert.equal(
    botToAct(black.game),
    true,
    'White moves first, and White is the bot',
  );

  const mine = settle(black);
  assert.equal(viewGame(mine.game).side, 'b');
  assert.equal(botToAct(mine.game), false);

  // Seen from Black's side, up on the screen is towards rank 1 and left is
  // towards the h-file.
  const rolled = drive(mine, 'select');
  assert.equal(drive(rolled, 'up').focus.cursor, 'e6');
  assert.equal(drive(rolled, 'left').focus.cursor, 'f7');
});

test('replacing a game in play asks after the colour, and keeps the choice', () => {
  const inPlay = initialState(options, started());
  const choosing = drive(inPlay, 'down', 'down', 'select');
  assert.equal(choosing.overlay.kind, 'colour');
  const confirming = drive(choosing, 'down', 'down', 'select');
  assert.equal(confirming.overlay.kind, 'confirm');
  const replaced = drive(confirming, 'down', 'select');
  assert.equal(replaced.game.mode, 'random');
  assert.equal(replaced.game.human, 'b');
});

test('New game from the menu of a bot game asks for the colour again', () => {
  const white = drive(fresh(), 'down', 'select', 'select');
  const menu = drive(white, 'back');
  const at = menuOptions(white.game).indexOf('New game');
  const choosing = drive(
    menu,
    ...(Array(at).fill('down') as BoardKey[]),
    'select',
  );
  assert.deepEqual(choosing.overlay, {
    kind: 'colour',
    index: 0,
    mode: 'random',
    from: 'menu',
  });
  // Back returns to the menu, on New game.
  assert.deepEqual(drive(choosing, 'back').overlay, {
    kind: 'menu',
    index: at,
  });
});

test('a game resumed as Black starts the cursor on Black’s side', () => {
  const black = newGame('random', 'resumed', undefined, 'b');
  assert.equal(initialState(options, black).focus.cursor, 'e7');
  assert.equal(
    initialState(options, newGame('random', 'w')).focus.cursor,
    'e2',
  );
});

test('a pawn reaching the last rank asks which piece it becomes', () => {
  // One step from promotion, with pawns rolled.
  const game = rollGame(
    newGame('hotseat', 'promotion', '4k3/P7/8/8/8/8/8/4K3 w - - 0 1'),
    [1, 1, 1],
  );
  const resumed = drive(initialState(options, game), 'select');
  assert.equal(resumed.overlay.kind, 'none');

  const asked = drive(
    resumed,
    ...(walk('e2', 'a7') as BoardKey[]),
    'select',
    'up',
    'select',
  );
  assert.equal(asked.overlay.kind, 'promotion');
  assert.deepEqual(
    asked.overlay.kind === 'promotion' ? asked.overlay.moves : [],
    ['a7a8q', 'a7a8r', 'a7a8b', 'a7a8n'],
  );

  // The arrows walk the choices and wrap at the ends.
  const wrapped = drive(asked, 'up');
  assert.equal(
    wrapped.overlay.kind === 'promotion' ? wrapped.overlay.index : -1,
    3,
  );

  // Back puts the choice away without playing, and the pawn stays picked up.
  const putAway = drive(wrapped, 'back');
  assert.equal(putAway.overlay.kind, 'none');
  assert.deepEqual(putAway.game.moves, []);
  assert.deepEqual(putAway.focus, { cursor: 'a8', selected: 'a7' });

  // OK plays the piece under the cursor: one down from the queen is the rook.
  const promoted = drive(asked, 'down', 'select');
  assert.equal(promoted.overlay.kind, 'none');
  assert.deepEqual(promoted.game.moves, ['a7a8r']);
  assert.deepEqual(promoted.focus, { cursor: 'a8', selected: null });
});
