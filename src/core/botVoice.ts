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

// Catalogue of 63 curated lines: 3 lines per event for each of the 3 bots.
export const VOICE_CATALOGUE: readonly VoiceLine[] = [
  // --- ROLLY (random, Easy) ---
  // Goofy, cheerful, clumsy, playful, loves rolling dice.
  {
    id: 'rolly_intro_1',
    bot: 'random',
    event: 'intro',
    text: "Hey! Let's roll and see what happens!",
  },
  {
    id: 'rolly_intro_2',
    bot: 'random',
    event: 'intro',
    text: "Dice ready, board ready! Let's have fun!",
  },
  {
    id: 'rolly_intro_3',
    bot: 'random',
    event: 'intro',
    text: "I love rolling dice! Hope they're friendly today!",
  },
  {
    id: 'rolly_empty_roll_1',
    bot: 'random',
    event: 'empty_roll',
    text: 'Oops, nowhere to go! Your turn!',
  },
  {
    id: 'rolly_empty_roll_2',
    bot: 'random',
    event: 'empty_roll',
    text: "Nothing to move? That's dice for you!",
  },
  {
    id: 'rolly_empty_roll_3',
    bot: 'random',
    event: 'empty_roll',
    text: 'A blank roll! Well, that was silly!',
  },
  {
    id: 'rolly_capture_heavy_1',
    bot: 'random',
    event: 'capture_heavy',
    text: 'Whoa! Did I really just grab that big piece?!',
  },
  {
    id: 'rolly_capture_heavy_2',
    bot: 'random',
    event: 'capture_heavy',
    text: 'Look what I found! Down goes a heavy hitter!',
  },
  {
    id: 'rolly_capture_heavy_3',
    bot: 'random',
    event: 'capture_heavy',
    text: 'Yay! That was a huge capture!',
  },
  {
    id: 'rolly_capture_1',
    bot: 'random',
    event: 'capture',
    text: 'Boop! Mine now!',
  },
  {
    id: 'rolly_capture_2',
    bot: 'random',
    event: 'capture',
    text: 'Got one! Every little piece counts!',
  },
  {
    id: 'rolly_capture_3',
    bot: 'random',
    event: 'capture',
    text: 'Snack time for my pieces!',
  },
  {
    id: 'rolly_danger_high_1',
    bot: 'random',
    event: 'danger_high',
    text: 'Uh oh, my king looks a little nervous...',
  },
  {
    id: 'rolly_danger_high_2',
    bot: 'random',
    event: 'danger_high',
    text: "Yikes, watch where you're pointing that!",
  },
  {
    id: 'rolly_danger_high_3',
    bot: 'random',
    event: 'danger_high',
    text: 'Wait wait wait, please leave my king alone!',
  },
  {
    id: 'rolly_win_1',
    bot: 'random',
    event: 'win',
    text: 'Yay, I won! Can we roll again?!',
  },
  {
    id: 'rolly_win_2',
    bot: 'random',
    event: 'win',
    text: 'Woohoo! The dice were super friendly today!',
  },
  {
    id: 'rolly_win_3',
    bot: 'random',
    event: 'win',
    text: 'High five! That was so much fun!',
  },
  {
    id: 'rolly_loss_1',
    bot: 'random',
    event: 'loss',
    text: 'Aww, good game! You got me fair and square!',
  },
  {
    id: 'rolly_loss_2',
    bot: 'random',
    event: 'loss',
    text: 'My king tripped! Nice checkmate!',
  },
  {
    id: 'rolly_loss_3',
    bot: 'random',
    event: 'loss',
    text: "You're too good! Let's play another round!",
  },

  // --- GRABBY (greedy, Medium) ---
  // Materialistic, hoarder, counts values, hates losing pieces.
  {
    id: 'grabby_intro_1',
    bot: 'greedy',
    event: 'intro',
    text: 'Everything on this board belongs in my collection.',
  },
  {
    id: 'grabby_intro_2',
    bot: 'greedy',
    event: 'intro',
    text: "Don't get attached to your pieces. I'm taking them all.",
  },
  {
    id: 'grabby_intro_3',
    bot: 'greedy',
    event: 'intro',
    text: 'A fresh board! So many shiny pieces to hoard.',
  },
  {
    id: 'grabby_empty_roll_1',
    bot: 'greedy',
    event: 'empty_roll',
    text: 'No moves?! But I wanted to take something!',
  },
  {
    id: 'grabby_empty_roll_2',
    bot: 'greedy',
    event: 'empty_roll',
    text: 'A waste of a roll! No loot for my vault this turn.',
  },
  {
    id: 'grabby_empty_roll_3',
    bot: 'greedy',
    event: 'empty_roll',
    text: 'Empty roll! You got lucky... for now.',
  },
  {
    id: 'grabby_capture_heavy_1',
    bot: 'greedy',
    event: 'capture_heavy',
    text: 'Jackpot! That prize piece is mine!',
  },
  {
    id: 'grabby_capture_heavy_2',
    bot: 'greedy',
    event: 'capture_heavy',
    text: 'Exquisite loot! A crown jewel for my hoard!',
  },
  {
    id: 'grabby_capture_heavy_3',
    bot: 'greedy',
    event: 'capture_heavy',
    text: 'The bigger the piece, the sweeter the profit!',
  },
  {
    id: 'grabby_capture_1',
    bot: 'greedy',
    event: 'capture',
    text: "Mine! I'll take that, thank you.",
  },
  {
    id: 'grabby_capture_2',
    bot: 'greedy',
    event: 'capture',
    text: 'Another piece added to my private collection.',
  },
  {
    id: 'grabby_capture_3',
    bot: 'greedy',
    event: 'capture',
    text: "Yoink! You shouldn't leave valuables lying around.",
  },
  {
    id: 'grabby_danger_high_1',
    bot: 'greedy',
    event: 'danger_high',
    text: 'Hey! Hands off the royal vault!',
  },
  {
    id: 'grabby_danger_high_2',
    bot: 'greedy',
    event: 'danger_high',
    text: 'Back away from my king! What impudence!',
  },
  {
    id: 'grabby_danger_high_3',
    bot: 'greedy',
    event: 'danger_high',
    text: 'Protect the crown! My hoard is in peril!',
  },
  {
    id: 'grabby_win_1',
    bot: 'greedy',
    event: 'win',
    text: 'Victory and total plunder! What a splendid haul!',
  },
  {
    id: 'grabby_win_2',
    bot: 'greedy',
    event: 'win',
    text: 'Checkmate! All your squares and treasures are mine!',
  },
  {
    id: 'grabby_win_3',
    bot: 'greedy',
    event: 'win',
    text: 'Greed is good, but winning is priceless!',
  },
  {
    id: 'grabby_loss_1',
    bot: 'greedy',
    event: 'loss',
    text: 'No! My glorious collection! How dare you?!',
  },
  {
    id: 'grabby_loss_2',
    bot: 'greedy',
    event: 'loss',
    text: 'Unacceptable! You plundered my king?!',
  },
  {
    id: 'grabby_loss_3',
    bot: 'greedy',
    event: 'loss',
    text: 'Defeated?! My treasures... slipping away...',
  },

  // --- RAMPAGE (aggressive, Hard) ---
  // Fierce, menacing, aggressive, relentless hunter of the king.
  {
    id: 'rampage_intro_1',
    bot: 'aggressive',
    event: 'intro',
    text: 'Step forward. Your king will not survive this day.',
  },
  {
    id: 'rampage_intro_2',
    bot: 'aggressive',
    event: 'intro',
    text: 'No mercy. No retreat. Let the battle begin.',
  },
  {
    id: 'rampage_intro_3',
    bot: 'aggressive',
    event: 'intro',
    text: 'Prepare yourself! I strike without hesitation.',
  },
  {
    id: 'rampage_empty_roll_1',
    bot: 'aggressive',
    event: 'empty_roll',
    text: 'The dice stall my fury. Savor your brief respite.',
  },
  {
    id: 'rampage_empty_roll_2',
    bot: 'aggressive',
    event: 'empty_roll',
    text: 'No targets?! Unacceptable! Next turn you fall.',
  },
  {
    id: 'rampage_empty_roll_3',
    bot: 'aggressive',
    event: 'empty_roll',
    text: 'A momentary pause before the storm resumes.',
  },
  {
    id: 'rampage_capture_heavy_1',
    bot: 'aggressive',
    event: 'capture_heavy',
    text: 'Crushed! Your mightiest defender falls into dust!',
  },
  {
    id: 'rampage_capture_heavy_2',
    bot: 'aggressive',
    event: 'capture_heavy',
    text: 'Devastating strike! You cannot withstand my assault!',
  },
  {
    id: 'rampage_capture_heavy_3',
    bot: 'aggressive',
    event: 'capture_heavy',
    text: 'Your high command is broken! Smashed to pieces!',
  },
  {
    id: 'rampage_capture_1',
    bot: 'aggressive',
    event: 'capture',
    text: 'Obliterated! One less obstacle in my path.',
  },
  {
    id: 'rampage_capture_2',
    bot: 'aggressive',
    event: 'capture',
    text: 'Cut down! Your ranks crumble before me.',
  },
  {
    id: 'rampage_capture_3',
    bot: 'aggressive',
    event: 'capture',
    text: 'Pathetic defense! Smashed aside!',
  },
  {
    id: 'rampage_danger_high_1',
    bot: 'aggressive',
    event: 'danger_high',
    text: 'You dare threaten me?! I will break your vanguard!',
  },
  {
    id: 'rampage_danger_high_2',
    bot: 'aggressive',
    event: 'danger_high',
    text: 'A bold assault... but you only seal your own doom!',
  },
  {
    id: 'rampage_danger_high_3',
    bot: 'aggressive',
    event: 'danger_high',
    text: 'My king does not flinch! Counterattack incoming!',
  },
  {
    id: 'rampage_win_1',
    bot: 'aggressive',
    event: 'win',
    text: 'Total annihilation! Kneel before the conqueror!',
  },
  {
    id: 'rampage_win_2',
    bot: 'aggressive',
    event: 'win',
    text: 'Checkmate! Your king is crushed beneath my heel!',
  },
  {
    id: 'rampage_win_3',
    bot: 'aggressive',
    event: 'win',
    text: 'Victory was inevitable! You were completely outmatched!',
  },
  {
    id: 'rampage_loss_1',
    bot: 'aggressive',
    event: 'loss',
    text: 'Impossible! How could my onslaught fail?!',
  },
  {
    id: 'rampage_loss_2',
    bot: 'aggressive',
    event: 'loss',
    text: 'You fought fiercely... I acknowledge your triumph.',
  },
  {
    id: 'rampage_loss_3',
    bot: 'aggressive',
    event: 'loss',
    text: 'Downed, but not broken! We will battle again!',
  },
];

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
