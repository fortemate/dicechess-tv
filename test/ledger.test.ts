import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyLedger,
  record,
  decodeLedger,
  summary,
  type Ledger,
} from '../src/core/ledger.ts';
import {
  newGame,
  rollGame,
  resignGame,
  agreeDraw,
  type Game,
  type Mode,
} from '../src/core/game.ts';

// A finished game of the given mode, without playing one out.
const ended = (mode: Mode, id: string, how: 'resign' | 'draw' = 'resign') => {
  const game = rollGame(newGame(mode, id), [5, 4, 2]);
  return how === 'draw' ? agreeDraw(game) : resignGame(game);
};

test('an unfinished game is never counted', () => {
  const ledger = emptyLedger();
  assert.equal(record(ledger, newGame('hotseat', 'a')), ledger);
  assert.equal(
    record(ledger, rollGame(newGame('hotseat', 'b'), [5, 4, 2])),
    ledger,
  );
  // Which is also why an abandoned game stays out: it never ends.
});

test('a result is counted exactly once, however many times it is offered', () => {
  const game = ended('hotseat', 'once');
  let ledger = record(emptyLedger(), game);
  assert.equal(ledger.hotseat.black, 1);

  // Every relaunch offers the same finished game again.
  for (let i = 0; i < 5; i++) ledger = record(ledger, game);
  assert.equal(ledger.hotseat.black, 1);
  assert.equal(ledger.lastCountedId, 'once');
});

test('the count and the marker are one value, so a crash cannot split them', () => {
  const ledger = record(emptyLedger(), ended('hotseat', 'atomic'));
  // Whatever is persisted carries both; there is no state in which the result
  // is counted but not marked, or marked but not counted.
  const persisted = decodeLedger(JSON.stringify(ledger));
  assert.equal(persisted.lastCountedId, 'atomic');
  assert.equal(persisted.hotseat.white + persisted.hotseat.black, 1);
});

test('hotseat is reported by colour, not by player', () => {
  let ledger = emptyLedger();
  // White resigns on White's turn, so Black wins.
  ledger = record(ledger, ended('hotseat', 'h1'));
  ledger = record(ledger, ended('hotseat', 'h2', 'draw'));
  assert.deepEqual(ledger.hotseat, { white: 0, draws: 1, black: 1 });
  assert.deepEqual(Object.keys(ledger.hotseat).sort(), [
    'black',
    'draws',
    'white',
  ]);
});

test('a game against an opponent is recorded under that opponent and the side played', () => {
  let ledger = emptyLedger();
  // In Random mode resigning is always the human's, so the human loses.
  ledger = record(ledger, ended('random', 'r1'), 'w');
  assert.deepEqual(ledger.bots.random?.w, { wins: 0, draws: 0, losses: 1 });
  assert.deepEqual(ledger.hotseat, { white: 0, draws: 0, black: 0 });

  // The same opponent played from the other side is a separate record, because
  // one number would hide how it plays each colour.
  ledger = record(ledger, ended('random', 'r2'), 'b');
  assert.deepEqual(ledger.bots.random?.b, { wins: 1, draws: 0, losses: 0 });
  assert.deepEqual(ledger.bots.random?.w, { wins: 0, draws: 0, losses: 1 });
});

test('a draw against an opponent counts for neither side', () => {
  // A draw agreement needs two players, so against an opponent a draw only
  // arrives from the rules: the halfmove boundary or the turn cap.
  const drawn: Game = {
    ...ended('random', 'd1'),
    result: { winner: null, reason: '100-halfmoves' },
  };
  const ledger = record(emptyLedger(), drawn, 'w');
  assert.deepEqual(ledger.bots.random?.w, { wins: 0, draws: 1, losses: 0 });
});

test('a ledger that no longer decodes is refused rather than reset to zero', () => {
  const good = record(emptyLedger(), ended('hotseat', 'x'));
  assert.deepEqual(decodeLedger(JSON.stringify(good)), good);

  for (const damaged of [
    { ...good, schema: 2 },
    { ...good, hotseat: { white: 1, draws: 0 } },
    { ...good, hotseat: { ...good.hotseat, white: -1 } },
    { ...good, bots: { random: { x: { wins: 0, draws: 0, losses: 0 } } } },
    { ...good, bots: { random: { w: { wins: 0 } } } },
    { ...good, lastCountedId: 7 },
  ]) {
    assert.throws(
      () => decodeLedger(JSON.stringify(damaged)),
      /Unsupported or damaged ledger/,
      JSON.stringify(damaged),
    );
  }
});

test('the summary lists each opponent and side a game was played from', () => {
  let ledger: Ledger = emptyLedger();
  ledger = record(ledger, ended('hotseat', 's1'));
  ledger = record(ledger, ended('random', 's2'), 'w');
  const view = summary(ledger);
  assert.deepEqual(view.hotseat, { white: 0, draws: 0, black: 1 });
  assert.equal(view.bots.length, 1);
  assert.equal(view.bots[0].opponent, 'random');
  assert.equal(view.bots[0].side, 'w');
  assert.deepEqual(view.bots[0].record, { wins: 0, draws: 0, losses: 1 });
});
