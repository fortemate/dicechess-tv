// The local opponents (#115): who they are, which engine algorithm each plays,
// and that the cards never promise more than the engine's own rating.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DiceChess } from '@fortemate/dicechess-engine';
import {
  BOT_MODES,
  INITIAL_POSITION,
  decodeGame,
  newGame,
  resignGame,
  rollGame,
} from '../src/core/game.ts';
import { botReply, engineBot } from '../src/core/bot.ts';
import { emptyLedger, record } from '../src/core/ledger.ts';
import { OPPONENTS, opponentOf } from '../src/core/opponents.ts';

test('the opponents are the bot modes, each an engine algorithm that is not experimental', () => {
  assert.deepEqual(
    OPPONENTS.map((opponent) => opponent.mode),
    [...BOT_MODES],
  );
  const bots = new Map(
    DiceChess.getAvailableBots().map((bot) => [bot.id, bot]),
  );
  for (const opponent of OPPONENTS) {
    const bot = bots.get(engineBot(opponent.mode));
    assert.ok(bot, `${opponent.mode} is an engine algorithm`);
    assert.equal(bot.isExperimental, false, opponent.mode);
    assert.equal(opponentOf(opponent.mode), opponent);
  }
});

test('the levels rise with the engine’s own difficulty rating', () => {
  const difficulty = new Map(
    DiceChess.getAvailableBots().map((bot) => [bot.id, bot.difficulty]),
  );
  const ratings = OPPONENTS.map((opponent) =>
    difficulty.get(engineBot(opponent.mode))!,
  );
  assert.deepEqual(
    ratings,
    [...ratings].sort((a, b) => a - b),
    'easiest first',
  );
  assert.equal(new Set(ratings).size, ratings.length, 'no two levels tie');
  assert.deepEqual(
    OPPONENTS.map((opponent) => opponent.level),
    ['Easy', 'Medium', 'Hard'],
  );
});

test('names are distinct and each style fits three lines of a card', () => {
  assert.equal(
    new Set(OPPONENTS.map((opponent) => opponent.name)).size,
    OPPONENTS.length,
  );
  for (const opponent of OPPONENTS) {
    assert.ok(
      opponent.style.length <= 60,
      `${opponent.name}: ${opponent.style}`,
    );
  }
});

test('each opponent plays with its own algorithm', () => {
  const original = DiceChess.getBestMove.bind(DiceChess);
  const asked: (string | undefined)[] = [];
  const spy = mock.method(
    DiceChess,
    'getBestMove',
    (dfen: string, options?: { algorithm?: string }) => {
      asked.push(options?.algorithm);
      return original(dfen, options);
    },
  );
  try {
    for (const mode of BOT_MODES) {
      // The person plays Black, so White, the bot, owes the first turn.
      const game = rollGame(
        newGame(mode, `bot-${mode}`, INITIAL_POSITION, 'b'),
        [5, 4, 2],
      );
      assert.ok(botReply(game).moves.length > 0, mode);
    }
  } finally {
    spy.mock.restore();
  }
  assert.deepEqual(asked, BOT_MODES.map(engineBot));
  assert.throws(
    () => botReply(rollGame(newGame('hotseat', 'nobody'), [5, 4, 2])),
    /No opponent/,
  );
});

test('games against every opponent save and read back; an unknown opponent is refused', () => {
  for (const mode of BOT_MODES) {
    const game = newGame(mode, `save-${mode}`, INITIAL_POSITION, 'w', 'random');
    assert.equal(decodeGame(JSON.stringify(game)).mode, mode);
  }
  const forged = { ...newGame('random', 'forged'), mode: 'minimax' };
  assert.throws(() => decodeGame(JSON.stringify(forged)), /damaged/);
});

test('results are kept apart for each opponent', () => {
  const lost = (mode: (typeof BOT_MODES)[number]) =>
    resignGame(
      rollGame(newGame(mode, `lost-${mode}`, INITIAL_POSITION, 'w'), [5, 4, 2]),
    );
  let ledger = record(emptyLedger(), lost('greedy'));
  ledger = record(ledger, lost('aggressive'));
  assert.deepEqual(ledger.bots, {
    greedy: { w: { wins: 0, draws: 0, losses: 1 } },
    aggressive: { w: { wins: 0, draws: 0, losses: 1 } },
  });
});

test('Rolly takes the king whenever its first action can, whatever else it rolled', () => {
  assert.equal(engineBot('random'), 'random-king-capture');
  // The person plays Black; White's rook on a1 attacks the king on a8, and the
  // roll has a rook die beside two king dice.
  const start = 'k7/8/8/8/8/8/8/R3K2q w - - 0 1';
  for (let attempt = 0; attempt < 30; attempt++) {
    const game = rollGame(
      newGame('random', `rolly-${attempt}`, start, 'b'),
      [4, 6, 6],
    );
    assert.equal(botReply(game).moves[0], 'a1a8', `attempt ${attempt}`);
  }
});
