import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Board } from '../src/Board';
import { arrowPath, hides } from '../src/arrow';
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
    overlays(root, (s) => s.backgroundColor === THEME.shadow).length,
    1,
    'the picked-up piece stands on a shadow',
  );

  // Only the cursor is framed in cyan (#121). The picked-up piece used to carry
  // the same frame, twice as thick, and the two were hard to tell apart.
  assert.equal(overlays(root, (s) => s.borderColor === THEME.cursor).length, 1);
  assert.equal(arrows(root).length, 1);
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

test('the cursor is a cyan frame with a dark line inside it (#121)', () => {
  const root = render({ cursor: 'e4' });
  const e4 = squareAt(root, 'e4');
  const [frame] = overlays(e4, (s) => s.borderColor === THEME.cursor);
  const [line] = overlays(e4, (s) => s.borderColor === THEME.cursorLine);
  assert.ok(frame && line, 'both on the cursor square');
  const width = styleOf(frame).borderWidth as number;
  assert.equal(styleOf(frame).width, EDGE);
  // Twice the line's width, and the line sits just inside it.
  assert.equal(styleOf(line).borderWidth, width / 2);
  assert.equal(styleOf(line).left, width);
  assert.equal(styleOf(line).top, width);
  assert.equal(styleOf(line).width, EDGE - width * 2);
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

test('the cursor stands out by lightness on both square colours (#121)', () => {
  // The cyan alone is 1.08:1 against a light square, so the dark line carries
  // the frame there. WCAG 2.2 (1.4.11) asks 3:1 of a graphical object.
  for (const square of [THEME.light, THEME.dark])
    assert.ok(
      contrast(THEME.cursorLine, square) >= 3,
      `line on ${square}: ${contrast(THEME.cursorLine, square).toFixed(2)}`,
    );
  assert.ok(contrast(THEME.cursor, THEME.cursorLine) >= 3);
});

test('the picked-up piece is raised on its shadow, with no frame (#121)', () => {
  const root = render({
    legal: ['b1a3', 'b1c3'],
    selected: 'b1',
    cursor: 'c3',
  });
  const b1 = squareAt(root, 'b1');
  const layers = b1.children.filter(
    (child): child is Instance => typeof child !== 'string',
  );
  const shadowAt = layers.findIndex(
    (layer) =>
      overlays(layer, (s) => s.backgroundColor === THEME.shadow).length,
  );
  const lifted = layers.findIndex(
    (layer) => layer.findAllByType(PIECES.N as never).length === 1,
  );
  assert.ok(shadowAt >= 0 && lifted > shadowAt, 'the knight over its shadow');
  const [scale, rise] = styleOf(layers[lifted]).transform as unknown as [
    { scale: number },
    { translateY: number },
  ];
  assert.ok(scale.scale > 1, 'larger than the pieces left standing');
  assert.ok(rise.translateY < 0, 'lifted');
  assert.equal(overlays(b1, (s) => s.borderColor !== undefined).length, 0);

  // A piece left standing is drawn as it is, without the wrapper.
  const g1 = squareAt(root, 'g1');
  assert.ok(g1.children.some((child) => (child as Instance).type === PIECES.N));
});

test('an arrow joins the picked-up piece to the cursor, and only then (#121)', () => {
  const centre = (file: number, row: number) => ({
    x: (file + 0.5) * EDGE,
    y: (row + 0.5) * EDGE,
  });
  const path = (root: Instance) =>
    arrows(root)
      .flatMap((arrow) => arrow.findAll((node) => isHost(node, 'Path')))
      .map((node) => node.props.d as string);

  const picked = { legal: ['b1a3', 'b1c3'], selected: 'b1', cursor: 'c3' };
  // b1 is file 1 on the bottom row; c3 is file 2, two rows up.
  assert.deepEqual(path(render(picked)), [
    arrowPath(centre(1, 7), centre(2, 5), EDGE),
  ]);
  // From Black's side, b1 is at the top, second from the right.
  assert.deepEqual(path(render({ ...picked, flipped: true })), [
    arrowPath(centre(6, 0), centre(5, 2), EDGE),
  ]);
  assert.deepEqual(path(render({ cursor: 'b1' })), [], 'no piece picked up');
});

test('a dot the arrow passes over is drawn on top of it (#121)', () => {
  // A pawn on e2 picked up, the cursor on its two-square push: the arrow runs
  // over e3, the single step, which must stay in sight.
  const root = render({
    legal: ['e2e3', 'e2e4'],
    selected: 'e2',
    cursor: 'e4',
  });
  const dot = (s: Style) => s.backgroundColor === THEME.destination;
  assert.equal(overlays(squareAt(root, 'e3'), dot).length, 0, 'not under it');
  assert.equal(overlays(squareAt(root, 'e4'), dot).length, 1);

  const views = root.findAll((node) => isHost(node, 'View'), { deep: true });
  const arrowAt = views.findIndex((node) => node.props.testID === 'move-arrow');
  const [e3] = overlays(root, dot).filter(
    (node) =>
      !squares(root).some((square) => overlays(square, dot).includes(node)),
  );
  assert.ok(e3, 'drawn by the arrow');
  assert.ok(views.indexOf(e3) > arrowAt, 'after the arrow, so over it');
  // Where e3's own dot would be: file e, the sixth row from the top.
  const size = Math.round(EDGE * 0.32);
  assert.equal(styleOf(e3).left, 4 * EDGE + Math.round((EDGE - size) / 2));
  assert.equal(styleOf(e3).top, 5 * EDGE + Math.round((EDGE - size) / 2));
  // On a disc of the square's own colour, so it looks like every other dot.
  const disc = views[views.indexOf(e3) - 1];
  assert.equal(styleOf(disc).backgroundColor, THEME.dark, 'e3 is dark');
  assert.equal(styleOf(disc).left, styleOf(e3).left);
});

test('only the squares between the two ends are under the arrow', () => {
  const at = (file: number, row: number) => ({ x: file * 10, y: row * 10 });
  const [from, to] = [at(0, 7), at(0, 2)];
  assert.ok(hides(from, to, at(0, 5), 10), 'on the way');
  assert.ok(!hides(from, to, at(0, 7), 10), 'the picked-up square');
  assert.ok(!hides(from, to, at(0, 2), 10), 'the cursor');
  assert.ok(!hides(from, to, at(0, 1), 10), 'beyond the cursor');
  assert.ok(!hides(from, to, at(1, 5), 10), 'beside the way');
  // A knight's arrow passes between squares, over none of their centres.
  assert.ok(!hides(at(2, 5), at(1, 3), at(1, 4), 10));
  assert.ok(!hides(at(2, 5), at(1, 3), at(2, 4), 10));
});

test('the arrow leaves the picked-up square and stops short of the dot', () => {
  const from = { x: 50, y: 350 };
  const tip = (d: string) => {
    // The fourth point of the outline is the tip.
    const [x, y] = d.slice(2, -2).split(' L ')[3].split(' ').map(Number);
    return Math.hypot(x - from.x, y - from.y);
  };
  for (const [to, length] of [
    [{ x: 150, y: 150 }, Math.hypot(100, 200)],
    [{ x: 50, y: 250 }, 100],
  ] as const) {
    const d = arrowPath(from, to, 100);
    assert.ok(d, 'drawn, even for a move to the next square');
    assert.ok(tip(d) < length - 15, 'short of the centre and its dot');
    assert.ok(tip(d) > 50, 'beyond the picked-up square');
  }
  assert.equal(arrowPath(from, { x: 60, y: 350 }, 100), null);
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
