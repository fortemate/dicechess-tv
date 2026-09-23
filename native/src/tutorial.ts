// The tutorial's flow, as a pure function of state and one key.
//
// It drives the same board, the same input reducer and the same controller the
// real game uses. A tutorial that behaved differently would teach the wrong
// thing, and the point of reusing them is that there is nothing separate to
// keep in step.
//
// There is no store here and no ledger. The screen that runs this is given
// neither, so a lesson cannot touch a saved game or a record.
import { moveGame, viewGame, type Game } from '../../src/core/game';
import {
  boardInput,
  type BoardFocus,
  type BoardKey,
} from '../../src/core/boardInput';
import {
  TUTORIAL,
  stepGame,
  isComplete,
  type TutorialStep,
} from '../../src/core/tutorial';
import { START } from './screen';

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
};

export const step = (state: TutorialState): TutorialStep =>
  TUTORIAL[state.index];

const atStep = (index: number): TutorialState => ({
  index,
  game: stepGame(TUTORIAL[index]),
  focus: { cursor: START, selected: null },
  complete: false,
  finished: false,
  exit: false,
});

export const initialTutorial = (): TutorialState => atStep(0);

export function tutorialReducer(
  state: TutorialState,
  key: BoardKey,
): TutorialState {
  if (state.exit) return state;

  if (state.finished)
    return key === 'select' || key === 'back'
      ? { ...state, exit: true }
      : state;

  // Between steps: OK goes on, Back leaves. The board takes no input, so a
  // stray press cannot undo what was just learned.
  if (state.complete) {
    if (key === 'back') return { ...state, exit: true };
    if (key !== 'select') return state;
    return state.index + 1 < TUTORIAL.length
      ? atStep(state.index + 1)
      : { ...state, finished: true };
  }

  const current = step(state);
  const result = boardInput(state.focus, key, viewGame(state.game).legal);
  // Back cancels a selection first and only then leaves, exactly as in a game.
  if (result.action.type === 'exit') return { ...state, exit: true };
  if (result.action.type === 'move') {
    const game = moveGame(state.game, result.action.move);
    return {
      ...state,
      game,
      focus: { ...result.focus, selected: null },
      complete: isComplete(current, game),
    };
  }
  // A promotion cannot arise: no step is played from a position that offers
  // one, and the tests hold that.
  return { ...state, focus: result.focus };
}
