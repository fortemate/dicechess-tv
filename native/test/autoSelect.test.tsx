// OK presses itself when the board offers only one choice (#302): the only
// piece that can move is picked up, and a piece in hand with only one
// destination is played there. Off by default; each press is a visible step at
// the opponent's pace, and Back or Menu hands the action in progress back to
// the person.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react-test-renderer';
import { MMKV, reset } from './stubs/react-native-mmkv.mjs';
import {
  AUTO_SELECT_MS,
  autoChoice,
  initialState,
  screenReducer,
  settingsOptions,
  type ScreenOptions,
  type ScreenState,
} from '../src/screen';
import { AUTO_PROMPT } from '../src/GameScreen';
import { readAutoSelect, saveAutoSelect } from '../src/autoSelectSetting';
import type { KeyValueStore } from '../src/mmkvStore';
import type { BoardKey } from '../../src/core/boardInput';
import {
  newGame,
  rollGame,
  viewGame,
  type Game,
  type Mode,
  type Side,
} from '../../src/core/game';
import {
  fakeTimers,
  fixedOptions,
  isHost,
  launch,
  send,
  styleOf,
  text,
  type Instance,
} from './support';

// The bot's and the host's lines go on the voices' own timers.
fakeTimers();

const options: ScreenOptions = fixedOptions({ newId: () => 'auto' });

const drive = (state: ScreenState, ...keys: BoardKey[]): ScreenState =>
  keys.reduce(
    (current, key) => screenReducer(current, { kind: 'key', key }, options),
    state,
  );

// The press the screen schedules for what it shows now.
const auto = (state: ScreenState): ScreenState =>
  screenReducer(
    state,
    {
      kind: 'auto',
      revision: state.game.revision,
      selected: state.focus.selected,
    },
    options,
  );

// The board over a game, as Resume shows it, with the setting as given.
const resumed = (game: Game, autoSelect = true): ScreenState => ({
  ...initialState(options, game, { autoSelect }),
  overlay: { kind: 'none' },
});

const rolled = (
  roll: number[],
  start?: string,
  mode: Mode = 'hotseat',
  human: Side | null = null,
): Game => rollGame(newGame(mode, 'auto', start, human, human), roll);

// Rook, rook and knight at the start, the owner's example.
const ROOK_ROOK_KNIGHT = [4, 4, 2];
// A knight alone with the kings, and three knight dice.
const LONE_KNIGHT = '4k3/8/8/8/8/8/8/1N2K3 w - - 0 1';
// A pawn about to promote, alone with the kings, and three pawn dice.
const PROMOTING = '7k/P7/8/8/8/8/8/K7 w - - 0 1';

// The person plays the knight with OK, OK: two knights, then two squares, so
// both are their choice.
const knightPlayed = (): ScreenState => {
  const state = resumed(rolled(ROOK_ROOK_KNIGHT));
  assert.equal(autoChoice(state), null);
  const holding = drive(state, 'select');
  assert.notEqual(holding.focus.selected, null);
  assert.equal(autoChoice(holding), null);
  const played = drive(holding, 'select');
  assert.equal(played.game.moves.length, 1);
  return played;
};

test('the setting is off by default, and then OK never presses itself', () => {
  assert.equal(initialState(options).autoSelect, false);
  const off = resumed(rolled([2, 2, 2], LONE_KNIGHT), false);
  // The lone knight is the only choice, and still waits for OK.
  assert.equal(autoChoice(off), null);
  assert.equal(auto(off), off);
  // The settings say so, last.
  assert.equal(
    settingsOptions(off.sound, off.music, false).at(-1),
    'Auto-select only choice: off',
  );
});

test('rook, rook, knight: after the knight, the four presses with no choice behind them play themselves', () => {
  let state = knightPlayed();
  const knight = state.game.moves[0];
  // Each press is its own step: the rook is picked up and shown in hand with
  // its one destination, then played there, twice.
  const steps: string[] = [];
  for (let square = autoChoice(state); square; square = autoChoice(state)) {
    const before = state.focus.selected;
    state = auto(state);
    steps.push(before ? `play ${square}` : `pick ${square}`);
    if (!before) assert.equal(state.focus.selected, square);
  }
  const [home, away] =
    knight === 'b1a3' || knight === 'b1c3' ? ['a1', 'b1'] : ['h1', 'g1'];
  assert.deepEqual(steps, [
    `pick ${home}`,
    `play ${away}`,
    `pick ${away}`,
    `play ${home}`,
  ]);
  assert.deepEqual(state.game.moves, [knight, home + away, away + home]);
  // The turn is over, and handing it on stays the person's press (#301).
  assert.equal(state.game.phase, 'handoff');
  assert.equal(autoChoice(state), null);
});

test('a lone knight on three knight dice is picked up, and where it goes is the person’s choice', () => {
  let state = resumed(rolled([2, 2, 2], LONE_KNIGHT));
  assert.equal(autoChoice(state), 'b1');
  state = auto(state);
  assert.equal(state.focus.selected, 'b1');
  // Three squares to choose from: nothing presses itself.
  assert.equal(autoChoice(state), null);
  state = drive(state, 'select');
  assert.equal(state.game.moves.length, 1);
  // The knight is again the only piece, wherever it went.
  assert.equal(autoChoice(state), state.game.moves[0].slice(2, 4));
});

test('a press of the person’s own wins, and the one scheduled before it does nothing', () => {
  const waiting = resumed(rolled([2, 2, 2], LONE_KNIGHT));
  const scheduled = {
    kind: 'auto',
    revision: waiting.game.revision,
    selected: waiting.focus.selected,
  } as const;
  // OK picks the knight up before the scheduled press comes.
  const picked = drive(waiting, 'select');
  assert.equal(picked.focus.selected, 'b1');
  assert.equal(screenReducer(picked, scheduled, options), picked);
  // A press scheduled for an earlier revision does nothing either.
  const played = drive(picked, 'select');
  assert.equal(
    screenReducer(
      played,
      { kind: 'auto', revision: picked.game.revision, selected: null },
      options,
    ),
    played,
  );
});

test('Back stops OK pressing itself and does nothing else; the next action is automatic again', () => {
  const waiting = knightPlayed();
  const square = autoChoice(waiting);
  assert.ok(square);
  // Back with the rook about to be picked up: nothing moves, no menu opens.
  const stopped = drive(waiting, 'back');
  assert.equal(stopped.overlay.kind, 'none');
  assert.deepEqual(stopped.focus, waiting.focus);
  assert.equal(stopped.game, waiting.game);
  assert.equal(autoChoice(stopped), null);
  assert.equal(auto(stopped), stopped);
  // A second Back opens the menu as it always has, and Resume comes back to
  // a board that still waits for the person.
  const resumedMenu = drive(stopped, 'back', 'back');
  assert.equal(resumedMenu.overlay.kind, 'none');
  assert.equal(autoChoice(resumedMenu), null);
  // The person plays this rook: OK, OK.
  const holding = drive(resumedMenu, 'select');
  assert.equal(holding.focus.selected, square);
  assert.equal(autoChoice(holding), null);
  const played = drive(holding, 'select');
  assert.equal(played.game.moves.length, 2);
  // The next action is automatic again.
  assert.ok(autoChoice(played));
});

test('Back with the piece in hand about to move keeps it in hand; a second Back puts it down', () => {
  const holding = auto(knightPlayed());
  const piece = holding.focus.selected;
  assert.ok(piece);
  assert.ok(autoChoice(holding));
  const stopped = drive(holding, 'back');
  assert.equal(stopped.focus.selected, piece);
  assert.equal(autoChoice(stopped), null);
  assert.equal(drive(stopped, 'back').focus.selected, null);
});

test('a piece picked up for the person and put down with Back stays down, and a second Back opens the menu', () => {
  // The lone knight is picked up for the person; it has three squares, so
  // nothing is pending when Back puts it down. Seen on the Virtual Device with
  // the king: without this, it was picked up again 600 ms later.
  const holding = auto(resumed(rolled([2, 2, 2], LONE_KNIGHT)));
  assert.equal(holding.focus.selected, 'b1');
  assert.equal(autoChoice(holding), null);
  const down = drive(holding, 'back');
  assert.equal(down.focus.selected, null);
  assert.equal(down.overlay.kind, 'none');
  assert.equal(autoChoice(down), null);
  assert.equal(drive(down, 'back').overlay.kind, 'menu');
  // OK still picks it up, and the knight's next action is automatic again.
  const played = drive(down, 'select', 'select');
  assert.equal(played.game.moves.length, 1);
  assert.ok(autoChoice(played));
});

test('Menu stops it too, on its way to the menu', () => {
  const waiting = knightPlayed();
  const menu = drive(waiting, 'menu');
  assert.equal(menu.overlay.kind, 'menu');
  assert.equal(autoChoice(drive(menu, 'back')), null);
});

test('a promotion opens the choice of piece by itself, and the piece stays the person’s choice', () => {
  let state = resumed(rolled([1, 1, 1], PROMOTING));
  assert.equal(autoChoice(state), 'a7');
  state = auto(state);
  assert.equal(autoChoice(state), 'a8');
  state = auto(state);
  assert.deepEqual(state.overlay, {
    kind: 'promotion',
    moves: ['a7a8q', 'a7a8r', 'a7a8b', 'a7a8n'],
    index: 0,
  });
  assert.equal(autoChoice(state), null);
  // Back leaves the pawn in hand, and the choice does not open again by
  // itself.
  const back = drive(state, 'back');
  assert.equal(back.overlay.kind, 'none');
  assert.equal(back.focus.selected, 'a7');
  assert.equal(autoChoice(back), null);
  // OK opens it, and the person picks the piece.
  const knight = drive(back, 'select', 'down', 'down', 'down', 'select');
  assert.equal(knight.game.lastMove, 'a7a8n');
});

test('only the person’s own choices: the opponent’s turn, the roll and the handoff stay as they were', () => {
  // The opponent's lone knight is not the person's to play.
  const bot = resumed(rolled([2, 2, 2], LONE_KNIGHT, 'random', 'b'));
  assert.equal(viewGame(bot.game).bot, true);
  assert.equal(autoChoice(bot), null);
  // Before the roll nothing presses itself: rolling is #301.
  const roll = resumed(newGame('hotseat', 'auto', LONE_KNIGHT));
  assert.equal(roll.game.phase, 'roll');
  assert.equal(autoChoice(roll), null);
  // Nor at the handoff, which stays an OK of the person's.
  const over = drive(resumed(rolled([2, 6, 6])), 'select', 'select');
  assert.equal(over.game.phase, 'handoff');
  assert.equal(autoChoice(over), null);
});

test('Black’s only choice presses itself too, on the board turned for Black', () => {
  // Against the bot as Black, and in Hot Seat on Black's turn.
  const black = '1n2k3/8/8/8/8/8/8/4K3 b - - 0 1';
  for (const [mode, human] of [
    ['random', 'b'],
    ['hotseat', null],
  ] as const) {
    let state = resumed(rolled([2, 2, 2], black, mode, human));
    assert.equal(viewGame(state.game).side, 'b');
    assert.equal(autoChoice(state), 'b8');
    state = auto(state);
    assert.equal(state.focus.selected, 'b8');
  }
});

test('OK or the arrows sideways flip the setting, the last row of Settings', () => {
  const home = initialState(options);
  const settings = drive(home, 'down', 'down', 'down', 'down', 'select');
  assert.equal(settings.overlay.kind, 'settings');
  const row = drive(settings, 'up');
  assert.equal(drive(row, 'select').autoSelect, true);
  assert.equal(drive(row, 'right').autoSelect, true);
  assert.equal(drive(row, 'select', 'left').autoSelect, false);
});

// ── Through the whole app ──────────────────────────────────────────────────────

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

test('the setting is stored as on or off, and anything else reads as off', () => {
  assert.equal(readAutoSelect(memoryStore()), false);
  assert.equal(
    readAutoSelect(memoryStore({ 'dicechess-tv.autoSelect.v1': 'yes' })),
    false,
  );
  const store = memoryStore();
  saveAutoSelect(store, true);
  assert.equal(readAutoSelect(store), true);
  saveAutoSelect(store, false);
  assert.equal(readAutoSelect(store), false);
});

// What the app schedules waits in a queue, with the wait it asked for.
const harness = (roll: number[]) => {
  const waiting: { step: () => void; wait: number }[] = [];
  return {
    options: fixedOptions({
      roll: () => [...roll],
      newId: () => 'auto',
      schedule: (step, wait) => {
        waiting.push({ step, wait });
      },
    }),
    waits: () => waiting.map(({ wait }) => wait),
    next: () => {
      for (const { step } of waiting.splice(0)) act(() => step());
    },
  };
};

const prompt = (root: Instance): string => {
  const lines = root
    .findAll((node) => isHost(node, 'Text') && styleOf(node).fontSize === 24, {
      deep: true,
    })
    .map((node) => String(node.props.children));
  assert.equal(lines.length, 1, lines.join(' | '));
  return lines[0];
};

test('in the app OK presses itself one step at a time, at the opponent’s pace, and says so', () => {
  reset();
  new MMKV().set('dicechess-tv.autoSelect.v1', 'on');
  const rig = harness(ROOK_ROOK_KNIGHT);
  const { root, state } = launch({ options: rig.options });
  // A new Hot Seat game, the roll, and the knight: OK, OK.
  send('enter', 'enter', 'enter');
  assert.deepEqual(rig.waits(), []);
  assert.equal(prompt(root), 'OK: move the knight here');
  send('enter');
  assert.match(state(), /legal 1 .*selected - .*auto [ah]1$/);
  assert.equal(prompt(root), AUTO_PROMPT);
  // Pick, play, pick, play: one scheduled press each, never two at once.
  const seen: string[] = [];
  for (let i = 0; i < 4; i++) {
    assert.deepEqual(rig.waits(), [AUTO_SELECT_MS]);
    rig.next();
    seen.push(state().replace(/.*selected (\S+).*last (\S+).*/, '$1 $2'));
  }
  assert.deepEqual(rig.waits(), []);
  assert.match(seen[0], /^[ah]1 /);
  assert.match(seen[1], /^- [ah]1[bg]1$/);
  assert.match(seen[2], /^[bg]1 /);
  assert.match(seen[3], /^- [bg]1[ah]1$/);
  assert.match(state(), /phase handoff/);
  assert.equal(prompt(root), "OK: Black's turn");
});

test('in the app Back stops the press that was coming, and the prompt is the board’s again', () => {
  reset();
  new MMKV().set('dicechess-tv.autoSelect.v1', 'on');
  const rig = harness(ROOK_ROOK_KNIGHT);
  const { root, state } = launch({ options: rig.options });
  send('enter', 'enter', 'enter', 'enter');
  assert.deepEqual(rig.waits(), [AUTO_SELECT_MS]);
  send('back');
  rig.next();
  assert.match(state(), /overlay none/);
  assert.match(state(), /selected - .*auto -$/);
  assert.equal(prompt(root), 'OK: pick up · Back: menu');
  assert.deepEqual(rig.waits(), []);
});

test('in the app the setting is off on a first launch, saved when changed and read on the next', () => {
  reset();
  let root = launch().root;
  // Settings, then the last row.
  send('down', 'down', 'down', 'down', 'enter');
  assert.match(text(root), /Auto-select only choice: off/);
  send('up', 'enter');
  assert.match(text(root), /Auto-select only choice: on/);
  assert.equal(new MMKV().getString('dicechess-tv.autoSelect.v1'), 'on');
  root = launch().root;
  send('down', 'down', 'down', 'down', 'enter');
  assert.match(text(root), /Auto-select only choice: on/);
});
