// The slide of a move on the board (#131): the piece in flight from its square
// to its destination, what the destination shows meanwhile, and no slide when
// the board is reset, when the platform asks for less motion, or before it has
// answered whether it does.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Board, SLIDE_MS } from '../src/Board';
import { PIECES } from '../src/pieces';
import { BOT_STEP_MS } from '../src/screen';
import { isHost, styleOf, type Instance } from './support';

const SIZE = 800;
const EDGE = Math.floor(SIZE / 8);
const INITIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR';
const AFTER_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR';

type Range = { interpolation: { outputRange: number[] } };
type Held = {
  value: { value: number; setValue(value: number): void };
  config: { toValue: number; duration: number; useNativeDriver: boolean };
  done: ((result: { finished: boolean }) => void) | null;
  stopped: boolean;
};
const globals = globalThis as {
  __holdSlides?: boolean;
  __heldSlides?: Held[];
  __reduceMotion?: boolean;
  __reduceMotionQuery?: 'pending' | 'fails' | 'throws';
  __answerReduceMotion?: (value: boolean) => void;
};

beforeEach(() => {
  globals.__holdSlides = true;
  globals.__heldSlides = [];
  globals.__reduceMotion = false;
  globals.__reduceMotionQuery = undefined;
});

// Mounts the board on one position, lets the platform answer whether it asks
// for less motion, and returns what moves the board on.
const mount = async (props: Record<string, unknown>) => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      React.createElement(Board, { size: SIZE, ...props } as never),
    );
  });
  return {
    root: () => tree.root,
    move: (next: Record<string, unknown>) =>
      act(() => {
        tree.update(
          React.createElement(Board, { size: SIZE, ...next } as never),
        );
      }),
  };
};

const flights = (root: Instance) =>
  root.findAll(
    (node) => isHost(node, 'Animated.View') && node.props.testID === 'flight',
  );

// Where a flight starts and ends on screen, from its transform.
const path = (flight: Instance) => {
  const [x, y] = styleOf(flight).transform as [
    { translateX: Range },
    { translateY: Range },
  ];
  return {
    x: x.translateX.interpolation.outputRange,
    y: y.translateY.interpolation.outputRange,
  };
};

// A square of the grid, found by its place in render order.
const square = (root: Instance, name: string, flipped = false): Instance => {
  const file = 'abcdefgh'.indexOf(name[0]);
  const rank = Number(name[1]) - 1;
  const column = flipped ? 7 - file : file;
  const row = flipped ? rank : 7 - rank;
  const grid = root.findAll(
    (node) =>
      isHost(node, 'View') &&
      styleOf(node).width === EDGE &&
      styleOf(node).position !== 'absolute',
  );
  return grid[row * 8 + column];
};

const pieceOn = (node: Instance): string | null => {
  for (const [letter, component] of Object.entries(PIECES))
    if (node.findAllByType(component as never).length) return letter;
  return null;
};

const land = () =>
  act(() => {
    for (const slide of globals.__heldSlides ?? [])
      if (!slide.stopped) slide.done?.({ finished: true });
  });

test("a slide is short, and over before the opponent's next step", () => {
  assert.ok(SLIDE_MS <= 300, 'the TV guidance of #51');
  assert.ok(SLIDE_MS < BOT_STEP_MS);
});

test('a move slides the piece from its square to its destination', async () => {
  const board = await mount({ board: INITIAL, lastMove: null });
  board.move({ board: AFTER_E4, lastMove: 'e2e4' });

  const [flight] = flights(board.root());
  assert.ok(flight, 'the pawn is in flight');
  assert.equal(pieceOn(flight), 'P');
  assert.deepEqual(path(flight), {
    x: [4 * EDGE, 4 * EDGE],
    y: [6 * EDGE, 4 * EDGE],
  });
  assert.equal(pieceOn(square(board.root(), 'e4')), null, 'not yet landed');
  const [held] = globals.__heldSlides!;
  assert.equal(held.config.duration, SLIDE_MS);
  assert.equal(held.config.useNativeDriver, true);

  land();
  assert.equal(flights(board.root()).length, 0);
  assert.equal(pieceOn(square(board.root(), 'e4')), 'P');
});

test('a capture shows the taken piece until the mover lands', async () => {
  const board = await mount({
    board: '4k3/8/8/3p4/4P3/8/8/4K3',
    lastMove: null,
  });
  board.move({ board: '4k3/8/8/3P4/8/8/8/4K3', lastMove: 'e4d5' });
  assert.equal(pieceOn(square(board.root(), 'd5')), 'p');
  assert.equal(pieceOn(flights(board.root())[0]), 'P');

  land();
  assert.equal(pieceOn(square(board.root(), 'd5')), 'P');
  assert.equal(board.root().findAllByType(PIECES.p as never).length, 0);
});

test('castling slides the king and the rook together', async () => {
  const board = await mount({
    board: 'r3k2r/8/8/8/8/8/8/R3K2R',
    lastMove: null,
  });
  board.move({ board: 'r3k2r/8/8/8/8/8/8/R4RK1', lastMove: 'e1g1' });
  assert.deepEqual(flights(board.root()).map(pieceOn).sort(), ['K', 'R']);
});

test('a board turned for Black slides in screen coordinates', async () => {
  const board = await mount({ board: INITIAL, lastMove: null, flipped: true });
  board.move({ board: AFTER_E4, lastMove: 'e2e4', flipped: true });
  assert.deepEqual(path(flights(board.root())[0]), {
    x: [3 * EDGE, 3 * EDGE],
    y: [1 * EDGE, 3 * EDGE],
  });
});

test('a new game is redrawn without a slide', async () => {
  const board = await mount({ board: AFTER_E4, lastMove: 'e2e4' });
  board.move({ board: INITIAL, lastMove: null });
  assert.equal(flights(board.root()).length, 0);
  assert.equal(pieceOn(square(board.root(), 'e2')), 'P');
});

test('the next move takes over from a slide still in flight', async () => {
  const board = await mount({ board: INITIAL, lastMove: null });
  board.move({ board: AFTER_E4, lastMove: 'e2e4' });
  board.move({ board: AFTER_E5, lastMove: 'e7e5' });
  const [first] = globals.__heldSlides!;
  assert.equal(first.stopped, true);
  const now = flights(board.root());
  assert.equal(now.length, 1);
  assert.equal(pieceOn(now[0]), 'p');
  // The earlier pawn is on its square, no longer in flight.
  assert.equal(pieceOn(square(board.root(), 'e4')), 'P');
});

test('when the platform asks for less motion, pieces do not slide', async () => {
  globals.__reduceMotion = true;
  const board = await mount({ board: INITIAL, lastMove: null });
  board.move({ board: AFTER_E4, lastMove: 'e2e4' });
  assert.equal(flights(board.root()).length, 0);
  assert.equal(pieceOn(square(board.root(), 'e4')), 'P');
});

test('a move before the platform answers is drawn, not slid', async () => {
  globals.__reduceMotionQuery = 'pending';
  const board = await mount({ board: INITIAL, lastMove: null });
  board.move({ board: AFTER_E4, lastMove: 'e2e4' });
  assert.equal(flights(board.root()).length, 0);
  assert.equal(pieceOn(square(board.root(), 'e4')), 'P');

  await act(async () => globals.__answerReduceMotion?.(false));
  board.move({ board: AFTER_E5, lastMove: 'e7e5' });
  assert.equal(flights(board.root()).length, 1);
});

test('where the platform cannot answer, pieces slide', async () => {
  for (const query of ['fails', 'throws'] as const) {
    globals.__reduceMotionQuery = query;
    const board = await mount({ board: INITIAL, lastMove: null });
    board.move({ board: AFTER_E4, lastMove: 'e2e4' });
    assert.equal(flights(board.root()).length, 1, query);
  }
});

// The opacity the whole board is drawn with.
const opacity = (root: Instance) =>
  root.find(
    (node) =>
      isHost(node, 'Animated.View') && styleOf(node).opacity !== undefined,
  ).props.style.opacity as Held['value'];

// Whether the board is drawn turned as each animation starts. The stub adds an
// animation by assigning a new list, so a setter sees every start.
const watchStarts = (root: () => Instance) => {
  const turned: boolean[] = [];
  let held: Held[] = globals.__heldSlides ?? [];
  Object.defineProperty(globals, '__heldSlides', {
    configurable: true,
    get: () => held,
    set: (next: Held[]) => {
      held = next;
      turned.push(pieceOn(square(root(), 'e1', true)) === 'K');
    },
  });
  return {
    turned,
    stop: () => {
      delete globals.__heldSlides;
      globals.__heldSlides = held;
    },
  };
};

test('when the board flips with full motion, it fades out, turns and fades back in', async () => {
  const board = await mount({ board: INITIAL, lastMove: null, flipped: false });
  const starts = watchStarts(board.root);
  try {
    board.move({ board: INITIAL, lastMove: null, flipped: true });
    const [fadeOut] = globals.__heldSlides!;
    assert.equal(fadeOut.config.toValue, 0);
    // It turns only once it has faded out.
    assert.equal(pieceOn(square(board.root(), 'e1')), 'K');

    await act(async () => {
      fadeOut.value.setValue(0);
      fadeOut.done?.({ finished: true });
    });
    assert.equal(pieceOn(square(board.root(), 'e1', true)), 'K');
    // Then it fades back in, and nothing cuts that short: the fade is not
    // stopped and the board does not jump back to full opacity (#120).
    assert.equal(globals.__heldSlides!.length, 2);
    const fadeIn = globals.__heldSlides![1];
    assert.equal(fadeIn.config.toValue, 1);
    assert.equal(fadeIn.stopped, false);
    assert.equal(opacity(board.root()).value, 0);
    // The fade in starts on the turned board, so the side it left never shows
    // again on the way in.
    assert.deepEqual(starts.turned, [false, true]);

    await act(async () => {
      fadeIn.value.setValue(1);
      fadeIn.done?.({ finished: true });
    });
    assert.equal(fadeIn.stopped, false);
    assert.equal(opacity(board.root()).value, 1);
    assert.equal(pieceOn(square(board.root(), 'e1', true)), 'K');
  } finally {
    starts.stop();
  }
});

test('a board turned back while it fades out stays as it was, fully shown', async () => {
  const board = await mount({ board: INITIAL, lastMove: null, flipped: false });
  board.move({ board: INITIAL, lastMove: null, flipped: true });
  const [fadeOut] = globals.__heldSlides!;
  fadeOut.value.setValue(0.5);

  board.move({ board: INITIAL, lastMove: null, flipped: false });
  assert.equal(fadeOut.stopped, true);
  assert.equal(globals.__heldSlides!.length, 1);
  assert.equal(opacity(board.root()).value, 1);
  assert.equal(pieceOn(square(board.root(), 'e1')), 'K');
});

test('when the platform asks for less motion, the board flips at once', async () => {
  globals.__reduceMotion = true;
  const board = await mount({ board: INITIAL, lastMove: null, flipped: false });
  board.move({ board: INITIAL, lastMove: null, flipped: true });
  assert.equal(globals.__heldSlides!.length, 0);
});
