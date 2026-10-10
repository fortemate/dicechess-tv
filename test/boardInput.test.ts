import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boardInput,
  landing,
  movableSquares,
  movesFrom,
  onlyChoice,
  waitingFocus,
  type BoardFocus,
  type BoardKey,
} from '../src/core/boardInput.ts';
import { route, RULE } from '../src/core/cursor.ts';
import {
  newGame,
  rollGame,
  moveGame,
  nextTurn,
  viewGame,
} from '../src/core/game.ts';
import type { Square } from '../src/core/board.ts';

const at = (cursor: string, selected: string | null = null): BoardFocus => ({
  cursor: cursor as Square,
  selected: selected as Square | null,
});

// Drive a sequence of keys and return the final focus and the actions produced.
const drive = (
  focus: BoardFocus,
  keys: BoardKey[],
  legal: readonly string[],
  flipped = false,
) => {
  const actions = [];
  let current = focus;
  for (const key of keys) {
    const result = boardInput(current, key, legal, flipped);
    current = result.focus;
    if (result.action.type !== 'none') actions.push(result.action);
  }
  return { focus: current, actions };
};

// Knights only, as after a roll of queen, rook and knight at the start.
const OPENING = ['b1a3', 'b1c3', 'g1f3', 'g1h3'];

test('arrows jump between movable pieces, cycling horizontally at an end', () => {
  assert.equal(boardInput(at('b1'), 'right', OPENING).focus.cursor, 'g1');
  assert.equal(boardInput(at('g1'), 'left', OPENING).focus.cursor, 'b1');
  // Both knights stand on the first rank: nothing lies above or below them.
  assert.equal(boardInput(at('b1'), 'up', OPENING).focus.cursor, 'b1');
  assert.equal(boardInput(at('b1'), 'left', OPENING).focus.cursor, 'g1');
  // From a square that holds no choice, a press still lands on one.
  assert.equal(boardInput(at('e4'), 'down', OPENING).focus.cursor, 'g1');
});

test('with a piece picked up, arrows jump between its destinations only', () => {
  const result = boardInput(at('a3', 'b1'), 'right', OPENING);
  assert.deepEqual(result.focus, at('c3', 'b1'));
  assert.deepEqual(result.action, { type: 'none' });
  // g1 can move too, but it is not a destination of the b1 knight.
  assert.equal(boardInput(at('c3', 'b1'), 'right', OPENING).focus.cursor, 'a3');
});

test('select picks up a piece and lands on its central destination', () => {
  const picked = boardInput(at('b1'), 'select', OPENING);
  // a3 and c3 are one press apart and equally far from b1; reading order
  // takes the left one.
  assert.deepEqual(picked.focus, at('a3', 'b1'));
  assert.deepEqual(picked.action, { type: 'none' });

  // The a1 rook is blocked on the opening roll, so nothing happens.
  const ignored = boardInput(at('a1'), 'select', OPENING);
  assert.deepEqual(ignored.focus, at('a1'));
  assert.deepEqual(ignored.action, { type: 'none' });

  // Nor does an empty square pick anything up.
  assert.equal(boardInput(at('e4'), 'select', OPENING).focus.selected, null);
});

test('a piece with a single destination is played with OK, then OK', () => {
  const { focus, actions } = drive(at('e2'), ['select', 'select'], ['e2e4']);
  assert.deepEqual(actions, [{ type: 'move', move: 'e2e4' }]);
  assert.deepEqual(focus, at('e4', 'e2'));
});

test('select on a legal destination emits exactly that move', () => {
  const { focus, actions } = drive(at('b1'), ['select', 'right'], OPENING);
  assert.deepEqual(focus, at('c3', 'b1'));
  assert.deepEqual(actions, []);

  const result = boardInput(focus, 'select', OPENING);
  assert.deepEqual(result.action, { type: 'move', move: 'b1c3' });
  // The move is intent only: the focus is left for the controller to reset.
  assert.equal(result.focus.selected, 'b1');
});

test('select on a piece that is not a destination switches pieces instead', () => {
  // b1 is picked up, but the cursor stands on g1, which can act: g1 becomes the
  // piece in hand, and the cursor lands on its destinations.
  const result = boardInput(at('g1', 'b1'), 'select', OPENING);
  assert.deepEqual(result.focus, at('f3', 'g1'));
  assert.deepEqual(result.action, { type: 'none' });
});

test('select on a dead square with a piece selected changes nothing', () => {
  const result = boardInput(at('e4', 'b1'), 'select', OPENING);
  assert.deepEqual(result.focus, at('e4', 'b1'));
  assert.deepEqual(result.action, { type: 'none' });
});

test('an ambiguous destination is handed back as a promotion choice', () => {
  const promotions = ['a7a8q', 'a7a8r', 'a7a8b', 'a7a8n'];
  const result = boardInput(at('a8', 'a7'), 'select', promotions);
  assert.deepEqual(result.action, { type: 'promote', moves: promotions });
  // The board does not choose a piece on the player's behalf.
  assert.equal(result.focus.selected, 'a7');
});

test('back puts the piece down with the cursor on it, then asks to leave', () => {
  const dropped = boardInput(at('c3', 'b1'), 'back', OPENING);
  assert.deepEqual(dropped.focus, at('b1'));
  assert.deepEqual(dropped.action, { type: 'none' });

  const leaving = boardInput(dropped.focus, 'back', OPENING);
  assert.deepEqual(leaving.action, { type: 'exit' });
  assert.equal(leaving.focus.cursor, 'b1');
});

test('the cursor waits on its square while that piece can move, else on the central one', () => {
  assert.deepEqual(waitingFocus('b1', OPENING), at('b1'));
  // e2 holds no knight: of b1 and g1, g1 is nearer.
  assert.deepEqual(waitingFocus('e2', OPENING), at('g1'));
  // A picked-up piece is put down.
  assert.deepEqual(waitingFocus('b1', OPENING).selected, null);
  // With nothing to choose, the cursor stays.
  assert.deepEqual(waitingFocus('e2', []), at('e2'));
});

test('on the board turned for Black, the arrows follow the screen', () => {
  const black = ['b8a6', 'b8c6', 'g8f6', 'g8h6'];
  // Seen from Black, g8 is on the left of b8.
  assert.equal(boardInput(at('b8'), 'left', black, true).focus.cursor, 'g8');
  assert.equal(boardInput(at('b8'), 'right', black, true).focus.cursor, 'g8');
  // The picked-up knight lands on the destination further left on the screen.
  assert.deepEqual(
    boardInput(at('b8'), 'select', black, true).focus,
    at('c6', 'b8'),
  );
});

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

test('a pawn that can advance two squares lands on the two-square push', () => {
  const pawns = ['d2d3', 'd2d4', 'e2e3', 'e2e4'];
  // With the board, e2 is known to hold a pawn on its starting rank.
  assert.deepEqual(
    boardInput(at('e2'), 'select', pawns, false, START).focus,
    at('e4', 'e2'),
  );
  // Without it, the landing is the central destination, the nearer e3.
  assert.deepEqual(boardInput(at('e2'), 'select', pawns).focus, at('e3', 'e2'));
  // One press back reaches the single step.
  const back = boardInput(at('e4', 'e2'), 'down', pawns, false, START);
  assert.equal(back.focus.cursor, 'e3');
});

test("Black's pawn lands on its two-square push on the turned board", () => {
  const pawns = ['e7e6', 'e7e5'];
  const board = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR';
  assert.deepEqual(
    boardInput(at('e7'), 'select', pawns, true, board).focus,
    at('e5', 'e7'),
  );
});

test('the two-square landing applies only to a pawn whose push is legal', () => {
  const layout = { flipped: false };
  // A pawn whose two-square push is blocked lands as before: here a black
  // knight stands on e4.
  const blocked = 'rnbqkb1r/pppppppp/8/8/4n3/8/PPPPPPPP/RNBQKBNR';
  assert.equal(landing(['e2e3'], 'e2', layout, blocked), 'e3');
  // A pawn that has left its starting rank has no two-square push.
  const advanced = 'rnbqkbnr/pppppppp/8/8/8/4P3/PPPP1PPP/RNBQKBNR';
  assert.equal(landing(['e3e4'], 'e3', layout, advanced), 'e4');
  // A rook on the second rank moving two squares up is not a pawn push: the
  // central destination of a2-a3-a4 is a3.
  const rook = '4k3/8/8/8/8/8/R7/4K3';
  assert.equal(landing(['a2a3', 'a2a4', 'a2a1'], 'a2', layout, rook), 'a3');
});

test('a piece that can take lands on the most valuable piece it can take', () => {
  const layout = { flipped: false };
  // The d4 knight can take the e6 pawn or the b5 rook: the rook is worth more.
  const knight = '4k3/8/4p3/1r6/3N4/8/8/4K3';
  const moves = [
    'd4b3',
    'd4b5',
    'd4c2',
    'd4c6',
    'd4e2',
    'd4e6',
    'd4f3',
    'd4f5',
  ];
  assert.equal(landing(moves, 'd4', layout, knight), 'b5');
  // Taking the king ends the game, so it comes before even the queen.
  const rook = 'k7/8/8/8/8/8/8/R6q';
  assert.equal(landing(['a1a8', 'a1h1', 'a1b1'], 'a1', layout, rook), 'a8');
  // Without the board nothing is known to be a capture: central, as before.
  assert.equal(landing(moves, 'd4', layout), 'c6');
});

test('between equal captures the cursor lands on the central one', () => {
  // The d4 rook can take a pawn on b4 or on d7; b4 is the nearer.
  const board = '4k3/3p4/8/8/1p1R4/8/8/4K3';
  const moves = ['d4b4', 'd4c4', 'd4d5', 'd4d6', 'd4d7', 'd4e4'];
  assert.equal(landing(moves, 'd4', { flipped: false }, board), 'b4');
});

test('a pawn takes before it pushes, en passant included', () => {
  const layout = { flipped: false };
  // A black knight on d3 is worth more to the e2 pawn than its two-square push.
  const knight = 'rnbqkb1r/pppppppp/8/8/8/3n4/PPPPPPPP/RNBQKBNR';
  assert.equal(landing(['e2d3', 'e2e3', 'e2e4'], 'e2', layout, knight), 'd3');
  // Black has just pushed d7-d5 beside the e5 pawn: e5xd6 lands on an empty
  // square and still takes a pawn.
  const passant = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR';
  assert.equal(landing(['e5d6', 'e5e6'], 'e5', layout, passant), 'd6');
});

test('a picked-up knight lands on its capture, not on the way home', () => {
  // The position of the site's Hot Seat screenshot: Black's c6 knight can take
  // on e5, and before the capture came first it landed on b8.
  const fen = 'r1bqkbnr/pppppppp/2n5/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
  const game = rollGame(newGame('hotseat', 'landing', fen), [2, 2, 2]);
  const { legal, dfen } = viewGame(game);
  assert.deepEqual(movesFrom(legal, 'c6').sort(), [
    'c6a5',
    'c6b4',
    'c6b8',
    'c6d4',
    'c6e5',
  ]);
  const picked = boardInput(
    at('c6'),
    'select',
    legal,
    true,
    dfen.split(' ')[0],
  );
  assert.deepEqual(picked.focus, at('e5', 'c6'));
});

test('a capture that would leave a destination out of reach gives way to the central one', () => {
  // Black's c5 queen, on the board turned for Black, can take the king on e3.
  // From e3 no arrow ever reaches a7, so the cursor lands where it always
  // could reach every destination.
  const fen = 'r1b1k3/1p1pnp2/n3Pr1b/2q1P2p/5P2/1BN1K1PP/PPPB4/R5R1 b - - 8 17';
  const game = rollGame(newGame('hotseat', 'reach', fen), [1, 4, 5]);
  const { legal, dfen } = viewGame(game);
  const board = dfen.split(' ')[0];
  const layout = { rule: RULE, flipped: true };
  const destinations = movesFrom(legal, 'c5').map((move) => move.slice(2, 4));
  assert.ok(destinations.includes('e3') && destinations.includes('a7'));
  assert.equal(route('e3', 'a7', destinations, layout), null);
  const square = landing(legal, 'c5', layout, board);
  assert.notEqual(square, 'e3');
  for (const to of destinations)
    assert.ok(route(square!, to, destinations, layout), `${to} out of reach`);
});

test('movesFrom and movableSquares report what the squares can do', () => {
  assert.deepEqual(movesFrom(OPENING, 'b1'), ['b1a3', 'b1c3']);
  assert.deepEqual(movesFrom(OPENING, 'a1'), []);
  assert.deepEqual(movableSquares(['g1f3', 'b1c3', 'g1h3']), ['b1', 'g1']);
});

test('onlyChoice names the square OK acts on when the board offers just one', () => {
  // Two knights: a choice of piece. Once one is in hand, a choice of square.
  assert.equal(onlyChoice(OPENING, null), null);
  assert.equal(onlyChoice(OPENING, 'b1'), null);
  // One piece with several destinations: picking it up is the only choice.
  assert.equal(onlyChoice(['b1a3', 'b1c3', 'b1d2'], null), 'b1');
  // A piece in hand with one destination, whoever picked it up, and even with
  // other pieces still able to move.
  assert.equal(onlyChoice(['a1b1', 'g1f3', 'g1h3'], 'a1'), 'b1');
  // Several promotions to one square are one square: OK opens the choice.
  const promotions = ['a7a8q', 'a7a8r', 'a7a8b', 'a7a8n'];
  assert.equal(onlyChoice(promotions, null), 'a7');
  assert.equal(onlyChoice(promotions, 'a7'), 'a8');
  // Nothing to choose: nothing for OK to do.
  assert.equal(onlyChoice([], null), null);
});

test('rook, rook, knight at the start: after the knight, every choice is the only one (#302)', () => {
  // The owner's example. Two knights, then two squares for the knight: the
  // person chooses. Then only the a1 rook can go, to b1, and the second rook
  // die can only take it back: four presses of OK with no choice behind them.
  let game = rollGame(newGame('hotseat', 'only'), [4, 4, 2]);
  assert.equal(onlyChoice(viewGame(game).legal, null), null);
  assert.equal(onlyChoice(viewGame(game).legal, 'b1'), null);
  game = moveGame(game, 'b1c3');
  const only: string[] = [];
  for (let focus = waitingFocus('c3', viewGame(game).legal); ;) {
    const { legal } = viewGame(game);
    const square = onlyChoice(legal, focus.selected);
    if (square === null) break;
    only.push(square);
    const result = boardInput({ ...focus, cursor: square }, 'select', legal);
    if (result.action.type === 'move') {
      game = moveGame(game, result.action.move);
      focus = waitingFocus(square, viewGame(game).legal);
    } else focus = result.focus;
  }
  assert.deepEqual(only, ['a1', 'b1', 'b1', 'a1']);
  assert.deepEqual(game.moves, ['b1c3', 'a1b1', 'b1a1']);
  assert.equal(game.phase, 'handoff');
});

test('a full remote-driven action against the engine produces a legal move', () => {
  // Queen, rook, knight: only the knights can act from the opening position.
  const game = rollGame(newGame('hotseat', 'input'), [5, 4, 2]);
  const legal = viewGame(game).legal;

  // A new game leaves the cursor on e2, where nothing can move: it waits on g1.
  const waiting = waitingFocus('e2', legal);
  assert.equal(waiting.cursor, 'g1');
  const toKnight = route('g1', 'b1', movableSquares(legal)) as BoardKey[];
  assert.deepEqual(toKnight, ['left']);
  const { focus } = drive(waiting, [...toKnight, 'select', 'right'], legal);
  assert.deepEqual(focus, at('c3', 'b1'));

  const result = boardInput(focus, 'select', legal);
  assert.deepEqual(result.action, { type: 'move', move: 'b1c3' });
  // The controller accepts it, which is the only proof that matters.
  const next = moveGame(game, 'b1c3');
  assert.equal(next.lastMove, 'b1c3');
  assert.equal(viewGame(next).remaining, 'QR');
});

test('the worked example in #68: the pieces that can move follow maximal dice use', () => {
  // Pawn, bishop and queen at the start (die faces 1, 3 and 5): only the pawns
  // that free both the bishop and the queen can move.
  const rolled = rollGame(newGame('hotseat', 'example'), [1, 3, 5]);
  const movable = (game = rolled) => movableSquares(viewGame(game).legal);
  assert.deepEqual(movable(), ['b2', 'd2', 'e2']);
  // Cycling makes all three one press apart; e2 is nearest to h8.
  assert.deepEqual(waitingFocus('h8', viewGame(rolled).legal), at('e2'));
  // After b2b3 only the bishop can move; after d2d4 the bishop and the queen.
  assert.deepEqual(movable(moveGame(rolled, 'b2b3')), ['c1']);
  assert.deepEqual(movable(moveGame(rolled, 'd2d4')), ['c1', 'd1']);
  // Black gets the mirror, once White has passed on queen, queen, king.
  const passed = nextTurn(rollGame(newGame('hotseat', 'example'), [5, 5, 6]));
  assert.deepEqual(movable(rollGame(passed, [1, 3, 5])), ['b7', 'd7', 'e7']);
});

test('menu with nothing selected asks to exit the board', () => {
  const result = boardInput(at('b1'), 'menu', OPENING);
  assert.deepEqual(result.focus, at('b1', null));
  assert.deepEqual(result.action, { type: 'exit' });
});

test('menu drops a picked-up piece and asks to exit the board', () => {
  const result = boardInput(at('c3', 'b1'), 'menu', OPENING);
  assert.deepEqual(result.focus, at('b1', null));
  assert.deepEqual(result.action, { type: 'exit' });
});

test('a held arrow walks ahead but cannot cycle in either selection phase', () => {
  const pawns = [...'abcdefgh'].map((file) => `${file}2${file}4`);
  const repeat = (focus: BoardFocus, key: BoardKey, legal: string[]) =>
    boardInput(focus, key, legal, false, null, { repeat: true });
  assert.equal(repeat(at('g2'), 'right', pawns).focus.cursor, 'h2');
  assert.equal(repeat(at('h2'), 'right', pawns).focus.cursor, 'h2');
  assert.equal(repeat(at('a2'), 'left', pawns).focus.cursor, 'a2');
  assert.deepEqual(boardInput(at('h2'), 'right', pawns), {
    focus: at('a2'),
    action: { type: 'none' },
  });
  assert.equal(boardInput(at('a2'), 'left', pawns).focus.cursor, 'h2');
  assert.equal(repeat(at('c3', 'b1'), 'right', OPENING).focus.cursor, 'c3');
  assert.deepEqual(boardInput(at('c3', 'b1'), 'right', OPENING), {
    focus: at('a3', 'b1'),
    action: { type: 'none' },
  });
  assert.deepEqual(boardInput(at('a3', 'b1'), 'left', OPENING), {
    focus: at('c3', 'b1'),
    action: { type: 'none' },
  });
});

test('waiting focus retains a movable piece and otherwise uses the cyclic graph', () => {
  const legal = ['b2b4', 'd2d4', 'e2e4'];
  assert.deepEqual(waitingFocus('d2', legal), at('d2'));
  assert.deepEqual(waitingFocus('e1', legal), at('e2'));
});
