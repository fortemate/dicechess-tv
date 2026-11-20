import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Dice } from '../src/Dice';
import { PIECES } from '../src/pieces';
import { THEME } from '../src/theme';
import { isHost, styleOf } from './support';

const names = {
  P: 'pawn',
  N: 'knight',
  B: 'bishop',
  R: 'rook',
  Q: 'queen',
  K: 'king',
};
const sizes = [
  { size: 37, spentEdge: 32, pieceSize: 27, spentPieceSize: 23 },
  { size: 72, spentEdge: 62, pieceSize: 52, spentPieceSize: 45 },
  { size: 96, spentEdge: 83, pieceSize: 69, spentPieceSize: 60 },
];
const states = [
  { spent: false, leftover: false, opacity: 1, ring: true, suffix: '' },
  {
    spent: false,
    leftover: true,
    opacity: 0.45,
    ring: false,
    suffix: ", can't be used",
  },
  { spent: true, leftover: false, opacity: 0.3, ring: false, suffix: ', used' },
  // Although the engine does not produce both flags, the component accepts
  // them: spent appearance and wording take precedence over leftover.
  { spent: true, leftover: true, opacity: 0.3, ring: false, suffix: ', used' },
];

test('each side and face retains exact opacity, spent precedence, size, ring and accessible wording', async () => {
  for (const side of ['w', 'b'] as const)
    for (const [piece, name] of Object.entries(names))
      for (const size of sizes)
        for (const state of states) {
          const die = Object.freeze({
            piece,
            spent: state.spent,
            leftover: state.leftover,
          });
          const props = Object.freeze({
            dice: Object.freeze([die]),
            side,
            size: size.size,
          });
          const before = JSON.stringify(props);
          let tree!: renderer.ReactTestRenderer;
          await act(async () => {
            tree = renderer.create(<Dice {...props} />);
          });
          try {
            const face = tree.root.find(
              (node) =>
                isHost(node, 'View') &&
                styleOf(node).backgroundColor === THEME.die,
            );
            const style = styleOf(face);
            assert.equal(style.opacity, state.opacity);
            assert.equal(style.width, state.spent ? size.spentEdge : size.size);
            assert.equal(style.height, style.width);
            assert.equal((style.borderWidth as number) > 0, state.ring);
            assert.equal(style.borderColor, THEME.dieRing);
            assert.equal(face.props.role, 'img');
            assert.equal(
              face.props['aria-label'],
              `${name} die${state.suffix}`,
            );
            const letter = side === 'w' ? piece : piece.toLowerCase();
            const image = face.findByType(
              PIECES[letter as keyof typeof PIECES] as never,
            );
            assert.equal(
              image.props.size,
              state.spent ? size.spentPieceSize : size.pieceSize,
            );
            assert.equal(JSON.stringify(props), before);
          } finally {
            await act(async () => tree.unmount());
          }
        }
});

test('an unknown piece keeps its accessible face and styling without drawing a piece', async () => {
  for (const side of ['w', 'b'] as const) {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <Dice
          dice={[{ piece: '?', spent: false, leftover: true }]}
          side={side}
        />,
      );
    });
    try {
      const face = tree.root.find(
        (node) =>
          isHost(node, 'View') && styleOf(node).backgroundColor === THEME.die,
      );
      assert.equal(styleOf(face).opacity, 0.45);
      assert.equal(styleOf(face).borderWidth, 0);
      assert.equal(face.props.role, 'img');
      assert.equal(face.props.children, null);
    } finally {
      await act(async () => tree.unmount());
    }
  }
});
