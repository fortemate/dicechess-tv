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
export const handsOff = (overlay: Overlay): boolean =>
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

export const homeOptions = (resumable: boolean, sound = true): string[] => [
  ...(resumable ? ['Resume game'] : []),
  'New hotseat game',
  'Play Random',
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
  const human =
    mode === 'hotseat' ? null : colour === 'random' ? options.side() : colour;
  return board(
    newGame(mode, options.newId(), INITIAL_POSITION, human),
    state.sound,
    startFor(human),
  );
};

// Which mode a home option starts. Resume starts nothing.
const modeOf = (option: string): Mode | null =>
  option === 'New hotseat game'
    ? 'hotseat'
    : option === 'Play Random'
      ? 'random'
      : null;

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

export function screenReducer(
  state: ScreenState,
  action: ScreenAction,
  options: ScreenOptions,
): ScreenState {
  if (action.kind === 'bot') return botStep(state, options);
  const key = action.key;
  const { game, overlay } = state;

  if (overlay.kind === 'home') {
    const choices = homeOptions(resumable(game), state.sound);
    if (key === 'back') return state;
    if (key !== 'select')
      return {
        ...state,
        overlay: {
          ...overlay,
          index: step(key, overlay.index, choices.length),
        },
      };
    const chosen = choices[overlay.index];
    // The label under the cursor flips; the cursor stays on it.
    if (isSoundOption(chosen)) return { ...state, sound: !state.sound };
    if (chosen === 'Resume game')
      return { ...state, overlay: { kind: 'none' } };
    if (chosen === 'How to play')
      return { ...state, overlay: { kind: 'tutorial' } };
    if (chosen === 'Rules') return { ...state, overlay: { kind: 'rules' } };
    if (chosen === 'About') return { ...state, overlay: { kind: 'about' } };
    const mode = modeOf(chosen);
    if (!mode) return state;
    // A game against the bot starts with the choice of colour.
    if (mode !== 'hotseat')
      return {
        ...state,
        overlay: { kind: 'colour', index: 0, mode, from: 'home' },
      };
    // Starting a new game over one still in play is a decision, not a keypress.
    if (resumable(game))
      return {
        ...state,
        overlay: { kind: 'confirm', action: 'replace', index: 0, mode },
      };
    return start(state, mode, 'random', options);
  }

  if (overlay.kind === 'colour') {
    // Back returns to the option the choice was opened from.
    if (key === 'back')
      return {
        ...state,
        overlay:
          overlay.from === 'home'
            ? {
                kind: 'home',
                index: homeOptions(resumable(game), state.sound).indexOf(
                  'Play Random',
                ),
              }
            : {
                kind: 'menu',
                index: menuOptions(game, state.sound).indexOf('New game'),
              },
      };
    if (key !== 'select')
      return {
        ...state,
        overlay: {
          ...overlay,
          index: step(key, overlay.index, colourOptions.length),
        },
      };
    const colour = COLOURS[overlay.index];
    // The confirmation comes last, right before the game in play is replaced.
    if (resumable(game))
      return {
        ...state,
        overlay: {
          kind: 'confirm',
          action: 'replace',
          index: 0,
          mode: overlay.mode,
          colour,
        },
      };
    return start(state, overlay.mode, colour, options);
  }

  if (overlay.kind === 'confirm') {
    if (key === 'back')
      return { ...state, overlay: { kind: 'menu', index: 0 } };
    if (key !== 'select')
      return {
        ...state,
        overlay: {
          ...overlay,
          index: step(key, overlay.index, confirmOptions.length),
        },
      };
    if (confirmOptions[overlay.index] === 'Cancel')
      return { ...state, overlay: { kind: 'menu', index: 0 } };
    return overlay.action === 'resign'
      ? played(state, resignGame(game))
      : start(state, overlay.mode, overlay.colour ?? 'random', options);
  }

  if (overlay.kind === 'menu') {
    const choices = menuOptions(game, state.sound);
    if (key === 'back') return { ...state, overlay: { kind: 'none' } };
    if (key !== 'select')
      return {
        ...state,
        overlay: {
          ...overlay,
          index: step(key, overlay.index, choices.length),
        },
      };
    const chosen = choices[overlay.index];
    if (chosen === 'Resume') return { ...state, overlay: { kind: 'none' } };
    // Handled before the fall-through below, which treats anything else as a
    // destructive choice and asks to confirm replacing the game.
    if (isSoundOption(chosen)) return { ...state, sound: !state.sound };
    if (chosen === 'Agree a draw') return played(state, agreeDraw(game));
    // A new game against the bot starts, like one from home, with the colour.
    if (chosen === 'New game' && game.mode !== 'hotseat')
      return {
        ...state,
        overlay: { kind: 'colour', index: 0, mode: game.mode, from: 'menu' },
      };
    // Both destructive choices go through a confirmation with Cancel first.
    return {
      ...state,
      overlay: {
        kind: 'confirm',
        action: chosen === 'Resign' ? 'resign' : 'replace',
        index: 0,
        mode: game.mode,
      },
    };
  }

  // Leaving any of those comes back here, to the screen they were started from.
  if (handsOff(overlay))
    return { ...state, overlay: { kind: 'home', index: 0 } };

  if (overlay.kind === 'promotion') {
    if (key === 'back') return { ...state, overlay: { kind: 'none' } };
    if (key === 'select')
      return played(state, moveGame(game, overlay.moves[overlay.index]));
    return {
      ...state,
      overlay: {
        ...overlay,
        index: step(key, overlay.index, overlay.moves.length),
      },
    };
  }

  // The board itself. Back is not intercepted here: boardInput cancels a
  // selection first and only asks to leave when there is nothing to cancel,
  // which is the behaviour the web probe already ships.
  if (game.phase === 'ended')
    return key === 'select' || key === 'back'
      ? { ...state, overlay: { kind: 'home', index: 0 } }
      : state;
  // While the opponent owes an action the board takes no input but Back, so a
  // player cannot move its pieces for it.
  if (botToAct(game))
    return key === 'back'
      ? { ...state, overlay: { kind: 'menu', index: 0 } }
      : state;
  if (game.phase === 'roll')
    return key === 'select'
      ? played(state, rollGame(game, options.roll()))
      : key === 'back'
        ? { ...state, overlay: { kind: 'menu', index: 0 } }
        : state;
  if (game.phase === 'handoff')
    return key === 'select'
      ? played(state, nextTurn(game))
      : key === 'back'
        ? { ...state, overlay: { kind: 'menu', index: 0 } }
        : state;

  const result = boardInput(
    state.focus,
    flipped(game) ? (TURNED[key] ?? key) : key,
    viewGame(game).legal,
  );
  if (result.action.type === 'exit')
    return { ...state, overlay: { kind: 'menu', index: 0 } };
  if (result.action.type === 'move')
    return played(
      { ...state, focus: result.focus },
      moveGame(game, result.action.move),
    );
  if (result.action.type === 'promote')
    return {
      ...state,
      focus: result.focus,
      overlay: { kind: 'promotion', moves: result.action.moves, index: 0 },
    };
  return { ...state, focus: result.focus };
}
