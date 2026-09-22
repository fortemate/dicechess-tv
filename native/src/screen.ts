// The screen's whole flow as a pure function of state and one key.
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
  viewGame,
  type Game,
} from '../../src/core/game';
import {
  boardInput,
  type BoardFocus,
  type BoardKey,
} from '../../src/core/boardInput';
import type { Square } from '../../src/core/board';

export const START: Square = 'e2';

// `home` is the screen shown before a game is in play; the rest sit over the
// board. `none` is the board itself.
export type Overlay =
  | { kind: 'none' }
  | { kind: 'home'; index: number }
  | { kind: 'menu'; index: number }
  | { kind: 'confirm'; action: 'resign' | 'replace'; index: number }
  | { kind: 'promotion'; moves: string[]; index: number };

export type ScreenState = {
  game: Game;
  focus: BoardFocus;
  overlay: Overlay;
};

export type ScreenOptions = {
  // Three dice. Injected so the screen never reaches for a global, and so a
  // test can play a known roll.
  roll: () => number[];
  // Identifies the game being saved. Injected so a restart does not collide
  // with the game it just restored.
  newId: () => string;
};

// Only what the player can actually do is offered: a bot opponent does not
// exist natively yet, so no mode claims one.
export const homeOptions = (resumable: boolean): string[] =>
  resumable ? ['Resume game', 'New hotseat game'] : ['New hotseat game'];

export const menuOptions = (game: Game): string[] => [
  'Resume',
  'Resign',
  ...(game.mode === 'hotseat' ? ['Agree a draw'] : []),
  'New game',
];

export const confirmOptions = ['Cancel', 'Yes'];

const board = (game: Game, cursor: Square = START): ScreenState => ({
  game,
  focus: { cursor, selected: null },
  overlay: { kind: 'none' },
});

// A played move clears the selection; the cursor stays where the player left it.
const played = (state: ScreenState, game: Game): ScreenState => ({
  game,
  focus: { ...state.focus, selected: null },
  overlay: { kind: 'none' },
});

const step = (key: BoardKey, index: number, length: number): number =>
  (index + (key === 'up' || key === 'left' ? -1 : 1) + length) % length;

// A game worth resuming: one that has started and has not ended.
export const resumable = (game: Game): boolean =>
  game.phase !== 'ended' && (game.roll.length > 0 || game.turn > 1);

export const initialState = (
  options: ScreenOptions,
  restored?: Game | null,
): ScreenState => {
  const game = restored ?? newGame('hotseat', options.newId());
  return {
    game,
    focus: { cursor: START, selected: null },
    // A restored game opens on the home screen so the player chooses to resume
    // rather than being dropped mid-turn into a game they may not remember.
    overlay: restored ? { kind: 'home', index: 0 } : { kind: 'none' },
  };
};

export function screenReducer(
  state: ScreenState,
  key: BoardKey,
  options: ScreenOptions,
): ScreenState {
  const { game, overlay } = state;

  if (overlay.kind === 'home') {
    const options_ = homeOptions(resumable(game));
    if (key === 'back') return state;
    if (key !== 'select')
      return {
        ...state,
        overlay: {
          ...overlay,
          index: step(key, overlay.index, options_.length),
        },
      };
    const chosen = options_[overlay.index];
    if (chosen === 'Resume game')
      return { ...state, overlay: { kind: 'none' } };
    // Starting a new game over one still in play is a decision, not a keypress.
    if (resumable(game))
      return {
        ...state,
        overlay: { kind: 'confirm', action: 'replace', index: 0 },
      };
    return board(newGame('hotseat', options.newId()));
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
      : board(newGame('hotseat', options.newId()));
  }

  if (overlay.kind === 'menu') {
    const options_ = menuOptions(game);
    if (key === 'back') return { ...state, overlay: { kind: 'none' } };
    if (key !== 'select')
      return {
        ...state,
        overlay: {
          ...overlay,
          index: step(key, overlay.index, options_.length),
        },
      };
    const chosen = options_[overlay.index];
    if (chosen === 'Resume') return { ...state, overlay: { kind: 'none' } };
    if (chosen === 'Agree a draw') return played(state, agreeDraw(game));
    // Both destructive choices go through a confirmation with Cancel first.
    return {
      ...state,
      overlay: {
        kind: 'confirm',
        action: chosen === 'Resign' ? 'resign' : 'replace',
        index: 0,
      },
    };
  }

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

  const result = boardInput(state.focus, key, viewGame(game).legal);
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
