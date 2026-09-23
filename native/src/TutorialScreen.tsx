// The tutorial screen. Same board, same input, same controller as a real game.
//
// It is given no store and no ledger, which is what makes "the tutorial never
// changes W/D/L or the saved real game" structural rather than a promise.
import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { viewGame } from '../../src/core/game';
import { TUTORIAL } from '../../src/core/tutorial';
import type { BoardKey } from '../../src/core/boardInput';
import { Board } from './Board';
import { useRemoteInput } from './useRemoteInput';
import { THEME } from './theme';
import { initialTutorial, tutorialReducer, step } from './tutorial';

export type TutorialScreenProps = {
  onExit: () => void;
  // Diagnostic seam for device checks, as on the game screen.
  onState?: (report: string) => void;
};

export const TutorialScreen = ({ onExit, onState }: TutorialScreenProps) => {
  const { width, height } = useWindowDimensions();
  const [state, onKey] = React.useReducer(
    tutorialReducer,
    undefined,
    initialTutorial,
  );

  // The tutorial always has somewhere to go back to, so it never lets Back
  // close the app.
  useRemoteInput(onKey as (key: BoardKey) => void, {
    onBack: () => {
      (onKey as (key: BoardKey) => void)('back');
      return true;
    },
  });

  React.useEffect(() => {
    if (state.exit) onExit();
  }, [state.exit, onExit]);

  React.useEffect(() => {
    onState?.(
      [
        `tutorial ${state.index + 1}/${TUTORIAL.length}`,
        `step ${step(state).id}`,
        `complete ${state.complete}`,
        `finished ${state.finished}`,
        `dice "${viewGame(state.game).remaining}"`,
        `cursor ${state.focus.cursor}`,
        `selected ${state.focus.selected ?? '-'}`,
        `last ${state.game.lastMove ?? '-'}`,
      ].join(' | '),
    );
  }, [onState, state]);

  const current = step(state);
  const board = viewGame(state.game);
  const size = Math.min(height - 64, width * 0.62);

  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        backgroundColor: THEME.background,
        alignItems: 'center',
        padding: 32,
      }}
    >
      <Board
        size={size}
        board={board.dfen.split(' ')[0]}
        legal={board.legal}
        lastMove={state.game.lastMove}
        selected={state.focus.selected}
        cursor={state.focus.cursor}
      />
      <View style={{ flex: 1, paddingLeft: 40 }}>
        <Text style={{ color: '#8dc9b6', fontSize: 18, letterSpacing: 2 }}>
          {`HOW TO PLAY · ${state.index + 1} OF ${TUTORIAL.length}`}
        </Text>
        <Text style={{ color: '#f0f4f8', fontSize: 34, marginBottom: 14 }}>
          {state.finished ? 'That is the whole game' : current.title}
        </Text>

        {state.finished ? (
          <Text style={{ color: '#aab8c9', fontSize: 22, marginBottom: 12 }}>
            Castling and promotion work as in chess; the rules guide has the
            detail when you want it.
          </Text>
        ) : (
          <>
            <Text style={{ color: '#f0f4f8', fontSize: 24, marginBottom: 10 }}>
              {current.instruction}
            </Text>
            <Text style={{ color: '#aab8c9', fontSize: 20, marginBottom: 12 }}>
              {current.note}
            </Text>
          </>
        )}

        <Text style={{ color: '#aab8c9', fontSize: 20, marginBottom: 12 }}>
          {board.remaining ? `Dice: ${board.remaining}` : 'No dice left'}
        </Text>

        <Text
          style={{
            color: state.complete || state.finished ? '#8aebaa' : '#98a9ba',
            fontSize: 22,
          }}
        >
          {state.finished
            ? 'OK: back to the menu'
            : state.complete
              ? 'Done. OK: next lesson · Back: leave'
              : // Back cancels a selection before it leaves, as in a game, so
                // say which one it will do rather than promising the wrong one.
                state.focus.selected
                ? 'Back: put the piece down'
                : 'Back: leave the tutorial'}
        </Text>
      </View>
    </View>
  );
};
