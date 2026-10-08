import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Board } from '../src/Board';
import { PIECES } from '../src/pieces';
import { THEME } from '../src/theme';

const INITIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const SIZE = 800;
const EDGE = Math.floor(SIZE / 8);

type Instance = renderer.ReactTestInstance;
type Style = Record<string, string | number | undefined>;

const styleOf = (node: Instance): Style => (node.props.style ?? {}) as Style;

// The stubs render host elements named after the React Native components. React's
// own types only know DOM element names, so the comparison needs widening.
const isHost = (node: Instance, name: string) =>
  (node.type as unknown as string) === name;

// React 19 commits inside act(), so create() outside it leaves the tree unmounted.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mount = (props: Record<string, unknown>): Instance => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(Board, props as never));
  });
  return tree.root;
};

const render = (props: Record<string, unknown> = {}) =>
  mount({ size: SIZE, board: INITIAL, ...props });

// A square is a View sized exactly one eighth of the board that carries a square
// colour; the overlays inside it are absolutely positioned.
const squares = (root: Instance): Instance[] =>
  root.findAll(
    (node) =>
      isHost(node, 'View') &&
      styleOf(node).width === EDGE &&
      styleOf(node).position !== 'absolute',
    { deep: true },
  );

const overlays = (
  root: Instance,
  match: (style: Style) => boolean,
): Instance[] =>
  root.findAll(
    (node) =>
      isHost(node, 'View') &&
      styleOf(node).position === 'absolute' &&
      match(styleOf(node)),
    { deep: true },
  );

test('the grid renders 64 squares, half of them dark', () => {
  const all = squares(render());
  assert.equal(all.length, 64);
  const count = (colour: string) =>
    all.filter((node) => styleOf(node).backgroundColor === colour).length;
  assert.equal(count(THEME.dark), 32);
  assert.equal(count(THEME.light), 32);
});

test('a1 is dark and h1 is light, so the board is not colour-flipped', () => {
  // Render order is rank 8 first, so rank 1 is the last eight squares.
  const rank1 = squares(render()).slice(56);
  assert.equal(styleOf(rank1[0]).backgroundColor, THEME.dark);
  assert.equal(styleOf(rank1[7]).backgroundColor, THEME.light);
});

test('every piece of the opening position is drawn with its own component', () => {
  const root = render();
  const drawn = Object.values(PIECES).flatMap((piece) =>
    root.findAllByType(piece as never, { deep: true }),
  );
  assert.equal(drawn.length, 32);
  assert.equal(root.findAllByType(PIECES.P as never).length, 8);
  assert.equal(root.findAllByType(PIECES.k as never).length, 1);
  assert.equal(root.findAllByType(PIECES.K as never).length, 1);
  // Pieces are inset inside their square rather than filling it.
  const size = root.findAllByType(PIECES.K as never)[0].props.size as number;
  assert.ok(size > 0 && size < EDGE, `piece size ${size} vs square ${EDGE}`);
});

test('each overlay state draws its own distinct mark', () => {
  const root = render({
    legal: ['b1a3', 'b1c3'],
    selected: 'b1',
    cursor: 'e4',
    lastMove: 'g1f3',
  });

  assert.equal(
    overlays(root, (s) => s.backgroundColor === THEME.destination).length,
    2,
    'one dot per legal destination',
  );
  assert.equal(
    overlays(root, (s) => s.backgroundColor === THEME.lastMove).length,
    2,
    'both ends of the last move are tinted',
  );
  assert.equal(
    overlays(root, (s) => s.backgroundColor === THEME.selected).length,
    1,
    'the source square has its own warm fill',
  );

  // The source is a fill; only focus carries green brackets.
  assert.equal(
    overlays(root, (s) => s.borderColor === THEME.boardCursor).length,
    2,
  );
  assert.equal(arrows(root).length, 0);
});

// The arrow from the picked-up piece to the cursor, as drawn.
const arrows = (root: Instance): Instance[] =>
  root.findAll(
    (node) => isHost(node, 'View') && node.props.testID === 'move-arrow',
  );

// The square at a position, from White's side: rank 8 is rendered first.
const squareAt = (root: Instance, square: string): Instance =>
  squares(root)[
    (8 - Number(square[1])) * 8 + square.charCodeAt(0) - 'a'.charCodeAt(0)
  ];

test('the board focus has green brackets and a faint fill on one square', () => {
  const root = render({ cursor: 'e4' });
  const e4 = squareAt(root, 'e4');
  const brackets = overlays(e4, (s) => s.borderColor === THEME.boardCursor);
  assert.equal(brackets.length, 2);
  assert.equal(
    overlays(root, (s) => s.backgroundColor === THEME.boardFocusFill).length,
    1,
  );
  const [left, right] = brackets.map(styleOf);
  assert.ok(left.borderLeftWidth && right.borderRightWidth);
  assert.equal(left.borderRightWidth, undefined);
  assert.equal(right.borderLeftWidth, undefined);
  assert.ok((left.width as number) < EDGE / 2, 'open across the middle');
  assert.equal(left.height, right.height);
  assert.equal(left.top, right.top);
});

// WCAG 2.2 relative luminance and contrast ratio, of opaque #rrggbb colours.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const c = parseInt(hex.slice(at, at + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('green brackets contrast with both square colours', () => {
  for (const square of [THEME.light, THEME.dark])
    assert.ok(contrast(THEME.boardCursor, square) >= 3);
});

test('the source stays marked while focus moves, with its piece at normal size', () => {
  for (const cursor of ['a3', 'c3']) {
    const root = render({ legal: ['b1a3', 'b1c3'], selected: 'b1', cursor });
    const b1 = squareAt(root, 'b1');
    assert.equal(
      overlays(b1, (s) => s.backgroundColor === THEME.selected).length,
      1,
    );
    assert.equal(
      overlays(b1, (s) => s.borderBottomColor === THEME.selectedLine).length,
      1,
    );
    assert.equal(
      overlays(b1, (s) => s.borderColor === THEME.boardCursor).length,
      0,
    );
    const knight = b1.findByType(PIECES.N as never);
    assert.equal(knight.props.size, Math.round(EDGE * 0.92));
    assert.ok(
      b1.children.some((child) => (child as Instance).type === PIECES.N),
    );
    assert.equal(arrows(root).length, 0);
  }
});

test('the focused destination loses its dot while the other pawn step keeps one', () => {
  for (const cursor of ['e3', 'e4']) {
    const root = render({ legal: ['e2e3', 'e2e4'], selected: 'e2', cursor });
    const dot = (s: Style) => s.backgroundColor === THEME.destination;
    assert.equal(overlays(squareAt(root, cursor), dot).length, 0);
    assert.equal(overlays(root, dot).length, 1);
    assert.equal(arrows(root).length, 0);
  }
});

test('a focused capture keeps the target piece visible, with brackets instead of a ring', () => {
  const root = render({
    board: '4k3/8/8/3p4/8/8/8/3RK3',
    selected: 'd1',
    cursor: 'd5',
    legal: ['d1d2', 'd1d5'],
  });
  const target = squareAt(root, 'd5');
  assert.equal(target.findAllByType(PIECES.p as never).length, 1);
  assert.equal(
    overlays(target, (s) => s.borderColor === THEME.destination).length,
    0,
  );
  assert.equal(
    overlays(target, (s) => s.borderColor === THEME.boardCursor).length,
    2,
  );
});

test('source and focus marks follow the board when viewed from Black', () => {
  const root = render({
    selected: 'b1',
    cursor: 'c3',
    legal: ['b1a3', 'b1c3'],
    flipped: true,
  });
  const all = squares(root);
  assert.equal(
    overlays(all[6], (s) => s.backgroundColor === THEME.selected).length,
    1,
  );
  assert.equal(
    overlays(all[2 * 8 + 5], (s) => s.borderColor === THEME.boardCursor).length,
    2,
  );
});

test('an empty destination gets a dot, and a piece that would be taken a ring', () => {
  // The tutorial's capture lesson: the rook on d1 can stop on an empty square or
  // take the pawn on d5.
  const root = mount({
    size: SIZE,
    board: '4k3/8/8/3p4/8/8/8/3RK3',
    selected: 'd1',
    legal: ['d1d2', 'd1d3', 'd1d4', 'd1d5', 'd1c1'],
  });
  const dot = (s: Style) => s.backgroundColor === THEME.destination;
  const ring = (s: Style) => s.borderColor === THEME.destination;
  assert.equal(overlays(root, dot).length, 4);
  assert.equal(overlays(root, ring).length, 1);

  // The ring is on the pawn's square, and nothing on it hides the pawn.
  const [d5] = squares(root).filter(
    (square) => overlays(square, ring).length === 1,
  );
  assert.equal(d5.findAllByType(PIECES.p as never).length, 1);
  assert.equal(overlays(d5, dot).length, 0);
  // Drawn before the pawn, so the pawn stays whole on top of it.
  const layers = d5.children.filter(
    (child): child is Instance => typeof child !== 'string',
  );
  const ringAt = layers.findIndex((layer) => overlays(layer, ring).length);
  const pawnAt = layers.findIndex((layer) => layer.type === PIECES.p);
  assert.ok(ringAt >= 0 && pawnAt > ringAt, `ring ${ringAt}, pawn ${pawnAt}`);

  for (const mark of overlays(root, (s) => dot(s) || ring(s))) {
    const s = styleOf(mark);
    const size = s.width as number;
    assert.equal(s.height, size);
    assert.equal(s.borderRadius, size / 2, 'round');
    for (const offset of [s.left, s.top] as number[])
      assert.ok(Math.abs(offset * 2 + size - EDGE) <= 1, 'centred');
    if (dot(s)) assert.ok(size < EDGE / 2, `dot ${size} vs square ${EDGE}`);
    else {
      // Wide enough to go around the piece, and hollow.
      assert.ok(size > EDGE * 0.8, `ring ${size} vs square ${EDGE}`);
      assert.ok((s.borderWidth as number) > 0);
      assert.equal(s.backgroundColor, undefined, 'hollow');
    }
  }
});

test('nothing is marked when no cursor, selection or last move is given', () => {
  const root = render({ legal: ['b1a3', 'b1c3'] });
  assert.equal(overlays(root, () => true).length, 0);
});

test('the board fills the size it is given, rounded to whole squares', () => {
  for (const size of [800, 476, 1017]) {
    const root = mount({ size, board: INITIAL });
    const edge = Math.floor(size / 8);
    const outer = styleOf(root.findAllByType('View' as never)[0]);
    assert.equal(outer.width, edge * 8);
    assert.equal(outer.height, edge * 8);
    assert.ok(edge * 8 <= size);
  }
});
