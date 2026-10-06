// The tutorial screen. Same board, same input, same controller as a real game.
//
// It is given no store and no ledger, which is what makes "the tutorial never
// changes W/D/L or the saved real game" structural rather than a promise.
//
// Thinkle the wizard teaches it (#264). The panel reads from the top: the
// lesson's title, his portrait with his name and the lesson's number, his
// bubble, and the task in plain words. The dice and the key hint stand at the
// bottom, where a game has the player's badge, so they keep their place however
// much he says, and his bubble may take the room between. After the last lesson
// the task gives way to a choice: a first game, or the main menu (#244).
import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { emptyRoll, viewGame } from '../../src/core/game';
import {
  CLOSING_LINES,
  TUTORIAL,
  isMissed,
  taskAt,
  tutorLinesAt,
} from '../../src/core/tutorial';
import { movableSquares, type BoardKey } from '../../src/core/boardInput';
import { Board } from './Board';
import { Dice } from './Dice';
import { diceOf } from '../../src/core/dice';
import { useRemoteInput } from './useRemoteInput';
import { THEME } from './theme';
import { Option } from './Option';
import { Teacher, TeacherTitle } from './Teacher';
import { useTutorialVoice, type TutorialVoice } from './useTutorialVoice';
import { BOARD_GAP, boardSide, drawnSide, safeInsets } from './layout';
import type { GameChoice } from './screen';
import {
  CLOSING_CHOICES,
  initialTutorial,
  tutorialReducer,
  step,
  type TutorialState,
} from './tutorial';

export type TutorialScreenProps = {
  // Leaving, with the game chosen on the closing screen to start, if any.
  onExit: (next: GameChoice | null) => void;
  // Diagnostic seam for device checks, as on the game screen.
  onState?: (report: string) => void;
  // Where Thinkle's lines are said: the game's sounds, which honour the Voices
  // setting. Without it the tutorial is silent and his bubble still shows.
  voice?: TutorialVoice;
};

// A line of text has room below its baseline. This pulls the hint's baseline
// down to the board's bottom edge, as the title's capitals meet its top one:
// measured on the Virtual Device (#264), to within a pixel of a 1080p capture.
const HINT_DESCENT = 5;

// What OK and Back do now. Back cancels a selection before it leaves, as in a
// game, so the hint says which of the two it will do. The closing screen's
// choices say what OK does there, so it has no hint. Each keeps to one line,
// as the game's hints do (#240, native/test/hints.test.tsx).
export const hint = (state: TutorialState): string => {
  if (state.complete)
    return state.index + 1 < TUTORIAL.length
      ? 'Done. OK: next lesson · Back: leave'
      : 'Done. OK: finish · Back: leave';
  if (emptyRoll(state.game)) return 'OK: pass the turn · Back: leave';
  if (isMissed(step(state), state.game)) return 'OK: try again · Back: leave';
  return state.focus.selected
    ? 'Back: put the piece down'
    : 'Back: leave the tutorial';
};

export const TutorialScreen = ({
  onExit,
  onState,
  voice,
}: TutorialScreenProps) => {
  const { width, height } = useWindowDimensions();
  const [state, onKey] = React.useReducer(
    tutorialReducer,
    undefined,
    initialTutorial,
  );

  // OK held down, shown on the focused choice of the closing screen (#51).
  const [pressed, setPressed] = React.useState(false);

  // The tutorial always has somewhere to go back to, so it never lets Back
  // close the app.
  useRemoteInput(onKey as (key: BoardKey) => void, {
    onBack: () => {
      (onKey as (key: BoardKey) => void)('back');
      return true;
    },
    onPress: setPressed,
  });

  React.useEffect(() => {
    if (state.exit) onExit(state.next);
  }, [state.exit, state.next, onExit]);

  React.useEffect(() => {
    const view = viewGame(state.game);
    onState?.(
      [
        `tutorial ${state.index + 1}/${TUTORIAL.length}`,
        `step ${step(state).id}`,
        `complete ${state.complete}`,
        `finished ${state.finished}`,
        `choice ${state.finished ? CLOSING_CHOICES[state.choice].label : '-'}`,
        `dice "${view.remaining}"`,
        `playable "${view.playable}"`,
        `cursor ${state.focus.cursor}`,
        `selected ${state.focus.selected ?? '-'}`,
        `last ${state.game.lastMove ?? '-'}`,
      ].join(' | '),
    );
  }, [onState, state]);

  const current = step(state);
  const board = viewGame(state.game);
  // Marked as in a game, except between steps, when the board takes no input.
  const movable =
    state.complete || state.finished ? null : movableSquares(board.legal);
  const size = boardSide(width, height);
  const insets = safeInsets(width, height);

  const lesson = `Lesson ${state.index + 1} of ${TUTORIAL.length}`;
  const lines = state.finished
    ? CLOSING_LINES
    : tutorLinesAt(current, state.game, state.complete);
  useTutorialVoice(voice, lines);

  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        backgroundColor: THEME.background,
        alignItems: 'center',
        paddingHorizontal: insets.x,
        paddingVertical: insets.y,
      }}
    >
      <Board
        size={size}
        board={board.dfen.split(' ')[0]}
        legal={board.legal}
        lastMove={state.game.lastMove}
        selected={state.focus.selected}
        cursor={state.finished ? null : state.focus.cursor}
        movable={movable}
      />
      {/* As tall as the board and level with it, as the game's panel is between
          its badges: the title starts at the board's top edge and the hint ends
          at its bottom one. */}
      <View
        style={{ flex: 1, height: drawnSide(size), paddingLeft: BOARD_GAP }}
      >
        <TeacherTitle>
          {state.finished ? 'That is the whole game' : current.title}
        </TeacherTitle>

        <Teacher
          caption={state.finished ? 'All lessons done' : lesson}
          text={lines.map((line) => line.text).join(' ')}
        />

        {/* Once the lesson is done there is nothing left to do on the board.
            After the last one, what comes next is chosen under his words. */}
        {state.finished ? (
          <View>
            {CLOSING_CHOICES.map(({ label }, i) => (
              <Option
                key={label}
                label={label}
                focused={i === state.choice}
                pressed={pressed}
              />
            ))}
          </View>
        ) : null}
        {state.finished || state.complete ? null : (
          <Text style={{ color: '#f0f4f8', fontSize: 24 }}>
            {taskAt(current, state.game)}
          </Text>
        )}

        <View style={{ flex: 1 }} />

        {/* After the last lesson there is nothing to roll, and the choices say
            what OK does. */}
        {state.finished ? null : (
          <>
            <Dice
              dice={diceOf(state.game.roll, board.remaining, board.playable)}
              side={board.side}
              size={56}
            />
            <Text
              style={{
                color: state.complete ? '#8aebaa' : '#98a9ba',
                fontSize: 22,
                marginBottom: -HINT_DESCENT,
              }}
            >
              {hint(state)}
            </Text>
          </>
        )}
      </View>
    </View>
  );
};
