import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { DiceChess } from '@fortemate/dicechess-engine';
import {
  newGame,
  rollGame,
  moveGame,
  nextTurn,
  viewGame,
  decodeGame,
  applyBotReply,
  resignGame,
  agreeDraw,
  rollDice,
  type Game,
} from '../src/core/game.ts';
import { SnapshotStore } from '../src/storage.ts';

const position = (board: string, clock = 0) => `${board} w - - ${clock} 1`;

test('all mandatory actions precede handoff; a roll cannot be repeated after save/reload', () => {
  let game = rollGame(newGame('hotseat', 'mandatory'), [1, 1, 2]);
  assert.throws(() => nextTurn(game));
  game = moveGame(game, viewGame(game).legal[0]);
  const restored = decodeGame(JSON.stringify(game));
  assert.deepEqual(restored, game);
  assert.equal(viewGame(restored).remaining.length, 2);
  assert.throws(() => rollGame(restored, [6, 6, 6]));
  while (game.phase === 'move') game = moveGame(game, viewGame(game).legal[0]);
  assert.equal(game.moves.length, 3);
  assert.equal(game.phase, 'handoff');
  const next = nextTurn(game);
  assert.equal(viewGame(next).side, 'b');
  assert.equal(next.phase, 'roll');
  assert.deepEqual(next.roll, []);
  assert.equal(next.turn, 2);
});

test('an unusable roll passes; king capture ends immediately without switching sides', () => {
  const pass = rollGame(newGame('hotseat', 'pass'), [4, 4, 4]);
  assert.equal(pass.phase, 'handoff');
  assert.equal(pass.moves.length, 0);
  assert.equal(viewGame(nextTurn(pass)).side, 'b');
  let capture = rollGame(
    newGame('hotseat', 'capture', position('4k3/4Q3/8/8/8/8/8/K7')),
    [5, 5, 5],
  );
  capture = moveGame(capture, 'e7e8');
  assert.deepEqual(capture.result, { winner: 'w', reason: 'king-captured' });
  assert.equal(viewGame(capture).side, 'w');
  assert.deepEqual(decodeGame(JSON.stringify(capture)), capture);
  assert.throws(() => nextTurn(capture));
  assert.throws(() => moveGame(capture, 'e8e7'));
});

test('promotion is selected only from canonical legal suffixes; castling and en passant stay engine-owned', () => {
  const promotion = rollGame(
    newGame('hotseat', 'promotion', position('4k3/P7/8/8/8/8/8/4K3')),
    [1, 4, 5],
  );
  const choices = viewGame(promotion).legal.filter((m) => m.startsWith('a7a8'));
  assert.deepEqual([...choices].sort(), ['a7a8q', 'a7a8r']);
  assert.throws(() => moveGame(promotion, 'a7a8n'));
  assert.match(viewGame(moveGame(promotion, 'a7a8r')).dfen, /^R3k3/);
  const castle = rollGame(
    newGame('hotseat', 'castle', '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1'),
    [6, 4, 4],
  );
  assert.ok(viewGame(castle).legal.includes('e1g1'));
  assert.match(viewGame(moveGame(castle, 'e1g1')).dfen, /R4RK1/);
  assert.equal(viewGame(moveGame(castle, 'e1g1')).remaining, 'R');
  assert.equal(viewGame(moveGame(promotion, 'a7a8r')).remaining, 'RQ');
  const ep = rollGame(
    newGame('hotseat', 'ep', '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1'),
    [1, 1, 1],
  );
  assert.ok(viewGame(ep).legal.includes('e5d6'));
  assert.match(viewGame(moveGame(ep, 'e5d6')).dfen, /4k3\/8\/3P4\/8\//);
});

test('automatic draws are turn-boundary checks; resignation and agreed draws cannot revive a game', () => {
  let game = rollGame(
    newGame('hotseat', 'clock', position('4k3/8/8/8/8/8/8/4K3', 99)),
    [6, 6, 6],
  );
  game = moveGame(game, viewGame(game).legal[0]);
  assert.equal(game.phase, 'move');
  while (game.phase === 'move') game = moveGame(game, viewGame(game).legal[0]);
  assert.deepEqual(game.result, { winner: null, reason: '100-halfmoves' });
  assert.deepEqual(decodeGame(JSON.stringify(game)), game);
  const resign = resignGame(newGame('random', 'resign'));
  assert.deepEqual(resign.result, { winner: 'b', reason: 'resigned' });
  assert.throws(() => rollGame(resign, [1, 1, 1]));
  assert.equal(
    agreeDraw(newGame('hotseat', 'draw')).result?.reason,
    'agreed-draw',
  );
  assert.throws(() => agreeDraw(newGame('random', 'no-draw')));
});

test('bot replies are complete and tied to game id, revision and exact position', () => {
  let game = newGame('random', 'bot');
  game = nextTurn(rollGame(game, [4, 4, 4]));
  game = rollGame(game, [1, 1, 2]);
  const dfen = viewGame(game).dfen;
  const path = DiceChess.getBestMove(dfen, { algorithm: 'random' }).moves.map(
    (m) => m.from + m.to + (m.promotion ?? '').toLowerCase(),
  );
  const reply = { gameId: game.id, revision: game.revision, dfen, moves: path };
  assert.equal(applyBotReply(game, reply).phase, 'handoff');
  for (const invalid of [
    { ...reply, gameId: 'old' },
    { ...reply, revision: 0 },
    { ...reply, dfen: 'old' },
    { ...reply, moves: path.slice(0, 1) },
    { ...reply, moves: [...path, 'e7e5'] },
  ])
    assert.throws(() => applyBotReply(game, invalid));
});

test('strict storage restores a partial full-game turn without touching the diagnostic database', async () => {
  const factory = new IDBFactory();
  let saves = new SnapshotStore<Game>(factory, {
    database: 'games-test',
    key: 'active.v2',
    decode: decodeGame,
  });
  let game = rollGame(newGame('random', 'partial'), [1, 2, 3]);
  game = moveGame(game, viewGame(game).legal[0]);
  await saves.save(game);
  await saves.close();
  saves = new SnapshotStore<Game>(factory, {
    database: 'games-test',
    key: 'active.v2',
    decode: decodeGame,
  });
  assert.deepEqual(await saves.load(), game);
  assert.deepEqual(viewGame((await saves.load())!), viewGame(game));
  await saves.close();
});

test('damaged rolls, skipped mandatory moves and forged results are rejected', () => {
  const game = rollGame(newGame('hotseat', 'invalid'), [1, 1, 2]);
  for (const bad of [
    { ...game, roll: [0, 1, 2] },
    { ...game, roll: [] },
    { ...game, phase: 'handoff' },
    { ...game, start: 'broken' },
    { ...game, moves: ['e2e5'] },
    {
      ...game,
      result: { winner: 'w', reason: 'king-captured' },
      phase: 'ended',
    },
  ])
    assert.throws(() => decodeGame(JSON.stringify(bad)));
});

test('dice rejection sampling discards bytes 252 through 255', () => {
  assert.deepEqual(
    rollDice((bytes) => bytes.set([255, 254, 253, 252, 0, 1, 5, 2])),
    [1, 2, 6],
  );
  assert.throws(() => rollDice((bytes) => bytes.fill(255)));
});

test('a reproducible complete local game reaches a canonical result', () => {
  let seed = 42;
  const dice = () =>
    rollDice((bytes) => {
      for (let i = 0; i < bytes.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        bytes[i] = seed >>> 24;
      }
    });
  let game = newGame('hotseat', 'complete');
  let actions = 0;
  while (game.phase !== 'ended' && actions++ < 20000) {
    if (game.phase === 'roll') game = rollGame(game, dice());
    else if (game.phase === 'handoff') game = nextTurn(game);
    else {
      const legal = viewGame(game).legal;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      game = moveGame(game, legal[seed % legal.length]);
    }
    game = decodeGame(JSON.stringify(game));
  }
  assert.equal(game.phase, 'ended');
  assert.ok(game.result);
});

test('Random paths remain legal over complete turns, including duplicate dice', () => {
  let game = newGame('random', 'random-sequence');
  let seed = 91;
  for (let turn = 0; turn < 150 && game.phase !== 'ended'; turn++) {
    const dice = Array.from({ length: 3 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return (seed % 6) + 1;
    });
    game = rollGame(game, dice);
    if (game.phase === 'move' && viewGame(game).bot) {
      const dfen = viewGame(game).dfen;
      const moves = DiceChess.getBestMove(dfen, {
        algorithm: 'random',
      }).moves.map((m) => m.from + m.to + (m.promotion ?? '').toLowerCase());
      game = applyBotReply(game, {
        gameId: game.id,
        revision: game.revision,
        dfen,
        moves,
      });
    } else
      while (game.phase === 'move')
        game = moveGame(game, viewGame(game).legal[0]);
    assert.deepEqual(decodeGame(JSON.stringify(game)), game);
    if (game.phase === 'handoff') game = nextTurn(game);
  }
});

test('turn cap finishes a forced pass and cannot produce a turn beyond the save limit', () => {
  const game = rollGame(
    { ...newGame('hotseat', 'cap'), turn: 5000 },
    [4, 4, 4],
  );
  assert.deepEqual(game.result, { winner: null, reason: 'turn-limit' });
  assert.deepEqual(decodeGame(JSON.stringify(game)), game);
  assert.throws(() => nextTurn(game));
});
