// Authentic character voices, triggers, and anti-spam pacing for local bots (#157).
//
// Each bot (Rolly, Grabby, Rampage) has a distinct personality and tone.
// All voice lines are identified by deterministic IDs to enable 1:1 mapping
// with audio clips in downstream synthesis (#159) and speech bubbles (#158).
//
// The trigger engine is pure and platform-independent with zero React or DOM
// dependencies, compiled under tsconfig.core.json (types: []).
//
// The Hot Seat host's lines and pacing are in hostVoice.ts (#202), which reads
// the turn with the same capture analysis.

import { DiceChess } from '@fortemate/dicechess-engine';
import { pieceAt } from './board.ts';
import { isEnPassant, isPromotion } from './cues.ts';
import type { Level } from './danger.ts';
import {
  emptyRoll,
  opposite,
  viewGame,
  type BotMode,
  type Game,
} from './game.ts';
import type { Opponent } from './opponents.ts';

// What the bot speaks about. A threat is its own: in a game against the
// computer the danger that turnDanger measures, and the music follows, is the
// danger to the person's king, so the bot names that king (#164). A win is the
// person's king taken or the person's resignation, so its lines claim neither.
export type VoiceEvent =
  | 'intro'
  | 'empty_roll'
  | 'capture_heavy'
  | 'capture'
  | 'threat'
  | 'win'
  | 'loss';

export type VoiceLine = {
  readonly id: string;
  readonly bot: BotMode;
  readonly event: VoiceEvent;
  readonly text: string;
};

export type BotVoiceState = {
  readonly lastSpokenTurn: number;
  readonly threatSpoken: boolean;
  readonly introSpoken: boolean;
  // The line each event said last, so the next is another (#159). Kept from one
  // game to the next: the same intro at the start of a rematch is a repeat too.
  readonly lastLines?: Readonly<Partial<Record<VoiceEvent, string>>>;
};

export const INITIAL_BOT_VOICE_STATE: BotVoiceState = {
  lastSpokenTurn: -99,
  threatSpoken: false,
  introSpoken: false,
};

export const TURN_COOLDOWN = 2;
export const PROBABILITY_STANDARD_CAPTURE = 0.5;
export const PROBABILITY_EMPTY_ROLL = 0.7;

export type BotVoiceCueResult = {
  readonly line: VoiceLine | null;
  readonly state: BotVoiceState;
  readonly nextState: BotVoiceState;
};

const BOT_PREFIX: Readonly<Record<BotMode, string>> = {
  random: 'rolly',
  greedy: 'grabby',
  aggressive: 'rampage',
};

const RAW_SCRIPTS: Readonly<
  Record<
    BotMode,
    Readonly<Record<VoiceEvent, readonly [string, string, string]>>
  >
> = {
  random: {
    intro: [
      "Hey! Let's roll and see what happens!",
      "Dice ready, board ready! Let's have fun!",
      "I love rolling dice! Hope they're friendly today!",
    ],
    empty_roll: [
      'Oops, nowhere to go! Your turn!',
      "Nothing to move? That's dice for you!",
      'A blank roll! Well, that was silly!',
    ],
    capture_heavy: [
      'Whoa! Did I really just grab that big piece?!',
      'Look what I found! Down goes a heavy hitter!',
      'Yay! That was a huge capture!',
    ],
    capture: [
      'Boop! Mine now!',
      'Got one! Every little piece counts!',
      'Snack time for my pieces!',
    ],
    threat: [
      'Ooh! Your king is right in my path!',
      'One lucky roll and your king goes boop!',
      'Psst... your king might want to hide!',
    ],
    win: [
      'Yay, I won! Can we roll again?!',
      'Woohoo! The dice were super friendly today!',
      'High five! That was so much fun!',
    ],
    loss: [
      'Aww, good game! You got me fair and square!',
      'My king tripped! Nice catch!',
      "You're too good! Let's play another round!",
    ],
  },
  greedy: {
    intro: [
      'Everything on this board belongs in my collection.',
      "Don't get attached to your pieces. I'm taking them all.",
      'A fresh board! So many shiny pieces to hoard.',
    ],
    empty_roll: [
      'No moves?! But I wanted to take something!',
      'A waste of a roll! No loot for my vault this turn.',
      'Empty roll! You got lucky... for now.',
    ],
    capture_heavy: [
      'Jackpot! That prize piece is mine!',
      'Exquisite loot! A crown jewel for my hoard!',
      'The bigger the piece, the sweeter the profit!',
    ],
    capture: [
      "Mine! I'll take that, thank you.",
      'Another piece added to my private collection.',
      "Yoink! You shouldn't leave valuables lying around.",
    ],
    threat: [
      'Your king would look lovely in my vault.',
      'One good roll and your king is mine!',
      'I spy your king. Very collectible!',
    ],
    win: [
      'Victory and total plunder! What a splendid haul!',
      'All your squares and treasures are mine!',
      'Greed is good, but winning is priceless!',
    ],
    loss: [
      'No! My glorious collection! How dare you?!',
      'Unacceptable! You plundered my king?!',
      'Defeated?! My treasures... slipping away...',
    ],
  },
  aggressive: {
    intro: [
      'Step forward. Your king will not survive this day.',
      'No mercy. No retreat. Let the battle begin.',
      'Prepare yourself! I strike without hesitation.',
    ],
    empty_roll: [
      'The dice stall my fury. Savor your brief respite.',
      'No targets?! Unacceptable! Next turn you fall.',
      'A momentary pause before the storm resumes.',
    ],
    capture_heavy: [
      'Crushed! Your mightiest defender falls into dust!',
      'Devastating strike! You cannot withstand my assault!',
      'Your high command is broken! Smashed to pieces!',
    ],
    capture: [
      'Obliterated! One less obstacle in my path.',
      'Cut down! Your ranks crumble before me.',
      'Pathetic defense! Smashed aside!',
    ],
    threat: [
      'Your king is in my sights!',
      'The right roll, and your king falls!',
      "I can smell your king's fear!",
    ],
    win: [
      'Total annihilation! Kneel before the conqueror!',
      'Your army is crushed beneath my heel!',
      'Victory was inevitable! You were completely outmatched!',
    ],
    loss: [
      'Impossible! How could my onslaught fail?!',
      'You fought fiercely... I acknowledge your triumph.',
      'Downed, but not broken! We will battle again!',
    ],
  },
};

// Catalogue of 63 curated lines: 3 lines per event for each of the 3 bots.
export const VOICE_CATALOGUE: readonly VoiceLine[] = (
  Object.keys(RAW_SCRIPTS) as BotMode[]
).flatMap((bot) => {
  const events = RAW_SCRIPTS[bot];
  return (Object.keys(events) as VoiceEvent[]).flatMap((event) =>
    events[event].map((text, index) => ({
      id: `${BOT_PREFIX[bot]}_${event}_${index + 1}`,
      bot,
      event,
      text,
    })),
  );
});

export function voiceLinesFor(
  bot: BotMode,
  event: VoiceEvent,
): readonly VoiceLine[] {
  return VOICE_CATALOGUE.filter(
    (line) => line.bot === bot && line.event === event,
  );
}

export function voiceLineById(id: string): VoiceLine | undefined {
  return VOICE_CATALOGUE.find((line) => line.id === id);
}

// What the actions between two games took. `heavy` and `standard` are what a
// bot's line reacts to: a queen or a rook, and any smaller piece, en passant
// included. The rest tell the Hot Seat host which piece it was (#202).
export type CaptureAnalysis = {
  heavy: boolean;
  standard: boolean;
  queen: boolean;
  rook: boolean;
  // A pawn, a knight or a bishop, taken by an ordinary capture.
  minor: boolean;
  enPassant: boolean;
  promotion: boolean;
};

// An action between two games, with the board it was played on.
type Played = { readonly move: string; readonly board: string };

function playedOn(before: Game, after: Game): Played[] {
  if (after.moves.length <= before.moves.length) return [];
  const actions: Played[] = [];
  let dfen = viewGame(before).dfen;
  for (const move of after.moves.slice(before.moves.length)) {
    actions.push({ move, board: dfen.split(' ')[0] });
    const applied = DiceChess.applyMove(
      dfen,
      move.slice(0, 2),
      move.slice(2, 4),
      move.slice(4) || undefined,
    );
    if (applied) dfen = applied;
  }
  return actions;
}

export function analyzeCaptures(before: Game, after: Game): CaptureAnalysis {
  let queen = false;
  let rook = false;
  let minor = false;
  let enPassant = false;
  let promotion = false;

  for (const { move, board } of playedOn(before, after)) {
    const target = pieceAt(board, move.slice(2, 4))?.toLowerCase();

    if (target === 'q') queen = true;
    else if (target === 'r') rook = true;
    else if (target && target !== 'k') minor = true;
    else if (isEnPassant(board, move)) enPassant = true;
    if (isPromotion(move)) promotion = true;
  }

  return {
    heavy: queen || rook,
    standard: minor || enPassant,
    queen,
    rook,
    minor,
    enPassant,
    promotion,
  };
}

function resultEvent(before: Game, after: Game): VoiceEvent | null {
  if (before.phase === 'ended' || after.phase !== 'ended') return null;
  if (!after.result?.winner || !after.human) return null;
  const botSide = opposite(after.human);
  return after.result.winner === botSide ? 'win' : 'loss';
}

export function isEmptyRollStep(before: Game, after: Game): boolean {
  return (
    emptyRoll(after) && before.phase === 'roll' && after.phase === 'handoff'
  );
}

export function isMatchStartStep(before: Game, after: Game): boolean {
  if (after.turn !== 1) return false;
  return (
    before.revision === 0 ||
    (before.roll.length === 0 &&
      after.roll.length > 0 &&
      before.moves.length === 0)
  );
}

// A line is never picked twice in a row for an event: with a voice, a repeat is
// heard at once, where a bubble read twice might pass (#159).
function pickVoiceLine(
  bot: BotMode,
  event: VoiceEvent,
  random: () => number,
  last?: string,
): VoiceLine {
  const all = voiceLinesFor(bot, event);
  if (all.length === 0) {
    throw new Error(`No voice lines found for bot ${bot} and event ${event}`);
  }
  const lines = all.length > 1 ? all.filter((line) => line.id !== last) : all;
  const index = Math.floor(random() * lines.length);
  return lines[Math.min(index, lines.length - 1)];
}

function nextVoiceState(
  state: BotVoiceState,
  line: VoiceLine,
  currentTurn: number,
): BotVoiceState {
  return {
    lastSpokenTurn: currentTurn,
    threatSpoken: state.threatSpoken || line.event === 'threat',
    introSpoken: state.introSpoken || line.event === 'intro',
    lastLines: { ...state.lastLines, [line.event]: line.id },
  };
}

function evaluateNonTerminalEvent(
  before: Game,
  after: Game,
  dangerLevel: Level,
  state: BotVoiceState,
  random: () => number,
): VoiceEvent | null {
  const isBotTurn = viewGame(before).bot || viewGame(after).bot;
  const captures = isBotTurn
    ? analyzeCaptures(before, after)
    : { heavy: false, standard: false };

  // Priority 1: Heavy piece capture (100% threshold)
  if (captures.heavy) {
    return 'capture_heavy';
  }

  // Priority 2: the bot threatens the person's king (100% threshold, max 1 per
  // game): one right die lets it take that king with its first action.
  if (!state.threatSpoken && dangerLevel === 'critical') {
    return 'threat';
  }

  // Priority 3: Bot empty roll (70% threshold)
  if (isBotTurn && isEmptyRollStep(before, after)) {
    if (random() < PROBABILITY_EMPTY_ROLL) return 'empty_roll';
    return null;
  }

  // Priority 4: Standard piece capture (50% threshold)
  if (captures.standard) {
    if (random() < PROBABILITY_STANDARD_CAPTURE) return 'capture';
    return null;
  }

  // Priority 5: Match intro (100% threshold, first turn only)
  if (!state.introSpoken && isMatchStartStep(before, after)) {
    return 'intro';
  }

  return null;
}

// Pure reducer function evaluating game transitions to select authentic bot commentary.
// `dangerLevel` is the danger to the person's king at the start of the turn, as
// turnDanger measures it in a game against the computer.
export function botVoiceCue(
  before: Game,
  after: Game,
  opponent: Opponent,
  dangerLevel: Level = 'calm',
  state: BotVoiceState = INITIAL_BOT_VOICE_STATE,
  random: () => number = Math.random,
): BotVoiceCueResult {
  if (
    before.id !== after.id ||
    after.mode === 'hotseat' ||
    after.human === null
  ) {
    return { line: null, state, nextState: state };
  }

  // Terminal results bypass cooldown and random probability gates
  const terminal = resultEvent(before, after);
  if (terminal) {
    const line = pickVoiceLine(
      opponent.mode,
      terminal,
      random,
      state.lastLines?.[terminal],
    );
    const next = nextVoiceState(state, line, after.turn);
    return { line, state: next, nextState: next };
  }

  // Pacing: turn cooldown for all non-terminal events
  if (after.turn - state.lastSpokenTurn < TURN_COOLDOWN) {
    return { line: null, state, nextState: state };
  }

  const event = evaluateNonTerminalEvent(
    before,
    after,
    dangerLevel,
    state,
    random,
  );
  if (!event) {
    return { line: null, state, nextState: state };
  }

  const line = pickVoiceLine(
    opponent.mode,
    event,
    random,
    state.lastLines?.[event],
  );
  const next = nextVoiceState(state, line, after.turn);
  return { line, state: next, nextState: next };
}

// Convenience helper returning just the voice line or null
export function botVoiceLine(
  before: Game,
  after: Game,
  opponent: Opponent,
  dangerLevel: Level = 'calm',
  state: BotVoiceState = INITIAL_BOT_VOICE_STATE,
  random: () => number = Math.random,
): VoiceLine | null {
  return botVoiceCue(before, after, opponent, dangerLevel, state, random).line;
}

// Explicit state-first reducer alias
export function nextBotVoice(
  state: BotVoiceState,
  before: Game,
  after: Game,
  opponent: Opponent,
  dangerLevel: Level = 'calm',
  random: () => number = Math.random,
): BotVoiceCueResult {
  return botVoiceCue(before, after, opponent, dangerLevel, state, random);
}
