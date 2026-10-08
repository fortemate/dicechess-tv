// The native game screen: a board, a panel, and the overlays the remote opens.
//
// All flow lives in screen.ts as a pure reducer; this file only draws what that
// reducer says and hands key presses to it.
import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import {
  viewGame,
  sideName,
  opposite,
  emptyRoll,
  isBotMode,
  type Game,
  type Result,
  type Side,
} from '../../src/core/game';
import { opponentOf } from '../../src/core/opponents';
import type { Ledger } from '../../src/core/ledger';
import { pieceAt } from '../../src/core/board';
import { movableSquares, type BoardKey } from '../../src/core/boardInput';
import { Board } from './Board';
import { Dice } from './Dice';
import { diceOf } from '../../src/core/dice';
import { TutorialScreen } from './TutorialScreen';
import { TutorialOffer } from './TutorialOffer';
import { RulesScreen } from './RulesScreen';
import { AboutScreen } from './AboutScreen';
import { OpponentScreen } from './OpponentScreen';
import { Matchup } from './Matchup';
import { HOST_BUBBLE_ROWS, SpeechBubble } from './SpeechBubble';
import { DISMISS_DELAY_MS, useBotVoice } from './useBotVoice';
import { useHostVoice } from './useHostVoice';
import { DEFAULT_HOST, type HostChoice } from './hostSetting';
import {
  LINE_START_MS,
  speechTiming,
  type Sounds,
  type SpokenLine,
} from './sound';
import type { Music } from './music';
import { MUSIC_STEPS, type MusicSetting } from './musicSetting';
import { useDanger } from './useDanger';
import { activeClock, scheduleActive, useActivity } from './activity';
import { cues } from '../../src/core/cues';
import { useRemoteInput } from './useRemoteInput';
import { THEME } from './theme';
import { PIECES } from './pieces';
import { Option } from './Option';
import { BOARD_GAP, boardSide, drawnSide, safeInsets } from './layout';
import { botReply, botToAct, type BotReply } from '../../src/core/bot';
import {
  screenReducer,
  initialState,
  homeOptions,
  menuOptions,
  settingsOptions,
  musicRole,
  confirmOptions,
  colourOptions,
  resultOptions,
  flipped,
  resumable,
  handsOff,
  botOwes,
  BOT_STEP_MS,
  OK_GUARD_MS,
  type GameChoice,
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
  // Called when the settings change sound, so the app can save the choice.
  onSound?: (on: boolean) => void;
  // Whether the board turns to the side to move in hotseat (#120).
  initialTurnBoard?: boolean;
  onTurnBoard?: (on: boolean) => void;
  // Whether the lines are spoken aloud, the bots' and the host's (#159).
  initialVoices?: boolean;
  onVoices?: (on: boolean) => void;
  // Who hosts Hot Seat games, or 'off' (#202).
  initialHost?: HostChoice;
  onHost?: (host: HostChoice) => void;
  // The adaptive music (#76). The screen says which theme fits what it shows;
  // whether music is on and how loud is the app's to apply and save.
  music?: Music;
  initialMusic?: MusicSetting;
  onMusic?: (music: MusicSetting) => void;
  // Whether the build has music, which the app learns after launch.
  musicAvailable?: boolean;
  // Whether to open on Thinkle's offer of the tutorial: a first launch (#244).
  offerTutorial?: boolean;
  // Called once the offer is answered, either way, so the app can remember
  // that it was and never make it again.
  onTutorialOffered?: () => void;
};

// How long the music stays silent after a game ends, so the result's jingle is
// heard on its own before the menu theme returns.
export const RESULT_SILENCE_MS = 2500;

// A bubble stays its usual time, or until its line has been said (#159),
// counting the moment the player takes to start the clip (#187).
const bubbleHoldMs = (line: SpokenLine): number => {
  const timing = speechTiming(line);
  return Math.max(
    DISMISS_DELAY_MS,
    timing ? timing.delayMs + LINE_START_MS + timing.ms : 0,
  );
};

// The volume as rings, like an opponent's level: filled up to the setting. Small
// enough that the label and ten rings fit the panel, which measured about
// 380 dp wide on the virtual device.
const RING = 10;
const VolumeRings = ({
  volume,
  focused,
}: {
  volume: number;
  focused: boolean;
}) => (
  <View style={{ flexDirection: 'row', marginLeft: 10 }}>
    {Array.from({ length: MUSIC_STEPS }, (_, i) => ringOf(i, volume, focused))}
  </View>
);

const ringOf = (i: number, volume: number, focused: boolean) => {
  const ink = focused ? '#f0f4f8' : '#aab8c9';
  return (
    <View
      key={i}
      testID={i < volume ? 'ring-filled' : 'ring-empty'}
      style={{
        width: RING,
        height: RING,
        borderRadius: RING / 2,
        borderWidth: 2,
        borderColor: ink,
        backgroundColor: i < volume ? ink : 'transparent',
        marginRight: 4,
      }}
    />
  );
};

const Choices = ({
  title,
  note,
  options,
  index,
  pressed = false,
  befores = [],
  afters = [],
}: {
  title: string;
  note?: string;
  options: string[];
  index: number;
  // OK is held on the focused option.
  pressed?: boolean;
  // Drawn before an option's label, by position.
  befores?: (React.ReactNode | undefined)[];
  // Drawn after an option's label, by position.
  afters?: (React.ReactNode | undefined)[];
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
      <Option
        key={option}
        label={option}
        focused={i === index}
        pressed={pressed}
        before={befores[i]}
        after={afters[i]}
      />
    ))}
  </View>
);

// Whose move it is, when one side belongs to the person.
// Only the person's own turn is marked: the bot's turn says so in the prompt,
// which keeps the headline to one line on a television.
const mover = (game: Game, bot: boolean): string =>
  game.human !== null && !bot ? ' · you' : '';

// Whose move it is, or that the roll left nothing to play (#85). Whose roll it
// was shows in the dice, drawn in that side's colour; leaving the side out keeps
// the notice to one line. Against the bot it is named, since its notice waits
// for the person's OK and the prompt then asks for their roll rather than
// saying the bot is playing. On the Virtual Device "No legal moves · Rampage"
// and "Rampage has no moves" both took two lines; this is the wording that
// fits the longest name.
// Nobody did anything wrong, so it says so plainly rather than "forfeited".
const headline = (game: Game, view: GameView): string => {
  if (!emptyRoll(game))
    return game.phase === 'handoff'
      ? turnOver(game, view)
      : `${sideName(view.side)} to play${mover(game, view.bot)}`;
  const name = opponentName(game);
  return view.bot && name
    ? `${name} can't move`
    : `No legal moves${mover(game, view.bot)}`;
};

// A turn with no action left is over, though it is still the mover's until OK
// hands it on (#232): the headline says so, not that the side is to play.
// Against the bot the person's own is "your turn", in the player's words, as
// the result is (#235).
const turnOver = (game: Game, view: GameView): string =>
  game.human !== null && !view.bot
    ? 'Your turn is over'
    : `${sideName(view.side)}'s turn is over`;

// Who the person plays: nobody in hotseat, else the opponent's name.
const opponentName = (game: Game): string | null =>
  isBotMode(game.mode) ? opponentOf(game.mode).name : null;

// Who plays a side, in the player's words (#235): against the bot the person is
// "You" and the bot goes by its name; in hotseat each side is its colour.
const playerOf = (game: Game, side: Side): string => {
  if (game.human === null) return sideName(side);
  return side === game.human ? 'You' : (opponentName(game) ?? 'The computer');
};

// A side's king, as a sentence names it: the person's is "your king".
const kingOf = (game: Game, side: Side): string =>
  side === game.human ? 'your king' : `${playerOf(game, side)}'s king`;

type GameView = ReturnType<typeof viewGame>;

// The headline of a finished game: who won, in the player's words (#235). The
// person's win is the one cheer; a loss names the bot that won rather than
// telling the person they lost.
const outcome = (game: Game, { winner }: Result): string => {
  if (!winner) return 'Draw';
  return winner === game.human ? 'You win!' : `${playerOf(game, winner)} wins`;
};

// Why a game was drawn, in the rules guide's terms but plain words (#235). The
// hundred is the engine's half-move clock, which counts each action that is
// neither a capture nor a pawn move, a die each, and nothing for a turn that
// passes (test/rules.test.ts). So it is a hundred moves in the tutorial's
// sense, where each die is one move, not fifty turns each as in chess.
const DRAWN = {
  'agreed-draw': 'Both players agreed',
  '100-halfmoves': '100 moves, no capture or pawn move',
  'turn-limit': '5,000-turn limit reached',
} as const;

// How a game ended, the line under who won (#235). A king taken and a
// resignation always have a winner.
const reasonOf = (game: Game, { winner, reason }: Result): string => {
  if (reason === 'king-captured')
    return `${playerOf(game, winner!)} took ${kingOf(game, opposite(winner!))}`;
  if (reason === 'resigned')
    return `${playerOf(game, opposite(winner!))} resigned`;
  return DRAWN[reason];
};

const HEADLINE = { color: '#f0f4f8', fontSize: 38, marginBottom: 16 };

// Under the dice after a roll with nothing to play, in the rules guide's words.
// It is a caption, 20 dp like the others (#168), which keeps it to one line of
// the panel: at 24 dp it took two, and the prompt under it ran into the bottom
// badge (#213). How a game ended is a caption of the same size, under who won
// (#235), so the longest of those, the draw after a hundred moves, keeps to one
// line too.
export const NO_MOVE_LINE = 'No die can be used — the turn passes';
const REASON_LINE = { color: '#aab8c9', fontSize: 20, marginBottom: 12 };

// The single line above the status or menu: mode and turn.
const modeLine = (game: Game, overlayOpen: boolean): string => {
  const name = opponentName(game);
  const turn = `TURN ${game.turn}`;
  if (!name) return `HOT SEAT · ${turn}`;
  if (overlayOpen) return `VS ${name.toUpperCase()} · ${turn}`;
  return turn;
};

// The line over an open menu, which names a game only when there is one to
// name (#234). Over the home screen, and the settings or a confirmation opened
// from it, that is the game Resume would return to: a first launch, or a game
// that has ended, has none. The choice of colour is for a new game, whatever is
// behind it, so it names that game's opponent and no turn.
const menuLine = (game: Game, overlay: Overlay): string | null => {
  if (overlay.kind === 'colour')
    return `VS ${opponentOf(overlay.mode).name.toUpperCase()}`;
  const overHome =
    overlay.kind === 'home' || ('from' in overlay && overlay.from === 'home');
  return overHome && !resumable(game) ? null : modeLine(game, true);
};

// The mode and the turn. Over an open menu it is the only line: a menu, its
// list and the record need the height to stay inside the safe area (#51), and
// the board behind it already shows the game. During play it stands under the
// top of the panel, the bot's dialogue block or the top badge, and those name
// the opponent.
const ModeLine = ({ line }: { line: string }) => (
  <Text style={{ color: '#8dc9b6', fontSize: 20, letterSpacing: 2 }}>
    {line}
  </Text>
);

// Whose move it is and the dice, and why the turn passes when a roll left
// nothing to play; or, once the game is over, who won and how (#235). The
// result of a game against the bot stands above the choice of what comes next
// (#163), and a hotseat result stays on the board.
const Status = ({ game, view }: { game: Game; view: GameView }) => {
  const { result } = game;
  if (result)
    return (
      <>
        <Text style={HEADLINE}>{outcome(game, result)}</Text>
        <Text style={REASON_LINE}>{reasonOf(game, result)}</Text>
      </>
    );
  return (
    <>
      <Text style={HEADLINE}>{headline(game, view)}</Text>
      <Dice
        dice={diceOf(game.roll, view.remaining, view.playable)}
        side={view.side}
      />
      {emptyRoll(game) ? <Text style={REASON_LINE}>{NO_MOVE_LINE}</Text> : null}
    </>
  );
};

// The piece standing on a square, as a word: the board draws no coordinates,
// so a prompt names the piece picked up, not its square (#233).
const pieceOn = (view: GameView, square: string): string => {
  const piece = pieceAt(view.dfen.split(' ')[0], square);
  return piece
    ? DIE[piece.toUpperCase() as keyof typeof DIE].toLowerCase()
    : 'piece';
};

// The opponent is at work on its turn: rolling, deciding or playing. Once the
// turn is over it still owes the handoff, but only waits for its last move to
// be seen, and the screen says the turn is over (#232), not that it plays on.
const botPlaying = (game: Game): boolean =>
  botOwes(game) && game.phase !== 'handoff';

// What OK does now, and Back where a viewer would not guess it, when no menu or
// choice is open. Each hint keeps to one line of the panel (#240): a hint on
// two lines took the room the host's line and the bottom badge need, and the
// arrows need no words on a television. native/test/hints.test.ts holds every
// hint to a width measured on the Virtual Device.
export const promptFor = (
  game: Game,
  view: GameView,
  selected: string | null,
): string => {
  // The board takes no keys while the opponent owes an action.
  if (botOwes(game))
    return botPlaying(game)
      ? `${opponentName(game) ?? 'The computer'} is playing…`
      : 'Your turn next';
  // After the opponent's empty roll, OK passes its turn and rolls the person's.
  if (game.phase === 'roll' || botToAct(game)) return 'OK: roll three dice';
  // OK hands the turn on, so the prompt says to whom (#232): the bot by its
  // name, and in hotseat the colour the remote goes to.
  if (game.phase === 'handoff')
    return `OK: ${playerOf(game, opposite(view.side))}'s turn`;
  if (game.phase === 'ended') return 'OK: back to the menu';
  // A piece in hand is named, not its square, which the board does not label
  // (#233), and OK moves it to the cursor. With the name there is no room on
  // the line for "Back: put down", and Back cancels on any television screen.
  return selected
    ? `OK: move the ${pieceOn(view, selected)} here`
    : 'OK: pick up · Back: menu';
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
  view,
  sound,
  music,
  hasMusic,
  turnHotseat,
  voices,
  host,
  selected,
  pressed,
}: {
  overlay: Overlay;
  game: Game;
  view: GameView;
  sound: boolean;
  music: MusicSetting;
  hasMusic: boolean;
  turnHotseat: boolean;
  voices: boolean;
  host: HostChoice;
  selected: string | null;
  // OK is held: the focused option of an open menu shows it.
  pressed: boolean;
}) => {
  switch (overlay.kind) {
    case 'home':
      return (
        <Choices
          title="Dice Chess"
          options={homeOptions(resumable(game))}
          index={overlay.index}
          pressed={pressed}
        />
      );
    case 'menu':
      return (
        <Choices
          title="Menu"
          options={menuOptions(game)}
          index={overlay.index}
          pressed={pressed}
        />
      );
    case 'settings':
      return (
        <Choices
          title="Settings"
          note={hasMusic ? 'Left and Right change the volume.' : undefined}
          options={settingsOptions(
            sound,
            music,
            hasMusic,
            turnHotseat,
            voices,
            host,
          )}
          index={overlay.index}
          pressed={pressed}
          afters={
            hasMusic
              ? [
                  undefined,
                  <VolumeRings
                    key="rings"
                    volume={music.volume}
                    focused={overlay.index === 1}
                  />,
                ]
              : []
          }
        />
      );
    case 'colour':
      return (
        <Choices
          title={`Play ${opponentOf(overlay.mode).name} as`}
          note="Random picks a colour for you."
          options={colourOptions}
          index={overlay.index}
          pressed={pressed}
        />
      );
    case 'confirm':
      return (
        <Choices
          {...CONFIRM[overlay.action]}
          options={confirmOptions}
          index={overlay.index}
          pressed={pressed}
        />
      );
    case 'result':
      return (
        <Choices
          title="What next?"
          options={resultOptions}
          index={overlay.index}
          pressed={pressed}
        />
      );
    case 'promotion': {
      const befores = overlay.moves.map((move) => {
        const letter =
          view.side === 'w'
            ? move.slice(4).toUpperCase()
            : move.slice(4).toLowerCase();
        const Piece = PIECES[letter as keyof typeof PIECES];
        return Piece ? (
          <View
            key={letter}
            style={{
              width: 38,
              height: 38,
              marginRight: 10,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Piece size={34} />
          </View>
        ) : undefined;
      });
      return (
        <Choices
          title="Promote to"
          options={overlay.moves.map(
            (move) => DIE[move.slice(4).toUpperCase() as keyof typeof DIE],
          )}
          index={overlay.index}
          pressed={pressed}
          befores={befores}
        />
      );
    }
    default:
      return (
        <Text style={{ color: '#f0f4f8', fontSize: 24 }}>
          {promptFor(game, view, selected)}
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
    `playable "${view.playable}"`,
    `legal ${view.legal.length}`,
    `cursor ${focus.cursor}`,
    `selected ${focus.selected ?? '-'}`,
    `last ${game.lastMove ?? '-'}`,
    `result ${game.result?.reason ?? '-'}`,
    `human ${game.human ?? '-'}`,
  ].join(' | ');

type OwnScreenProps = {
  // Leaving returns to the home screen, or starts the game chosen on the
  // tutorial's last screen (#244).
  onExit: (next?: GameChoice | null) => void;
  onState?: (report: string) => void;
  // The game's sounds, for a screen that speaks: Thinkle in the tutorial.
  voice?: Sounds;
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
  initialTurnBoard = false,
  onTurnBoard,
  initialVoices = true,
  onVoices,
  initialHost = DEFAULT_HOST,
  onHost,
  music,
  initialMusic,
  onMusic,
  musicAvailable = false,
  offerTutorial = false,
  onTutorialOffered,
}: GameScreenProps) => {
  const { activity, active } = useActivity();
  const { width, height } = useWindowDimensions();
  const reduce = React.useCallback(
    (state: ScreenState, action: ScreenAction) =>
      screenReducer(state, action, options),
    [options],
  );
  const [
    {
      game,
      focus,
      overlay,
      sound,
      music: musicSetting,
      musicAvailable: hasMusic,
      turnHotseat,
      voices,
      host,
      guarded,
      pending,
    },
    dispatch,
  ] = React.useReducer(reduce, initial, (restored) =>
    initialState(
      options,
      restored,
      {
        sound: initialSound,
        music: initialMusic,
        musicAvailable,
        turnHotseat: initialTurnBoard,
        voices: initialVoices,
        host: initialHost,
      },
      offerTutorial,
    ),
  );
  React.useEffect(() => {
    dispatch({ kind: 'musicAvailable', available: musicAvailable });
  }, [musicAvailable]);
  // OK held down, shown on the focused option of an open menu (#51).
  const [pressed, setPressed] = React.useState(false);
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
  const onPress = React.useCallback((down: boolean) => {
    if (!handsOver.current) setPressed(down);
  }, []);
  const state = React.useMemo(() => viewGame(game), [game]);
  // The pieces the person can move, while it is their choice (#68): straight
  // from the legal list the view already has.
  const movable = React.useMemo(
    () =>
      game.phase === 'move' && !botToAct(game)
        ? movableSquares(state.legal)
        : null,
    [game, state],
  );
  // The cursor frame shows only while the person chooses on the board (#206).
  // Before the roll, at the handoff, on an ended board, on the bot's turn and
  // behind a menu there is nothing to choose, and a frame would suggest a piece
  // is picked before the dice say which may move. After the roll the cursor is
  // already waiting on a movable piece (#68).
  const choosing = overlay.kind === 'none' && movable !== null;

  // Back at the home screen has nowhere to go, so the app agrees to close —
  // what a viewer expects at the top of a TV app. Anywhere else it is ours.
  const onBack = React.useCallback(() => {
    if (handsOver.current) return true; // the tutorial owns it
    if (overlayAtRoot.current) return false;
    dispatch({ kind: 'key', key: 'back' });
    return true;
  }, []);

  useRemoteInput(onKey, { onBack, onPress });

  // The opponent takes one step at a time, scheduled rather than looped, so the
  // player watches it roll and move instead of the board jumping. It is paused
  // while an overlay is up, which is also how leaving play stops it.
  //
  // The first step of a turn needs the whole reply, which the engine works out
  // in one piece. That search starts with the wait, between frames so the roll
  // is already on screen, and counts against it: the first action shows
  // BOT_STEP_MS after the roll, or as soon as the reply is ready if that is
  // later (#253). Nothing about the search changes, only when it runs.
  // The reply is kept with the game it was worked out for, together with how
  // much of the wait has gone, so a menu opened meanwhile neither loses it nor
  // asks again, and what resumes is the rest of the wait, not a new one.
  const thinking = React.useRef<{
    game: Game;
    reply: BotReply | null;
    used: number;
  } | null>(null);
  React.useEffect(() => {
    if (overlay.kind !== 'none' || !botOwes(game)) return;
    let cancelled = false;
    if (game.phase !== 'move' || pending.length) {
      return scheduleActive(
        activity,
        options.schedule,
        () => {
          if (!cancelled) dispatch({ kind: 'bot' });
        },
        BOT_STEP_MS,
        options.now,
      );
    }
    if (thinking.current?.game !== game)
      thinking.current = { game, reply: null, used: 0 };
    const hold = thinking.current;
    const clock = activeClock(activity, options.now ?? (() => 0));
    const began = clock.now();
    let cancelMove: () => void = () => undefined;
    const cancelSearch = scheduleActive(
      activity,
      options.background ?? ((step) => step()),
      () => {
        if (cancelled) return;
        const reply = (hold.reply ??= botReply(game));
        const wait = Math.max(
          0,
          BOT_STEP_MS - hold.used - (clock.now() - began),
        );
        cancelMove = scheduleActive(
          activity,
          options.schedule,
          () => {
            if (!cancelled) dispatch({ kind: 'bot', reply });
          },
          wait,
          options.now,
        );
      },
    );
    return () => {
      cancelled = true;
      cancelSearch();
      cancelMove();
      hold.used += clock.now() - began;
      clock.dispose();
    };
  }, [game, pending, overlay.kind, options, activity]);

  // After a roll with nothing to play, OK comes back once the guard
  // has run out (#85). A menu opened meanwhile does not stop the clock.
  React.useEffect(() => {
    if (!guarded) return;
    let cancelled = false;
    options.schedule(() => {
      if (!cancelled) dispatch({ kind: 'unguard' });
    }, OK_GUARD_MS);
    return () => {
      cancelled = true;
    };
  }, [guarded, options]);

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

  // Seeded like the sound, so opening the screen is not reported as a change.
  const setting = React.useRef(musicSetting);
  React.useEffect(() => {
    if (musicSetting === setting.current) return;
    setting.current = musicSetting;
    onMusic?.(musicSetting);
  }, [musicSetting, onMusic]);

  // Seeded like the sound, so opening the screen is not reported as a change.
  const turnSetting = React.useRef(turnHotseat);
  React.useEffect(() => {
    if (turnHotseat === turnSetting.current) return;
    turnSetting.current = turnHotseat;
    onTurnBoard?.(turnHotseat);
  }, [turnHotseat, onTurnBoard]);

  // Seeded like the sound, so opening the screen is not reported as a change.
  const voiceSetting = React.useRef(voices);
  React.useEffect(() => {
    if (voices === voiceSetting.current) return;
    voiceSetting.current = voices;
    onVoices?.(voices);
  }, [voices, onVoices]);

  // The offer of the tutorial is answered as soon as the screen leaves it, for
  // the tutorial, the home screen or Back (#244). Reported once.
  const offered = React.useRef(overlay.kind === 'offer');
  React.useEffect(() => {
    if (!offered.current || overlay.kind === 'offer') return;
    offered.current = false;
    onTutorialOffered?.();
  }, [overlay.kind, onTutorialOffered]);

  // Seeded like the sound, so opening the screen is not reported as a change.
  const hostSetting = React.useRef(host);
  React.useEffect(() => {
    if (host === hostSetting.current) return;
    hostSetting.current = host;
    onHost?.(host);
  }, [host, onHost]);

  // The theme for what the screen shows, and over a game the danger to the king
  // at the start of this turn (#76). When a game has just ended the music falls
  // silent first, so the result's jingle is heard on its own.
  const level = useDanger(game, options.background, onState);
  // A bot's line is said as it shows, and its bubble stays until it has been
  // said (#159). The host's is only said (#202).
  const say = React.useCallback(
    (line: SpokenLine) => sounds?.say(line),
    [sounds],
  );
  const stopLine = React.useCallback(() => sounds?.stopLine(), [sounds]);
  // Lines are picked only while the board is on screen (#202), so a game
  // waiting behind the home screen says nothing. A bot's last word is said with
  // the result over the board.
  const live = active && overlay.kind === 'none';
  const voiceLine = useBotVoice(game, level, {
    onVoiceLine: say,
    holdMs: bubbleHoldMs,
    live: active && (live || overlay.kind === 'result'),
  });
  // The Hot Seat host (#202): her line is said, and shown with her portrait
  // above the bottom badge while it lasts (#213). The bot's hook speaks only
  // against the bot and this one only in hotseat, so at most one of them has a
  // line. A line of hers holds as long as a bot's bubble would, until it has
  // been said, and the next one waits for it. Turned off mid-line, she stops
  // talking and leaves the screen.
  const hostLine = useHostVoice(game, {
    live,
    on: host !== 'off',
    host: host === 'off' ? DEFAULT_HOST : host,
    onVoiceLine: say,
    onStop: stopLine,
    holdMs: bubbleHoldMs,
  });
  const role = musicRole(overlay, game, level);
  const lastRole = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!music || role === lastRole.current) return;
    const ended =
      game.phase === 'ended' &&
      lastRole.current !== null &&
      lastRole.current !== 'menu';
    lastRole.current = role;
    music.setRole(role, ended ? RESULT_SILENCE_MS : 0);
    const pause = ended ? ` after ${RESULT_SILENCE_MS} ms` : '';
    onState?.(`music ${role}${pause}`);
  }, [music, role, game.phase, onState]);

  React.useEffect(() => {
    onState?.(report(game, state, focus, overlay));
  }, [onState, game, state, focus, overlay]);

  // Leaving a screen of its own goes back to the home screen, or into the game
  // chosen on the tutorial's last screen (#244).
  const leave = React.useCallback((next?: GameChoice | null) => {
    dispatch(
      next ? { kind: 'newGame', ...next } : { kind: 'key', key: 'back' },
    );
  }, []);

  // The tutorial, the rules and About are screens of their own, with their own
  // state, and this one hands over entirely rather than drawing a board behind.
  if (handsOff(overlay)) {
    const Screen = OWN_SCREENS[overlay.kind];
    return <Screen onExit={leave} onState={onState} voice={sounds} />;
  }

  // The choice of opponent takes the whole screen: three cards need the width
  // the board would take. The remote stays with this screen and its reducer.
  if (overlay.kind === 'opponent')
    return (
      <OpponentScreen index={overlay.index} pressed={pressed} ledger={ledger} />
    );

  const size = boardSide(width, height);
  const insets = safeInsets(width, height);
  // The result of a game against the bot is drawn in the matchup HUD like the
  // game itself, so the bot's last word shows under its badge (#163).
  const result = overlay.kind === 'result' ? game.result : null;
  const overMenu = menuLine(game, overlay);
  const isFlipped = flipped(game, turnHotseat);
  const screen = {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: THEME.background,
    alignItems: 'center',
    paddingHorizontal: insets.x,
    paddingVertical: insets.y,
  } as const;
  const board = (
    <Board
      size={size}
      board={state.dfen.split(' ')[0]}
      legal={state.legal}
      lastMove={game.lastMove}
      selected={focus.selected}
      cursor={choosing ? focus.cursor : null}
      flipped={isFlipped}
      movable={movable}
    />
  );

  // The offer of the tutorial on a first launch (#244) stands level with the
  // board, as the tutorial's panel does, since it shows Thinkle as the lessons
  // do.
  if (overlay.kind === 'offer')
    return (
      <View style={screen}>
        {board}
        <View
          style={{ flex: 1, height: drawnSide(size), paddingLeft: BOARD_GAP }}
        >
          <TutorialOffer
            index={overlay.index}
            pressed={pressed}
            voice={sounds}
          />
        </View>
      </View>
    );

  return (
    <View style={screen}>
      {board}
      <View style={{ flex: 1, height: size, paddingLeft: BOARD_GAP }}>
        {overlay.kind !== 'none' && !result ? (
          <>
            {overMenu ? <ModeLine line={overMenu} /> : null}
            <Panel
              overlay={overlay}
              game={game}
              view={state}
              sound={sound}
              music={musicSetting}
              hasMusic={hasMusic}
              turnHotseat={turnHotseat}
              voices={voices}
              host={host}
              selected={focus.selected}
              pressed={pressed}
            />
          </>
        ) : (
          // Anchored at the top: the headline, the dice and the prompt keep
          // their place whatever the prompt's length (#168).
          <Matchup
            game={game}
            side={state.side}
            flipped={isFlipped}
            thinking={botPlaying(game)}
            speechBubble={
              voiceLine ? <SpeechBubble text={voiceLine.text} /> : undefined
            }
            hostBubble={
              hostLine ? (
                <SpeechBubble text={hostLine.text} rows={HOST_BUBBLE_ROWS} />
              ) : undefined
            }
            host={hostLine?.host}
            header={<ModeLine line={modeLine(game, false)} />}
          >
            <Status game={game} view={state} />
            <Panel
              overlay={overlay}
              game={game}
              view={state}
              sound={sound}
              music={musicSetting}
              hasMusic={hasMusic}
              turnHotseat={turnHotseat}
              voices={voices}
              host={host}
              selected={focus.selected}
              pressed={pressed}
            />
          </Matchup>
        )}
      </View>
    </View>
  );
};
