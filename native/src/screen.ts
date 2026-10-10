// The screen's whole flow as a pure function of state and one action.
//
// It is a reducer rather than a set of handlers because remote repeats can
// arrive faster than React re-renders: handlers closing over state would read a
// stale cursor and drop moves while a direction is held.
//
// Nothing here decides legality. Moves come from the engine's own list, and the
// controller in src/core/game.ts applies them.
import {
  newGame,
  rollGame,
  moveGame,
  nextTurn,
  resignGame,
  agreeDraw,
  applyBotReply,
  viewGame,
  emptyRoll,
  INITIAL_POSITION,
  isBotMode,
  type BotMode,
  type ColourChoice,
  type Game,
  type Mode,
  type Side,
} from '../../src/core/game';
import { diceOf, type Die } from '../../src/core/dice';
import { OPPONENTS } from '../../src/core/opponents';
import {
  boardInput,
  onlyChoice,
  waitingFocus,
  type BoardFocus,
  type BoardKey,
} from '../../src/core/boardInput';
import {
  botReply,
  botToAct,
  replyFits,
  type BotReply,
} from '../../src/core/bot';
import type { Square } from '../../src/core/board';
import type { Level } from '../../src/core/danger';
import { DEFAULT_MUSIC, MUSIC_STEPS, type MusicSetting } from './musicSetting';
import {
  DEFAULT_HOST,
  cycleHost,
  hostName,
  type HostChoice,
} from './hostSetting';

export const START: Square = 'e2';

// Where the cursor starts: on the mover's own side of the board.
export const startFor = (
  human: Side | null,
  isFlipped = human === 'b',
): Square => (isFlipped ? 'e7' : START);

// Against the bot a person plays the colour they chose, or one drawn for them.
export const colourOptions = ['Random', 'White', 'Black'];
const COLOURS: readonly ColourChoice[] = ['random', 'w', 'b'];

// A person playing Black sees the board from Black's side. In hotseat, turning
// the board flips it for Black's turn (#120).
export const flipped = (game: Game, turnHotseat = false): boolean =>
  game.human === 'b' ||
  (turnHotseat && game.mode === 'hotseat' && viewGame(game).side === 'b');

// Where the cursor waits once the person has a piece to choose, after a roll or
// an action (#68): on its square while that piece can still move, otherwise on
// the central movable piece. On the opponent's turn it stays where it was.
const settled = (
  focus: BoardFocus,
  game: Game,
  turnHotseat = false,
): BoardFocus =>
  game.phase === 'move' && !botToAct(game)
    ? waitingFocus(
        focus.cursor,
        viewGame(game).legal,
        flipped(game, turnHotseat),
      )
    : { ...focus, selected: null };

// The square OK is about to press itself on (#302), if any: with the setting
// on, on the board, while the person chooses, unless they stopped it for this
// action, and only when the board offers exactly one choice. `legal` saves
// working out the view again where it is to hand.
export const autoChoice = (
  state: ScreenState,
  legal?: readonly string[],
): Square | null => {
  const { game } = state;
  if (
    !state.autoSelect ||
    state.overlay.kind !== 'none' ||
    state.autoStopped === game.revision ||
    game.phase !== 'move' ||
    botToAct(game)
  )
    return null;
  return onlyChoice(legal ?? viewGame(game).legal, state.focus.selected);
};

// OK pressed for the person (#302), on the state it was scheduled for. A press
// of their own since, or an action played, leaves this one nothing to do: the
// screen schedules again for what it shows now.
const autoSelected = (
  state: ScreenState,
  revision: number,
  selected: Square | null,
): ScreenState => {
  if (state.game.revision !== revision || state.focus.selected !== selected)
    return state;
  const square = autoChoice(state);
  if (square === null) return state;
  return onMove(
    { ...state, focus: { ...state.focus, cursor: square } },
    'select',
    false,
  );
};

// The screen advances on a key, on the local opponent taking its turn, on OK
// pressing itself when the board offers one choice, or on the guard after a
// roll with nothing to play running out.
// The opponent's step may carry the reply the screen worked out while it waited;
// without one the reducer asks for it.
// It also learns whether the build has music at all, which the app finds out
// after launch.
export type ScreenAction =
  | { kind: 'key'; key: BoardKey; repeat?: boolean }
  // A game started from outside the menus: the tutorial's last screen offers
  // one against Rolly or a friend (#244).
  | ({ kind: 'newGame' } & GameChoice)
  | { kind: 'bot'; reply?: BotReply }
  // OK pressed for the person (#302), on the game revision and the piece in
  // hand it was scheduled for.
  | { kind: 'auto'; revision: number; selected: Square | null }
  | { kind: 'unguard' }
  | { kind: 'musicAvailable'; available: boolean };

// A game to start: its mode, and the colour a person plays against the bot.
export type GameChoice = { mode: Mode; colour: ColourChoice };

// How long the opponent's next step waits, in milliseconds: long enough to watch
// each roll and move land.
export const BOT_STEP_MS = 600;

// How long OK waits before it presses itself on the only choice (#302): the
// opponent's pace, so each pick and move is seen to land, and Back has a moment
// to stop it.
export const AUTO_SELECT_MS = BOT_STEP_MS;

// The opponent owes a step, which the screen takes for it on a timer. Its roll
// with nothing to play is not one: the notice stays until the person presses
// OK, which passes the turn and rolls their own dice (#149), so it can be read
// for as long as it takes without adding a press.
export const botOwes = (game: Game): boolean =>
  botToAct(game) && !emptyRoll(game);

// How long OK is ignored after a roll with nothing to play, either side's, so
// that a double press on the remote cannot pass the turn before the notice is
// seen.
export const OK_GUARD_MS = 700;

// `home` is the screen shown before a game is in play; the rest sit over the
// board. `none` is the board itself.
export type Overlay =
  | { kind: 'none' }
  | { kind: 'home'; index: number }
  // On a first launch, before the home screen: Thinkle offers to teach the game
  // (#244). Answered once, either way, it is never shown again.
  | { kind: 'offer'; index: number }
  | { kind: 'menu'; index: number }
  | {
      kind: 'confirm';
      action: 'resign' | 'replace';
      index: number;
      // Which mode a confirmed replacement starts, and the colour chosen for
      // it when it is a game against the bot.
      mode: Mode;
      colour?: ColourChoice;
      // Where the action began, which Cancel and Back return to.
      from: 'home' | 'menu';
    }
  // The local opponent to play, one card each (#115). `from` is where Back
  // returns.
  | { kind: 'opponent'; index: number; from: 'home' | 'menu' }
  // The colour a person plays against the chosen opponent, before the game
  // starts. Back returns to the cards; `from` is where the cards return.
  | { kind: 'colour'; index: number; mode: BotMode; from: 'home' | 'menu' }
  | { kind: 'promotion'; moves: string[]; index: number }
  // Music, its volume, the sound effects, the voices, the Hot Seat host,
  // turning the board and OK pressing itself on the only choice (#76, #159,
  // #202, #120, #302). `from` is where Back returns.
  | { kind: 'settings'; index: number; from: 'home' | 'menu' }
  // After a game against the bot: a rematch, or back to the main menu.
  | { kind: 'result'; index: number }
  // The tutorial, the rules guide and the About screen, which the screen hands
  // to their own components. Nothing about a game is touched while one is up.
  | { kind: 'tutorial' }
  | { kind: 'rules'; from: 'home' | 'menu' }
  | { kind: 'about' };

// The overlays drawn by their own component, which takes the remote while it is
// up. One definition, used here and by GameScreen, so a new screen cannot be
// added to one and forgotten in the other.
export const handsOff = (
  overlay: Overlay,
): overlay is Extract<Overlay, { kind: 'tutorial' | 'rules' | 'about' }> =>
  overlay.kind === 'tutorial' ||
  overlay.kind === 'rules' ||
  overlay.kind === 'about';

export type ScreenState = {
  game: Game;
  focus: BoardFocus;
  overlay: Overlay;
  // The opponent's remaining actions, revealed one at a time. Validated as a
  // complete path before the first is played, so this is a reveal and not a
  // decision taken in instalments.
  pending: string[];
  // Whether the game's sound effects are heard, and whether music plays and how
  // loud. Changed on the settings screen; the screen reports each change so the
  // app can save it and apply it to the players.
  sound: boolean;
  music: MusicSetting;
  // Whether this build has music. Without it the settings offer only the sound
  // effects, rather than switches that do nothing (#76).
  musicAvailable: boolean;
  // Whether the board turns to the side to move in hotseat (#120).
  turnHotseat: boolean;
  // Whether the lines are spoken aloud, the bots' and the host's (#159).
  voices: boolean;
  // Who hosts Hot Seat games, or 'off' (#202).
  host: HostChoice;
  // Whether OK presses itself when the board offers only one choice (#302).
  autoSelect: boolean;
  // The game revision on which the person stopped that with Back or Menu: the
  // action in progress is theirs to finish, and the next one is automatic
  // again. Null when they have not.
  autoStopped: number | null;
  // OK is ignored: a roll has just left nothing to play. The app clears it
  // after OK_GUARD_MS; the other keys work throughout.
  guarded: boolean;
  // The dice played on the latest finished turn, shown dimmed until the next
  // roll so a player can inspect what the bot (or the other side) rolled (#297).
  lastDice: LastDice | null;
  // Whether a game is in play and can be resumed from the home screen (#343).
  // True once a game is started, until it ends or is replaced.
  resumable: boolean;
};

export type LastDice = {
  dice: Die[];
  side: Side;
};

// The dice of a finished turn, as they are drawn at the handoff: all spent or
// leftover, so they can stay on screen dimmed until the next roll (#297).
export const lastDiceOf = (game: Game): LastDice | null => {
  if (!game.roll.length) return null;
  const view = viewGame(game);
  return {
    dice: diceOf(game.roll, view.remaining, view.playable),
    side: view.side,
  };
};

// What a new game keeps: the settings, and whether this build has music.
export type ScreenSettings = Pick<
  ScreenState,
  | 'sound'
  | 'music'
  | 'musicAvailable'
  | 'turnHotseat'
  | 'voices'
  | 'host'
  | 'autoSelect'
>;

// Sound effects, music, the voices and who hosts Hot Seat are set on a screen
// of their own, opened from both menus. A label says what a setting is now,
// which is what a viewer checks.
export const SETTINGS_OPTION = 'Settings';
export const settingsOptions = (
  sound: boolean,
  music: MusicSetting,
  musicAvailable = true,
  turnHotseat = false,
  voices = true,
  host: HostChoice = DEFAULT_HOST,
  autoSelect = false,
): string[] => [
  ...(musicAvailable
    ? [`Music: ${music.on ? 'on' : 'off'}`, `Music volume: ${music.volume}`]
    : []),
  `Sound effects: ${sound ? 'on' : 'off'}`,
  `Voices: ${voices ? 'on' : 'off'}`,
  `Hot Seat host: ${hostName(host)}`,
  `Turn board in Hot Seat: ${turnHotseat ? 'on' : 'off'}`,
  `Auto-select only choice: ${autoSelect ? 'on' : 'off'}`,
];

export type ScreenOptions = {
  // Three dice. Injected so the screen never reaches for a global, and so a
  // test can play a known roll.
  roll: () => number[];
  // Identifies the game being saved. Injected so a restart does not collide
  // with the game it just restored.
  newId: () => string;
  // Runs a step after about `wait` milliseconds: the opponent's next step, or the
  // end of a guard. The app spaces them out so the player can watch; a test
  // runs them immediately. A scheduler may return a cancellation function.
  schedule: (step: () => void, wait: number) => void | (() => void);
  // The colour a person gets on choosing Random. Injected like the dice.
  side: () => Side;
  // Runs one small piece of background work soon, between frames: a step of
  // measuring the danger to a king (#76). Without it the work runs at once,
  // which is what a test wants.
  background?: (step: () => void) => void | (() => void);
  // The time in milliseconds, to measure how much of the opponent's step wait
  // its search has already used. Without it no time counts as used, which is
  // what a test that does not look at the clock wants.
  now?: () => number;
};

// The home options that start a game: a Hot Seat game at once, a game against
// the computer through the choice of opponent and colour.
export const RESUME_OPTION = 'Resume game';
export const HOTSEAT_OPTION = 'New Hot Seat game';
export const COMPUTER_OPTION = 'Play the computer';
export const RULES_OPTION = 'Rules reference';

export const homeOptions = (resumable: boolean): string[] => [
  ...(resumable ? [RESUME_OPTION] : []),
  HOTSEAT_OPTION,
  COMPUTER_OPTION,
  'Learn to play',
  RULES_OPTION,
  SETTINGS_OPTION,
  // Last, because it is read once: it is where the credits a licence asks for
  // are shown.
  'About',
];

// A new game. Against the bot the person plays the chosen colour, or the one
// drawn for them when they chose Random.
const start = (
  state: ScreenState,
  mode: Mode,
  colour: ColourChoice,
  options: ScreenOptions,
): ScreenState => {
  const human = mode === 'hotseat' ? null : chosen(colour, options);
  return board(
    newGame(
      mode,
      options.newId(),
      INITIAL_POSITION,
      human,
      mode === 'hotseat' ? null : colour,
    ),
    state,
    startFor(human),
  );
};

// The colour a choice gives: the one named, or one drawn for Random.
const chosen = (colour: ColourChoice, options: ScreenOptions): Side =>
  colour === 'random' ? options.side() : colour;

// The card the choice of opponent opens on: the opponent of the game in play,
// so a new game against the same one is OK away, or the first card.
const cardOf = (mode: Mode): number =>
  Math.max(
    0,
    OPPONENTS.findIndex((opponent) => opponent.mode === mode),
  );

// Home options that open another screen and change nothing else.
const OPENS = new Map<string, Overlay>([
  [RESUME_OPTION, { kind: 'none' }],
  ['Learn to play', { kind: 'tutorial' }],
  [RULES_OPTION, { kind: 'rules', from: 'home' }],
  [SETTINGS_OPTION, { kind: 'settings', index: 0, from: 'home' }],
  ['About', { kind: 'about' }],
]);

export const MAIN_MENU_OPTION = 'Main menu';

export const menuOptions = (game: Game): string[] => [
  RESUME_OPTION,
  'Resign',
  // A draw needs two players to agree; there is nobody to agree with a bot.
  ...(game.mode === 'hotseat' ? ['Agree a draw'] : []),
  'New game',
  MAIN_MENU_OPTION,
  RULES_OPTION,
  // Last: the order above is unchanged, and because the menu wraps, Up from
  // Resume game reaches this in one press — the quickest way to silence a game.
  SETTINGS_OPTION,
];

export const confirmOptions = ['Cancel', 'Yes'];

// The first launch's offer (#244): the tutorial, or straight to the home screen.
export const LEARN_OPTION = 'Learn to play';
export const offerOptions = [LEARN_OPTION, 'Skip'];

export const resultOptions = ['Rematch', 'Main menu'];

// A new game keeps the settings, which are not about the game.
const board = (
  game: Game,
  {
    sound,
    music,
    musicAvailable,
    turnHotseat,
    voices,
    host,
    autoSelect,
  }: ScreenSettings,
  cursor: Square = START,
): ScreenState => ({
  game,
  focus: { cursor, selected: null },
  overlay: { kind: 'none' },
  pending: [],
  sound,
  music,
  musicAvailable,
  turnHotseat,
  voices,
  host,
  autoSelect,
  autoStopped: null,
  guarded: false,
  lastDice: null,
  resumable: true,
});

// A played move clears the selection, and the cursor settles for the next
// choice. A roll that has just left nothing to play is guarded.
const played = (
  state: ScreenState,
  game: Game,
  nextFocus?: BoardFocus,
): ScreenState => {
  const result = game.phase === 'ended';
  return {
    game,
    focus: nextFocus ?? settled(state.focus, game, state.turnHotseat),
    overlay: after(game),
    pending: [],
    sound: state.sound,
    music: state.music,
    musicAvailable: state.musicAvailable,
    turnHotseat: state.turnHotseat,
    voices: state.voices,
    host: state.host,
    autoSelect: state.autoSelect,
    autoStopped: state.autoStopped,
    guarded: emptyRoll(game),
    lastDice: state.lastDice,
    resumable: state.resumable && !result,
  };
};

const step = (key: BoardKey, index: number, length: number): number =>
  (index + (key === 'up' || key === 'left' ? -1 : 1) + length) % length;

// A game worth resuming: one that has started and has not ended.
export const resumable = (game: Game): boolean =>
  game.phase !== 'ended' && (game.roll.length > 0 || game.turn > 1);

// Whether the current screen state represents a game in play that can be
// resumed from the home screen (#343).
export const isResumable = (state: ScreenState): boolean =>
  state.resumable && state.game.phase !== 'ended';

// The settings as the app read them; any not given start at their defaults.
export const initialState = (
  options: ScreenOptions,
  restored?: Game | null,
  {
    sound = true,
    music = DEFAULT_MUSIC,
    musicAvailable = false,
    turnHotseat = false,
    voices = true,
    host = DEFAULT_HOST,
    autoSelect = false,
  }: Partial<ScreenSettings> = {},
  // A first launch, which opens on the offer of the tutorial (#244).
  firstLaunch = false,
): ScreenState => {
  const game = restored ?? newGame('hotseat', options.newId());
  const isFlipped = flipped(game, turnHotseat);
  return {
    game,
    // A game restored mid-turn waits on a piece that can move.
    focus: settled(
      { cursor: startFor(game.human, isFlipped), selected: null },
      game,
      turnHotseat,
    ),
    // The home screen: a new launch has a mode to choose, and a restored game
    // should be resumed deliberately rather than dropping the player mid-turn
    // into a game they may not remember. A first launch is offered the tutorial
    // first: the game is new to nearly everyone (#244).
    overlay: firstLaunch
      ? { kind: 'offer', index: 0 }
      : { kind: 'home', index: 0 },
    pending: [],
    sound,
    music,
    musicAvailable,
    turnHotseat,
    voices,
    host,
    autoSelect,
    autoStopped: null,
    guarded: false,
    lastDice: null,
    resumable: Boolean(restored && restored.phase !== 'ended'),
  };
};

// One step of the local opponent's turn: roll, reveal one action of its path,
// or end the turn. A three-dice turn is three visible steps rather than a board
// that changes by three moves at once, because a player who cannot see what the
// opponent did cannot read the game.
function botStep(
  state: ScreenState,
  options: ScreenOptions,
  given?: BotReply,
): ScreenState {
  const { game, pending } = state;
  if (state.overlay.kind !== 'none' || !botOwes(game)) return state;

  // Mid-path: reveal the next action. moveGame revalidates it against the
  // position it is actually applied to. A path that no longer fits is dropped
  // rather than thrown (#255): none of it has been shown, and the next step
  // asks for the rest of the turn again, checked as a whole, as a relaunch in
  // the middle of the opponent's turn does.
  if (pending.length) {
    if (!viewGame(game).legal.includes(pending[0]))
      return { ...state, pending: [] };
    const next = moveGame(game, pending[0]);
    return {
      ...state,
      game: next,
      overlay: after(next),
      pending: pending.slice(1),
      resumable: state.resumable && next.phase !== 'ended',
    };
  }

  // A roll can end the game too: with nothing to play once the half-move clock
  // or the turn count has run out, the result is a draw.
  if (game.phase === 'roll') {
    const next = rollGame(game, options.roll());
    return {
      ...state,
      game: next,
      overlay: after(next),
      guarded: emptyRoll(next),
      resumable: state.resumable && next.phase !== 'ended',
    };
  }
  if (game.phase === 'handoff') {
    const lastDice = lastDiceOf(game) ?? state.lastDice;
    return { ...state, game: nextTurn(game), lastDice };
  }

  // Decide the whole turn at once and check it as a whole: applyBotReply
  // rejects a stale or incomplete path. Its result is discarded and the path is
  // replayed a move at a time, so the check covers what is about to be shown.
  // A reply worked out while the step waited is the same question asked sooner;
  // one that no longer fits the position is not trusted, and is asked for again.
  // A reply just asked for that is still rejected is the engine's fault, not a
  // stale answer, and it throws to the game screen's fallback (#255): returning
  // the state unchanged would leave the opponent "playing" with nothing to ask
  // it again.
  const reply = given && replyFits(game, given) ? given : botReply(game);
  applyBotReply(game, reply);
  const next = moveGame(game, reply.moves[0]);
  return {
    ...state,
    game: next,
    overlay: after(next),
    pending: reply.moves.slice(1),
    resumable: state.resumable && next.phase !== 'ended',
  };
}

// The overlays every key handler below returns to.
const BOARD: Overlay = { kind: 'none' };
const HOME: Overlay = { kind: 'home', index: 0 };
const MENU: Overlay = { kind: 'menu', index: 0 };
const RESULT: Overlay = { kind: 'result', index: 0 };

// What follows a step of play: the board, or, when a game against the bot has
// just ended, the offer of a rematch. A hotseat result keeps the board, where OK
// goes back to the main menu.
const after = (game: Game): Overlay =>
  game.phase === 'ended' && game.mode !== 'hotseat' ? RESULT : BOARD;

// Puts up another overlay, or the board itself, and changes nothing else.
const show = (state: ScreenState, overlay: Overlay): ScreenState => ({
  ...state,
  overlay,
});

// What each overlay plays (#76): the menu theme away from a game, and the
// level of danger over one. A menu opened from a game keeps the game's music, so
// browsing it does not crossfade back and forth; a finished game is back in the
// menus.
export type MusicRole = 'menu' | Level;
export const musicRole = (
  overlay: Overlay,
  game: Game,
  level: Level,
): MusicRole => {
  if (game.phase === 'ended') return 'menu';
  switch (overlay.kind) {
    case 'none':
    case 'menu':
    case 'promotion':
      return level;
    case 'confirm':
    case 'settings':
    case 'opponent':
    case 'colour':
    case 'rules':
      return overlay.from === 'menu' ? level : 'menu';
    default:
      return 'menu';
  }
};

// The arrows walk a list of options, wrapping at both ends.
const moved = (
  state: ScreenState,
  overlay: Extract<Overlay, { index: number }>,
  key: BoardKey,
  length: number,
): ScreenState =>
  show(state, { ...overlay, index: step(key, overlay.index, length) });

// One handler per overlay, each given its own overlay already narrowed.
type Handler<K extends Overlay['kind']> = (
  state: ScreenState,
  overlay: Extract<Overlay, { kind: K }>,
  key: BoardKey,
  options: ScreenOptions,
) => ScreenState;

const onHome: Handler<'home'> = (state, overlay, key, options) => {
  const choices = homeOptions(isResumable(state));
  if (key === 'back' || key === 'menu') return state;
  if (key !== 'select') return moved(state, overlay, key, choices.length);
  const chosen = choices[overlay.index];
  const opens = OPENS.get(chosen);
  if (opens) return show(state, opens);
  // A game against the computer starts with the choice of opponent.
  if (chosen === COMPUTER_OPTION)
    return show(state, {
      kind: 'opponent',
      index: cardOf(state.game.mode),
      from: 'home',
    });
  if (chosen !== HOTSEAT_OPTION) return state;
  // Starting a new game over one still in play is a decision, not a keypress.
  if (isResumable(state))
    return show(state, {
      kind: 'confirm',
      action: 'replace',
      index: 0,
      mode: 'hotseat',
      from: 'home',
    });
  return start(state, 'hotseat', 'random', options);
};

// The offer of the tutorial on a first launch. Skip, Back and Menu all go to the
// home screen, so the offer never closes the app.
const onOffer: Handler<'offer'> = (state, overlay, key) => {
  if (key === 'back' || key === 'menu') return show(state, HOME);
  if (key !== 'select') return moved(state, overlay, key, offerOptions.length);
  return show(
    state,
    offerOptions[overlay.index] === LEARN_OPTION ? { kind: 'tutorial' } : HOME,
  );
};

// A game started from the tutorial's last screen, as one from the menus would
// be: over a game still in play only after the same confirmation.
const startFrom = (
  state: ScreenState,
  mode: Mode,
  colour: ColourChoice,
  options: ScreenOptions,
): ScreenState =>
  isResumable(state)
    ? show(state, {
        kind: 'confirm',
        action: 'replace',
        index: 0,
        mode,
        colour,
        from: 'home',
      })
    : start(state, mode, colour, options);

// The option the choice of opponent was opened from, which Back returns to.
const openerOf = (state: ScreenState, from: 'home' | 'menu'): Overlay =>
  from === 'home'
    ? {
        kind: 'home',
        index: homeOptions(isResumable(state)).indexOf(COMPUTER_OPTION),
      }
    : {
        kind: 'menu',
        index: menuOptions(state.game).indexOf('New game'),
      };

// The cards: the arrows walk them, OK takes one to the choice of colour.
const onOpponent: Handler<'opponent'> = (state, overlay, key) => {
  if (key === 'menu') return show(state, HOME);
  if (key === 'back') return show(state, openerOf(state, overlay.from));
  if (key !== 'select') return moved(state, overlay, key, OPPONENTS.length);
  return show(state, {
    kind: 'colour',
    index: 0,
    mode: OPPONENTS[overlay.index].mode,
    from: overlay.from,
  });
};

const onColour: Handler<'colour'> = (state, overlay, key, options) => {
  if (key === 'menu') return show(state, HOME);
  if (key === 'back')
    return show(state, {
      kind: 'opponent',
      index: cardOf(overlay.mode),
      from: overlay.from,
    });
  if (key !== 'select') return moved(state, overlay, key, colourOptions.length);
  const colour = COLOURS[overlay.index];
  // The confirmation comes last, right before the game in play is replaced.
  if (isResumable(state))
    return show(state, {
      kind: 'confirm',
      action: 'replace',
      index: 0,
      mode: overlay.mode,
      colour,
      from: overlay.from,
    });
  return start(state, overlay.mode, colour, options);
};

// Cancel, or Back, calls the whole action off and returns to where it began:
// the menu, or the home screen with the cursor on the option that started it.
const cancelled = (
  state: ScreenState,
  overlay: Extract<Overlay, { kind: 'confirm' }>,
): Overlay =>
  overlay.from === 'menu'
    ? MENU
    : {
        kind: 'home',
        index: homeOptions(isResumable(state)).indexOf(
          overlay.mode === 'hotseat' ? HOTSEAT_OPTION : COMPUTER_OPTION,
        ),
      };

const onConfirm: Handler<'confirm'> = (state, overlay, key, options) => {
  if (key === 'menu') return show(state, HOME);
  if (key === 'back') return show(state, cancelled(state, overlay));
  if (key !== 'select')
    return moved(state, overlay, key, confirmOptions.length);
  if (confirmOptions[overlay.index] === 'Cancel')
    return show(state, cancelled(state, overlay));
  return overlay.action === 'resign'
    ? played(state, resignGame(state.game))
    : start(state, overlay.mode, overlay.colour ?? 'random', options);
};

const onMenu: Handler<'menu'> = (state, overlay, key) => {
  const { game } = state;
  const choices = menuOptions(game);
  if (key === 'back' || key === 'menu') return show(state, BOARD);
  if (key !== 'select') return moved(state, overlay, key, choices.length);
  const chosen = choices[overlay.index];
  if (chosen === RESUME_OPTION) return show(state, BOARD);
  // Handled before the fall-through below, which treats anything else as a
  // destructive choice and asks to confirm replacing the game.
  if (chosen === SETTINGS_OPTION)
    return show(state, { kind: 'settings', index: 0, from: 'menu' });
  if (chosen === RULES_OPTION)
    return show(state, { kind: 'rules', from: 'menu' });
  if (chosen === MAIN_MENU_OPTION) return show(state, HOME);
  if (chosen === 'Agree a draw') return played(state, agreeDraw(game));
  // A new game against the computer starts, like one from home, with the
  // cards, on the opponent of this game.
  if (chosen === 'New game' && isBotMode(game.mode))
    return show(state, {
      kind: 'opponent',
      index: cardOf(game.mode),
      from: 'menu',
    });
  // Both destructive choices go through a confirmation with Cancel first.
  return show(state, {
    kind: 'confirm',
    action: chosen === 'Resign' ? 'resign' : 'replace',
    index: 0,
    mode: game.mode,
    from: 'menu',
  });
};

// The option the rules guide was opened from, which Back returns to.
const rulesOpener = (state: ScreenState, from: 'home' | 'menu'): Overlay =>
  from === 'home'
    ? {
        kind: 'home',
        index: homeOptions(isResumable(state)).indexOf(RULES_OPTION),
      }
    : {
        kind: 'menu',
        index: menuOptions(state.game).indexOf(RULES_OPTION),
      };

// The option the settings were opened from, which Back returns to.
const settingsOpener = (state: ScreenState, from: 'home' | 'menu'): Overlay =>
  from === 'home'
    ? {
        kind: 'home',
        index: homeOptions(isResumable(state)).indexOf(SETTINGS_OPTION),
      }
    : {
        kind: 'menu',
        index: menuOptions(state.game).indexOf(SETTINGS_OPTION),
      };

// What a sideways arrow, or OK, does to a row. What a row is comes from its
// label: the rows differ with the build.
const changed = (
  state: ScreenState,
  row: string,
  key: BoardKey,
): ScreenState => {
  if (row.startsWith('Music volume')) {
    if (key === 'select') return state;
    const volume = Math.max(
      0,
      Math.min(MUSIC_STEPS, state.music.volume + (key === 'left' ? -1 : 1)),
    );
    return { ...state, music: { ...state.music, volume } };
  }
  if (row.startsWith('Music:'))
    return { ...state, music: { ...state.music, on: !state.music.on } };
  if (row.startsWith('Sound effects:'))
    return { ...state, sound: !state.sound };
  if (row.startsWith('Voices:')) return { ...state, voices: !state.voices };
  if (row.startsWith('Hot Seat host:'))
    return { ...state, host: cycleHost(state.host, key === 'left' ? -1 : 1) };
  if (row.startsWith('Turn board in Hot Seat:'))
    return { ...state, turnHotseat: !state.turnHotseat };
  if (row.startsWith('Auto-select only choice:'))
    return { ...state, autoSelect: !state.autoSelect };
  return state;
};

// Up and Down walk the settings. The arrows sideways change the volume on its
// row, step through the hosts on hers, and flip a switch on the others, as OK
// does, so either habit works.
const onSettings: Handler<'settings'> = (state, overlay, key) => {
  if (key === 'menu') return show(state, HOME);
  if (key === 'back') return show(state, settingsOpener(state, overlay.from));
  const rows = settingsOptions(
    state.sound,
    state.music,
    state.musicAvailable,
    state.turnHotseat,
    state.voices,
    state.host,
    state.autoSelect,
  );
  if (key === 'up' || key === 'down')
    return moved(state, overlay, key, rows.length);
  return changed(state, rows[overlay.index] ?? '', key);
};

// Back from the choice of piece leaves the pawn in hand. With OK pressing
// itself (#302) it would open the choice again on its own, so the action is
// left to the person, as Back on the board leaves it.
const onPromotion: Handler<'promotion'> = (state, overlay, key) => {
  if (key === 'back' || key === 'menu')
    return show(
      state.autoSelect ? { ...state, autoStopped: state.game.revision } : state,
      BOARD,
    );
  if (key === 'select')
    return played(state, moveGame(state.game, overlay.moves[overlay.index]));
  return moved(state, overlay, key, overlay.moves.length);
};

// Rematch starts again against the same opponent, with the same colour option:
// Random draws a side again. Back, like Main menu, leaves for the main menu.
const onResult: Handler<'result'> = (state, overlay, key, options) => {
  if (key === 'back' || key === 'menu') return show(state, HOME);
  if (key !== 'select') return moved(state, overlay, key, resultOptions.length);
  if (resultOptions[overlay.index] === 'Main menu') return show(state, HOME);
  const { mode, colour } = state.game;
  return start(state, mode, colour ?? 'random', options);
};

// Choosing a piece and a square. Back is intercepted here only to stop OK
// pressing itself (#302): otherwise boardInput cancels a selection first and
// only asks to leave when there is nothing to cancel, which is the behaviour
// the web probe already ships.
function onMove(
  state: ScreenState,
  key: BoardKey,
  repeat: boolean,
): ScreenState {
  const { game } = state;
  const { legal, dfen } = viewGame(game);
  // With OK pressing itself (#302), Back or Menu leaves the rest of the
  // action to the person. Otherwise a piece picked up for them and put down
  // with Back would be picked up again, and Back could never reach the menu.
  // While a press is pending, Back only stops it; a second Back puts down or
  // leaves as it always has.
  if (
    (key === 'back' || key === 'menu') &&
    state.autoSelect &&
    state.autoStopped !== game.revision
  ) {
    const stopped = { ...state, autoStopped: game.revision };
    if (key === 'back' && autoChoice(state, legal) !== null) return stopped;
    return onMove(stopped, key, repeat);
  }
  const result = boardInput(
    state.focus,
    key,
    legal,
    flipped(game, state.turnHotseat),
    dfen.split(' ')[0],
    { repeat },
  );
  const focused = { ...state, focus: result.focus };
  switch (result.action.type) {
    case 'exit':
      return show(focused, MENU);
    case 'move':
      return played(focused, moveGame(game, result.action.move));
    case 'promote':
      return show(focused, {
        kind: 'promotion',
        moves: result.action.moves,
        index: 0,
      });
    case 'none':
      return focused;
  }
}

// The board itself.
const onBoard = (
  state: ScreenState,
  key: BoardKey,
  options: ScreenOptions,
  repeat: boolean,
): ScreenState => {
  const { game } = state;
  if (game.phase === 'ended')
    return key === 'select' || key === 'back' || key === 'menu'
      ? show(state, HOME)
      : state;
  const bot = botOwes(game);
  if (game.phase === 'move' && !bot) return onMove(state, key, repeat);
  // Otherwise Back opens the menu, and OK rolls the dice or passes the turn.
  // While the opponent owes an action the board takes no input but Back or Menu, so a
  // player cannot move its pieces for it; while a guard is up, no OK either.
  if (key === 'back' || key === 'menu') return show(state, MENU);
  if (key !== 'select' || bot || state.guarded) return state;
  if (game.phase === 'roll') {
    return played(state, rollGame(game, options.roll()));
  }
  // OK after the opponent's empty roll is the person's roll: the one press
  // they would have made on their own turn, made while the notice is up.
  if (botToAct(game))
    return played(state, rollGame(nextTurn(game), options.roll()));
  if (game.mode === 'hotseat') {
    const next = nextTurn(game);
    const isFlipped = flipped(next, state.turnHotseat);
    const focusSeed: BoardFocus = {
      cursor: startFor(next.human, isFlipped),
      selected: null,
    };
    const rolled = rollGame(next, options.roll());
    return played(state, rolled, settled(focusSeed, rolled, state.turnHotseat));
  }
  const lastDice = lastDiceOf(game) ?? state.lastDice;
  const next = nextTurn(game);
  return { ...played(state, next), lastDice };
};

export function screenReducer(
  state: ScreenState,
  action: ScreenAction,
  options: ScreenOptions,
): ScreenState {
  if (action.kind === 'bot') return botStep(state, options, action.reply);
  if (action.kind === 'auto')
    return autoSelected(state, action.revision, action.selected);
  if (action.kind === 'newGame')
    return startFrom(state, action.mode, action.colour, options);
  if (action.kind === 'unguard')
    return state.guarded ? { ...state, guarded: false } : state;
  if (action.kind === 'musicAvailable') {
    if (action.available === state.musicAvailable) return state;
    // Without music the settings have fewer rows: start them from the top.
    const overlay: Overlay =
      state.overlay.kind === 'settings'
        ? { ...state.overlay, index: 0 }
        : state.overlay;
    return { ...state, musicAvailable: action.available, overlay };
  }
  const { key } = action;
  const { overlay } = state;
  // Leaving any of those comes back here, to the screen they were started from.
  if (handsOff(overlay)) {
    if (overlay.kind === 'rules')
      return show(state, rulesOpener(state, overlay.from));
    return show(state, HOME);
  }
  switch (overlay.kind) {
    case 'home':
      return onHome(state, overlay, key, options);
    case 'offer':
      return onOffer(state, overlay, key, options);
    case 'opponent':
      return onOpponent(state, overlay, key, options);
    case 'colour':
      return onColour(state, overlay, key, options);
    case 'confirm':
      return onConfirm(state, overlay, key, options);
    case 'menu':
      return onMenu(state, overlay, key, options);
    case 'promotion':
      return onPromotion(state, overlay, key, options);
    case 'settings':
      return onSettings(state, overlay, key, options);
    case 'result':
      return onResult(state, overlay, key, options);
    case 'none':
      return onBoard(state, key, options, action.repeat ?? false);
  }
}
