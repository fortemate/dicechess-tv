// The native game screen: a board, a panel, and the overlays the remote opens.
//
// All flow lives in screen.ts as a pure reducer; this file only draws what that
// reducer says and hands key presses to it.
import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import {
  viewGame,
  sideName,
  type Game,
  type Result,
} from '../../src/core/game';
import { summary, type Ledger } from '../../src/core/ledger';
import type { BoardKey } from '../../src/core/boardInput';
import { Board } from './Board';
import { Dice } from './Dice';
import { diceOf } from '../../src/core/dice';
import { TutorialScreen } from './TutorialScreen';
import { RulesScreen } from './RulesScreen';
import { AboutScreen } from './AboutScreen';
import type { Sounds } from './sound';
import { cues } from '../../src/core/cues';
import { useRemoteInput } from './useRemoteInput';
import { THEME } from './theme';
import { botToAct } from '../../src/core/bot';
import {
  screenReducer,
  initialState,
  homeOptions,
  menuOptions,
  confirmOptions,
  colourOptions,
  resultOptions,
  flipped,
  resumable,
  handsOff,
  type Overlay,
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
  // What each step of the game sounds like is decided here; whether it is heard
  // and on what is the player's business.
  sounds?: Sounds;
  // Whether sound starts on, read before the first render like the saved game.
  initialSound?: boolean;
  // Called when a menu toggles sound, so the app can save the choice.
  onSound?: (on: boolean) => void;
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

// Whose move it is, when one side belongs to the person.
// Only the person's own turn is marked: the bot's turn says so in the prompt,
// which keeps the headline to one line on a television.
const mover = (game: Game, bot: boolean): string =>
  game.human !== null && !bot ? ' · you' : '';

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

type GameView = ReturnType<typeof viewGame>;

// The line under the headline: who won, or the dice still to use.
const winnerLine = (result: Result): string =>
  result.winner ? `${sideName(result.winner)} wins` : 'Drawn';
const RESULT_LINE = { color: '#aab8c9', fontSize: 24, marginBottom: 12 };

// The mode and the turn; then how the game ended or whose move it is; then the
// winner or the dice. The home screen leaves the dice out: it is a menu, and its
// list needs the height.
const Status = ({
  game,
  view,
  dice,
}: {
  game: Game;
  view: GameView;
  dice: boolean;
}) => {
  const { result } = game;
  return (
    <>
      <Text style={{ color: '#8dc9b6', fontSize: 20, letterSpacing: 2 }}>
        {`${game.mode === 'hotseat' ? 'HOTSEAT' : 'VS RANDOM'} · TURN ${game.turn}`}
      </Text>
      <Text style={{ color: '#f0f4f8', fontSize: 38, marginBottom: 16 }}>
        {result
          ? RESULT[result.reason]
          : `${sideName(view.side)} to play${mover(game, view.bot)}`}
      </Text>
      {result ? <Text style={RESULT_LINE}>{winnerLine(result)}</Text> : null}
      {!result && dice ? (
        <Dice dice={diceOf(game.roll, view.remaining)} side={view.side} />
      ) : null}
    </>
  );
};

// What OK and the arrows do now, when no menu or choice is open.
const promptFor = (game: Game, selected: string | null): string => {
  // The board takes no keys while the opponent owes an action.
  if (botToAct(game)) return 'Random is playing…';
  if (game.phase === 'roll') return 'OK: roll three dice';
  if (game.phase === 'handoff') return 'OK: continue';
  if (game.phase === 'ended') return 'OK: back to the menu';
  return selected
    ? `Choose a destination for ${selected} · Back: put it down`
    : 'Arrows: move focus · OK: select · Back: menu';
};

const CONFIRM = {
  resign: { title: 'Resign?', note: 'The other player wins.' },
  replace: {
    title: 'Replace this game?',
    note: 'The game in progress is lost.',
  },
} as const;

// What sits under the status: an open menu or choice, or the prompt.
const Panel = ({
  overlay,
  game,
  sound,
  selected,
  ledger,
}: {
  overlay: Overlay;
  game: Game;
  sound: boolean;
  selected: string | null;
  ledger?: Ledger;
}) => {
  switch (overlay.kind) {
    case 'home':
      return (
        <>
          <Choices
            title="Dice Chess"
            options={homeOptions(resumable(game), sound)}
            index={overlay.index}
          />
          {ledger ? <Record ledger={ledger} /> : null}
        </>
      );
    case 'menu':
      return (
        <Choices
          title="Menu"
          options={menuOptions(game, sound)}
          index={overlay.index}
        />
      );
    case 'colour':
      return (
        <Choices
          title="Play as"
          note="Random picks a colour for you."
          options={colourOptions}
          index={overlay.index}
        />
      );
    case 'confirm':
      return (
        <Choices
          {...CONFIRM[overlay.action]}
          options={confirmOptions}
          index={overlay.index}
        />
      );
    case 'result':
      return (
        <Choices
          title="What next?"
          options={resultOptions}
          index={overlay.index}
        />
      );
    case 'promotion':
      return (
        <Choices
          title="Promote to"
          options={overlay.moves.map(
            (move) => DIE[move.slice(4).toUpperCase() as keyof typeof DIE],
          )}
          index={overlay.index}
        />
      );
    default:
      return (
        <Text style={{ color: '#f0f4f8', fontSize: 24 }}>
          {promptFor(game, selected)}
        </Text>
      );
  }
};

// One line saying what the screen shows, for device checks.
const report = (
  game: Game,
  view: GameView,
  focus: ScreenState['focus'],
  overlay: Overlay,
): string =>
  [
    `overlay ${overlay.kind}${'index' in overlay ? '#' + overlay.index : ''}`,
    `turn ${game.turn}`,
    `phase ${game.phase}`,
    `side ${view.side}`,
    `dice "${view.remaining}"`,
    `legal ${view.legal.length}`,
    `cursor ${focus.cursor}`,
    `selected ${focus.selected ?? '-'}`,
    `last ${game.lastMove ?? '-'}`,
    `result ${game.result?.reason ?? '-'}`,
    `human ${game.human ?? '-'}`,
  ].join(' | ');

type OwnScreenProps = {
  onExit: () => void;
  onState?: (report: string) => void;
};

// The screens that take over entirely, each given only a way back. They get no
// store, so a lesson cannot reach a saved game or the record.
const OWN_SCREENS: {
  [K in 'tutorial' | 'rules' | 'about']: React.ComponentType<OwnScreenProps>;
} = {
  tutorial: TutorialScreen,
  rules: RulesScreen,
  about: AboutScreen,
};

export const GameScreen = ({
  options,
  initial,
  onCommit,
  ledger,
  onState,
  sounds,
  initialSound = true,
  onSound,
}: GameScreenProps) => {
  const { width, height } = useWindowDimensions();
  const reduce = React.useCallback(
    (state: ScreenState, action: ScreenAction) =>
      screenReducer(state, action, options),
    [options],
  );
  const [{ game, focus, overlay, sound }, dispatch] = React.useReducer(
    reduce,
    initial,
    (restored) => initialState(options, restored, initialSound),
  );
  // While the tutorial is up it owns the remote. This screen stays subscribed —
  // a hook cannot be conditional — so it ignores keys instead, or every press
  // would be handled twice. Both refs follow committed renders only, like the
  // handlers in useRemoteInput.
  const handsOver = React.useRef(false);
  const overlayAtRoot = React.useRef(false);
  React.useLayoutEffect(() => {
    handsOver.current = handsOff(overlay);
    overlayAtRoot.current = overlay.kind === 'home';
  });
  const onKey = React.useCallback((key: BoardKey) => {
    if (handsOver.current) return;
    dispatch({ kind: 'key', key });
  }, []);
  const state = React.useMemo(() => viewGame(game), [game]);

  // Back at the home screen has nowhere to go, so the app agrees to close —
  // what a viewer expects at the top of a TV app. Anywhere else it is ours.
  const onBack = React.useCallback(() => {
    if (handsOver.current) return true; // the tutorial owns it
    if (overlayAtRoot.current) return false;
    dispatch({ kind: 'key', key: 'back' });
    return true;
  }, []);

  useRemoteInput(onKey, { onBack });

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
    const before = committed.current;
    committed.current = game;
    onCommit?.(game);
    // Win or loss is heard from the side the person plays against the bot.
    sounds?.play(cues(before, game, game.human ?? 'w'));
  }, [game, onCommit, sounds]);

  // Seeded like the game, so opening the screen is not reported as a change.
  const heard = React.useRef(sound);
  React.useEffect(() => {
    if (sound === heard.current) return;
    heard.current = sound;
    onSound?.(sound);
  }, [sound, onSound]);

  React.useEffect(() => {
    onState?.(report(game, state, focus, overlay));
  }, [onState, game, state, focus, overlay]);

  // The tutorial, the rules and About are screens of their own, with their own
  // state, and this one hands over entirely rather than drawing a board behind.
  if (handsOff(overlay)) {
    const Screen = OWN_SCREENS[overlay.kind];
    return (
      <Screen
        onExit={() => dispatch({ kind: 'key', key: 'back' })}
        onState={onState}
      />
    );
  }

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
        board={state.dfen.split(' ')[0]}
        legal={state.legal}
        lastMove={game.lastMove}
        selected={focus.selected}
        cursor={focus.cursor}
        flipped={flipped(game)}
      />
      <View style={{ flex: 1, paddingLeft: 40 }}>
        <Status game={game} view={state} dice={overlay.kind !== 'home'} />
        <Panel
          overlay={overlay}
          game={game}
          sound={sound}
          selected={focus.selected}
          ledger={ledger}
        />
      </View>
    </View>
  );
};
