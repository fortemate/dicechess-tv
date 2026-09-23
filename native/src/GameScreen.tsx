// The native game screen: a board, a panel, and the overlays the remote opens.
//
// All flow lives in screen.ts as a pure reducer; this file only draws what that
// reducer says and hands key presses to it.
import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { viewGame, sideName, type Game } from '../../src/core/game';
import { summary, type Ledger } from '../../src/core/ledger';
import type { BoardKey } from '../../src/core/boardInput';
import { Board } from './Board';
import { useRemoteInput } from './useRemoteInput';
import { THEME } from './theme';
import { botToAct } from '../../src/core/bot';
import {
  screenReducer,
  initialState,
  homeOptions,
  menuOptions,
  confirmOptions,
  resumable,
  type ScreenAction,
  type ScreenOptions,
  type ScreenState,
} from './screen';

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

const RESULT = {
  'king-captured': 'King captured',
  resigned: 'Resigned',
  'agreed-draw': 'Draw agreed',
  '100-halfmoves': 'Draw: 100 halfmoves',
  'turn-limit': 'Draw: turn limit',
} as const;

export type GameScreenProps = {
  options: ScreenOptions;
  // A game to resume, read before the first render so the board never shows a
  // fresh position that is about to be replaced.
  initial?: Game | null;
  // Called with every committed game, and only those: moving the cursor does
  // not produce a new game, so this does not fire for it.
  onCommit?: (game: Game) => void;
  // Completed games so far. The screen shows it and never changes it.
  ledger?: Ledger;
  // Diagnostic seam for device checks. Vega has no screenshot command and a
  // Release build does not route console output anywhere readable, so the only
  // way to know what the screen shows is to let it say so.
  onState?: (report: string) => void;
};

const Choices = ({
  title,
  note,
  options,
  index,
}: {
  title: string;
  note?: string;
  options: string[];
  index: number;
}) => (
  <View style={{ marginTop: 12 }}>
    <Text style={{ color: '#f0f4f8', fontSize: 30, marginBottom: 8 }}>
      {title}
    </Text>
    {note ? (
      <Text style={{ color: '#aab8c9', fontSize: 20, marginBottom: 10 }}>
        {note}
      </Text>
    ) : null}
    {options.map((option, i) => (
      <Text
        key={option}
        style={{
          color: i === index ? THEME.cursor : '#aab8c9',
          fontSize: 26,
          marginBottom: 4,
        }}
      >
        {(i === index ? '> ' : '  ') + option}
      </Text>
    ))}
  </View>
);

// Results so far, shown where a player chooses what to do next. Hotseat is by
// colour because the seats change hands and nobody here knows who sat where.
const Record = ({ ledger }: { ledger: Ledger }) => {
  const view = summary(ledger);
  const { white, draws, black } = view.hotseat;
  const played = white + draws + black > 0;
  if (!played && view.bots.length === 0) return null;
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ color: '#8dc9b6', fontSize: 16, letterSpacing: 2 }}>
        COMPLETED GAMES
      </Text>
      {played ? (
        <Text style={{ color: '#aab8c9', fontSize: 18 }}>
          {`Hotseat — White ${white} · Drawn ${draws} · Black ${black}`}
        </Text>
      ) : null}
      {view.bots.map(({ opponent, side, record }) => (
        <Text key={opponent + side} style={{ color: '#aab8c9', fontSize: 18 }}>
          {`${opponent} as ${sideName(side)} — ${record.wins}W ${record.draws}D ${record.losses}L`}
        </Text>
      ))}
    </View>
  );
};

export const GameScreen = ({
  options,
  initial,
  onCommit,
  ledger,
  onState,
}: GameScreenProps) => {
  const { width, height } = useWindowDimensions();
  const reduce = React.useCallback(
    (state: ScreenState, action: ScreenAction) =>
      screenReducer(state, action, options),
    [options],
  );
  const [{ game, focus, overlay }, dispatch] = React.useReducer(
    reduce,
    initial,
    (restored) => initialState(options, restored),
  );
  const onKey = React.useCallback(
    (key: BoardKey) => dispatch({ kind: 'key', key }),
    [],
  );
  const state = React.useMemo(() => viewGame(game), [game]);

  useRemoteInput(onKey);

  // The opponent takes one step at a time, scheduled rather than looped, so the
  // player watches it roll and move instead of the board jumping. It is paused
  // while an overlay is up, which is also how leaving play stops it.
  React.useEffect(() => {
    if (overlay.kind !== 'none' || !botToAct(game)) return;
    let cancelled = false;
    options.schedule(() => {
      if (!cancelled) dispatch({ kind: 'bot' });
    });
    return () => {
      cancelled = true;
    };
  }, [game, overlay.kind, options]);

  // Seeded with the game the screen opened on, so mounting never re-saves what
  // was just restored.
  const committed = React.useRef(game);
  React.useEffect(() => {
    if (game === committed.current) return;
    committed.current = game;
    onCommit?.(game);
  }, [game, onCommit]);

  React.useEffect(() => {
    onState?.(
      [
        `overlay ${overlay.kind}`,
        `turn ${game.turn}`,
        `phase ${game.phase}`,
        `side ${state.side}`,
        `dice "${state.remaining}"`,
        `legal ${state.legal.length}`,
        `cursor ${focus.cursor}`,
        `selected ${focus.selected ?? '-'}`,
        `last ${game.lastMove ?? '-'}`,
        `result ${game.result?.reason ?? '-'}`,
      ].join(' | '),
    );
  }, [onState, game, state, focus, overlay]);

  const size = Math.min(height - 64, width * 0.62);
  const prompt =
    game.phase === 'roll'
      ? 'OK: roll three dice'
      : game.phase === 'handoff'
        ? 'OK: continue'
        : game.phase === 'ended'
          ? 'OK: back to the menu'
          : focus.selected
            ? `Choose a destination for ${focus.selected}`
            : 'Arrows: move focus · OK: select · Back: menu';

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
        <Text style={{ color: '#f0f4f8', fontSize: 38, marginBottom: 16 }}>
          {game.result
            ? RESULT[game.result.reason]
            : `${sideName(state.side)} to play`}
        </Text>
        {game.result ? (
          <Text style={{ color: '#aab8c9', fontSize: 24, marginBottom: 12 }}>
            {game.result.winner
              ? `${sideName(game.result.winner)} wins`
              : 'Drawn'}
          </Text>
        ) : (
          <Text style={{ color: '#aab8c9', fontSize: 22, marginBottom: 6 }}>
            {state.remaining
              ? `Remaining: ${dice(state.remaining)}`
              : 'No dice'}
          </Text>
        )}

        {overlay.kind === 'home' ? (
          <>
            <Choices
              title="Dice Chess"
              options={homeOptions(resumable(game))}
              index={overlay.index}
            />
            {ledger ? <Record ledger={ledger} /> : null}
          </>
        ) : overlay.kind === 'menu' ? (
          <Choices
            title="Menu"
            options={menuOptions(game)}
            index={overlay.index}
          />
        ) : overlay.kind === 'confirm' ? (
          <Choices
            title={
              overlay.action === 'resign' ? 'Resign?' : 'Replace this game?'
            }
            note={
              overlay.action === 'resign'
                ? 'The other player wins.'
                : 'The game in progress is lost.'
            }
            options={confirmOptions}
            index={overlay.index}
          />
        ) : overlay.kind === 'promotion' ? (
          <Choices
            title="Promote to"
            options={overlay.moves.map(
              (move) => DIE[move.slice(4).toUpperCase() as keyof typeof DIE],
            )}
            index={overlay.index}
          />
        ) : (
          <Text style={{ color: '#f0f4f8', fontSize: 24 }}>{prompt}</Text>
        )}
      </View>
    </View>
  );
};
