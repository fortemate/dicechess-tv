// The Hot Seat host (#202): Rolly hosts games between two people at one
// television, a neutral party host who cheers the moment and never a side.
//
// He speaks only at the pauses: as a game starts, when a turn ends and the
// prompt says "OK: continue", and when the game ends. A turn is judged as a
// whole, over all of its actions, and one step says at most one line. How often
// he speaks is the host pacing of voices/events.json in dicechess-assets, which
// every Dice Chess client shares, generated into hostPacing.ts.
//
// The lines are written in dicechess-assets
// (voices/elevenlabs-dicechess-host/catalogue.json) and copied here word for
// word: native/test/vendoredVoices.test.ts fails when a line here and the clip
// recorded from it say different things.
//
// Pure, like the bots' voices in botVoice.ts, and compiled under
// tsconfig.core.json (types: []).

import {
  analyzeCaptures,
  isEmptyRollStep,
  isMatchStartStep,
} from './botVoice.ts';
import { viewGame, type Game } from './game.ts';
import {
  HOST_EVENTS,
  HOST_PACING,
  type HostEvent,
  type HostPacing,
} from './hostPacing.ts';

export { HOST_EVENTS, HOST_PACING };
export type { HostEvent, HostPacing };

export type HostLine = {
  readonly id: string;
  readonly bot: 'host';
  readonly event: HostEvent;
  readonly text: string;
};

// Every event of events.json has its lines, or this does not compile.
const SCRIPT: Readonly<Record<HostEvent, readonly string[]>> = {
  white_wins: [
    'White wins! What a game, both of you!',
    'Victory for White! You both played great!',
    'Hooray, White! And hooray, Black, too!',
  ],
  black_wins: [
    'Black takes the game! Well played, both!',
    "It's Black's game! What a match, you two!",
    'Three cheers for Black, and for White too!',
  ],
  win: [
    "And that's the game! Bravo, you two!",
    'We have a winner! Great game, everyone!',
  ],
  draw: [
    'A draw! Nobody wins, and everybody wins!',
    "It's a draw! You two are perfectly matched!",
    'All even! Shake hands, both of you!',
  ],
  intro: [
    "You two play, and I'll do the cheering!",
    "No dice for me! I'm just the host!",
    'Welcome, both of you! White rolls first!',
    'One board, two players, three dice! Go!',
    "Ooh, a brand new game... I can't wait!",
  ],
  again: [
    'Another game? Yay, more cheering for me!',
    "New game, new luck! Who's ready?",
    'Back for more? The dice are all warmed up!',
  ],
  handoff: [
    "Now pass the remote over! Black's turn!",
    'After every turn, the remote changes hands!',
    'Remote swap time! Black, roll away!',
  ],
  en_passant: [
    'En passant! A rare sideways capture!',
    'Did you see that? A pawn caught in passing!',
    "Psst... that's called en passant!",
  ],
  promotion: [
    'Look! That little pawn grew up!',
    'A pawn crossed the whole board! Amazing!',
    'Ta-da! The pawn got a big upgrade!',
  ],
  capture_queen: [
    'A queen is taken! Deep breaths, you two!',
    'Oh, the queen! My heart just did a flip!',
    'Ooh... there goes a queen!',
    'Queen down! My microphone is shaking!',
  ],
  capture_heavy: [
    'Wowee! The whole board felt that one!',
    'Kaboom! A mighty piece leaves the board!',
    'Timber! What a tumble!',
    'Big, big moment! Somebody pinch me!',
    'Oh my! Hold on to your seats, you two!',
  ],
  empty_roll: [
    'The dice said no! Pass it along!',
    'Aww, bad luck! Those dice are so cheeky!',
    'Oh no, the dice took a nap! Next turn!',
    'Uh-oh! The dice are playing tricks on us!',
  ],
  capture: [
    'Pop! One piece hops off the board!',
    'Oho! The plot thickens!',
    'A capture! A little more room on the board!',
    'And that piece is off for a little rest!',
  ],
};

// The 45 lines, with the ids their clips are recorded under: host_<event>_<n>,
// numbered from 1.
export const HOST_CATALOGUE: readonly HostLine[] = (
  Object.keys(SCRIPT) as HostEvent[]
).flatMap((event) =>
  SCRIPT[event].map((text, index) => ({
    id: `host_${event}_${index + 1}`,
    bot: 'host' as const,
    event,
    text,
  })),
);

export function hostLinesFor(event: HostEvent): readonly HostLine[] {
  return HOST_CATALOGUE.filter((line) => line.event === event);
}

export function hostLineById(id: string): HostLine | undefined {
  return HOST_CATALOGUE.find((line) => line.id === id);
}

// The host's last word: it stays while the result shows.
const RESULT_EVENTS: readonly HostEvent[] = [
  'white_wins',
  'black_wins',
  'win',
  'draw',
];
export const isResultLine = (line: Pick<HostLine, 'event'>): boolean =>
  RESULT_EVENTS.includes(line.event);

type Counts = Readonly<Partial<Record<HostEvent, number>>>;

export type HostState = {
  // Kept from game to game for the session.
  // A game was played this session, so the next one starts with 'again'.
  readonly played: boolean;
  // The pass of the remote has been taught: once a session.
  readonly handoffSaid: boolean;
  // The line ids left in each event's shuffled bag, so every line of an event
  // is heard before any repeats.
  readonly bags: Readonly<Partial<Record<HostEvent, readonly string[]>>>;
  // The line each event said last, which a refilled bag never opens with. A
  // colour's win is kept under 'win', with the lines that name no colour.
  readonly lastLines: Readonly<Partial<Record<HostEvent, string>>>;
  // The game being hosted, from the start of hosting it.
  // The game turn of the last line; at the start of hosting, the turn there.
  readonly lastSpokenTurn: number;
  // How many times each event happened this game, and was said.
  readonly happened: Counts;
  readonly spoken: Counts;
};

export const INITIAL_HOST_STATE: HostState = {
  played: false,
  handoffSaid: false,
  bags: {},
  lastLines: {},
  lastSpokenTurn: 0,
  happened: {},
  spoken: {},
};

export type HostCue = {
  readonly line: HostLine | null;
  readonly event: HostEvent | null;
  readonly state: HostState;
};

const quiet = (state: HostState): HostCue => ({
  line: null,
  event: null,
  state,
});

const byPriority = (a: HostEvent, b: HostEvent): number =>
  HOST_EVENTS[a].priority - HOST_EVENTS[b].priority;

// A game the host has not seen yet: the first one he hosts, another one, or the
// same id started again (an ended game replaced by a new one).
const startsHosting = (before: Game | null, after: Game): boolean =>
  !before ||
  before.id !== after.id ||
  after.revision < before.revision ||
  before.mode !== after.mode;

// What a step of a hotseat game gives the host to speak about, the most
// important first. Only the end of the game and the end of a turn count.
export function hostEvents(
  before: Game,
  after: Game,
  state: HostState,
): HostEvent[] {
  if (after.mode !== 'hotseat') return [];
  // The end of the game, which a turn's captures do not outweigh: a king
  // taken, a resignation, a draw agreed or reached.
  if (before.phase !== 'ended' && after.phase === 'ended' && after.result) {
    const { winner } = after.result;
    return [
      winner === 'w' ? 'white_wins' : winner === 'b' ? 'black_wins' : 'draw',
    ];
  }
  // The end of a turn: the roll left nothing to play, or its last action was
  // played, and the prompt says "OK: continue".
  if (
    after.phase !== 'handoff' ||
    before.phase === 'handoff' ||
    before.turn !== after.turn
  )
    return [];
  // The whole turn, from its roll: the same game with no actions yet.
  const turn = analyzeCaptures({ ...after, moves: [], lastMove: null }, after);
  const events: HostEvent[] = [];
  if (turn.queen) events.push('capture_queen');
  if (turn.rook) events.push('capture_heavy');
  if (turn.enPassant) events.push('en_passant');
  if (turn.promotion) events.push('promotion');
  if (turn.minor) events.push('capture');
  if (isEmptyRollStep(before, after)) events.push('empty_roll');
  // Until the next turn begins, the side in the position is still the one that
  // moved. Two of the three lines name Black's turn, so only the end of a
  // White turn teaches the pass.
  if (!state.handoffSaid && viewGame(after).side === 'w')
    events.push('handoff');
  return events.sort(byPriority);
}

// The lines an event draws from: a colour's win joins the lines that name no
// colour.
const poolOf = (event: HostEvent): readonly string[] => {
  const ids = (of: HostEvent) => hostLinesFor(of).map((line) => line.id);
  if (event === 'white_wins' || event === 'black_wins')
    return [...ids(event), ...ids('win')];
  return ids(event);
};

// Both colours' wins draw the lines that name no colour, so the results share
// their recency: a refilled bag of either colour never opens with the result
// said last, whichever colour won, and a colourless line heard for one colour
// leaves the other colour's bag. Otherwise the line that ended one game could
// end the next.
const recencyOf = (event: HostEvent): HostEvent =>
  event === 'white_wins' || event === 'black_wins' ? 'win' : event;
const otherColour = (event: HostEvent): HostEvent | null =>
  event === 'white_wins'
    ? 'black_wins'
    : event === 'black_wins'
      ? 'white_wins'
      : null;

// A fresh bag for an event: its lines shuffled, never opening with the line
// said last.
function refill(
  event: HostEvent,
  last: string | undefined,
  random: () => number,
): string[] {
  const bag = [...poolOf(event)];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  if (bag.length > 1 && bag[0] === last) [bag[0], bag[1]] = [bag[1], bag[0]];
  return bag;
}

function speak(
  state: HostState,
  event: HostEvent,
  turn: number,
  random: () => number,
): HostCue {
  const recency = recencyOf(event);
  const left = state.bags[event];
  const bag = left?.length
    ? left
    : refill(event, state.lastLines[recency], random);
  const [id, ...rest] = bag;
  const line = hostLineById(id);
  if (!line) throw new Error(`No host line ${id} for ${event}`);
  const bags = { ...state.bags, [event]: rest };
  const other = otherColour(event);
  const theirs = other && bags[other];
  if (theirs && line.event === 'win')
    bags[other] = theirs.filter((kept) => kept !== id);
  return {
    line,
    event,
    state: {
      ...state,
      handoffSaid: state.handoffSaid || event === 'handoff',
      bags,
      lastLines: { ...state.lastLines, [recency]: id },
      lastSpokenTurn: turn,
      spoken: { ...state.spoken, [event]: (state.spoken[event] ?? 0) + 1 },
    },
  };
}

const counted = (state: HostState, events: readonly HostEvent[]): HostState => {
  const happened: Partial<Record<HostEvent, number>> = { ...state.happened };
  for (const event of events) happened[event] = (happened[event] ?? 0) + 1;
  return { ...state, happened };
};

// Whether an event that happened may be said now, `since` turns after the last
// line. The chance of a frequent event is drawn only once its cooldown has
// passed.
function maySpeak(
  state: HostState,
  event: HostEvent,
  since: number,
  random: () => number,
  pacing: HostPacing,
): boolean {
  const { tier } = HOST_EVENTS[event];
  const spoken = state.spoken[event] ?? 0;
  // Rare or decisive: without a cooldown, the first times it happens in a game.
  if (
    tier === 'always' &&
    (state.happened[event] ?? 0) <= pacing.alwaysPerEvent
  )
    return true;
  if (tier !== 'frequent')
    return (
      since >= pacing.notableCooldownTurns && spoken < pacing.notablePerEvent
    );
  return (
    since >= pacing.frequentCooldownTurns &&
    random() < pacing.frequentChance * pacing.repeatDecay ** spoken
  );
}

// The host's line for one step of the game, if any, and his state after it.
// `before` is the game he saw last, or null when he has not seen one: then this
// is the start of hosting `after`.
export function hostVoiceCue(
  before: Game | null,
  after: Game,
  state: HostState = INITIAL_HOST_STATE,
  random: () => number = Math.random,
  pacing: HostPacing = HOST_PACING,
): HostCue {
  if (after.mode !== 'hotseat') return quiet(state);

  if (startsHosting(before, after)) {
    const fresh: HostState = {
      ...state,
      lastSpokenTurn: after.turn,
      happened: {},
      spoken: {},
    };
    // A game resumed part of the way through is hosted from here, quietly.
    if (!isMatchStartStep(after, after)) return quiet(fresh);
    const event: HostEvent = state.played ? 'again' : 'intro';
    return speak(counted(fresh, [event]), event, after.turn, random);
  }
  // Nothing happened: the same game seen again.
  if (!before || after.revision === before.revision) return quiet(state);

  const played: HostState = { ...state, played: true };
  const events = hostEvents(before, after, played);
  const seen = counted(played, events);
  if (!events.length) return quiet(seen);

  const since = after.turn - seen.lastSpokenTurn;
  // After a long silence, whatever happened is said.
  const pick =
    since >= pacing.silenceBreakerTurns
      ? events[0]
      : events.find((event) => maySpeak(seen, event, since, random, pacing));
  if (!pick) return quiet(seen);
  return speak(seen, pick, after.turn, random);
}

// Puts back a line that was picked but never heard, at the front of its bag,
// so it is the next one of its event. The counts stay: it still spent the
// cooldown. A pass of the remote that was never taught is taught later.
export function restoreLine(
  state: HostState,
  event: HostEvent,
  id: string,
): HostState {
  return {
    ...state,
    handoffSaid: event === 'handoff' ? false : state.handoffSaid,
    bags: { ...state.bags, [event]: [id, ...(state.bags[event] ?? [])] },
  };
}
