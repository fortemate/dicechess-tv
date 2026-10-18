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
  type Game,
  type GameView,
} from '../../src/core/game';
import {
  NO_MOVE_LINE,
  opponentName,
  outcome,
  playerOf,
  reasonOf,
  squareLabel,
  turnOver,
} from '../../src/core/announcements';
import { OPPONENTS, opponentOf } from '../../src/core/opponents';
import { pieceAt } from '../../src/core/board';
import { boardView } from '../../src/core/boardView';
import { movableSquares, type BoardKey } from '../../src/core/boardInput';
import { Board } from './Board';
import { Dice } from './Dice';
import { diceOf } from '../../src/core/dice';
import { TutorialScreen } from './TutorialScreen';
import { TutorialOffer } from './TutorialOffer';
import { RulesScreen } from './RulesScreen';
import { AboutScreen } from './AboutScreen';
import {
  OPPONENT_TITLE,
  OpponentScreen,
  cardLabel,
  opponentHint,
} from './OpponentScreen';
import { Matchup } from './Matchup';
import { HOST_BUBBLE_ROWS, SpeechBubble } from './SpeechBubble';
import { DISMISS_DELAY_MS, useBotVoice } from './useBotVoice';
import { useHostVoice } from './useHostVoice';
import { DEFAULT_HOST, type HostChoice } from './hostSetting';
import { DEFAULT_PLAY_AS, type PlayAs } from './playAsSetting';
import { DEFAULT_HIGHLIGHTS, type HighlightStyle } from './highlightsSetting';
import {
  LINE_START_MS,
  speechTiming,
  type Sounds,
  type SpokenLine,
} from './sound';
import type { Music } from './music';
import { MUSIC_STEPS, musicHeard, type MusicSetting } from './musicSetting';
import { DEFAULT_SOUND, soundHeard, type SoundSetting } from './soundSetting';
import { DEFAULT_VOICES, voicesHeard, type VoiceSetting } from './voiceSetting';
import { useDanger } from './useDanger';
import { activeClock, scheduleActive, useActivity } from './activity';
import { cues } from '../../src/core/cues';
import { useRemoteInput } from './useRemoteInput';
import { THEME } from './theme';
import { PIECES } from './pieces';
import { Option } from './Option';
import { settingsHint } from './settingsHint';
import { BOARD_GAP, boardSide, drawnSide, safeInsets } from './layout';
import { announce, useScreenReader } from './announcer';
import {
  screenSpeech,
  spokenHint,
  type Choice,
  type Heard,
} from './screenSpeech';
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
  offerOptions,
  flipped,
  handsOff,
  botOwes,
  autoChoice,
  AUTO_SELECT_MS,
  BOT_STEP_MS,
  OK_GUARD_MS,
  type GameChoice,
  type LastDice,
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
  // Diagnostic seam for device checks. Vega has no screenshot command and a
  // Release build does not route console output anywhere readable, so the only
  // way to know what the screen shows is to let it say so.
  onState?: (report: string) => void;
  // What each step of the game sounds like is decided here; whether it is heard
  // and on what is the player's business.
  sounds?: Sounds;
  // Whether sound starts on and its volume, read before the first render like the saved game.
  initialSound?: SoundSetting;
  // Called when the settings change sound, so the app can save the choice.
  onSound?: (sound: SoundSetting) => void;
  // Whether the board turns to the side to move in hotseat (#120).
  initialTurnBoard?: boolean;
  onTurnBoard?: (on: boolean) => void;
  // Whether the lines are spoken aloud and how loud (#159, #398).
  initialVoices?: VoiceSetting;
  onVoices?: (voices: VoiceSetting) => void;
  // Who hosts Hot Seat games, or 'off' (#202).
  initialHost?: HostChoice;
  onHost?: (host: HostChoice) => void;
  // Whether OK presses itself when the board offers only one choice (#302).
  initialAutoSelect?: boolean;
  onAutoSelect?: (on: boolean) => void;
  // The colour a person plays against the computer, or Ask (#345).
  initialPlayAs?: PlayAs;
  onPlayAs?: (choice: PlayAs) => void;
  // How the board marks movable pieces, the picked-up piece, legal
  // destinations, the target under the cursor and the cursor (#404).
  initialHighlights?: HighlightStyle;
  onHighlights?: (choice: HighlightStyle) => void;
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
  description,
  options,
  index,
  pressed = false,
  befores = [],
  afters = [],
}: {
  title: string;
  note?: string;
  description?: string;
  options: readonly string[];
  index: number;
  // OK is held on the focused option.
  pressed?: boolean;
  // Drawn before an option's label, by position.
  befores?: (React.ReactNode | undefined)[];
  // Drawn after an option's label, by position.
  afters?: (React.ReactNode | undefined)[];
}) => (
  <View style={{ marginTop: 12 }}>
    {/* No heading role, here or on the other screens' titles: VoiceView reads
        a heading by itself as it appears, and on the Virtual Device that cut
        off the result announced just before it (#257). The title is
        announced with the menu instead (screenSpeech.ts). */}
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
    {description !== undefined ? (
      <Text
        style={{
          color: '#aab8c9',
          fontSize: 20,
          lineHeight: 24,
          minHeight: 24,
          marginTop: 10,
        }}
      >
        {description}
      </Text>
    ) : null}
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

const HEADLINE = { color: '#f0f4f8', fontSize: 38, marginBottom: 16 };

// Under the dice after a roll with nothing to play, in the rules guide's words,
// which a screen reader is told too (#257). It is a caption, 20 dp like the others (#168), which keeps it to one line of
// the panel: at 24 dp it took two, and the prompt under it ran into the bottom
// badge (#213). How a game ended is a caption of the same size, under who won
// (#235), so the longest of those, the draw after a hundred moves, keeps to one
// line too.
export { NO_MOVE_LINE };
const REASON_LINE = { color: '#aab8c9', fontSize: 20, marginBottom: 12 };

// The single line above the status or menu: mode and turn. Exported for the
// test that holds it to one line of the panel.
export const modeLine = (game: Game, overlayOpen: boolean): string => {
  const name = opponentName(game);
  const turn = `TURN ${game.turn}`;
  if (!name) return `FRIEND GAME · ${turn}`;
  if (overlayOpen) return `VS ${name.toUpperCase()} · ${turn}`;
  return turn;
};

// The line over an open menu, which names a game only when there is one to
// name (#234). Over the home screen, and the settings or a confirmation opened
// from it, that is the game Resume would return to: a first launch, or a game
// that has ended, has none. The choice of colour is for a new game, whatever is
// behind it, so it names that game's opponent and no turn.
const menuLine = (
  game: Game,
  overlay: Overlay,
  resumableGame: boolean,
): string | null => {
  if (overlay.kind === 'colour')
    return `VS ${opponentOf(overlay.mode).name.toUpperCase()}`;
  const overHome =
    overlay.kind === 'home' || ('from' in overlay && overlay.from === 'home');
  return overHome && !resumableGame ? null : modeLine(game, true);
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
const Status = ({
  game,
  view,
  lastDice,
}: {
  game: Game;
  view: GameView;
  lastDice?: LastDice | null;
}) => {
  const { result } = game;
  if (result)
    return (
      <>
        <Text style={HEADLINE}>{outcome(game, result)}</Text>
        <Text style={REASON_LINE}>{reasonOf(game, result)}</Text>
      </>
    );
  const dice =
    game.roll.length > 0
      ? diceOf(game.roll, view.remaining, view.playable)
      : (lastDice?.dice ?? []);
  const side = game.roll.length > 0 ? view.side : (lastDice?.side ?? view.side);
  return (
    <>
      <Text style={HEADLINE}>{headline(game, view)}</Text>
      <Dice dice={dice} side={side} />
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
const boardActivity = (active: boolean, kind: Overlay['kind']) => ({
  live: active && kind === 'none',
  voiceLive: active && (kind === 'none' || kind === 'result'),
});

const botPlaying = (game: Game): boolean =>
  botOwes(game) && game.phase !== 'handoff';

// What OK does now, and Back where a viewer would not guess it, when no menu or
// choice is open. When OK is about to press itself on the only choice (#302),
// the hint says why, and that Back stops it. Each hint keeps to one line of the
// panel (#240): a hint on two lines took the room the host's line and the
// bottom badge need, and the arrows need no words on a television.
// native/test/hints.test.ts holds every hint to a width measured on the Virtual
// Device.
export const promptFor = (
  game: Game,
  view: GameView,
  selected: string | null,
  auto = false,
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
  if (auto) return AUTO_PROMPT;
  // A piece in hand is named, not its square, which the board does not label
  // (#233), and OK moves it to the cursor. With the name there is no room on
  // the line for "Back: put down", and Back cancels on any television screen.
  return selected
    ? `OK: move the ${pieceOn(view, selected)} here`
    : 'OK: pick up · Back: menu';
};

export const AUTO_PROMPT = 'Only one choice · Back: stop';

// A prompt worth saying aloud asks for a press (#257). The others say the
// opponent is playing, which the steps of its turn already say.
const asksForPress = (prompt: string): boolean =>
  prompt.startsWith('OK:') || prompt === AUTO_PROMPT;

// The square under the cursor as a screen reader is told it, with the marks
// the board draws on it (#257).
const cursorLabel = (
  view: GameView,
  focus: ScreenState['focus'],
  movable: readonly string[] | null,
): string | null => {
  const square = boardView({
    board: view.dfen.split(' ')[0],
    cursor: focus.cursor,
    selected: focus.selected,
    legal: view.legal,
    movable,
  })
    .flat()
    .find((each) => each.cursor);
  return square ? squareLabel(square) : null;
};

const CONFIRM = {
  resign: { title: 'Resign?', note: 'The other player wins.' },
  replace: {
    title: 'Replace this game?',
    note: 'The game in progress is lost.',
  },
} as const;

// What the open menu or choice depends on, beyond the overlay itself.
type ChoiceContext = {
  game: Game;
  resumableGame: boolean;
  sound: SoundSetting;
  music: MusicSetting;
  hasMusic: boolean;
  turnHotseat: boolean;
  voices: VoiceSetting;
  host: HostChoice;
  autoSelect: boolean;
  playAs: PlayAs;
  highlights: HighlightStyle;
};

// What an open menu or choice shows: its title, a note, its options and the
// focused one. The panel draws it, the choice of opponent and the offer of the
// tutorial draw their own, and a screen reader is told it (#257). Null on the
// board and on the screens that take over.
const choiceOf = (overlay: Overlay, context: ChoiceContext): Choice | null => {
  switch (overlay.kind) {
    case 'home':
      return {
        title: 'Dice Chess',
        options: homeOptions(context.resumableGame),
        index: overlay.index,
      };
    case 'offer':
      return {
        title: 'Dice Chess',
        options: offerOptions,
        index: overlay.index,
      };
    case 'menu':
      return {
        title: 'Menu',
        options: menuOptions(context.game),
        index: overlay.index,
      };
    case 'settings': {
      const options = settingsOptions({
        sound: context.sound,
        music: context.music,
        musicAvailable: context.hasMusic,
        turnHotseat: context.turnHotseat,
        voices: context.voices,
        host: context.host,
        autoSelect: context.autoSelect,
        playAs: context.playAs,
        highlights: context.highlights,
      });
      return {
        title: 'Settings',
        ...settingsHint(options[overlay.index] ?? ''),
        options,
        index: overlay.index,
      };
    }
    case 'opponent':
      return {
        title: OPPONENT_TITLE,
        note: spokenHint(opponentHint(context.playAs)),
        options: OPPONENTS.map(cardLabel),
        index: overlay.index,
      };
    case 'colour':
      return {
        title: `Play ${opponentOf(overlay.mode).name} as`,
        note: 'Random picks a color for you.',
        options: colourOptions,
        index: overlay.index,
      };
    case 'confirm':
      return {
        ...CONFIRM[overlay.action],
        options: confirmOptions,
        index: overlay.index,
      };
    case 'result':
      return {
        title: 'What next?',
        options: resultOptions,
        index: overlay.index,
      };
    case 'promotion':
      return {
        title: 'Promote to',
        options: overlay.moves.map(
          (move) => DIE[move.slice(4).toUpperCase() as keyof typeof DIE],
        ),
        index: overlay.index,
      };
    default:
      return null;
  }
};

// What sits under the status: an open menu or choice, or the prompt.
const settingsAfters = (
  index: number,
  context: ChoiceContext,
): React.ReactNode[] => {
  const musicOffset = context.hasMusic ? 1 : 0;
  const soundRing = (
    <VolumeRings
      key="sound-rings"
      volume={soundHeard(context.sound) ? context.sound.volume : 0}
      focused={index === musicOffset}
    />
  );
  const voiceRing = (
    <VolumeRings
      key="voice-rings"
      volume={voicesHeard(context.voices) ? context.voices.volume : 0}
      focused={index === musicOffset + 1}
    />
  );
  if (!context.hasMusic) return [soundRing, voiceRing];
  return [
    <VolumeRings
      key="music-rings"
      volume={musicHeard(context.music) ? context.music.volume : 0}
      focused={index === 0}
    />,
    soundRing,
    voiceRing,
  ];
};

const Panel = ({
  overlay,
  view,
  context,
  auto,
  selected,
  pressed,
}: {
  overlay: Overlay;
  view: GameView;
  context: ChoiceContext;
  // Whether OK is about to press itself now (#302).
  auto: boolean;
  selected: string | null;
  // OK is held: the focused option of an open menu shows it.
  pressed: boolean;
}) => {
  const choice = choiceOf(overlay, context);
  if (!choice)
    return (
      <Text style={{ color: '#f0f4f8', fontSize: 24 }}>
        {promptFor(context.game, view, selected, auto)}
      </Text>
    );
  if (overlay.kind === 'settings') {
    return (
      <Choices
        {...choice}
        pressed={pressed}
        afters={settingsAfters(overlay.index, context)}
      />
    );
  }
  if (overlay.kind === 'promotion') {
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
    return <Choices {...choice} pressed={pressed} befores={befores} />;
  }
  return <Choices {...choice} pressed={pressed} />;
};

// One line saying what the screen shows, for device checks.
const report = (
  game: Game,
  view: GameView,
  focus: ScreenState['focus'],
  overlay: Overlay,
  auto: string | null,
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
    `auto ${auto ?? '-'}`,
  ].join(' | ');

type OwnScreenProps = {
  // Leaving returns to the home screen, or starts the game chosen on the
  // tutorial's last screen (#244).
  onExit: (next?: GameChoice | null) => void;
  onState?: (report: string) => void;
  // The game's sounds, for a screen that speaks: Thinkle in the tutorial.
  voice?: Sounds;
  highlights?: HighlightStyle;
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
  onState,
  sounds,
  initialSound = DEFAULT_SOUND,
  onSound,
  initialTurnBoard = false,
  onTurnBoard,
  initialVoices = DEFAULT_VOICES,
  onVoices,
  initialHost = DEFAULT_HOST,
  onHost,
  initialAutoSelect = false,
  onAutoSelect,
  initialPlayAs = DEFAULT_PLAY_AS,
  onPlayAs,
  initialHighlights = DEFAULT_HIGHLIGHTS,
  onHighlights,
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
  const [screenState, dispatch] = React.useReducer(
    reduce,
    initial,
    (restored) =>
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
          autoSelect: initialAutoSelect,
          playAs: initialPlayAs,
          highlights: initialHighlights,
        },
        offerTutorial,
      ),
  );
  const {
    game,
    focus,
    overlay,
    sound,
    music: musicSetting,
    musicAvailable: hasMusic,
    turnHotseat,
    voices,
    host,
    autoSelect,
    playAs,
    highlights,
    guarded,
    pending,
    lastDice,
    resumable: screenResumable,
  } = screenState;
  React.useEffect(() => {
    dispatch({ kind: 'musicAvailable', available: musicAvailable });
  }, [musicAvailable]);
  // OK held down, shown on the focused option of an open menu (#51).
  const [pressed, setPressed] = React.useState(false);
  // Whether the opponent search is currently running past one step wait (#261).
  const [searching, setSearching] = React.useState(false);
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
  const onKey = React.useCallback((key: BoardKey, repeat: boolean) => {
    if (handsOver.current) return;
    dispatch({ kind: 'key', key, repeat });
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
  // The square OK is about to press itself on, when the board offers only one
  // choice and the setting is on (#302).
  const auto = React.useMemo(
    () => autoChoice(screenState, state.legal),
    [screenState, state],
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

  useRemoteInput(onKey, {
    onBack,
    onPress,
    scope: `${overlay.kind}:${game.phase}:${focus.selected ?? '-'}`,
  });

  // The opponent takes one step at a time, scheduled rather than looped, so the
  // player watches it roll and move instead of the board jumping. It is paused
  // while an overlay is up, which is also how leaving play stops it.
  //
  // The first step of a turn needs the whole reply, which the engine works out
  // in one piece. That search starts with the wait, through an asynchronous
  // reply interface (#261), and counts against it: the first action shows
  // BOT_STEP_MS after the roll, or as soon as the reply is ready if that is
  // later (#253). While the reply is awaited past the step wait, the screen
  // shows that the opponent is thinking; nothing is shown for a reply that
  // arrives within one step wait.
  // The reply is kept with the game it was worked out for, together with how
  // much of the wait has gone, so a menu opened meanwhile neither loses it nor
  // asks again, and what resumes is the rest of the wait, not a new one.
  const thinking = React.useRef<{
    game: Game;
    reply: BotReply | null;
    used: number;
    done: boolean;
    promise: Promise<BotReply | undefined> | null;
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
      thinking.current = {
        game,
        reply: null,
        used: 0,
        done: false,
        promise: null,
      };
    const hold = thinking.current;
    const clock = activeClock(activity, options.now ?? (() => 0));
    const began = clock.now();
    let cancelTimer: () => void = () => undefined;

    if (options.reply) {
      if (!hold.promise) {
        try {
          hold.promise = Promise.resolve(options.reply(game))
            .then((rep) => {
              hold.reply = rep;
              hold.done = true;
              return rep;
            })
            .catch(() => {
              hold.done = true;
              return undefined;
            });
        } catch {
          hold.done = true;
          hold.promise = Promise.resolve(undefined);
        }
      }

      const wait = Math.max(0, BOT_STEP_MS - hold.used);
      let waitDone = wait === 0;
      let searchDone = hold.done;

      const maybeAdvance = () => {
        if (cancelled) return;
        if (waitDone && searchDone) {
          setSearching(false);
          dispatch({ kind: 'bot', reply: hold.reply ?? undefined });
        } else if (waitDone && !searchDone) {
          setSearching(true);
        }
      };

      if (wait > 0) {
        cancelTimer = scheduleActive(
          activity,
          options.schedule,
          () => {
            if (cancelled) return;
            waitDone = true;
            maybeAdvance();
          },
          wait,
          options.now,
        );
      } else {
        maybeAdvance();
      }

      void hold.promise.then(() => {
        if (cancelled) return;
        searchDone = true;
        maybeAdvance();
      });

      return () => {
        cancelled = true;
        cancelTimer();
        hold.used += clock.now() - began;
        clock.dispose();
        setSearching(false);
      };
    }

    let cancelMove: () => void = () => undefined;
    const cancelSearch = scheduleActive(
      activity,
      options.background ?? ((step) => step()),
      () => {
        if (cancelled) return;
        let reply: BotReply | undefined;
        try {
          reply = hold.reply ??= botReply(game);
        } catch {
          // No reply: the reducer asks for one itself.
        }
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

  // OK presses itself on the only choice (#302) one step at a time, at the
  // opponent's pace, so a chain of them is watched rather than jumped over, and
  // only while the app is in front. Each press names the state it was
  // scheduled for: one the person has pressed past, or moved on from, is
  // dropped, and the next is scheduled for what the screen shows then.
  React.useEffect(() => {
    if (auto === null) return;
    const revision = game.revision;
    const selected = focus.selected;
    return scheduleActive(
      activity,
      options.schedule,
      () => dispatch({ kind: 'auto', revision, selected }),
      AUTO_SELECT_MS,
      options.now,
    );
  }, [auto, game.revision, focus.selected, options, activity]);

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
    sounds?.play(cues(before, game));
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
  const autoSetting = React.useRef(autoSelect);
  React.useEffect(() => {
    if (autoSelect === autoSetting.current) return;
    autoSetting.current = autoSelect;
    onAutoSelect?.(autoSelect);
  }, [autoSelect, onAutoSelect]);

  // Seeded like the sound, so opening the screen is not reported as a change.
  const playAsSetting = React.useRef(playAs);
  React.useEffect(() => {
    if (playAs === playAsSetting.current) return;
    playAsSetting.current = playAs;
    onPlayAs?.(playAs);
  }, [playAs, onPlayAs]);

  // Seeded like the sound, so opening the screen is not reported as a change.
  const highlightsSetting = React.useRef(highlights);
  React.useEffect(() => {
    if (highlights === highlightsSetting.current) return;
    highlightsSetting.current = highlights;
    onHighlights?.(highlights);
  }, [highlights, onHighlights]);

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
  // silent first, so the result's jingle is heard on its own. With no music
  // heard, only the opponent's threat line needs the level (#368).
  const level = useDanger(
    game,
    options.background,
    hasMusic && musicHeard(musicSetting),
    onState,
  );
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
  const { live, voiceLive } = boardActivity(active, overlay.kind);
  const voiceLine = useBotVoice(game, level, {
    onVoiceLine: say,
    holdMs: bubbleHoldMs,
    live: voiceLive,
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
    onState?.(report(game, state, focus, overlay, auto));
  }, [onState, game, state, focus, overlay, auto]);

  // A screen reader is told what changed (#257): a step of the game, where
  // focus went in a menu, and on the board the prompt and the square under the
  // cursor (screenSpeech.ts). Worked out only while one is on. The screens that
  // take over say their own, and coming back from one opens the menu afresh.
  const reader = useScreenReader();
  const resumableGame = screenResumable && game.phase !== 'ended';
  const context: ChoiceContext = {
    game,
    resumableGame,
    sound,
    music: musicSetting,
    hasMusic,
    turnHotseat,
    voices,
    host,
    autoSelect,
    playAs,
    highlights,
  };
  const told = React.useRef<Heard | null>(null);
  const listening = reader && !handsOff(overlay);
  React.useEffect(() => {
    if (!listening) {
      told.current = null;
      return;
    }
    const prompt =
      overlay.kind === 'none'
        ? promptFor(game, state, focus.selected, auto !== null)
        : null;
    const now: Heard = {
      game,
      choice: choiceOf(overlay, context),
      prompt: prompt && asksForPress(prompt) ? prompt : null,
      cursor: choosing ? cursorLabel(state, focus, movable) : null,
    };
    announce(screenSpeech(told.current, now));
    told.current = now;
  });

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
    return (
      <Screen
        onExit={leave}
        onState={onState}
        voice={sounds}
        highlights={highlights}
      />
    );
  }

  // The choice of opponent takes the whole screen: three cards need the width
  // the board would take. The remote stays with this screen and its reducer.
  if (overlay.kind === 'opponent')
    return (
      <OpponentScreen index={overlay.index} pressed={pressed} playAs={playAs} />
    );

  const size = boardSide(width, height);
  const insets = safeInsets(width, height);
  // The result of a game against the bot is drawn in the matchup HUD like the
  // game itself, so the bot's last word shows under its badge (#163).
  const result = overlay.kind === 'result' ? game.result : null;
  const overMenu = menuLine(game, overlay, resumableGame);
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
      highlights={highlights}
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
              view={state}
              context={context}
              auto={auto !== null}
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
            thinking={options.reply ? searching : botPlaying(game)}
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
            <Status game={game} view={state} lastDice={lastDice} />
            <Panel
              overlay={overlay}
              view={state}
              context={context}
              auto={auto !== null}
              selected={focus.selected}
              pressed={pressed}
            />
          </Matchup>
        )}
      </View>
    </View>
  );
};
