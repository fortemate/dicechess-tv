// The tutorial's flow, as a pure function of state and one key.
//
// It drives the same board, the same input reducer and the same controller the
// real game uses. A tutorial that behaved differently would teach the wrong
// thing, and the point of reusing them is that there is nothing separate to
// keep in step.
//
// There is no store here and no ledger. The screen that runs this is given
// neither, so a lesson cannot touch a saved game or a record. The game chosen
// on the last screen is only named here. The game screen starts it as its
// menus would, and asks first if that would replace a game in play (#244).
import { emptyRoll, moveGame, viewGame, type Game } from '../../src/core/game';
import {
  boardInput,
  waitingFocus,
  type BoardFocus,
  type BoardKey,
} from '../../src/core/boardInput';
import {
  TUTORIAL,
  stepGame,
  rollStep,
  passStep,
  closingGame,
  isComplete,
  isMissed,
  type TutorialStep,
} from '../../src/core/tutorial';
import { opponentOf } from '../../src/core/opponents';
import { START, type GameChoice } from './screen';

export type TutorialState = {
  index: number;
  game: Game;
  focus: BoardFocus;
  // The current step is done and the player is invited to go on.
  complete: boolean;
  // Every step is done.
  finished: boolean;
  // The player asked to leave. The tutorial is skippable at any point.
  exit: boolean;
  // The option focused on the closing screen, and the game chosen there to
  // start on leaving (#244). Leaving any other way starts none.
  choice: number;
  next: GameChoice | null;
};

// What the closing screen offers (#244): a first game against the easiest
// opponent, as White so the player rolls first, or against a friend on the
// same remote; or the main menu.
export const CLOSING_CHOICES: readonly {
  label: string;
  game: GameChoice | null;
}[] = [
  {
    label: `Play ${opponentOf('random').name}`,
    game: { mode: 'random', colour: 'w' },
  },
  { label: 'Play a friend', game: { mode: 'hotseat', colour: 'random' } },
  { label: 'Main menu', game: null },
];

export const step = (state: TutorialState): TutorialStep =>
  TUTORIAL[state.index];

// As in a game, the cursor waits on a piece that can move, or, before the roll,
// where a game's would.
const atStep = (index: number): TutorialState => {
  const game = stepGame(TUTORIAL[index]);
  return {
    index,
    game,
    focus: waitingFocus(START, viewGame(game).legal),
    complete: false,
    finished: false,
    exit: false,
    choice: 0,
    next: null,
  };
};

export const initialTutorial = (): TutorialState => atStep(0);

export type TutorialInput = BoardKey | { key: BoardKey; repeat?: boolean };

export function tutorialReducer(
  state: TutorialState,
  input: TutorialInput,
): TutorialState {
  const key = typeof input === 'string' ? input : input.key;
  const repeat = typeof input === 'string' ? false : (input.repeat ?? false);
  if (state.exit) return state;

  // The closing screen: the arrows walk its choices, wrapping, as they walk a
  // menu's, and OK takes one. Back and Menu go to the main menu, as its last
  // choice does.
  if (state.finished) {
    if (key === 'back' || key === 'menu') return { ...state, exit: true };
    if (key === 'select')
      return { ...state, exit: true, next: CLOSING_CHOICES[state.choice].game };
    const length = CLOSING_CHOICES.length;
    const back = key === 'up' || key === 'left';
    return {
      ...state,
      choice: (state.choice + (back ? -1 : 1) + length) % length,
    };
  }

  // Between steps: OK goes on, Back leaves. The board takes no input, so a
  // stray press cannot undo what was just learned.
  if (state.complete) {
    if (key === 'back' || key === 'menu') return { ...state, exit: true };
    if (key !== 'select') return state;
    return state.index + 1 < TUTORIAL.length
      ? atStep(state.index + 1)
      : {
          ...state,
          finished: true,
          game: closingGame(),
          focus: { ...state.focus, selected: null },
        };
  }

  const current = step(state);

  // The dice are spent and the goal was missed: OK tries the lesson again from
  // its roll, and Back leaves.
  if (isMissed(current, state.game)) {
    if (key === 'back' || key === 'menu') return { ...state, exit: true };
    return key === 'select' ? atStep(state.index) : state;
  }

  // Before the roll the board takes no input either: OK rolls the step's dice,
  // Back leaves.
  if (state.game.phase === 'roll') {
    if (key === 'back' || key === 'menu') return { ...state, exit: true };
    if (key !== 'select') return state;
    const game = rollStep(current, state.game);
    return {
      ...state,
      game,
      focus: waitingFocus(state.focus.cursor, viewGame(game).legal),
    };
  }

  // A roll no die can use: OK passes the turn, as in a game, and Back leaves.
  if (emptyRoll(state.game)) {
    if (key === 'back' || key === 'menu') return { ...state, exit: true };
    if (key !== 'select') return state;
    const game = passStep(state.game);
    return { ...state, game, complete: isComplete(current, game) };
  }

  const { legal, dfen } = viewGame(state.game);
  const result = boardInput(
    state.focus,
    key,
    legal,
    false,
    dfen.split(' ')[0],
    { repeat },
  );
  // Back cancels a selection first and only then leaves, exactly as in a game.
  if (result.action.type === 'exit') return { ...state, exit: true };
  if (result.action.type === 'move') {
    const game = moveGame(state.game, result.action.move);
    return {
      ...state,
      game,
      focus: waitingFocus(result.focus.cursor, viewGame(game).legal),
      complete: isComplete(current, game),
    };
  }
  // A promotion cannot arise: no step is played from a position that offers
  // one, and the tests hold that.
  return { ...state, focus: result.focus };
}
