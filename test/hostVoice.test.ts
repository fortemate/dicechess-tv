// The Hot Seat host (#202): what she speaks about at the pauses of a game, and
// how often, by the host pacing of voices/events.json. Every step is played on
// the engine, so the events are the ones a real game gives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOST_CATALOGUE,
  HOST_EVENTS,
  HOST_PACING,
  INITIAL_HOST_STATE,
  hostEvents,
  hostLineById,
  hostLinesFor,
  hostVoiceCue,
  isResultLine,
  restoreLine,
  type HostEvent,
  type HostState,
} from '../src/core/hostVoice.ts';
import { analyzeCaptures } from '../src/core/botVoice.ts';
import { cues } from '../src/core/cues.ts';
import { rowsOf } from './rows.ts';
import {
  agreeDraw,
  moveGame,
  newGame,
  nextTurn,
  resignGame,
  rollGame,
  type Game,
} from '../src/core/game.ts';

const PAWN = 1;
const BISHOP = 3;
const ROOK = 4;
const QUEEN = 5;
const KING = 6;

const OPENING = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// A hotseat game from a position, rolled, at a given game turn.
const rolled = (start: string, roll: number[], turn = 1, id = 'host'): Game =>
  rollGame({ ...newGame('hotseat', id, start), turn }, roll);

// The last step of a turn: the game before its last action, and after it.
const lastAction = (game: Game, ...moves: string[]): [Game, Game] => {
  let before = game;
  for (const move of moves.slice(0, -1)) before = moveGame(before, move);
  return [before, moveGame(before, moves.at(-1)!)];
};

// A turn that ends at its roll: nothing to play.
const emptyRollStep = (
  start = OPENING,
  roll = [QUEEN, ROOK, KING],
  turn = 1,
) => {
  const before = { ...newGame('hotseat', 'host', start), turn };
  return [before, rollGame(before, roll)] as [Game, Game];
};

// One-action turns, each ending at the capture: the dice left are pawns, and
// White has none.
const takes = (piece: string, turn = 1, id = 'host'): [Game, Game] =>
  lastAction(
    rolled(
      `4k3/8/8/${piece}7/8/8/8/R3K3 w - - 0 1`,
      [ROOK, PAWN, PAWN],
      turn,
      id,
    ),
    'a1a5',
  );
const EN_PASSANT = (turn = 1) =>
  lastAction(
    rolled('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', [PAWN, BISHOP, BISHOP], turn),
    'e5d6',
  );
const PROMOTION = (turn = 1) =>
  lastAction(
    rolled('4k3/P7/8/8/8/8/8/4K3 w - - 0 1', [PAWN, PAWN, PAWN], turn),
    'a7a8q',
  );
const PROMOTION_TAKING_QUEEN = (turn = 1) =>
  lastAction(
    rolled('1q2k3/P7/8/8/8/8/8/4K3 w - - 0 1', [PAWN, PAWN, PAWN], turn),
    'a7b8q',
  );
// A rook and a bishop take a rook and a knight in one turn.
const ROOK_AND_KNIGHT = (turn = 1) =>
  lastAction(
    rolled('4k3/8/8/r7/8/8/1n6/R1B1K3 w - - 0 1', [ROOK, BISHOP, PAWN], turn),
    'a1a5',
    'c1b2',
  );
const WHITE_TAKES_KING = (turn = 1, id = 'host') =>
  lastAction(
    rolled('4k3/8/8/8/8/8/8/4RK2 w - - 0 1', [ROOK, PAWN, PAWN], turn, id),
    'e1e8',
  );
const BLACK_TAKES_KING = (turn = 1, id = 'host') =>
  lastAction(
    rolled('4k3/8/8/8/8/8/8/4K2r b - - 0 1', [ROOK, PAWN, PAWN], turn, id),
    'h1e1',
  );

// The host in the middle of a game: the pass already taught, and `since` turns
// after her last line at `turn`.
const midGame = (
  turn: number,
  since: number,
  extra: Partial<HostState> = {},
): HostState => ({
  ...INITIAL_HOST_STATE,
  played: true,
  handoffSaid: true,
  lastSpokenTurn: turn - since,
  ...extra,
});

const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};
const never = () => 0.99;

const cueOf = (
  [before, after]: [Game, Game],
  state: HostState,
  random: () => number = () => 0,
) => hostVoiceCue(before, after, state, random);

// ── The lines ──────────────────────────────────────────────────────────────────

test('the host has 45 lines, numbered by event from 1', () => {
  assert.equal(HOST_CATALOGUE.length, 45);
  const ids = HOST_CATALOGUE.map((line) => line.id);
  assert.equal(new Set(ids).size, ids.length);
  const counts: Record<HostEvent, number> = {
    intro: 5,
    again: 3,
    handoff: 3,
    empty_roll: 4,
    capture_heavy: 5,
    capture_queen: 4,
    capture: 4,
    en_passant: 3,
    promotion: 3,
    white_wins: 3,
    black_wins: 3,
    win: 2,
    draw: 3,
  };
  for (const event of Object.keys(HOST_EVENTS) as HostEvent[]) {
    const lines = hostLinesFor(event);
    assert.equal(lines.length, counts[event], event);
    lines.forEach((line, index) => {
      assert.equal(line.id, `host_${event}_${index + 1}`);
      assert.equal(line.bot, 'host');
      assert.equal(hostLineById(line.id), line);
    });
  }
  for (const line of HOST_CATALOGUE)
    assert.ok(Object.hasOwn(HOST_EVENTS, line.event), line.id);
});

// Her bubble, above the bottom badge (#213), shows at most two rows of 20 dp
// text. It is about 50 dp wider than the one beside a bot's portrait, whose
// rows held 23 characters on the Virtual Device (2026-10-03), so rows of 25
// leave room.
const HOST_ROW_CHARACTERS = 25;

test('every host line fits the two rows of her bubble', () => {
  const long = HOST_CATALOGUE.filter(
    (line) => rowsOf(line.text, HOST_ROW_CHARACTERS) > 2,
  ).map((line) => `${line.id} (${line.text})`);
  assert.deepEqual(long, []);
});

test('every host line is short, plain ASCII, and names no chess check', () => {
  for (const { id, text } of HOST_CATALOGUE) {
    assert.match(text, /^[\x20-\x7e]+$/, id);
    assert.ok(text.length <= 50, `${id} has ${text.length} characters`);
    // Dice Chess has no check: a king is taken.
    assert.doesNotMatch(text, /\b(check|checkmate|stalemate)\b/i, id);
  }
});

test('only the end of the game is the last word', () => {
  for (const line of HOST_CATALOGUE)
    assert.equal(
      isResultLine(line),
      ['white_wins', 'black_wins', 'win', 'draw'].includes(line.event),
      line.id,
    );
});

// ── The start of a game ──────────────────────────────────────────────────────

test('a new game opens with a greeting, and with another one later in the session', () => {
  const first = hostVoiceCue(null, newGame('hotseat', 'one'));
  assert.equal(first.event, 'intro');
  assert.equal(first.line?.event, 'intro');
  assert.equal(first.state.lastSpokenTurn, 1);
  const again = hostVoiceCue(null, newGame('hotseat', 'two'), {
    ...first.state,
    played: true,
  });
  assert.equal(again.event, 'again');
});

test('a game resumed part of the way through is hosted quietly from its turn', () => {
  const resumed = { ...rolled(OPENING, [2, 2, 2], 7), revision: 13 };
  const cue = hostVoiceCue(null, resumed);
  assert.equal(cue.line, null);
  assert.equal(cue.state.lastSpokenTurn, 7);
});

test('a game against a bot is never hosted', () => {
  assert.equal(hostVoiceCue(null, newGame('random', 'bot')).line, null);
  const before = newGame('greedy', 'bot', '4k3/8/8/8/8/8/8/4RK2 w - - 0 1');
  const after = rollGame(before, [ROOK, PAWN, PAWN]);
  const cue = hostVoiceCue(before, moveGame(after, 'e1e8'), midGame(1, 0));
  assert.equal(cue.line, null);
  assert.deepEqual(
    hostEvents(after, moveGame(after, 'e1e8'), midGame(1, 0)),
    [],
  );
});

test('the same game again, or the same id started again, starts nothing new', () => {
  const game = newGame('hotseat', 'same');
  const start = hostVoiceCue(null, game);
  assert.equal(hostVoiceCue(game, game, start.state).line, null);
  // An ended game replaced by a new one with the same id is a new game.
  const [, ended] = WHITE_TAKES_KING(4, 'same');
  const fresh = hostVoiceCue(ended, game, midGame(4, 0));
  assert.equal(fresh.event, 'again');
});

// ── Steps that are not pauses ─────────────────────────────────────────────────

test('she says nothing while a turn is being played, nor as the next begins', () => {
  const state = midGame(9, 8);
  const start = { ...newGame('hotseat', 'quiet'), turn: 9, revision: 3 };
  const roll = rollGame(start, [2, 2, 2]);
  assert.equal(hostVoiceCue(start, roll, state).line, null, 'a roll');
  const one = moveGame(roll, 'b1c3');
  assert.equal(hostVoiceCue(roll, one, state).line, null, 'an action');
  // A capture with actions still to come is judged at the end of the turn.
  const taking = rolled(
    '4k3/8/8/b7/8/8/8/R3K3 w - - 0 1',
    [ROOK, KING, KING],
    9,
  );
  const took = moveGame(taking, 'a1a5');
  assert.equal(took.phase, 'move');
  assert.deepEqual(hostEvents(taking, took, state), []);
  assert.equal(hostVoiceCue(taking, took, state).line, null, 'a capture');
  const [, ended] = EN_PASSANT(9);
  assert.equal(
    hostVoiceCue(ended, nextTurn(ended), state).line,
    null,
    'the next turn',
  );
});

test('a capture early in the turn is said at its end', () => {
  const taking = rolled(
    '4k3/8/8/b7/8/8/8/R3K3 w - - 0 1',
    [ROOK, KING, KING],
    5,
  );
  const [before, after] = lastAction(taking, 'a1a5', 'e1d1', 'd1c1');
  assert.equal(after.phase, 'handoff');
  assert.deepEqual(hostEvents(before, after, midGame(5, 6)), ['capture']);
  assert.equal(cueOf([before, after], midGame(5, 6)).event, 'capture');
});

// ── What a turn's end gives her to say ────────────────────────────────────────

test('each moment of a turn is named at its end', () => {
  const state = midGame(1, 0);
  const events = (step: [Game, Game]) => hostEvents(step[0], step[1], state);
  assert.deepEqual(events(emptyRollStep()), ['empty_roll']);
  assert.deepEqual(events(takes('q')), ['capture_queen']);
  assert.deepEqual(events(takes('r')), ['capture_heavy']);
  for (const piece of ['b', 'n', 'p'])
    assert.deepEqual(events(takes(piece)), ['capture'], piece);
  assert.deepEqual(events(EN_PASSANT()), ['en_passant']);
  assert.deepEqual(events(PROMOTION()), ['promotion']);
  assert.deepEqual(events(PROMOTION_TAKING_QUEEN()), [
    'promotion',
    'capture_queen',
  ]);
  assert.deepEqual(events(ROOK_AND_KNIGHT()), ['capture_heavy', 'capture']);
});

test('each moment is said, once its pacing allows', () => {
  const said = (step: [Game, Game], since: number) =>
    cueOf(step, midGame(step[1].turn, since)).event;
  assert.equal(
    said(emptyRollStep(OPENING, [QUEEN, ROOK, KING], 3), 2),
    'empty_roll',
  );
  assert.equal(said(takes('q', 3), 0), 'capture_queen');
  assert.equal(said(takes('r', 3), 2), 'capture_heavy');
  assert.equal(said(takes('n', 7), 6), 'capture');
  assert.equal(said(EN_PASSANT(3), 0), 'en_passant');
  assert.equal(said(PROMOTION(3), 0), 'promotion');
  // A promotion that takes a queen is, above all, a promotion.
  assert.equal(said(PROMOTION_TAKING_QUEEN(3), 0), 'promotion');
});

test('a queen is said even right after another line', () => {
  const cue = cueOf(takes('q', 2), midGame(2, 0));
  assert.equal(cue.event, 'capture_queen');
  assert.ok(cue.line?.id.startsWith('host_capture_queen_'));
});

// ── Teaching the pass ─────────────────────────────────────────────────────────

test('the first White turn end of a session teaches the pass, over a capture', () => {
  const step = takes('r');
  const fresh: HostState = { ...INITIAL_HOST_STATE, lastSpokenTurn: 1 };
  assert.deepEqual(hostEvents(...step, fresh), ['handoff', 'capture_heavy']);
  const cue = cueOf(step, fresh);
  assert.equal(cue.event, 'handoff');
  assert.equal(cue.state.handoffSaid, true);
  // Never again in the session, in this game or the next.
  assert.deepEqual(hostEvents(...takes('r', 3), cue.state), ['capture_heavy']);
  const next = hostVoiceCue(null, newGame('hotseat', 'next'), cue.state);
  assert.equal(next.state.handoffSaid, true);
  assert.deepEqual(hostEvents(...emptyRollStep(), next.state), ['empty_roll']);
});

test('a Black turn end never teaches the pass', () => {
  const step = emptyRollStep('4k3/8/8/8/8/8/8/R3K3 b - - 0 1', [
    PAWN,
    PAWN,
    PAWN,
  ]);
  assert.deepEqual(hostEvents(...step, INITIAL_HOST_STATE), ['empty_roll']);
});

test('a turn that ends the game gives the result, and the pass waits for a later game', () => {
  const cue = cueOf(WHITE_TAKES_KING(), {
    ...INITIAL_HOST_STATE,
    lastSpokenTurn: 1,
  });
  assert.equal(cue.event, 'white_wins');
  assert.equal(cue.state.handoffSaid, false);
});

// ── The end of the game ───────────────────────────────────────────────────────

const ids = (...events: HostEvent[]) =>
  events.flatMap((event) => hostLinesFor(event).map((line) => line.id));

test('the winner is cheered, and the loser too', () => {
  const white = cueOf(WHITE_TAKES_KING(), midGame(1, 0));
  assert.equal(white.event, 'white_wins');
  assert.ok(ids('white_wins', 'win').includes(white.line!.id));
  const black = cueOf(BLACK_TAKES_KING(), midGame(1, 0));
  assert.equal(black.event, 'black_wins');
  assert.ok(ids('black_wins', 'win').includes(black.line!.id));
});

test('a resignation is the other side winning, and a draw is a draw', () => {
  const white = rolled(OPENING, [2, 2, 2], 4);
  assert.equal(
    cueOf([white, resignGame(white)], midGame(4, 0)).event,
    'black_wins',
  );
  const blackToMove = rolled(
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
    [2, 2, 2],
    4,
  );
  assert.equal(
    cueOf([blackToMove, resignGame(blackToMove)], midGame(4, 0)).event,
    'white_wins',
  );
  assert.equal(cueOf([white, agreeDraw(white)], midGame(4, 0)).event, 'draw');
  const quiet = lastAction(
    rolled('4k3/8/8/8/8/8/8/R3K3 w - - 99 1', [ROOK, PAWN, PAWN], 4),
    'a1a2',
  );
  assert.equal(quiet[1].result?.reason, '100-halfmoves');
  assert.equal(cueOf(quiet, midGame(4, 0)).event, 'draw');
});

test('the result ignores the cooldown, and the captures of its turn are not said', () => {
  // The rook takes the knight, then the king.
  const start = rolled(
    '4k3/8/8/8/8/8/4n3/4RK2 w - - 0 1',
    [ROOK, ROOK, PAWN],
    6,
  );
  const [before, after] = lastAction(start, 'e1e2', 'e2e8');
  assert.equal(after.result?.winner, 'w');
  assert.deepEqual(hostEvents(before, after, midGame(6, 0)), ['white_wins']);
});

// ── Pacing ────────────────────────────────────────────────────────────────────

test('a queen is said its first two times in a game, then as a notable event', () => {
  let state = midGame(1, 0);
  const at = (turn: number) => {
    const cue = cueOf(takes('q', turn), state);
    state = cue.state;
    return cue.event;
  };
  assert.equal(at(2), 'capture_queen');
  assert.equal(at(3), 'capture_queen');
  // The third waits for the notable cooldown.
  assert.equal(at(4), null);
  assert.equal(at(5), 'capture_queen');
  // Three said in all is the most a game has.
  assert.equal(at(7), null);
  assert.equal(at(9), null);
});

test('a rook waits a round, and is said three times a game at most', () => {
  let state = midGame(1, 0);
  const at = (turn: number) => {
    const cue = cueOf(takes('r', turn), state);
    state = cue.state;
    return cue.event;
  };
  assert.equal(at(2), null, 'one turn after the last line');
  assert.equal(at(3), 'capture_heavy');
  assert.equal(at(5), 'capture_heavy');
  assert.equal(at(7), 'capture_heavy');
  assert.equal(at(9), null, 'a fourth');
  // A new game counts afresh.
  state = hostVoiceCue(null, newGame('hotseat', 'later'), state).state;
  assert.equal(at(3), 'capture_heavy');
});

test('a small capture waits three rounds, with a chance that halves on repeats', () => {
  const at = (since: number, spoken: number, chance: number) =>
    cueOf(
      takes('b', 20),
      midGame(20, since, { spoken: { capture: spoken } }),
      sequence(chance, 0),
    ).event;
  assert.equal(at(5, 0, 0), null, 'before six turns');
  assert.equal(at(6, 0, 0.69), 'capture');
  assert.equal(at(6, 0, 0.71), null);
  assert.equal(at(6, 1, 0.34), 'capture');
  assert.equal(at(6, 1, 0.36), null);
  assert.equal(at(6, 2, 0.17), 'capture');
  assert.equal(at(6, 2, 0.18), null);
  assert.equal(HOST_PACING.frequentChance, 0.7);
  assert.equal(HOST_PACING.repeatDecay, 0.5);
});

test('the chance is drawn only once the cooldown has passed', () => {
  let draws = 0;
  cueOf(takes('b', 20), midGame(20, 3), () => {
    draws++;
    return 0;
  });
  assert.equal(draws, 0);
});

test('the most important moment wins, and one that may not speak gives way', () => {
  // A rook and a knight in one turn: the rook, a notable event, wins.
  const both = ROOK_AND_KNIGHT(20);
  assert.equal(cueOf(both, midGame(20, 6)).event, 'capture_heavy');
  // With the rook said three times already, the knight is said instead.
  assert.equal(
    cueOf(both, midGame(20, 6, { spoken: { capture_heavy: 3 } })).event,
    'capture',
  );
});

test('after eight quiet turns, whatever happens is said', () => {
  assert.equal(cueOf(takes('b', 20), midGame(20, 7), never).event, null);
  assert.equal(cueOf(takes('b', 20), midGame(20, 8), never).event, 'capture');
  assert.equal(
    cueOf(takes('r', 20), midGame(20, 8, { spoken: { capture_heavy: 3 } }))
      .event,
    'capture_heavy',
  );
  assert.equal(HOST_PACING.silenceBreakerTurns, 8);
});

test('one step says one line at most', () => {
  const cue = cueOf(ROOK_AND_KNIGHT(20), midGame(20, 8));
  assert.equal(cue.state.spoken.capture_heavy, 1);
  assert.equal(cue.state.spoken.capture, undefined);
  assert.equal(cue.state.happened.capture, 1, 'the knight still happened');
});

// ── The bag of lines ──────────────────────────────────────────────────────────

// A seeded generator, so the bag is shuffled differently every time.
const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2 ** 31;
  return seed / 2 ** 31;
};

test('every line of an event is heard before any repeats, and a refill never repeats the last', () => {
  const random = seeded(7);
  let state = INITIAL_HOST_STATE;
  const heard: string[] = [];
  for (let game = 0; game < 25; game++) {
    const cue = hostVoiceCue(
      null,
      newGame('hotseat', `g${game}`),
      state,
      random,
    );
    heard.push(cue.line!.id);
    state = { ...cue.state, played: false };
  }
  // Five intros a round, the bag kept from one game to the next.
  for (let round = 0; round < 5; round++)
    assert.deepEqual(
      heard.slice(round * 5, round * 5 + 5).sort(),
      ids('intro').sort(),
      `round ${round}`,
    );
  for (let i = 1; i < heard.length; i++)
    assert.notEqual(heard[i], heard[i - 1], `pick ${i}`);
});

test("a colour's win draws from its own lines and the ones that name no colour", () => {
  let state = midGame(1, 0);
  const heard = new Set<string>();
  for (let game = 0; game < 5; game++) {
    state = hostVoiceCue(null, newGame('hotseat', `w${game}`), state).state;
    const cue = cueOf(WHITE_TAKES_KING(1, `w${game}`), state, seeded(game + 1));
    assert.equal(cue.event, 'white_wins');
    heard.add(cue.line!.id);
    state = cue.state;
  }
  assert.deepEqual([...heard].sort(), ids('white_wins', 'win').sort());
});

test('the line that ended one game never ends the next, whichever colour won', () => {
  // The colourless lines are in both colours' pools, each with its own bag.
  const random = seeded(11);
  let state = midGame(1, 0);
  let last: string | undefined;
  const heard = new Set<string>();
  for (let game = 0; game < 300; game++) {
    const id = `r${game}`;
    state = hostVoiceCue(null, newGame('hotseat', id), state, random).state;
    const white = random() < 0.5;
    const cue = cueOf(
      white ? WHITE_TAKES_KING(1, id) : BLACK_TAKES_KING(1, id),
      state,
      random,
    );
    assert.equal(cue.event, white ? 'white_wins' : 'black_wins');
    assert.notEqual(cue.line!.id, last, `game ${game}`);
    last = cue.line!.id;
    heard.add(last);
    state = cue.state;
  }
  assert.deepEqual(
    [...heard].sort(),
    ids('white_wins', 'black_wins', 'win').sort(),
  );
});

test("a colourless line heard for one colour leaves the other colour's bag", () => {
  const state = midGame(1, 0, {
    bags: {
      white_wins: ['host_win_1', 'host_white_wins_1'],
      black_wins: ['host_win_1', 'host_black_wins_2', 'host_win_2'],
    },
  });
  const white = cueOf(WHITE_TAKES_KING(), state);
  assert.equal(white.line?.id, 'host_win_1');
  assert.deepEqual(white.state.bags.black_wins, [
    'host_black_wins_2',
    'host_win_2',
  ]);
  const black = cueOf(BLACK_TAKES_KING(1, 'next'), {
    ...white.state,
    happened: {},
    spoken: {},
  });
  assert.equal(black.line?.id, 'host_black_wins_2');
});

test('a line dropped unheard is the next one of its event', () => {
  const first = hostVoiceCue(null, newGame('hotseat', 'drop'));
  const id = first.line!.id;
  const restored = restoreLine(first.state, 'intro', id);
  const next = hostVoiceCue(null, newGame('hotseat', 'again'), {
    ...restored,
    played: false,
  });
  assert.equal(next.line?.id, id);
  // The counts stay: it spent the cooldown.
  assert.equal(restored.lastSpokenTurn, first.state.lastSpokenTurn);
});

test('a pass of the remote that was never heard is taught later', () => {
  const cue = cueOf(takes('r'), { ...INITIAL_HOST_STATE, lastSpokenTurn: 1 });
  assert.equal(cue.event, 'handoff');
  const restored = restoreLine(cue.state, 'handoff', cue.line!.id);
  assert.equal(restored.handoffSaid, false);
});

// ── The capture analysis the bots share ───────────────────────────────────────

test('the capture analysis agrees with the cues, and gives the bots what it gave them', () => {
  const steps: [string, [Game, Game]][] = [
    ['queen', takes('q')],
    ['rook', takes('r')],
    ['bishop', takes('b')],
    ['knight', takes('n')],
    ['pawn', takes('p')],
    ['en passant', EN_PASSANT()],
    ['promotion', PROMOTION()],
    ['promotion taking a queen', PROMOTION_TAKING_QUEEN()],
    ['quiet', lastAction(rolled(OPENING, [2, 2, 2]), 'b1c3')],
  ];
  const heavy = new Set(['queen', 'rook', 'promotion taking a queen']);
  const standard = new Set(['bishop', 'knight', 'pawn', 'en passant']);
  for (const [name, [before, after]] of steps) {
    const analysis = analyzeCaptures(before, after);
    const heard = cues(before, after);
    assert.equal(analysis.promotion, heard.includes('promotion'), name);
    const took =
      heard.includes('piece_capture') ||
      (heard.includes('promotion') && name === 'promotion taking a queen');
    assert.equal(
      analysis.queen || analysis.rook || analysis.minor || analysis.enPassant,
      took,
      name,
    );
    assert.equal(analysis.heavy, heavy.has(name), name);
    assert.equal(analysis.standard, standard.has(name), name);
  }
});
