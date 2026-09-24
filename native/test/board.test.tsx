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
  );

  // The cursor square and the selected square each get a ring, and the selected
  // one is twice as thick so the two are told apart.
  const rings = overlays(root, (s) => s.borderColor === THEME.cursor);
  assert.equal(rings.length, 2);
  const widths = rings
    .map((ring) => styleOf(ring).borderWidth as number)
    .sort((a, b) => a - b);
  assert.equal(widths[1], widths[0] * 2, `ring widths ${widths}`);
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
