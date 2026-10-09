import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  screenReducer,
  initialState,
  homeOptions,
  menuOptions,
  settingsOptions,
  RULES_OPTION,
  musicRole,
  confirmOptions,
  resultOptions,
  colourOptions,
  offerOptions,
  resumable,
  botOwes,
  flipped,
  type ScreenOptions,
  type ScreenState,
} from '../src/screen';
import {
  movableSquares,
  movesFrom,
  type BoardKey,
} from '../../src/core/boardInput';
import { route, RULE } from '../../src/core/cursor';
import {
  newGame,
  rollGame,
  moveGame,
  viewGame,
  type Side,
} from '../../src/core/game';
import { botReply, botToAct } from '../../src/core/bot';
import { OPPONENTS } from '../../src/core/opponents';

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

// Play `move` on the remote from wherever the cursor waits: jumps to the piece,
// OK, jumps to the destination, OK.
const play = (state: ScreenState, move: string): ScreenState => {
  const [from, to] = [move.slice(0, 2), move.slice(2, 4)];
  const layout = { rule: RULE, flipped: state.game.human === 'b' };
  const legal = viewGame(state.game).legal;
  const toPiece = route(
    state.focus.cursor,
    from,
    movableSquares(legal),
    layout,
  );
  assert.ok(toPiece, `${from} is out of reach`);
  const holding = drive(state, ...toPiece, 'select');
  const targets = movesFrom(legal, from).map((action) => action.slice(2, 4));
  const toSquare = route(holding.focus.cursor, to, targets, layout);
  assert.ok(toSquare, `${to} is out of reach`);
  return drive(holding, ...toSquare, 'select');
};

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

test('a launch opens on the home screen, and resume is offered only when there is one', () => {
  assert.equal(fresh().overlay.kind, 'home');
  assert.equal(initialState(options, started()).overlay.kind, 'home');
  // Dropping a player straight into a turn they may not remember is worse than
  // asking them to choose it.
  assert.deepEqual(homeOptions(resumable(started())), [
    'Resume game',
    'New Hot Seat game',
    'Play the computer',
    'Learn to play',
    'Rules reference',
    'Settings',
    'About',
  ]);
  assert.deepEqual(homeOptions(false), [
    'New Hot Seat game',
    'Play the computer',
    'Learn to play',
    'Rules reference',
    'Settings',
    'About',
  ]);
});

// ── The first launch (#244) ────────────────────────────────────────────────────

const firstLaunch = () => initialState(options, null, {}, true);
const HOME_TOP = { kind: 'home', index: 0 };

test('a first launch opens on the offer of the tutorial, a later one on the home screen', () => {
  assert.deepEqual(firstLaunch().overlay, { kind: 'offer', index: 0 });
  assert.deepEqual(offerOptions, ['Learn to play', 'Skip']);
  assert.deepEqual(initialState(options, null, {}, false).overlay, HOME_TOP);
  assert.deepEqual(fresh().overlay, HOME_TOP);
  // Away from a game, the offer plays the menu theme.
  const first = firstLaunch();
  assert.equal(musicRole(first.overlay, first.game, 'critical'), 'menu');
});

test('Learn to play opens the tutorial; Skip, Back and Menu go to the home screen', () => {
  const first = firstLaunch();
  assert.equal(drive(first, 'select').overlay.kind, 'tutorial');
  assert.deepEqual(drive(first, 'down', 'select').overlay, HOME_TOP);
  assert.deepEqual(drive(first, 'back').overlay, HOME_TOP);
  assert.deepEqual(drive(first, 'menu').overlay, HOME_TOP);
  // The arrows walk the two answers, wrapping.
  assert.deepEqual(drive(first, 'up').overlay, { kind: 'offer', index: 1 });
  assert.deepEqual(drive(first, 'down', 'down').overlay, {
    kind: 'offer',
    index: 0,
  });
  // The tutorial, left, returns to the home screen like one opened from there.
  assert.deepEqual(drive(first, 'select', 'back').overlay, HOME_TOP);
  // An answer starts no game.
  assert.equal(drive(first, 'select').game, first.game);
  assert.equal(drive(first, 'down', 'select').game, first.game);
});

test('a game chosen at the end of the tutorial starts at once when none is in play', () => {
  const tutorial = drive(fresh(), 'down', 'down', 'select');
  assert.equal(tutorial.overlay.kind, 'tutorial');
  const rolly = screenReducer(
    tutorial,
    { kind: 'newGame', mode: 'random', colour: 'w' },
    options,
  );
  assert.equal(rolly.overlay.kind, 'none');
  assert.equal(rolly.game.mode, 'random');
  assert.equal(rolly.game.human, 'w');
  // The player, as White, rolls first.
  assert.equal(rolly.game.phase, 'roll');
  assert.equal(botOwes(rolly.game), false);
  const friend = screenReducer(
    tutorial,
    { kind: 'newGame', mode: 'hotseat', colour: 'random' },
    options,
  );
  assert.equal(friend.overlay.kind, 'none');
  assert.equal(friend.game.mode, 'hotseat');
  assert.equal(friend.game.human, null);
});

test('over a game in play, a game chosen at the end of the tutorial asks first', () => {
  const playing = initialState(options, started());
  const tutorial = drive(playing, 'down', 'down', 'down', 'select');
  assert.equal(tutorial.overlay.kind, 'tutorial');
  const asked = screenReducer(
    tutorial,
    { kind: 'newGame', mode: 'random', colour: 'w' },
    options,
  );
  assert.deepEqual(asked.overlay, {
    kind: 'confirm',
    action: 'replace',
    index: 0,
    mode: 'random',
    colour: 'w',
    from: 'home',
  });
  assert.equal(asked.game, playing.game);
  // Cancel keeps the game, and the home screen waits on the option that would
  // have started the new one.
  const kept = drive(asked, 'select');
  assert.equal(kept.game, playing.game);
  assert.deepEqual(kept.overlay, {
    kind: 'home',
    index: homeOptions(true).indexOf('Play the computer'),
  });
  // Yes replaces it with the game chosen.
  const replaced = drive(asked, 'down', 'select');
  assert.equal(replaced.game.mode, 'random');
  assert.equal(replaced.game.human, 'w');
  // A game against a friend asks the same, and Back waits on its option.
  const hotseat = screenReducer(
    tutorial,
    { kind: 'newGame', mode: 'hotseat', colour: 'random' },
    options,
  );
  assert.equal(hotseat.overlay.kind, 'confirm');
  assert.deepEqual(drive(hotseat, 'back').overlay, {
    kind: 'home',
    index: homeOptions(true).indexOf('New Hot Seat game'),
  });
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
    index: homeOptions(true).indexOf('New Hot Seat game'),
  });
  assert.deepEqual(drive(asking, 'back'), kept);

  const replaced = drive(asking, 'down', 'select');
  assert.deepEqual(replaced.game.moves, []);
  assert.equal(replaced.overlay.kind, 'none');
});

test('cancelling a new bot game from the home screen returns there, on Play the computer', () => {
  const home = initialState(options, started());
  // Play the computer, Rolly, Random as the colour, then the confirmation.
  const asking = drive(home, 'down', 'down', 'select', 'select', 'select');
  assert.equal(asking.overlay.kind, 'confirm');
  const cancelled = drive(asking, 'select');
  assert.deepEqual(cancelled.overlay, {
    kind: 'home',
    index: homeOptions(true).indexOf('Play the computer'),
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
    'Resume game',
    'Resign',
    'Agree a draw',
    'New game',
    RULES_OPTION,
    'Settings',
  ]);

  assert.equal(drive(menu, 'select').overlay.kind, 'none');
  assert.equal(drive(menu, 'back').overlay.kind, 'none');
  assert.equal(drive(menu, 'menu').overlay.kind, 'none');
  assert.equal(drive(board, 'menu').overlay.kind, 'menu');
});

test('menu key drops a picked-up piece and opens the menu', () => {
  const board = drive(fresh(), 'select', 'select');
  const picked = drive(board, 'select');
  assert.notEqual(picked.focus.selected, null);
  const opened = drive(picked, 'menu');
  assert.equal(opened.overlay.kind, 'menu');
  assert.equal(opened.focus.selected, null);
});

test('menu key on secondary overlays returns to the main menu', () => {
  const home = fresh();
  const settings = drive(home, 'down', 'down', 'down', 'down', 'select');
  assert.equal(settings.overlay.kind, 'settings');
  assert.equal(drive(settings, 'menu').overlay.kind, 'home');

  const opponent = drive(home, 'down', 'select');
  assert.equal(opponent.overlay.kind, 'opponent');
  assert.equal(drive(opponent, 'menu').overlay.kind, 'home');

  const colour = drive(opponent, 'select');
  assert.equal(colour.overlay.kind, 'colour');
  assert.equal(drive(colour, 'menu').overlay.kind, 'home');
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

test('Play the computer, then Rolly, starts a game the local opponent plays as Black', () => {
  const started = drive(fresh(), 'down', 'select', 'select', 'select');
  assert.equal(started.game.mode, 'random');
  assert.equal(started.overlay.kind, 'none');
  // White is the player, so the opponent owes nothing yet.
  assert.equal(botToAct(started.game), false);
});

test('the opponent takes its whole turn and hands back to the player', () => {
  // Start Random, then play White's turn out to the handoff.
  let state = drive(fresh(), 'down', 'select', 'select', 'select', 'select');
  while (state.game.phase === 'move') {
    const legal = viewGame(state.game).legal;
    const move = legal[0];
    state = play(state, move);
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
  let state = drive(fresh(), 'down', 'select', 'select', 'select', 'select');
  while (state.game.phase === 'move') {
    const move = viewGame(state.game).legal[0];
    state = play(state, move);
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
  const random = drive(fresh(), 'down', 'select', 'select', 'select');
  assert.deepEqual(menuOptions(random.game), [
    'Resume game',
    'Resign',
    'New game',
    RULES_OPTION,
    'Settings',
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
  let state = drive(fresh(), 'down', 'select', 'select', 'select', 'select');
  while (state.game.phase === 'move') {
    const move = viewGame(state.game).legal[0];
    state = play(state, move);
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

test('a pending path that no longer fits is dropped, and the rest of the turn asked for again', () => {
  const pawns: ScreenOptions = { ...options, roll: () => [1, 1, 1] };
  const rolled = screenReducer(handedToBot(), { kind: 'bot' }, pawns);
  const midway = screenReducer(rolled, { kind: 'bot' }, pawns);
  assert.equal(midway.pending.length, 2);

  // An action no position of this turn allows: the step does not throw to the
  // game screen's fallback (#255), plays nothing and forgets the path.
  const stale: ScreenState = { ...midway, pending: ['a1a8', 'a1a8'] };
  const dropped = screenReducer(stale, { kind: 'bot' }, pawns);
  assert.deepEqual(dropped.pending, []);
  assert.equal(dropped.game, midway.game);

  // The next steps finish the turn from where it was left.
  const finished = settle(dropped, pawns);
  assert.equal(finished.game.moves.length, 0);
  assert.equal(viewGame(finished.game).side, 'w');
  assert.equal(finished.game.turn, 3);
});

test('a reply worked out ahead is played exactly as given', () => {
  const pawns: ScreenOptions = { ...options, roll: () => [1, 1, 1] };
  const rolled = screenReducer(handedToBot(), { kind: 'bot' }, pawns);
  const ahead = botReply(rolled.game);
  const first = screenReducer(rolled, { kind: 'bot', reply: ahead }, pawns);
  // Its first action is shown and the rest wait to be revealed, as when the
  // reducer asks for the reply itself.
  assert.equal(first.game.moves.length, 1);
  assert.equal(first.game.lastMove, ahead.moves[0]);
  assert.deepEqual(first.pending, ahead.moves.slice(1));
});

test('a reply that no longer fits the position is not trusted: it is asked for again', () => {
  const pawns: ScreenOptions = { ...options, roll: () => [1, 1, 1] };
  const rolled = screenReducer(handedToBot(), { kind: 'bot' }, pawns);
  const ahead = botReply(rolled.game);
  for (const stale of [
    { ...ahead, revision: ahead.revision + 1 },
    { ...ahead, gameId: 'another' },
    { ...ahead, dfen: ahead.dfen.replace(' w ', ' b ') },
  ]) {
    const first = screenReducer(rolled, { kind: 'bot', reply: stale }, pawns);
    assert.equal(first.game.moves.length, 1);
    assert.equal(first.pending.length, 2);
  }
});

test('rolling the dice clears last move until the next action is played', () => {
  const pawns: ScreenOptions = { ...options, roll: () => [1, 1, 1] };
  const finished = settle(handedToBot(), pawns);
  // Bot has finished turn 2 and handed to human for turn 3:
  assert.equal(finished.game.turn, 3);
  assert.equal(finished.game.phase, 'roll');
  assert.notEqual(finished.game.lastMove, null);

  // Human rolls with OK/select:
  const rolled = drive(finished, 'select');
  assert.equal(rolled.game.phase, 'move');
  assert.equal(rolled.game.lastMove, null);
});

// ── Settings: music, its volume, the sound effects, the voices and the host ──
// (#76, #159, #202)

const toSettings = (state: ScreenState): ScreenState => {
  const at = homeOptions(resumable(state.game)).indexOf('Settings');
  return drive(state, ...(Array(at).fill('down') as BoardKey[]), 'select');
};

// A build with music, as the app reports once it has read the catalogue.
const withMusic = (state: ScreenState): ScreenState =>
  screenReducer(state, { kind: 'musicAvailable', available: true }, options);

test('without music in the build, Settings offers sound effects, voices, the host and hotseat board turning', () => {
  const settings = toSettings(fresh());
  assert.equal(settings.musicAvailable, false);
  assert.deepEqual(
    settingsOptions(
      settings.sound,
      settings.music,
      settings.musicAvailable,
      settings.turnHotseat,
      settings.voices,
      settings.host,
    ),
    [
      'Sound effects: on',
      'Voices: on',
      'Hot Seat host: Prowla',
      'Turn board in Hot Seat: off',
    ],
  );
  // Down moves from the sound effects to the voices, on to the host, and on
  // to hotseat board turning.
  assert.equal(drive(settings, 'select').sound, false);
  const voices = drive(settings, 'down');
  assert.equal(drive(voices, 'select').voices, false);
  assert.equal(drive(voices, 'select').sound, true);
  const host = drive(voices, 'down');
  assert.equal(drive(host, 'select').host, 'rolly');
  assert.equal(drive(host, 'select').voices, true);
  assert.equal(drive(host, 'select').turnHotseat, false);
  const hotseat = drive(host, 'down');
  assert.equal(hotseat.overlay.kind, 'settings');
  assert.equal(drive(hotseat, 'select').turnHotseat, true);
  // When the catalogue turns up, the rows grow and the cursor starts at the top.
  const grown = withMusic(drive(settings, 'down'));
  assert.equal(grown.musicAvailable, true);
  assert.equal(grown.overlay.kind === 'settings' ? grown.overlay.index : -1, 0);
});

test('Settings opens from the home menu on music, and Back returns to it', () => {
  const settings = toSettings(fresh());
  assert.deepEqual(settings.overlay, {
    kind: 'settings',
    index: 0,
    from: 'home',
  });
  assert.deepEqual(
    settingsOptions(
      settings.sound,
      settings.music,
      true,
      settings.turnHotseat,
      settings.voices,
      settings.host,
    ),
    [
      'Music: on',
      'Music volume: 7',
      'Sound effects: on',
      'Voices: on',
      'Hot Seat host: Prowla',
      'Turn board in Hot Seat: off',
    ],
  );
  const back = drive(settings, 'back');
  assert.equal(back.overlay.kind, 'home');
  assert.equal(
    back.overlay.kind === 'home' ? back.overlay.index : -1,
    homeOptions(false).indexOf('Settings'),
  );
});

test('OK or the arrows sideways flip music, sound effects, voices and hotseat board turning, and step through the hosts', () => {
  const settings = toSettings(withMusic(fresh()));
  const musicOff = drive(settings, 'select');
  assert.equal(musicOff.music.on, false);
  assert.equal(drive(musicOff, 'right').music.on, true);
  const effects = drive(settings, 'down', 'down');
  assert.equal(drive(effects, 'select').sound, false);
  assert.equal(drive(effects, 'left').sound, false);
  // Down once more reaches the voices, which are on by default.
  const voices = drive(effects, 'down');
  assert.equal(voices.voices, true);
  assert.equal(drive(voices, 'select').voices, false);
  assert.equal(drive(voices, 'right').voices, false);
  assert.equal(drive(voices, 'select', 'left').voices, true);
  // Once more, the Hot Seat host, Prowla by default (#258). OK and Right step
  // to the next choice, Rolly, Thinkle (#279) and then off, and Left to the one
  // before.
  const host = drive(voices, 'down');
  assert.equal(host.host, 'prowla');
  assert.equal(drive(host, 'select').host, 'rolly');
  assert.equal(drive(host, 'right').host, 'rolly');
  assert.equal(drive(host, 'select', 'select').host, 'thinkle');
  assert.equal(drive(host, 'select', 'select', 'select').host, 'off');
  assert.equal(drive(host, 'left').host, 'off');
  assert.equal(drive(host, 'left', 'left').host, 'thinkle');
  assert.equal(
    drive(host, 'select', 'select', 'select', 'select').host,
    'prowla',
  );
  assert.equal(drive(host, 'right', 'left').host, 'prowla');
  assert.equal(
    settingsOptions(
      host.sound,
      host.music,
      host.musicAvailable,
      host.turnHotseat,
      host.voices,
      'thinkle',
    )[4],
    'Hot Seat host: Thinkle',
  );
  const hostOff = drive(host, 'left');
  assert.equal(
    settingsOptions(
      hostOff.sound,
      hostOff.music,
      hostOff.musicAvailable,
      hostOff.turnHotseat,
      hostOff.voices,
      hostOff.host,
    )[4],
    'Hot Seat host: off',
  );
  // And once more, hotseat board turning.
  const hotseat = drive(host, 'down');
  assert.equal(drive(hotseat, 'select').turnHotseat, true);
  assert.equal(drive(hotseat, 'right').turnHotseat, true);
  // None touches another, nor leaves the screen.
  assert.equal(drive(hotseat, 'select').music.on, true);
  assert.equal(drive(hotseat, 'select').voices, true);
  assert.equal(drive(hotseat, 'select').host, 'prowla');
  assert.equal(drive(hotseat, 'select').overlay.kind, 'settings');
});

test('the volume moves one step per press and stops at both ends', () => {
  const volume = drive(toSettings(withMusic(fresh())), 'down');
  assert.equal(drive(volume, 'right').music.volume, 8);
  assert.equal(drive(volume, 'left', 'left').music.volume, 5);
  const top = drive(volume, 'right', 'right', 'right', 'right', 'right');
  assert.equal(top.music.volume, 10);
  const bottom = drive(volume, ...(Array(12).fill('left') as BoardKey[]));
  assert.equal(bottom.music.volume, 0);
  // OK on the volume changes nothing.
  assert.deepEqual(drive(volume, 'select'), volume);
});

test('Settings from the game menu never asks to replace the game, and Back returns to the menu', () => {
  // Everything in that menu that is not handled explicitly falls through to a
  // confirmation, so an unhandled item would offer to throw the game away.
  const menu = drive(fresh(), 'select', 'select', 'back');
  // Up from Resume wraps to the last item, Settings.
  const settings = drive(menu, 'up', 'select');
  assert.deepEqual(settings.overlay, {
    kind: 'settings',
    index: 0,
    from: 'menu',
  });
  assert.deepEqual(settings.game, menu.game);
  const back = drive(settings, 'back');
  assert.equal(back.overlay.kind, 'menu');
  assert.equal(
    back.overlay.kind === 'menu' ? back.overlay.index : -1,
    menuOptions(menu.game).indexOf('Settings'),
  );
});

test('Rules reference from the game menu never asks to replace the game, and Back returns to the menu on Rules reference', () => {
  const board = drive(initialState(options, started()), 'select');
  const menu = drive(board, 'back');
  const at = menuOptions(menu.game).indexOf(RULES_OPTION);
  const rules = drive(
    menu,
    ...(Array(at).fill('down') as BoardKey[]),
    'select',
  );
  assert.deepEqual(rules.overlay, {
    kind: 'rules',
    from: 'menu',
  });
  assert.deepEqual(rules.game, menu.game);
  assert.equal(musicRole(rules.overlay, rules.game, 'critical'), 'critical');
  const back = drive(rules, 'back');
  assert.equal(back.overlay.kind, 'menu');
  assert.equal(back.overlay.kind === 'menu' ? back.overlay.index : -1, at);
  assert.deepEqual(back.game, menu.game);
  // Resuming from the menu returns to the board with the turn and focus intact.
  const resumed = drive(
    back,
    ...(Array(at).fill('up') as BoardKey[]),
    'select',
  );
  assert.equal(resumed.overlay.kind, 'none');
  assert.deepEqual(resumed.game, board.game);
  assert.deepEqual(resumed.focus, board.focus);
});

test('opening rules reference from the menu mid-turn preserves game phase, roll and pending actions', () => {
  const pawns: ScreenOptions = { ...options, roll: () => [1, 1, 1] };
  const rolled = screenReducer(handedToBot(), { kind: 'bot' }, pawns);
  const inPlay = screenReducer(rolled, { kind: 'bot' }, pawns);
  assert.equal(inPlay.game.phase, 'move');
  assert.ok(inPlay.pending.length > 0);
  const menu = drive(inPlay, 'back');
  assert.equal(menu.overlay.kind, 'menu');
  const at = menuOptions(menu.game).indexOf(RULES_OPTION);
  const rules = drive(
    menu,
    ...(Array(at).fill('down') as BoardKey[]),
    'select',
  );
  assert.equal(rules.overlay.kind, 'rules');
  assert.equal(rules.game.phase, 'move');
  assert.deepEqual(rules.game.roll, inPlay.game.roll);
  assert.deepEqual(rules.pending, inPlay.pending);
  const left = drive(rules, 'back');
  assert.deepEqual(left.overlay, { kind: 'menu', index: at });
  assert.equal(left.game.phase, 'move');
  assert.deepEqual(left.game.roll, inPlay.game.roll);
  assert.deepEqual(left.pending, inPlay.pending);
});

test('rules reference opened from home returns to home on Rules reference', () => {
  const home = fresh();
  const at = homeOptions(false).indexOf(RULES_OPTION);
  const rules = drive(
    home,
    ...(Array(at).fill('down') as BoardKey[]),
    'select',
  );
  assert.deepEqual(rules.overlay, {
    kind: 'rules',
    from: 'home',
  });
  assert.equal(musicRole(rules.overlay, rules.game, 'critical'), 'menu');
  const back = drive(rules, 'back');
  assert.deepEqual(back.overlay, {
    kind: 'home',
    index: at,
  });
});

test('a new game keeps the settings', () => {
  const settings = toSettings(withMusic(fresh()));
  const changed = drive(
    settings,
    'select',
    'down',
    'right',
    'down',
    'select',
    'down',
    'select',
    'down',
    'select',
  );
  assert.deepEqual(changed.music, { on: false, volume: 8 });
  assert.equal(changed.sound, false);
  assert.equal(changed.voices, false);
  assert.equal(changed.host, 'rolly');
  // Back to the home menu, on Settings, then up to a new hotseat game.
  const home = drive(changed, 'back');
  const at = homeOptions(false).indexOf('Settings');
  const game = drive(home, ...(Array(at).fill('up') as BoardKey[]), 'select');
  assert.equal(game.overlay.kind, 'none');
  assert.deepEqual(game.music, { on: false, volume: 8 });
  assert.equal(game.sound, false);
  assert.equal(game.voices, false);
  assert.equal(game.host, 'rolly');
});

test('the host setting starts as the app read it, and a move keeps it (#202)', () => {
  const off = initialState(options, null, { host: 'off' });
  assert.equal(off.host, 'off');
  assert.equal(fresh().host, 'prowla');
  // A new game, then a roll: both keep it.
  const board = drive(off, 'select');
  assert.equal(board.overlay.kind, 'none');
  assert.equal(board.host, 'off');
  assert.equal(drive(board, 'select').host, 'off');
});

// ── Which music plays where (#76) ──────────────────────────────────────────────

test('the menus play the menu theme, and a game plays its level of danger', () => {
  const home = fresh();
  assert.equal(musicRole(home.overlay, home.game, 'critical'), 'menu');
  const board = drive(home, 'select');
  assert.equal(board.overlay.kind, 'none');
  assert.equal(musicRole(board.overlay, board.game, 'tense'), 'tense');
  const menu = drive(board, 'back');
  assert.equal(musicRole(menu.overlay, menu.game, 'tense'), 'tense');
  // Settings keeps the music of where it was opened from.
  const settings = drive(menu, 'up', 'select');
  assert.equal(
    musicRole(settings.overlay, settings.game, 'critical'),
    'critical',
  );
  assert.equal(
    musicRole(toSettings(fresh()).overlay, home.game, 'critical'),
    'menu',
  );
  // The cards opened from home are part of the menus.
  const cards = drive(fresh(), 'down', 'select');
  assert.equal(cards.overlay.kind, 'opponent');
  assert.equal(musicRole(cards.overlay, cards.game, 'tense'), 'menu');
});

test('a finished game is back in the menus', () => {
  const board = drive(fresh(), 'select');
  const menu = drive(board, 'back', 'down', 'select', 'down', 'select');
  assert.equal(menu.game.phase, 'ended');
  assert.equal(musicRole(menu.overlay, menu.game, 'critical'), 'menu');
});

// ── The colour against the bot (#53) ───────────────────────────────────────────

test('choosing an opponent opens the choice of colour, on Random', () => {
  const choosing = drive(fresh(), 'down', 'select', 'select');
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
  assert.equal(choose('down', 'select', 'select', 'select').game.human, 'b');
  assert.equal(
    choose('down', 'select', 'select', 'down', 'select').game.human,
    'w',
  );
  assert.equal(
    choose('down', 'select', 'select', 'down', 'down', 'select').game.human,
    'b',
  );
});

test('Back from the colour returns to the cards, and from the cards to Play the computer', () => {
  const cards = drive(fresh(), 'down', 'select', 'right', 'select', 'back');
  assert.deepEqual(cards.overlay, { kind: 'opponent', index: 1, from: 'home' });
  assert.deepEqual(drive(cards, 'back').overlay, {
    kind: 'home',
    index: homeOptions(false).indexOf('Play the computer'),
  });
});

test('playing Black: the bot opens, the cursor starts on e7, and the arrows follow the turned board', () => {
  const black = drive(
    fresh(),
    'down',
    'select',
    'select',
    'down',
    'down',
    'select',
  );
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

  // Only the knights can move on queen, rook and knight. e7 holds none, so
  // the cursor waits on g8, the nearer knight.
  const rolled = drive(mine, 'select');
  assert.equal(rolled.focus.cursor, 'g8');
  // Seen from Black's side, the h-file is on the left and rank 1 at the top:
  // b8 lies to the right of g8, and nothing lies above or below it.
  assert.equal(drive(rolled, 'right').focus.cursor, 'b8');
  assert.equal(drive(rolled, 'left').focus.cursor, 'b8');
  assert.equal(drive(rolled, 'up').focus.cursor, 'g8');
});

test('replacing a game in play asks after the colour, and keeps the choice', () => {
  const inPlay = initialState(options, started());
  const choosing = drive(inPlay, 'down', 'down', 'select', 'select');
  assert.equal(choosing.overlay.kind, 'colour');
  const confirming = drive(choosing, 'down', 'down', 'select');
  assert.equal(confirming.overlay.kind, 'confirm');
  const replaced = drive(confirming, 'down', 'select');
  assert.equal(replaced.game.mode, 'random');
  assert.equal(replaced.game.human, 'b');
});

test('New game from the menu of a bot game opens the cards on that opponent', () => {
  // Grabby, the second card, as White.
  const white = drive(
    fresh(),
    'down',
    'select',
    'right',
    'select',
    'down',
    'select',
  );
  assert.equal(white.game.mode, 'greedy');
  const menu = drive(white, 'back');
  const at = menuOptions(white.game).indexOf('New game');
  const choosing = drive(
    menu,
    ...(Array(at).fill('down') as BoardKey[]),
    'select',
  );
  assert.deepEqual(choosing.overlay, {
    kind: 'opponent',
    index: 1,
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

  // The a7 pawn is the only piece that can move, so the cursor waits on it; OK
  // picks it up and lands on a8, its only square, and OK there asks.
  assert.equal(resumed.focus.cursor, 'a7');
  const asked = drive(resumed, 'select', 'select');
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

// Keys, with options of the test's own, such as a colour draw that changes.
const driveWith = (
  opts: ScreenOptions,
  state: ScreenState,
  ...keys: BoardKey[]
): ScreenState =>
  keys.reduce(
    (current, key) => screenReducer(current, { kind: 'key', key }, opts),
    state,
  );

// From the person's turn in a game against the bot: menu, Resign, Yes.
const resign = (opts: ScreenOptions, state: ScreenState): ScreenState =>
  driveWith(opts, state, 'back', 'down', 'select', 'down', 'select');

test('a game against the bot ends on the offer of a rematch, with Rematch first', () => {
  // Rolly, as Black; the bot, White, opens.
  const black = settle(
    drive(fresh(), 'down', 'select', 'select', 'down', 'down', 'select'),
  );
  assert.equal(black.game.human, 'b');
  assert.equal(black.game.colour, 'b');

  const over = resign(options, black);
  assert.equal(over.game.phase, 'ended');
  assert.deepEqual(over.overlay, { kind: 'result', index: 0 });
  assert.deepEqual(resultOptions, ['Rematch', 'Main menu']);

  // Rematch: a new game against the same opponent, and Black again.
  const again = drive(over, 'select');
  assert.notEqual(again.game.id, over.game.id);
  assert.equal(again.game.mode, 'random');
  assert.equal(again.game.human, 'b');
  assert.equal(again.game.colour, 'b');
  assert.equal(again.game.phase, 'roll');
  assert.deepEqual(again.overlay, { kind: 'none' });
  assert.equal(again.focus.cursor, 'e7');
});

test('a rematch after Random draws the colour again', () => {
  const draws: Side[] = ['w', 'b'];
  const opts: ScreenOptions = { ...options, side: () => draws.shift() ?? 'w' };
  const white = driveWith(
    opts,
    initialState(opts),
    'down',
    'select',
    'select',
    'select',
  );
  assert.equal(white.game.human, 'w');
  assert.equal(white.game.colour, 'random');

  const again = driveWith(opts, resign(opts, white), 'select');
  assert.equal(again.game.human, 'b');
  assert.equal(again.game.colour, 'random');
});

test('Main menu and Back leave a result for the main menu', () => {
  const over = resign(
    options,
    drive(fresh(), 'down', 'select', 'select', 'select'),
  );
  assert.deepEqual(drive(over, 'down', 'select').overlay, {
    kind: 'home',
    index: 0,
  });
  assert.deepEqual(drive(over, 'back').overlay, { kind: 'home', index: 0 });
  // The two choices wrap.
  assert.deepEqual(drive(over, 'up').overlay, { kind: 'result', index: 1 });
});

test('a hotseat result keeps the board, and OK goes back to the main menu', () => {
  const board = drive(initialState(options, started()), 'select');
  // Menu, Resign, Yes: the side to move resigns.
  const over = drive(board, 'back', 'down', 'select', 'down', 'select');
  assert.equal(over.game.phase, 'ended');
  assert.deepEqual(over.overlay, { kind: 'none' });
  assert.deepEqual(drive(over, 'select').overlay, { kind: 'home', index: 0 });
});

test('the bot taking the king ends on the offer of a rematch too', () => {
  // The bot, Black, has rooks rolled and a rook next to White's king.
  const game = rollGame(
    newGame('random', 'taken', 'k7/8/8/8/8/8/4r3/4K3 b - - 0 1', 'w'),
    [4, 4, 4],
  );
  const taking: ScreenState = {
    ...initialState(options, game),
    overlay: { kind: 'none' },
    pending: ['e2e1'],
  };
  const over = screenReducer(taking, { kind: 'bot' }, options);
  assert.deepEqual(over.game.result, { winner: 'b', reason: 'king-captured' });
  assert.deepEqual(over.overlay, { kind: 'result', index: 0 });
});

test('a bot roll that ends the game offers a rematch as well', () => {
  // The bot, Black, rolls three rooks it does not have, with the half-move
  // clock already at 100: nothing to play, so the game is drawn on the roll.
  const game = newGame(
    'random',
    'drawn',
    '4k3/8/8/8/8/8/8/4K3 b - - 100 60',
    'w',
  );
  const opts: ScreenOptions = { ...options, roll: () => [4, 4, 4] };
  const waiting: ScreenState = {
    ...initialState(opts, game),
    overlay: { kind: 'none' },
  };
  const over = screenReducer(waiting, { kind: 'bot' }, opts);
  assert.deepEqual(over.game.result, { winner: null, reason: '100-halfmoves' });
  assert.deepEqual(over.overlay, { kind: 'result', index: 0 });
});

test('after every roll and action the cursor waits on a piece that can move', () => {
  // A new hotseat game: e2 holds no knight, so after queen, rook and knight
  // the cursor waits on g1, the nearer knight.
  let state = drive(fresh(), 'select', 'select');
  assert.equal(state.focus.cursor, 'g1');
  // After g1f3 only the h1 rook can move (to g1): the cursor goes to it.
  state = play(state, 'g1f3');
  assert.deepEqual(state.focus, { cursor: 'h1', selected: null });
});

test('the cursor stays on its piece while that piece can move again', () => {
  const pawns: ScreenOptions = { ...options, roll: () => [1, 1, 1] };
  let state = initialState(pawns);
  state = screenReducer(state, { kind: 'key', key: 'select' }, pawns);
  state = screenReducer(state, { kind: 'key', key: 'select' }, pawns);
  // e2 holds a pawn that can move, so the cursor stays there.
  assert.equal(state.focus.cursor, 'e2');
  // After e2e4 the same pawn can go on to e5, and the cursor stays with it.
  state = play(state, 'e2e4');
  assert.equal(state.focus.cursor, 'e4');
});

test('OK on a pawn on its starting rank lands on the two-square push', () => {
  const pawns: ScreenOptions = { ...options, roll: () => [1, 1, 1] };
  let state = initialState(pawns);
  state = screenReducer(state, { kind: 'key', key: 'select' }, pawns);
  state = screenReducer(state, { kind: 'key', key: 'select' }, pawns);
  // The cursor waits on e2; OK picks the pawn up and lands on e4, not e3.
  state = screenReducer(state, { kind: 'key', key: 'select' }, pawns);
  assert.deepEqual(state.focus, { cursor: 'e4', selected: 'e2' });
  // A second OK plays the push.
  state = screenReducer(state, { kind: 'key', key: 'select' }, pawns);
  assert.equal(state.game.lastMove, 'e2e4');
});

test('OK on a piece that can take lands on its capture', () => {
  // White's e4 pawn can push to e5 or take the pawn on d5.
  const fen = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1';
  const game = rollGame(newGame('hotseat', 'capture', fen), [1, 1, 1]);
  // Resume the saved game, then reach the e4 pawn and pick it up.
  let state = drive(initialState(options, game), 'select');
  assert.equal(state.overlay.kind, 'none');
  const layout = { rule: RULE, flipped: false };
  const pieces = movableSquares(viewGame(state.game).legal);
  const toPawn = route(state.focus.cursor, 'e4', pieces, layout);
  assert.ok(toPawn, 'e4 is out of reach');
  state = drive(state, ...toPawn, 'select');
  assert.deepEqual(state.focus, { cursor: 'd5', selected: 'e4' });
  // A second OK takes.
  state = drive(state, 'select');
  assert.equal(state.game.lastMove, 'e4d5');
});

// Queen, rook, king: from the opening nothing can move, for either side.
const nothing: ScreenOptions = { ...options, roll: () => [5, 4, 6] };

test('after a roll with nothing to play, OK passes the turn only once the guard is over', () => {
  const rolled = driveWith(nothing, drive(fresh(), 'select'), 'select');
  assert.equal(rolled.game.phase, 'handoff');
  assert.equal(rolled.guarded, true);
  // A second press, as from a double press on the remote, changes nothing.
  assert.equal(driveWith(nothing, rolled, 'select'), rolled);
  // Back still reaches the menu.
  assert.equal(driveWith(nothing, rolled, 'back').overlay.kind, 'menu');
  const ready = screenReducer(rolled, { kind: 'unguard' }, nothing);
  assert.equal(ready.guarded, false);
  const passed = driveWith(nothing, ready, 'select');
  assert.equal(passed.game.turn, 2);
  assert.equal(passed.guarded, true);
  // Unguarding Black's empty roll:
  assert.equal(
    screenReducer(passed, { kind: 'unguard' }, nothing).guarded,
    false,
  );
});

test('only an empty roll is guarded: a roll with moves and a turn with dice left are not', () => {
  assert.equal(drive(drive(fresh(), 'select'), 'select').guarded, false);
  // Knight, king, king: the knight moves, and the kings are left over.
  const leftover: ScreenOptions = { ...options, roll: () => [2, 6, 6] };
  const partial = play(
    driveWith(leftover, drive(fresh(), 'select'), 'select'),
    'g1f3',
  );
  assert.equal(partial.game.phase, 'handoff');
  assert.equal(partial.guarded, false);
  assert.equal(drive(partial, 'select').game.turn, 2);
});

test('the opponent’s roll with nothing to play waits for the person, whose OK rolls their own dice', () => {
  const handed = handedToBot();
  assert.equal(botOwes(handed.game), true);
  const stuck = screenReducer(handed, { kind: 'bot' }, nothing);
  assert.equal(stuck.game.phase, 'handoff');
  assert.equal(botToAct(stuck.game), true);
  // Nothing is scheduled for the bot: the notice stays until OK.
  assert.equal(botOwes(stuck.game), false);
  assert.equal(screenReducer(stuck, { kind: 'bot' }, nothing), stuck);
  // A double press cannot skip it either.
  assert.equal(stuck.guarded, true);
  assert.equal(driveWith(nothing, stuck, 'select'), stuck);
  assert.equal(driveWith(nothing, stuck, 'back').overlay.kind, 'menu');

  // One OK passes the bot's turn and rolls the person's: no press is added.
  const ready = screenReducer(stuck, { kind: 'unguard' }, nothing);
  const pawns: ScreenOptions = { ...options, roll: () => [1, 1, 1] };
  const mine = driveWith(pawns, ready, 'select');
  assert.equal(mine.game.turn, stuck.game.turn + 1);
  assert.equal(botToAct(mine.game), false);
  assert.equal(mine.game.phase, 'move');
  assert.deepEqual(mine.game.roll, [1, 1, 1]);
  assert.equal(mine.guarded, false);
});

test('a bot turn that ends with dice left is still the bot’s to hand over, unguarded', () => {
  const leftover: ScreenOptions = { ...options, roll: () => [2, 6, 6] };
  const steps = settleSteps(handedToBot(), leftover);
  const partial = steps.find((s) => s.game.phase === 'handoff');
  assert.ok(partial && partial.game.moves.length > 0);
  // A turn that ends with dice left is not an empty roll: the bot hands over.
  assert.equal(botOwes(partial.game), true);
  assert.equal(partial.guarded, false);
  assert.equal(botToAct(steps.at(-1)!.game), false);
});

// ── The choice of opponent (#115) ─────────────────────────────────────────────

test('Play the computer opens the cards on the first, and the arrows walk them, wrapping', () => {
  const cards = drive(fresh(), 'down', 'select');
  assert.deepEqual(cards.overlay, { kind: 'opponent', index: 0, from: 'home' });
  const at = (...keys: BoardKey[]) => {
    const { overlay } = drive(cards, ...keys);
    return overlay.kind === 'opponent' ? overlay.index : -1;
  };
  assert.equal(at('right'), 1);
  assert.equal(at('right', 'right'), 2);
  assert.equal(at('right', 'right', 'right'), 0);
  assert.equal(at('left'), 2);
  // Nothing has started yet.
  assert.equal(cards.game.mode, 'hotseat');
});

test('each card starts a game against its own opponent', () => {
  OPPONENTS.forEach((opponent, i) => {
    const moves = Array(i).fill('right') as BoardKey[];
    const { game } = drive(
      fresh(),
      'down',
      'select',
      ...moves,
      'select',
      'select',
    );
    assert.equal(game.mode, opponent.mode, opponent.name);
    assert.equal(game.human, 'w');
  });
});

test('a rematch keeps the opponent, and the cards open on it next time', () => {
  // Rampage, the last card, reached by wrapping left; White; then resign.
  const rampage = drive(
    fresh(),
    'down',
    'select',
    'left',
    'select',
    'down',
    'select',
  );
  assert.equal(rampage.game.mode, 'aggressive');
  const over = resign(options, rampage);
  assert.equal(drive(over, 'select').game.mode, 'aggressive');

  // Main menu, then Play the computer: the cards open on Rampage.
  const cards = drive(over, 'down', 'select', 'down', 'select');
  assert.deepEqual(cards.overlay, { kind: 'opponent', index: 2, from: 'home' });
});

// ── Hotseat board turning (#120) ─────────────────────────────────────────────

test('when Turn board in hotseat is on, the board turns for Black and cursor starts on Black side', () => {
  let state = initialState(options, null, { turnHotseat: true });
  state = drive(state, 'select');
  assert.equal(state.game.mode, 'hotseat');
  assert.equal(state.game.turn, 1);
  assert.equal(flipped(state.game, state.turnHotseat), false);
  assert.equal(state.focus.cursor, 'e2');

  // White rolls and plays moves
  state = drive(state, 'select');
  while (state.game.phase === 'move') {
    const move = viewGame(state.game).legal[0];
    state = play(state, move);
  }
  assert.equal(state.game.phase, 'handoff');
  assert.equal(flipped(state.game, state.turnHotseat), false);

  // Turn handover to Black and roll
  state = drive(state, 'select');
  assert.equal(state.game.turn, 2);
  assert.equal(viewGame(state.game).side, 'b');
  assert.equal(flipped(state.game, state.turnHotseat), true);
  assert.equal(state.focus.cursor, 'g8');

  // Black plays moves
  while (state.game.phase === 'move') {
    const move = viewGame(state.game).legal[0];
    state = play(state, move);
  }
  assert.equal(state.game.phase, 'handoff');
  assert.equal(flipped(state.game, state.turnHotseat), true);

  // Turn handover back to White and roll
  state = drive(state, 'select');
  assert.equal(state.game.turn, 3);
  assert.equal(viewGame(state.game).side, 'w');
  assert.equal(flipped(state.game, state.turnHotseat), false);
  assert.equal(state.focus.cursor, 'g1');
});

test('when Turn board in hotseat is off, the board remains drawn from White side throughout hotseat', () => {
  let state = initialState(options, null, { turnHotseat: false });
  state = drive(state, 'select');
  assert.equal(state.game.mode, 'hotseat');
  assert.equal(flipped(state.game, state.turnHotseat), false);

  // White rolls and plays moves
  state = drive(state, 'select');
  while (state.game.phase === 'move') {
    const move = viewGame(state.game).legal[0];
    state = play(state, move);
  }
  assert.equal(state.game.phase, 'handoff');

  // Turn handover to Black: board does not flip when setting is off
  state = drive(state, 'select');
  assert.equal(state.game.turn, 2);
  assert.equal(flipped(state.game, state.turnHotseat), false);
});

test('a saved hotseat game resumes in the right orientation when Turn board in hotseat is on', () => {
  // A game handed to Black on turn 2
  let state = initialState(options, null, { turnHotseat: true });
  state = drive(state, 'select', 'select');
  while (state.game.phase === 'move') {
    state = play(state, viewGame(state.game).legal[0]);
  }
  state = drive(state, 'select');
  assert.equal(state.game.turn, 2);
  assert.equal(viewGame(state.game).side, 'b');

  // Resuming this saved game with turnHotseat on
  const resumed = initialState(options, state.game, { turnHotseat: true });
  assert.equal(flipped(resumed.game, resumed.turnHotseat), true);
  assert.equal(resumed.focus.cursor, 'g8');

  // Resuming with turnHotseat off stays on White side
  const resumedOff = initialState(options, state.game, {
    turnHotseat: false,
  });
  assert.equal(flipped(resumedOff.game, resumedOff.turnHotseat), false);
});

test('lastDice is null at the start of a game, so the first roll opens on empty slots', () => {
  const initial = initialState(options);
  assert.equal(initial.lastDice, null);

  const started = drive(initial, 'select');
  assert.equal(started.lastDice, null);
});

test('after the bot’s turn finishes, lastDice retains the bot’s played dice dimmed until the next roll (#297)', () => {
  const pawns: ScreenOptions = { ...options, roll: () => [1, 1, 1] };
  const steps = settleSteps(handedToBot(), pawns);
  const finished = steps[steps.length - 1];

  assert.equal(finished.game.turn, 3);
  assert.equal(finished.game.phase, 'roll');
  assert.equal(finished.game.roll.length, 0);
  assert.equal(viewGame(finished.game).side, 'w');

  assert.notEqual(finished.lastDice, null);
  assert.equal(finished.lastDice!.side, 'b');
  assert.equal(finished.lastDice!.dice.length, 3);
  // All three dice were spent or leftover, so each is dimmed
  assert.ok(
    finished.lastDice!.dice.every((die) => die.spent || die.leftover),
    'every die is dimmed (spent or leftover)',
  );
  assert.ok(
    finished.lastDice!.dice.every((die) => die.piece === 'P'),
    'each die shows the rolled piece',
  );
});
