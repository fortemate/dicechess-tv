// The native game screen: a board, a panel, and the overlays the remote opens.
//
// All flow lives in screen.ts as a pure reducer; this file only draws what that
// reducer says and hands key presses to it.
import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import {
  viewGame,
  sideName,
  emptyRoll,
  isBotMode,
  type Game,
  type Result,
} from '../../src/core/game';
import { opponentOf } from '../../src/core/opponents';
import type { Ledger } from '../../src/core/ledger';
import { movableSquares, type BoardKey } from '../../src/core/boardInput';
import { Board } from './Board';
import { Dice } from './Dice';
import { diceOf } from '../../src/core/dice';
import { TutorialScreen } from './TutorialScreen';
import { RulesScreen } from './RulesScreen';
import { AboutScreen } from './AboutScreen';
import { OpponentScreen } from './OpponentScreen';
import { Matchup } from './Matchup';
import { SpeechBubble } from './SpeechBubble';
import { DISMISS_DELAY_MS, useBotVoice } from './useBotVoice';
import type { VoiceLine } from '../../src/core/botVoice';
import { LINE_START_MS, speechTiming, type Sounds } from './sound';
import type { Music } from './music';
import { MUSIC_STEPS, type MusicSetting } from './musicSetting';
import { useDanger } from './useDanger';
import { cues } from '../../src/core/cues';
import { useRemoteInput } from './useRemoteInput';
import { THEME } from './theme';
import { Option } from './Option';
import { BOARD_GAP, boardSide, safeInsets } from './layout';
import { botToAct } from '../../src/core/bot';
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
  // Called when the settings change sound, so the app can save the choice.
  onSound?: (on: boolean) => void;
  // Whether the board turns to the side to move in hotseat (#120).
  initialTurnBoard?: boolean;
  onTurnBoard?: (on: boolean) => void;
  // Whether the bots speak their lines aloud (#159).
  initialVoices?: boolean;
  onVoices?: (on: boolean) => void;
  // The adaptive music (#76). The screen says which theme fits what it shows;
  // whether music is on and how loud is the app's to apply and save.
  music?: Music;
  initialMusic?: MusicSetting;
  onMusic?: (music: MusicSetting) => void;
  // Whether the build has music, which the app learns after launch.
  musicAvailable?: boolean;
};

// How long the music stays silent after a game ends, so the result's jingle is
// heard on its own before the menu theme returns.
export const RESULT_SILENCE_MS = 2500;

// A bubble stays its usual time, or until its line has been said (#159),
// counting the moment the player takes to start the clip (#187).
const bubbleHoldMs = (line: VoiceLine): number => {
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
  afters = [],
}: {
  title: string;
  note?: string;
  options: string[];
  index: number;
  // OK is held on the focused option.
  pressed?: boolean;
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
    return `${sideName(view.side)} to play${mover(game, view.bot)}`;
  const name = opponentName(game);
  return view.bot && name
    ? `${name} can't move`
    : `No legal moves${mover(game, view.bot)}`;
};

// Who the person plays: nobody in hotseat, else the opponent's name.
const opponentName = (game: Game): string | null =>
  isBotMode(game.mode) ? opponentOf(game.mode).name : null;

type GameView = ReturnType<typeof viewGame>;

// The line under the headline: who won, or the dice still to use.
const winnerLine = (result: Result): string =>
  result.winner ? `${sideName(result.winner)} wins` : 'Drawn';
const HEADLINE = { color: '#f0f4f8', fontSize: 38, marginBottom: 16 };
const STATUS_LINE = { color: '#aab8c9', fontSize: 24, marginBottom: 12 };

// Under the dice after a roll with nothing to play, in the rules guide's words.
export const NO_MOVE_LINE = 'No die can be used — the turn passes';

// The single line above the status or menu: mode and turn.
const modeLine = (game: Game, overlayOpen: boolean): string => {
  const name = opponentName(game);
  const turn = `TURN ${game.turn}`;
  if (!name) return `HOTSEAT · ${turn}`;
  if (overlayOpen) return `VS ${name.toUpperCase()} · ${turn}`;
  return turn;
};

// The mode and the turn. Over an open menu it is the only line: a menu, its
// list and the record need the height to stay inside the safe area (#51), and
// the board behind it already shows the game. During play it stands under the
// top badge, at the foot of the bot's speech zone in a game against the bot,
// and the badges name the opponent.
const ModeLine = ({
  game,
  overlayOpen,
}: {
  game: Game;
  overlayOpen: boolean;
}) => (
  <Text style={{ color: '#8dc9b6', fontSize: 20, letterSpacing: 2 }}>
    {modeLine(game, overlayOpen)}
  </Text>
);

// How the game ended or whose move it is; then the winner or the dice, and why
// the turn passes when a roll left nothing to play. It also shows the result of
// a game against the bot, above the choice of what comes next (#163).
const Status = ({ game, view }: { game: Game; view: GameView }) => {
  const { result } = game;
  return (
    <>
      <Text style={HEADLINE}>
        {result ? RESULT[result.reason] : headline(game, view)}
      </Text>
      {result ? (
        <Text style={STATUS_LINE}>{winnerLine(result)}</Text>
      ) : (
        <Dice
          dice={diceOf(game.roll, view.remaining, view.playable)}
          side={view.side}
        />
      )}
      {!result && emptyRoll(game) ? (
        <Text style={STATUS_LINE}>{NO_MOVE_LINE}</Text>
      ) : null}
    </>
  );
};

// What OK and the arrows do now, when no menu or choice is open.
const promptFor = (game: Game, selected: string | null): string => {
  // The board takes no keys while the opponent owes an action.
  if (botOwes(game))
    return `${opponentName(game) ?? 'The computer'} is playing…`;
  // After the opponent's empty roll, OK passes its turn and rolls the person's.
  if (game.phase === 'roll' || botToAct(game)) return 'OK: roll three dice';
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
  music,
  hasMusic,
  turnHotseat,
  voices,
  selected,
  pressed,
}: {
  overlay: Overlay;
  game: Game;
  sound: boolean;
  music: MusicSetting;
  hasMusic: boolean;
  turnHotseat: boolean;
  voices: boolean;
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
          options={settingsOptions(sound, music, hasMusic, turnHotseat, voices)}
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
    case 'promotion':
      return (
        <Choices
          title="Promote to"
          options={overlay.moves.map(
            (move) => DIE[move.slice(4).toUpperCase() as keyof typeof DIE],
          )}
          index={overlay.index}
          pressed={pressed}
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
    `playable "${view.playable}"`,
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
  initialTurnBoard = false,
  onTurnBoard,
  initialVoices = true,
  onVoices,
  music,
  initialMusic,
  onMusic,
  musicAvailable = false,
}: GameScreenProps) => {
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
      guarded,
    },
    dispatch,
  ] = React.useReducer(reduce, initial, (restored) =>
    initialState(
      options,
      restored,
      initialSound,
      initialMusic,
      musicAvailable,
      initialTurnBoard,
      initialVoices,
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
  React.useEffect(() => {
    if (overlay.kind !== 'none' || !botOwes(game)) return;
    let cancelled = false;
    options.schedule(() => {
      if (!cancelled) dispatch({ kind: 'bot' });
    }, BOT_STEP_MS);
    return () => {
      cancelled = true;
    };
  }, [game, overlay.kind, options]);

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

  // The theme for what the screen shows, and over a game the danger to the king
  // at the start of this turn (#76). When a game has just ended the music falls
  // silent first, so the result's jingle is heard on its own.
  const level = useDanger(game, options.background, onState);
  // Each line is said as it shows, and its bubble stays until it has been
  // said (#159).
  const say = React.useCallback(
    (line: VoiceLine) => sounds?.say(line),
    [sounds],
  );
  const voiceLine = useBotVoice(game, level, {
    onVoiceLine: say,
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
  const isFlipped = flipped(game, turnHotseat);
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
        board={state.dfen.split(' ')[0]}
        legal={state.legal}
        lastMove={game.lastMove}
        selected={focus.selected}
        cursor={choosing ? focus.cursor : null}
        flipped={isFlipped}
        movable={movable}
      />
      <View style={{ flex: 1, height: size, paddingLeft: BOARD_GAP }}>
        {overlay.kind !== 'none' && !result ? (
          <>
            <ModeLine game={game} overlayOpen={true} />
            <Panel
              overlay={overlay}
              game={game}
              sound={sound}
              music={musicSetting}
              hasMusic={hasMusic}
              turnHotseat={turnHotseat}
              voices={voices}
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
            thinking={botOwes(game)}
            speechBubble={
              voiceLine ? <SpeechBubble text={voiceLine.text} /> : undefined
            }
            header={<ModeLine game={game} overlayOpen={false} />}
          >
            <Status game={game} view={state} />
            <Panel
              overlay={overlay}
              game={game}
              sound={sound}
              music={musicSetting}
              hasMusic={hasMusic}
              turnHotseat={turnHotseat}
              voices={voices}
              selected={focus.selected}
              pressed={pressed}
            />
          </Matchup>
        )}
      </View>
    </View>
  );
};
