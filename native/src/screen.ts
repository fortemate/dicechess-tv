// The screen's whole flow as a pure function of state and one action.
//
// It is a reducer rather than a set of handlers because remote repeats can
// arrive faster than React re-renders: handlers closing over state would read a
// stale cursor and drop moves while a direction is held.
//
// Nothing here decides legality. Moves come from the engine's own list, and the
// controller in src/core/game.ts applies them.
import {
  newGame,
  rollGame,
  moveGame,
  nextTurn,
  resignGame,
  agreeDraw,
  applyBotReply,
  viewGame,
  INITIAL_POSITION,
  type Game,
  type Mode,
  type Side,
} from '../../src/core/game';
import {
  boardInput,
  type BoardFocus,
  type BoardKey,
} from '../../src/core/boardInput';
import { botReply, botToAct } from '../../src/core/bot';
import type { Square } from '../../src/core/board';

export const START: Square = 'e2';

// Where the cursor starts: on the person's own side of the board.
const startFor = (human: Side | null): Square => (human === 'b' ? 'e7' : START);

// Against the bot a person plays the colour they chose, or one drawn for them.
export type ColourChoice = 'random' | Side;
export const colourOptions = ['Random', 'White', 'Black'];
const COLOURS: readonly ColourChoice[] = ['random', 'w', 'b'];

// A person playing Black sees the board from Black's side.
export const flipped = (game: Game): boolean => game.human === 'b';

// On the turned board the arrows turn with it, so each still moves the focus
// the way it points on the screen.
const TURNED: Partial<Record<BoardKey, BoardKey>> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

// The screen advances on a key, or on the local opponent taking its turn.
export type ScreenAction = { kind: 'key'; key: BoardKey } | { kind: 'bot' };

// `home` is the screen shown before a game is in play; the rest sit over the
// board. `none` is the board itself.
export type Overlay =
  | { kind: 'none' }
  | { kind: 'home'; index: number }
  | { kind: 'menu'; index: number }
  | {
      kind: 'confirm';
      action: 'resign' | 'replace';
      index: number;
      // Which mode a confirmed replacement starts, and the colour chosen for
      // it when it is a game against the bot.
      mode: Mode;
      colour?: ColourChoice;
      // Where the action began, which Cancel and Back return to.
      from: 'home' | 'menu';
    }
  // The colour a person plays against the bot, chosen before the game starts.
  // `from` is where Back returns.
  | { kind: 'colour'; index: number; mode: Mode; from: 'home' | 'menu' }
  | { kind: 'promotion'; moves: string[]; index: number }
  // The tutorial, the rules guide and the About screen, which the screen hands
  // to their own components. Nothing about a game is touched while one is up.
  | { kind: 'tutorial' }
  | { kind: 'rules' }
  | { kind: 'about' };

// The overlays drawn by their own component, which takes the remote while it is
// up. One definition, used here and by GameScreen, so a new screen cannot be
// added to one and forgotten in the other.
export const handsOff = (
  overlay: Overlay,
): overlay is Extract<Overlay, { kind: 'tutorial' | 'rules' | 'about' }> =>
  overlay.kind === 'tutorial' ||
  overlay.kind === 'rules' ||
  overlay.kind === 'about';

export type ScreenState = {
  game: Game;
  focus: BoardFocus;
  overlay: Overlay;
  // The opponent's remaining actions, revealed one at a time. Validated as a
  // complete path before the first is played, so this is a reveal and not a
  // decision taken in instalments.
  pending: string[];
  // Whether the game's sounds are heard. Toggled from either menu; the screen
  // reports each change so the app can save it and mute the players.
  sound: boolean;
};

// The toggle's label says what the sound is now, which is what a viewer checks.
export const soundOption = (on: boolean): string =>
  on ? 'Sound: on' : 'Sound: off';
const isSoundOption = (option: string): boolean => option.startsWith('Sound:');

export type ScreenOptions = {
  // Three dice. Injected so the screen never reaches for a global, and so a
  // test can play a known roll.
  roll: () => number[];
  // Identifies the game being saved. Injected so a restart does not collide
  // with the game it just restored.
  newId: () => string;
  // How the opponent's next step is scheduled. The app spaces them out so the
  // player can watch; a test runs them immediately.
  schedule: (step: () => void) => void;
  // The colour a person gets on choosing Random. Injected like the dice.
  side: () => Side;
};

// The home option that starts each mode.
const START_OPTION: Readonly<Record<Mode, string>> = {
  hotseat: 'New hotseat game',
  random: 'Play Random',
};

export const homeOptions = (resumable: boolean, sound = true): string[] => [
  ...(resumable ? ['Resume game'] : []),
  START_OPTION.hotseat,
  START_OPTION.random,
  'How to play',
  'Rules',
  soundOption(sound),
  // Last, because it is read once: it is where the credits a licence asks for
  // are shown.
  'About',
];

// A new game. Against the bot the person plays the chosen colour, or the one
// drawn for them when they chose Random.
const start = (
  state: ScreenState,
  mode: Mode,
  colour: ColourChoice,
  options: ScreenOptions,
): ScreenState => {
  const human = mode === 'hotseat' ? null : chosen(colour, options);
  return board(
    newGame(mode, options.newId(), INITIAL_POSITION, human),
    state.sound,
    startFor(human),
  );
};

// The colour a choice gives: the one named, or one drawn for Random.
const chosen = (colour: ColourChoice, options: ScreenOptions): Side =>
  colour === 'random' ? options.side() : colour;

// Which mode a home option starts. Resume starts nothing.
const MODES = new Map<string, Mode>(
  (Object.keys(START_OPTION) as Mode[]).map((mode) => [
    START_OPTION[mode],
    mode,
  ]),
);

// Home options that open another screen and change nothing else.
const OPENS = new Map<string, Overlay>([
  ['Resume game', { kind: 'none' }],
  ['How to play', { kind: 'tutorial' }],
  ['Rules', { kind: 'rules' }],
  ['About', { kind: 'about' }],
]);

export const menuOptions = (game: Game, sound = true): string[] => [
  'Resume',
  'Resign',
  // A draw needs two players to agree; there is nobody to agree with a bot.
  ...(game.mode === 'hotseat' ? ['Agree a draw'] : []),
  'New game',
  // Last: the order above is unchanged, and because the menu wraps, Up from
  // Resume reaches this in one press — the quickest way to silence a game.
  soundOption(sound),
];

export const confirmOptions = ['Cancel', 'Yes'];

// A new game keeps the one setting that is not about the game: sound.
const board = (
  game: Game,
  sound: boolean,
  cursor: Square = START,
): ScreenState => ({
  game,
  focus: { cursor, selected: null },
  overlay: { kind: 'none' },
  pending: [],
  sound,
});

// A played move clears the selection; the cursor stays where the player left it.
const played = (state: ScreenState, game: Game): ScreenState => ({
  game,
  focus: { ...state.focus, selected: null },
  overlay: { kind: 'none' },
  pending: [],
  sound: state.sound,
});

const step = (key: BoardKey, index: number, length: number): number =>
  (index + (key === 'up' || key === 'left' ? -1 : 1) + length) % length;

// A game worth resuming: one that has started and has not ended.
export const resumable = (game: Game): boolean =>
  game.phase !== 'ended' && (game.roll.length > 0 || game.turn > 1);

export const initialState = (
  options: ScreenOptions,
  restored?: Game | null,
  sound = true,
): ScreenState => {
  const game = restored ?? newGame('hotseat', options.newId());
  return {
    game,
    focus: { cursor: startFor(game.human), selected: null },
    // Always the home screen: a new launch has a mode to choose, and a restored
    // game should be resumed deliberately rather than dropping the player
    // mid-turn into a game they may not remember.
    overlay: { kind: 'home', index: 0 },
    pending: [],
    sound,
  };
};

// One step of the local opponent's turn: roll, reveal one action of its path,
// or end the turn. A three-dice turn is three visible steps rather than a board
// that changes by three moves at once, because a player who cannot see what the
// opponent did cannot read the game.
function botStep(state: ScreenState, options: ScreenOptions): ScreenState {
  const { game, pending } = state;
  if (!botToAct(game)) return state;

  // Mid-path: reveal the next action. moveGame revalidates it against the
  // position it is actually applied to.
  if (pending.length)
    return {
      ...state,
      game: moveGame(game, pending[0]),
      pending: pending.slice(1),
    };

  if (game.phase === 'roll')
    return { ...state, game: rollGame(game, options.roll()) };
  if (game.phase === 'handoff') return { ...state, game: nextTurn(game) };

  // Decide the whole turn at once and check it as a whole: applyBotReply
  // rejects a stale or incomplete path. Its result is discarded and the path is
  // replayed a move at a time, so the check covers what is about to be shown.
  const reply = botReply(game);
  applyBotReply(game, reply);
  return {
    ...state,
    game: moveGame(game, reply.moves[0]),
    pending: reply.moves.slice(1),
  };
}

// The overlays every key handler below returns to.
const BOARD: Overlay = { kind: 'none' };
const HOME: Overlay = { kind: 'home', index: 0 };
const MENU: Overlay = { kind: 'menu', index: 0 };

// Puts up another overlay, or the board itself, and changes nothing else.
const show = (state: ScreenState, overlay: Overlay): ScreenState => ({
  ...state,
  overlay,
});

const toggleSound = (state: ScreenState): ScreenState => ({
  ...state,
  sound: !state.sound,
});

// The arrows walk a list of options, wrapping at both ends.
const moved = (
  state: ScreenState,
  overlay: Extract<Overlay, { index: number }>,
  key: BoardKey,
  length: number,
): ScreenState =>
  show(state, { ...overlay, index: step(key, overlay.index, length) });

// One handler per overlay, each given its own overlay already narrowed.
type Handler<K extends Overlay['kind']> = (
  state: ScreenState,
  overlay: Extract<Overlay, { kind: K }>,
  key: BoardKey,
  options: ScreenOptions,
) => ScreenState;

const onHome: Handler<'home'> = (state, overlay, key, options) => {
  const choices = homeOptions(resumable(state.game), state.sound);
  if (key === 'back') return state;
  if (key !== 'select') return moved(state, overlay, key, choices.length);
  const chosen = choices[overlay.index];
  // The label under the cursor flips; the cursor stays on it.
  if (isSoundOption(chosen)) return toggleSound(state);
  const opens = OPENS.get(chosen);
  if (opens) return show(state, opens);
  const mode = MODES.get(chosen);
  if (!mode) return state;
  // A game against the bot starts with the choice of colour.
  if (mode !== 'hotseat')
    return show(state, { kind: 'colour', index: 0, mode, from: 'home' });
  // Starting a new game over one still in play is a decision, not a keypress.
  if (resumable(state.game))
    return show(state, {
      kind: 'confirm',
      action: 'replace',
      index: 0,
      mode,
      from: 'home',
    });
  return start(state, mode, 'random', options);
};

// The option the colour choice was opened from, which Back returns to.
const openerOf = (state: ScreenState, from: 'home' | 'menu'): Overlay =>
  from === 'home'
    ? {
        kind: 'home',
        index: homeOptions(resumable(state.game), state.sound).indexOf(
          START_OPTION.random,
        ),
      }
    : {
        kind: 'menu',
        index: menuOptions(state.game, state.sound).indexOf('New game'),
      };

const onColour: Handler<'colour'> = (state, overlay, key, options) => {
  if (key === 'back') return show(state, openerOf(state, overlay.from));
  if (key !== 'select') return moved(state, overlay, key, colourOptions.length);
  const colour = COLOURS[overlay.index];
  // The confirmation comes last, right before the game in play is replaced.
  if (resumable(state.game))
    return show(state, {
      kind: 'confirm',
      action: 'replace',
      index: 0,
      mode: overlay.mode,
      colour,
      from: overlay.from,
    });
  return start(state, overlay.mode, colour, options);
};

// Cancel, or Back, calls the whole action off and returns to where it began:
// the menu, or the home screen with the cursor on the option that started it.
const cancelled = (
  state: ScreenState,
  overlay: Extract<Overlay, { kind: 'confirm' }>,
): Overlay =>
  overlay.from === 'menu'
    ? MENU
    : {
        kind: 'home',
        index: homeOptions(resumable(state.game), state.sound).indexOf(
          START_OPTION[overlay.mode],
        ),
      };

const onConfirm: Handler<'confirm'> = (state, overlay, key, options) => {
  if (key === 'back') return show(state, cancelled(state, overlay));
  if (key !== 'select')
    return moved(state, overlay, key, confirmOptions.length);
  if (confirmOptions[overlay.index] === 'Cancel')
    return show(state, cancelled(state, overlay));
  return overlay.action === 'resign'
    ? played(state, resignGame(state.game))
    : start(state, overlay.mode, overlay.colour ?? 'random', options);
};

const onMenu: Handler<'menu'> = (state, overlay, key) => {
  const { game } = state;
  const choices = menuOptions(game, state.sound);
  if (key === 'back') return show(state, BOARD);
  if (key !== 'select') return moved(state, overlay, key, choices.length);
  const chosen = choices[overlay.index];
  if (chosen === 'Resume') return show(state, BOARD);
  // Handled before the fall-through below, which treats anything else as a
  // destructive choice and asks to confirm replacing the game.
  if (isSoundOption(chosen)) return toggleSound(state);
  if (chosen === 'Agree a draw') return played(state, agreeDraw(game));
  // A new game against the bot starts, like one from home, with the colour.
  if (chosen === 'New game' && game.mode !== 'hotseat')
    return show(state, {
      kind: 'colour',
      index: 0,
      mode: game.mode,
      from: 'menu',
    });
  // Both destructive choices go through a confirmation with Cancel first.
  return show(state, {
    kind: 'confirm',
    action: chosen === 'Resign' ? 'resign' : 'replace',
    index: 0,
    mode: game.mode,
    from: 'menu',
  });
};

const onPromotion: Handler<'promotion'> = (state, overlay, key) => {
  if (key === 'back') return show(state, BOARD);
  if (key === 'select')
    return played(state, moveGame(state.game, overlay.moves[overlay.index]));
  return moved(state, overlay, key, overlay.moves.length);
};

// Choosing a piece and a square. Back is not intercepted here: boardInput
// cancels a selection first and only asks to leave when there is nothing to
// cancel, which is the behaviour the web probe already ships.
const onMove = (state: ScreenState, key: BoardKey): ScreenState => {
  const { game } = state;
  const result = boardInput(
    state.focus,
    flipped(game) ? (TURNED[key] ?? key) : key,
    viewGame(game).legal,
  );
  const focused = { ...state, focus: result.focus };
  switch (result.action.type) {
    case 'exit':
      return show(state, MENU);
    case 'move':
      return played(focused, moveGame(game, result.action.move));
    case 'promote':
      return show(focused, {
        kind: 'promotion',
        moves: result.action.moves,
        index: 0,
      });
    case 'none':
      return focused;
  }
};

// The board itself.
const onBoard = (
  state: ScreenState,
  key: BoardKey,
  options: ScreenOptions,
): ScreenState => {
  const { game } = state;
  if (game.phase === 'ended')
    return key === 'select' || key === 'back' ? show(state, HOME) : state;
  const bot = botToAct(game);
  if (game.phase === 'move' && !bot) return onMove(state, key);
  // Otherwise Back opens the menu, and OK rolls the dice or passes the turn.
  // While the opponent owes an action the board takes no input but Back, so a
  // player cannot move its pieces for it.
  if (key === 'back') return show(state, MENU);
  if (key !== 'select' || bot) return state;
  return played(
    state,
    game.phase === 'roll' ? rollGame(game, options.roll()) : nextTurn(game),
  );
};

export function screenReducer(
  state: ScreenState,
  action: ScreenAction,
  options: ScreenOptions,
): ScreenState {
  if (action.kind === 'bot') return botStep(state, options);
  const { key } = action;
  const { overlay } = state;
  // Leaving any of those comes back here, to the screen they were started from.
  if (handsOff(overlay)) return show(state, HOME);
  switch (overlay.kind) {
    case 'home':
      return onHome(state, overlay, key, options);
    case 'colour':
      return onColour(state, overlay, key, options);
    case 'confirm':
      return onConfirm(state, overlay, key, options);
    case 'menu':
      return onMenu(state, overlay, key, options);
    case 'promotion':
      return onPromotion(state, overlay, key, options);
    case 'none':
      return onBoard(state, key, options);
  }
}
