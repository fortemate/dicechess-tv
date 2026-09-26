import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
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
  emptyRoll,
  type Game,
} from '../src/core/game.ts';
import {
  encodeSnapshot,
  type SnapshotStore,
} from '../src/core/snapshotStore.ts';

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

test('only a roll with nothing to play is an empty roll, not a turn that ran out of actions', () => {
  const fresh = newGame('hotseat', 'empty');
  assert.equal(emptyRoll(fresh), false);
  // Rook, rook, rook from the start: nothing can move.
  const stuck = rollGame(fresh, [4, 4, 4]);
  assert.equal(emptyRoll(stuck), true);
  assert.equal(emptyRoll(nextTurn(stuck)), false);
  // Knight, king, king: the knight moves, then nothing can use the kings. The
  // turn passes with dice left over, which is not an empty roll.
  const rolled = rollGame(fresh, [2, 6, 6]);
  assert.equal(emptyRoll(rolled), false);
  const partial = moveGame(rolled, 'b1c3');
  assert.equal(partial.phase, 'handoff');
  assert.equal(emptyRoll(partial), false);
  // A roll with nothing to play that ends the game is the result, not a pass.
  const drawn = rollGame(
    newGame(
      'hotseat',
      'drawn',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 100 1',
    ),
    [4, 4, 4],
  );
  assert.equal(drawn.result?.reason, '100-halfmoves');
  assert.equal(emptyRoll(drawn), false);
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
  // A saved result must hold exactly its two fields.
  for (const result of [
    { winner: 'b' },
    { winner: 'b', reason: 'resigned', extra: true },
  ])
    assert.throws(
      () => decodeGame(JSON.stringify({ ...resign, result })),
      /Invalid result/,
    );
  assert.equal(
    agreeDraw(newGame('hotseat', 'draw')).result?.reason,
    'agreed-draw',
  );
  assert.throws(() => agreeDraw(newGame('random', 'no-draw')));
});

test('a saved result must be the one the position explains', () => {
  // In hotseat the side to move resigns: White here, so Black wins.
  const resigned = resignGame(newGame('hotseat', 'resign-hotseat'));
  assert.deepEqual(resigned.result, { winner: 'b', reason: 'resigned' });
  assert.deepEqual(decodeGame(JSON.stringify(resigned)), resigned);
  assert.throws(
    () =>
      decodeGame(
        JSON.stringify({
          ...resigned,
          result: { winner: 'w', reason: 'resigned' },
        }),
      ),
    /Invalid resignation/,
  );

  // A position that has ended must carry its result, whatever the phase says.
  const captured = moveGame(
    rollGame(
      newGame('hotseat', 'capture', position('k7/8/8/8/8/8/8/R3K3')),
      [4, 4, 4],
    ),
    'a1a8',
  );
  assert.deepEqual(captured.result, { winner: 'w', reason: 'king-captured' });
  for (const phase of ['ended', 'move'])
    assert.throws(
      () => decodeGame(JSON.stringify({ ...captured, result: null, phase })),
      /Missing result/,
    );
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

// The smallest thing that honours the contract: it keeps a string, because
// that is all a store ever holds, and it validates on the way in. Reading it
// back through a second instance is what a relaunch does.
const memoryStore = (): SnapshotStore<Game> & { raw: string | null } => ({
  raw: null,
  async load() {
    return this.raw === null ? null : decodeGame(this.raw);
  },
  async save(game: Game) {
    this.raw = encodeSnapshot(game, decodeGame);
  },
});

test('a half-played turn survives being saved and read back', async () => {
  const saves = memoryStore();
  let game = rollGame(newGame('random', 'partial'), [1, 2, 3]);
  game = moveGame(game, viewGame(game).legal[0]);
  await saves.save(game);

  // A second store over the same bytes is what a relaunch sees.
  const reopened = memoryStore();
  reopened.raw = saves.raw;
  assert.deepEqual(await reopened.load(), game);
  // Not just equal as data: the same position, the same dice still in hand.
  assert.deepEqual(viewGame((await reopened.load())!), viewGame(game));
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

// N, P, P here: c2c4 is legal only because Nb3xc5, which takes the king, can
// follow it. A quiet knight move after c2c4 would end a turn that spends two
// dice, while c2c3, c3c4, Nb3xc5 spends all three (#101).
const GAP = '8/8/8/2k5/8/1N6/2P5/K7 w - - 0 1';

test('a turn is checked as a whole: an action no full turn continues is refused', () => {
  const rolled = rollGame(newGame('hotseat', 'gap', GAP), [2, 1, 1]);
  const after = moveGame(rolled, 'c2c4');
  assert.deepEqual(viewGame(after).legal, ['b3c5']);
  assert.throws(() => moveGame(after, 'b3d4'), /Illegal move/);
  const won = moveGame(after, 'b3c5');
  assert.equal(won.phase, 'ended');
  assert.deepEqual(won.result, { winner: 'w', reason: 'king-captured' });
});

test('the legal actions are exactly the keys of the tree node the turn has reached', () => {
  let game = newGame('hotseat', 'keys');
  const rolls = [
    [1, 2, 5],
    [1, 1, 3],
    [2, 2, 1],
    [1, 3, 4],
    [5, 1, 2],
    [6, 1, 1],
  ];
  for (const roll of rolls) {
    game = rollGame(game, roll);
    let node = DiceChess.getLegalTurnTree(viewGame(game).dfen);
    for (;;) {
      const { legal } = viewGame(game);
      assert.deepEqual([...legal].sort(), Object.keys(node).sort());
      // A turn goes on exactly while its node has children.
      assert.equal(game.phase === 'move', legal.length > 0);
      if (game.phase !== 'move') break;
      const move = legal[legal.length - 1];
      node = node[move];
      game = moveGame(game, move);
    }
    if (game.phase === 'ended') break;
    game = nextTurn(game);
  }
});

test('a roll builds its turn tree once, keeps only that one, and replays a turn without legal lists', () => {
  const trees = mock.method(DiceChess, 'getLegalTurnTree');
  const lists = mock.method(DiceChess, 'getLegalUciMoves');
  try {
    // A start of its own, so no earlier test has left this roll's tree behind.
    let game = rollGame(
      newGame('hotseat', 'once', '4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1'),
      [1, 1, 1],
    );
    for (let i = 0; i < 3; i++) game = moveGame(game, viewGame(game).legal[0]);
    viewGame(game);
    assert.equal(trees.mock.callCount(), 1);
    assert.equal(lists.mock.callCount(), 0);
    const next = rollGame(nextTurn(game), [1, 1, 1]);
    viewGame(next);
    assert.equal(trees.mock.callCount(), 2);
    // The earlier roll's tree was dropped, so viewing that turn builds it again.
    viewGame(game);
    assert.equal(trees.mock.callCount(), 3);
    assert.equal(lists.mock.callCount(), 0);
  } finally {
    trees.mock.restore();
    lists.mock.restore();
  }
});

test('a bot reply must be a whole turn of the tree', () => {
  // The person plays Black, so White's turn is the bot's.
  const game = rollGame(newGame('random', 'gap-bot', GAP, 'b'), [2, 1, 1]);
  const reply = (moves: string[]) => ({
    gameId: game.id,
    revision: game.revision,
    dfen: viewGame(game).dfen,
    moves,
  });
  assert.throws(
    () => applyBotReply(game, reply(['c2c4'])),
    /Incomplete bot turn/,
  );
  assert.throws(
    () => applyBotReply(game, reply(['c2c4', 'b3d4'])),
    /Illegal move/,
  );
  const won = applyBotReply(game, reply(['c2c4', 'b3c5']));
  assert.deepEqual(won.result, { winner: 'w', reason: 'king-captured' });
});

test('a save whose turn left the tree is refused as damaged, and its legal prefix is not', () => {
  const rolled = rollGame(newGame('hotseat', 'gap-save', GAP), [2, 1, 1]);
  // What the TV could save before 0.13.0: c2c4, then a quiet knight move.
  const forbidden: Game = {
    ...rolled,
    revision: rolled.revision + 2,
    moves: ['c2c4', 'b3d4'],
    phase: 'handoff',
    lastMove: 'b3d4',
  };
  assert.throws(() => decodeGame(JSON.stringify(forbidden)), /Illegal action/);
  const prefix: Game = {
    ...rolled,
    revision: rolled.revision + 1,
    moves: ['c2c4'],
    phase: 'move',
    lastMove: 'c2c4',
  };
  assert.deepEqual(decodeGame(JSON.stringify(prefix)), prefix);
});
