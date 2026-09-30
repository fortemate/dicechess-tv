import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  botVoiceCue,
  botVoiceLine,
  nextBotVoice,
  voiceLineById,
  voiceLinesFor,
  INITIAL_BOT_VOICE_STATE,
  PROBABILITY_EMPTY_ROLL,
  PROBABILITY_STANDARD_CAPTURE,
  VOICE_CATALOGUE,
  type BotVoiceState,
  type VoiceEvent,
} from '../src/core/botVoice.ts';
import { finish, turnDanger } from '../src/core/danger.ts';
import {
  moveGame,
  newGame,
  resignGame,
  rollGame,
  type BotMode,
  type Game,
} from '../src/core/game.ts';
import { opponentOf } from '../src/core/opponents.ts';

const PAWN = 1;
const KNIGHT = 2;
const BISHOP = 3;
const ROOK = 4;

const EVENTS: readonly VoiceEvent[] = [
  'intro',
  'empty_roll',
  'capture_heavy',
  'capture',
  'threat',
  'win',
  'loss',
];

const BOTS: readonly BotMode[] = ['random', 'greedy', 'aggressive'];

test('catalogue contains exactly 63 lines (3 lines per event for all 3 bots)', () => {
  assert.equal(VOICE_CATALOGUE.length, 63);

  const ids = new Set<string>();
  for (const line of VOICE_CATALOGUE) {
    assert.ok(line.id.length > 0, 'id must not be empty');
    assert.ok(line.text.length > 0, 'text must not be empty');
    assert.ok(!ids.has(line.id), `duplicate id: ${line.id}`);
    ids.add(line.id);
  }

  for (const bot of BOTS) {
    for (const event of EVENTS) {
      const lines = voiceLinesFor(bot, event);
      assert.equal(
        lines.length,
        3,
        `expected 3 lines for bot ${bot} and event ${event}`,
      );
      for (let i = 1; i <= 3; i++) {
        const id = `${lines[0].id.split('_')[0]}_${event}_${i}`;
        const found = voiceLineById(id);
        assert.ok(found, `expected line ${id} to exist`);
        assert.equal(found.bot, bot);
        assert.equal(found.event, event);
      }
    }
  }
});

// The bubble shows at most two rows of 20 dp text (#168), and a row holds
// about 36 characters on the Virtual Device, so a line is kept well inside two
// rows, with room for wide letters and for where the words break.
const BUBBLE_CHARACTERS = 64;

test('every voice line fits the two rows of the speech bubble', () => {
  const long = VOICE_CATALOGUE.filter(
    (line) => line.text.length > BUBBLE_CHARACTERS,
  ).map((line) => `${line.id} (${line.text.length})`);
  assert.deepEqual(long, []);
});

test('voiceLineById returns undefined for non-existent id', () => {
  assert.equal(voiceLineById('unknown_line_id'), undefined);
});

test('deterministic seed picks exact line variant', () => {
  const rolly = opponentOf('random');
  const game = newGame('random', 'seed-test');
  const rolledGame = rollGame(game, [KNIGHT, BISHOP, ROOK]);

  const line0 = botVoiceCue(
    game,
    rolledGame,
    rolly,
    'calm',
    INITIAL_BOT_VOICE_STATE,
    () => 0.0,
  ).line;
  const line1 = botVoiceCue(
    game,
    rolledGame,
    rolly,
    'calm',
    INITIAL_BOT_VOICE_STATE,
    () => 0.45,
  ).line;
  const line2 = botVoiceCue(
    game,
    rolledGame,
    rolly,
    'calm',
    INITIAL_BOT_VOICE_STATE,
    () => 0.95,
  ).line;

  assert.equal(line0?.id, 'rolly_intro_1');
  assert.equal(line1?.id, 'rolly_intro_2');
  assert.equal(line2?.id, 'rolly_intro_3');
});

test('an event never says the same line twice in a row (#159)', () => {
  const rolly = opponentOf('random');
  const game = newGame('random', 'repeat-test');
  const rolledGame = rollGame(game, [KNIGHT, BISHOP, ROOK]);
  const said = {
    ...INITIAL_BOT_VOICE_STATE,
    lastLines: { intro: 'rolly_intro_1' },
  };
  const pick = (random: number) =>
    botVoiceCue(game, rolledGame, rolly, 'calm', said, () => random);
  // The other two lines share the whole range between them.
  assert.equal(pick(0).line?.id, 'rolly_intro_2');
  assert.equal(pick(0.49).line?.id, 'rolly_intro_2');
  assert.equal(pick(0.5).line?.id, 'rolly_intro_3');
  assert.equal(pick(0.99).line?.id, 'rolly_intro_3');
  // The state remembers the line said, for this event only.
  const cue = pick(0);
  assert.deepEqual(cue.state.lastLines, { intro: 'rolly_intro_2' });
  const first = botVoiceCue(
    game,
    rolledGame,
    rolly,
    'calm',
    undefined,
    () => 0,
  );
  assert.deepEqual(first.state.lastLines, { intro: 'rolly_intro_1' });
});

test('match start triggers intro once and sets introSpoken flag', () => {
  const grabby = opponentOf('greedy');
  const start = newGame('greedy', 'intro-test');
  const rolled = rollGame(start, [KNIGHT, KNIGHT, KNIGHT]);

  const res1 = botVoiceCue(start, rolled, grabby);
  assert.equal(res1.line?.event, 'intro');
  assert.equal(res1.line?.bot, 'greedy');
  assert.equal(res1.state.introSpoken, true);
  assert.equal(res1.state.lastSpokenTurn, 1);

  // Calling again with updated state does not trigger intro twice
  const res2 = botVoiceCue(rolled, rolled, grabby, 'calm', res1.state);
  assert.equal(res2.line, null);
});

test('empty roll by the bot triggers empty_roll according to probability threshold', () => {
  const rampage = opponentOf('aggressive');
  // Black (bot) king only, pawns roll will yield no moves
  const position = 'k7/8/8/8/8/8/8/K7 b - - 0 1';
  const before = newGame('aggressive', 'empty-roll-test', position, 'w');
  const after = rollGame(before, [PAWN, PAWN, PAWN]);

  // Below threshold 0.7 triggers empty_roll
  const resTrigger = botVoiceCue(
    before,
    after,
    rampage,
    'calm',
    INITIAL_BOT_VOICE_STATE,
    () => PROBABILITY_EMPTY_ROLL - 0.1,
  );
  assert.equal(resTrigger.line?.event, 'empty_roll');
  assert.equal(resTrigger.line?.bot, 'aggressive');

  // At or above threshold 0.7 does not trigger
  const resSkip = botVoiceCue(
    before,
    after,
    rampage,
    'calm',
    INITIAL_BOT_VOICE_STATE,
    () => PROBABILITY_EMPTY_ROLL + 0.1,
  );
  assert.equal(resSkip.line, null);
});

test('bot capturing queen or rook triggers capture_heavy with 100% probability', () => {
  const grabby = opponentOf('greedy');
  // Black (bot) rook on a8, White (human) queen on a1
  const position = 'r6k/8/8/8/8/8/8/Q6K b - - 0 1';
  const game = rollGame(
    newGame('greedy', 'heavy-capture-test', position, 'w'),
    [ROOK, ROOK, ROOK],
  );
  const after = moveGame(game, 'a8a1');

  const res = botVoiceCue(
    game,
    after,
    grabby,
    'calm',
    INITIAL_BOT_VOICE_STATE,
    () => 0.99,
  );
  assert.equal(res.line?.event, 'capture_heavy');
  assert.equal(res.line?.bot, 'greedy');
  assert.equal(res.state.lastSpokenTurn, 1);
});

test('bot capturing standard piece triggers capture governed by 50% probability', () => {
  const rolly = opponentOf('random');
  // Black (bot) bishop on c8, White (human) pawn on f5
  const position = '2b4k/8/8/5P2/8/8/8/7K b - - 0 1';
  const game = rollGame(
    newGame('random', 'standard-capture-test', position, 'w'),
    [BISHOP, BISHOP, BISHOP],
  );
  const after = moveGame(game, 'c8f5');

  // Below 0.5 triggers standard capture
  const resPass = botVoiceCue(
    game,
    after,
    rolly,
    'calm',
    INITIAL_BOT_VOICE_STATE,
    () => PROBABILITY_STANDARD_CAPTURE - 0.1,
  );
  assert.equal(resPass.line?.event, 'capture');
  assert.equal(resPass.line?.bot, 'random');

  // At or above 0.5 skips
  const resSkip = botVoiceCue(
    game,
    after,
    rolly,
    'calm',
    INITIAL_BOT_VOICE_STATE,
    () => PROBABILITY_STANDARD_CAPTURE + 0.1,
  );
  assert.equal(resSkip.line, null);
});

test('critical danger triggers a threat and is capped at 1 line per game', () => {
  const rampage = opponentOf('aggressive');
  const game = newGame('aggressive', 'danger-test');

  // Turn 3: cooldown allows speaking
  const stateAtTurn3: BotVoiceState = {
    lastSpokenTurn: 1,
    threatSpoken: false,
    introSpoken: true,
  };
  const turn3Game: Game = { ...game, turn: 3 };

  const res1 = botVoiceCue(
    turn3Game,
    turn3Game,
    rampage,
    'critical',
    stateAtTurn3,
  );
  assert.equal(res1.line?.event, 'threat');
  assert.equal(res1.line?.bot, 'aggressive');
  assert.equal(res1.state.threatSpoken, true);
  assert.equal(res1.state.lastSpokenTurn, 3);

  // Turn 6: even after cooldown has elapsed, danger is not repeated
  const turn6Game: Game = { ...game, turn: 6 };
  const res2 = botVoiceCue(
    turn6Game,
    turn6Game,
    rampage,
    'critical',
    res1.state,
  );
  assert.equal(res2.line, null);
});

test("a threat follows the danger to the person's king, which turnDanger measures", () => {
  const rampage = opponentOf('aggressive');
  const quiet: BotVoiceState = {
    lastSpokenTurn: -99,
    threatSpoken: false,
    introSpoken: true,
  };
  // The person plays White. Rampage's rook on e4 attacks White's king on e1:
  // one rook die, and it takes that king with its first action.
  const start = '4k3/8/8/8/4r3/8/8/4K3 w - - 0 1';
  const threatened = newGame('aggressive', 'threatened', start, 'w');
  const level = finish(turnDanger(threatened));
  assert.equal(level, 'critical');
  const cue = botVoiceCue(threatened, threatened, rampage, level, quiet);
  assert.equal(cue.line?.event, 'threat');

  // Here the person's rook on e5 attacks Rampage's king instead. The level
  // stays calm, since it measures the person's king only, and the bot is quiet.
  const other = '4k3/8/8/4R3/8/8/8/4K3 w - - 0 1';
  const threatening = newGame('aggressive', 'threatening', other, 'w');
  const calm = finish(turnDanger(threatening));
  assert.equal(calm, 'calm');
  assert.equal(
    botVoiceCue(threatening, threatening, rampage, calm, quiet).line,
    null,
  );
});

test("every threat line speaks of the person's king", () => {
  for (const bot of BOTS) {
    const lines = voiceLinesFor(bot, 'threat');
    assert.ok(lines.length > 0, `no threat lines for ${bot}`);
    for (const line of lines)
      assert.match(line.text, /\byour king\b/i, line.id);
  }
});

test('no line speaks of check or checkmate, which Dice Chess does not have', () => {
  // The rules guide: "There is no checkmate. The king is taken like any other
  // piece." (src/core/rules.ts)
  for (const line of VOICE_CATALOGUE)
    assert.doesNotMatch(
      line.text,
      /\b(check|checks|checkmate|checkmated|stalemate)\b/i,
      line.id,
    );
});

test('a win line also plays when the person resigns', () => {
  const grabby = opponentOf('greedy');
  const game = newGame('greedy', 'resign-test');
  const state: BotVoiceState = {
    lastSpokenTurn: 1,
    threatSpoken: false,
    introSpoken: true,
  };
  const res = botVoiceCue(game, resignGame(game), grabby, 'calm', state);
  assert.equal(res.line?.event, 'win');
});

test('bot winning the game triggers win line and bypasses cooldown', () => {
  const rampage = opponentOf('aggressive');
  // Black (bot) rook takes White king on e1
  const position = '4r2k/8/8/8/8/8/8/4K3 b - - 0 1';
  const game = rollGame(newGame('aggressive', 'bot-win-test', position, 'w'), [
    ROOK,
    ROOK,
    ROOK,
  ]);
  const after = moveGame(game, 'e8e1');

  // Cooldown is active from the same turn
  const cooldownState: BotVoiceState = {
    lastSpokenTurn: after.turn,
    threatSpoken: false,
    introSpoken: true,
  };

  const res = botVoiceCue(game, after, rampage, 'calm', cooldownState);
  assert.equal(res.line?.event, 'win');
  assert.equal(res.line?.bot, 'aggressive');
  assert.equal(res.state.lastSpokenTurn, after.turn);
});

test('human winning triggers bot loss line and bypasses cooldown', () => {
  const grabby = opponentOf('greedy');
  // White (human) rook takes Black king on e8
  const position = '4k3/8/8/8/8/8/8/4R2K w - - 0 1';
  const game = rollGame(newGame('greedy', 'bot-loss-test', position, 'w'), [
    ROOK,
    ROOK,
    ROOK,
  ]);
  const after = moveGame(game, 'e1e8');

  const cooldownState: BotVoiceState = {
    lastSpokenTurn: after.turn,
    threatSpoken: false,
    introSpoken: true,
  };

  const res = botVoiceCue(game, after, grabby, 'calm', cooldownState);
  assert.equal(res.line?.event, 'loss');
  assert.equal(res.line?.bot, 'greedy');
});

test('anti-spam enforces turn cooldown between non-terminal lines', () => {
  const rolly = opponentOf('random');
  const position = '2b4k/8/8/5P2/8/8/8/7K b - - 0 1';
  const game = rollGame(newGame('random', 'cooldown-test', position, 'w'), [
    BISHOP,
    BISHOP,
    BISHOP,
  ]);
  const after = moveGame(game, 'c8f5');

  // Spoke on turn 1, current turn is 2 -> cooldown active (2 - 1 = 1 < 2)
  const turn2Game: Game = { ...after, turn: 2 };
  const stateTurn1: BotVoiceState = {
    lastSpokenTurn: 1,
    threatSpoken: false,
    introSpoken: true,
  };

  const resBlocked = botVoiceCue(
    { ...game, turn: 2 },
    turn2Game,
    rolly,
    'calm',
    stateTurn1,
    () => 0.1,
  );
  assert.equal(resBlocked.line, null);

  // Spoke on turn 1, current turn is 3 -> cooldown expired (3 - 1 = 2 >= 2)
  const turn3Game: Game = { ...after, turn: 3 };
  const resAllowed = botVoiceCue(
    { ...game, turn: 3 },
    turn3Game,
    rolly,
    'calm',
    stateTurn1,
    () => 0.1,
  );
  assert.equal(resAllowed.line?.event, 'capture');
});

test('hotseat games never trigger bot voice lines', () => {
  const rolly = opponentOf('random');
  const before = newGame('hotseat', 'hotseat-test');
  const after = rollGame(before, [KNIGHT, KNIGHT, KNIGHT]);

  const res = botVoiceCue(before, after, rolly);
  assert.equal(res.line, null);
});

test('botVoiceLine and nextBotVoice helpers match botVoiceCue behavior', () => {
  const grabby = opponentOf('greedy');
  const game = newGame('greedy', 'helpers-test');
  const rolled = rollGame(game, [KNIGHT, KNIGHT, KNIGHT]);
  const deterministicRandom = () => 0.0;

  const cue = botVoiceCue(
    game,
    rolled,
    grabby,
    'calm',
    INITIAL_BOT_VOICE_STATE,
    deterministicRandom,
  );
  const line = botVoiceLine(
    game,
    rolled,
    grabby,
    'calm',
    INITIAL_BOT_VOICE_STATE,
    deterministicRandom,
  );
  assert.ok(line);
  assert.equal(line.event, 'intro');
  assert.deepEqual(line, cue.line);

  const reduced = nextBotVoice(
    INITIAL_BOT_VOICE_STATE,
    game,
    rolled,
    grabby,
    'calm',
    deterministicRandom,
  );
  assert.deepEqual(reduced.line, line);
  assert.equal(reduced.nextState.introSpoken, true);
});
