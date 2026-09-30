// Authentic character voices, triggers, and anti-spam pacing for local bots (#157).
//
// Each bot (Rolly, Grabby, Rampage) has a distinct personality and tone.
// All voice lines are identified by deterministic IDs to enable 1:1 mapping
// with audio clips in downstream synthesis (#159) and speech bubbles (#158).
//
// The trigger engine is pure and platform-independent with zero React or DOM
// dependencies, compiled under tsconfig.core.json (types: []).

import { DiceChess } from '@fortemate/dicechess-engine';
import { fileOf, pieceAt } from './board.ts';
import type { Level } from './danger.ts';
import {
  emptyRoll,
  opposite,
  viewGame,
  type BotMode,
  type Game,
} from './game.ts';
import type { Opponent } from './opponents.ts';

export type VoiceEvent =
  | 'intro'
  | 'empty_roll'
  | 'capture_heavy'
  | 'capture'
  | 'danger_high'
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
  readonly dangerSpoken: boolean;
  readonly introSpoken: boolean;
};

export const INITIAL_BOT_VOICE_STATE: BotVoiceState = {
  lastSpokenTurn: -99,
  dangerSpoken: false,
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
    danger_high: [
      'Uh oh, my king looks a little nervous...',
      "Yikes, watch where you're pointing that!",
      'Wait wait wait, please leave my king alone!',
    ],
    win: [
      'Yay, I won! Can we roll again?!',
      'Woohoo! The dice were super friendly today!',
      'High five! That was so much fun!',
    ],
    loss: [
      'Aww, good game! You got me fair and square!',
      'My king tripped! Nice checkmate!',
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
    danger_high: [
      'Hey! Hands off the royal vault!',
      'Back away from my king! What impudence!',
      'Protect the crown! My hoard is in peril!',
    ],
    win: [
      'Victory and total plunder! What a splendid haul!',
      'Checkmate! All your squares and treasures are mine!',
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
    danger_high: [
      'You dare threaten me?! I will break your vanguard!',
      'A bold assault... but you only seal your own doom!',
      'My king does not flinch! Counterattack incoming!',
    ],
    win: [
      'Total annihilation! Kneel before the conqueror!',
      'Checkmate! Your king is crushed beneath my heel!',
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

type CaptureAnalysis = {
  heavy: boolean;
  standard: boolean;
};

function analyzeCaptures(before: Game, after: Game): CaptureAnalysis {
  if (after.moves.length <= before.moves.length) {
    return { heavy: false, standard: false };
  }
  const newMoves = after.moves.slice(before.moves.length);
  let dfen = viewGame(before).dfen;
  let heavy = false;
  let standard = false;

  for (const move of newMoves) {
    const board = dfen.split(' ')[0];
    const from = move.slice(0, 2);
    const to = move.slice(2, 4);
    const target = pieceAt(board, to)?.toLowerCase();
    const mover = pieceAt(board, from)?.toLowerCase();

    if (target === 'q' || target === 'r') {
      heavy = true;
    } else if (target && target !== 'k') {
      standard = true;
    } else if (mover === 'p' && fileOf(from) !== fileOf(to) && !target) {
      // En passant
      standard = true;
    }

    const applied = DiceChess.applyMove(
      dfen,
      from,
      to,
      move.slice(4) || undefined,
    );
    if (applied) dfen = applied;
  }

  return { heavy, standard };
}

function resultEvent(before: Game, after: Game): VoiceEvent | null {
  if (before.phase === 'ended' || after.phase !== 'ended') return null;
  if (!after.result || !after.result.winner || !after.human) return null;
  const botSide = opposite(after.human);
  return after.result.winner === botSide ? 'win' : 'loss';
}

function isEmptyRollStep(before: Game, after: Game): boolean {
  return (
    emptyRoll(after) && before.phase === 'roll' && after.phase === 'handoff'
  );
}

function isMatchStartStep(before: Game, after: Game): boolean {
  if (after.turn !== 1) return false;
  return (
    before.revision === 0 ||
    (before.roll.length === 0 &&
      after.roll.length > 0 &&
      before.moves.length === 0)
  );
}

function pickVoiceLine(
  bot: BotMode,
  event: VoiceEvent,
  random: () => number,
): VoiceLine {
  const lines = voiceLinesFor(bot, event);
  if (lines.length === 0) {
    throw new Error(`No voice lines found for bot ${bot} and event ${event}`);
  }
  const index = Math.floor(random() * lines.length);
  return lines[Math.min(index, lines.length - 1)];
}

function nextVoiceState(
  state: BotVoiceState,
  event: VoiceEvent,
  currentTurn: number,
): BotVoiceState {
  return {
    lastSpokenTurn: currentTurn,
    dangerSpoken: state.dangerSpoken || event === 'danger_high',
    introSpoken: state.introSpoken || event === 'intro',
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

  // Priority 2: Critical threat to king (100% threshold, max 1 per game)
  if (!state.dangerSpoken && dangerLevel === 'critical') {
    return 'danger_high';
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
    const line = pickVoiceLine(opponent.mode, terminal, random);
    const next = nextVoiceState(state, terminal, after.turn);
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

  const line = pickVoiceLine(opponent.mode, event, random);
  const next = nextVoiceState(state, event, after.turn);
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
