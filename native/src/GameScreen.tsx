// A turn played with the remote, end to end, on the canonical engine.
//
// The board draws, the reducer interprets the remote, and the shared controller
// in src/core/game.ts owns the rules. Nothing here decides legality: every move
// it applies came out of the engine's own list of legal actions.
//
// The roll is a fixed instructional fixture, not production randomness.
import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import {
  newGame,
  rollGame,
  moveGame,
  nextTurn,
  viewGame,
  sideName,
  type Game,
} from '../../src/core/game';
import {
  boardInput,
  type BoardFocus,
  type BoardKey,
} from '../../src/core/boardInput';
import type { Square } from '../../src/core/board';
import { Board } from './Board';
import { useRemoteInput } from './useRemoteInput';
import { THEME } from './theme';

const ROLL = [5, 4, 2];
const START: Square = 'e2';
const DIE = {
  P: 'Pawn',
  N: 'Knight',
  B: 'Bishop',
  R: 'Rook',
  Q: 'Queen',
  K: 'King',
} as const;

const dice = (remaining: string) =>
  [...remaining]
    .map((letter) => DIE[letter as keyof typeof DIE] ?? letter)
    .join(' · ');

// The screen's whole flow as a pure function of state and one key.
//
// It is a reducer rather than a set of handlers because remote repeats can
// arrive faster than React re-renders: handlers closing over state would read a
// stale cursor and drop moves while a direction is held.
export type ScreenState = {
  game: Game;
  focus: BoardFocus;
  promotion: string[] | null;
  promotionIndex: number;
};

export const initialState = (): ScreenState => ({
  game: newGame('hotseat', 'remote'),
  focus: { cursor: START, selected: null },
  promotion: null,
  promotionIndex: 0,
});

// A played move clears the selection and any promotion choice; the cursor stays
// where the player left it.
const played = (state: ScreenState, game: Game): ScreenState => ({
  game,
  focus: { ...state.focus, selected: null },
  promotion: null,
  promotionIndex: 0,
});

export function screenReducer(state: ScreenState, key: BoardKey): ScreenState {
  const { game, promotion } = state;
  if (promotion) {
    if (key === 'back') return { ...state, promotion: null, promotionIndex: 0 };
    if (key === 'select')
      return played(state, moveGame(game, promotion[state.promotionIndex]));
    const step = key === 'up' || key === 'left' ? -1 : 1;
    return {
      ...state,
      promotionIndex:
        (state.promotionIndex + step + promotion.length) % promotion.length,
    };
  }
  if (game.phase === 'roll')
    return key === 'select' ? played(state, rollGame(game, ROLL)) : state;
  if (game.phase === 'handoff')
    return key === 'select' ? played(state, nextTurn(game)) : state;
  if (game.phase === 'ended') return state;

  const result = boardInput(state.focus, key, viewGame(game).legal);
  if (result.action.type === 'move')
    return played(
      { ...state, focus: result.focus },
      moveGame(game, result.action.move),
    );
  if (result.action.type === 'promote')
    return {
      ...state,
      focus: result.focus,
      promotion: result.action.moves,
      promotionIndex: 0,
    };
  return { ...state, focus: result.focus };
}

export type GameScreenProps = {
  // Diagnostic seam for device checks. Vega has no screenshot command and a
  // Release build does not route console output anywhere readable, so the only
  // way to know what the screen shows is to let it say so. The app passes
  // nothing and the effect does not run.
  onState?: (report: string) => void;
};

export const GameScreen = ({ onState }: GameScreenProps = {}) => {
  const { width, height } = useWindowDimensions();
  const [{ game, focus, promotion, promotionIndex }, onKey] = React.useReducer(
    screenReducer,
    null,
    initialState,
  );
  const state = React.useMemo(() => viewGame(game), [game]);

  useRemoteInput(onKey);

  React.useEffect(() => {
    onState?.(
      [
        `turn ${game.turn}`,
        `phase ${game.phase}`,
        `side ${state.side}`,
        `dice "${state.remaining}"`,
        `legal ${state.legal.length}`,
        `cursor ${focus.cursor}`,
        `selected ${focus.selected ?? '-'}`,
        `last ${game.lastMove ?? '-'}`,
        `moves ${game.moves.join(',') || '-'}`,
      ].join(' | '),
    );
  }, [onState, game, state, focus]);

  const size = Math.min(height - 64, width * 0.62);
  const prompt = promotion
    ? 'Arrows: choose a piece · OK: confirm · Back: cancel'
    : game.phase === 'roll'
      ? 'OK: roll three dice'
      : game.phase === 'handoff'
        ? 'OK: continue'
        : game.phase === 'ended'
          ? 'Game over'
          : focus.selected
            ? `Choose a destination for ${focus.selected}`
            : 'Arrows: move focus · OK: select';

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
        board={state.dfen.split(' ')[0]}
        legal={state.legal}
        lastMove={game.lastMove}
        selected={focus.selected}
        cursor={focus.cursor}
      />
      <View style={{ flex: 1, paddingLeft: 40 }}>
        <Text style={{ color: '#8dc9b6', fontSize: 20, letterSpacing: 2 }}>
          {`HOTSEAT · TURN ${game.turn}`}
        </Text>
        <Text style={{ color: '#f0f4f8', fontSize: 40, marginBottom: 20 }}>
          {game.result
            ? `${game.result.reason}`
            : `${sideName(state.side)} to play`}
        </Text>
        <Text style={{ color: '#aab8c9', fontSize: 22, marginBottom: 6 }}>
          {state.remaining ? `Remaining: ${dice(state.remaining)}` : 'No dice'}
        </Text>
        <Text style={{ color: '#f0f4f8', fontSize: 24, marginBottom: 16 }}>
          {prompt}
        </Text>
        {promotion
          ? promotion.map((move, index) => (
              <Text
                key={move}
                style={{
                  color: index === promotionIndex ? THEME.cursor : '#aab8c9',
                  fontSize: 22,
                }}
              >
                {DIE[move.slice(4).toUpperCase() as keyof typeof DIE] ?? move}
              </Text>
            ))
          : null}
        <Text style={{ color: '#98a9ba', fontSize: 16, marginTop: 20 }}>
          {`Cursor ${focus.cursor} · ${game.phase} · fixed instructional roll`}
        </Text>
      </View>
    </View>
  );
};
