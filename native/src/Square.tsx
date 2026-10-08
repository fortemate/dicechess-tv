// One square of the board and the marks on it: the last move, the pieces that
// can move, the picked-up piece, the legal destinations and the cursor. It
// draws what a SquareView says and nothing else.
import React from 'react';
import { View } from 'react-native';
import type { SquareView } from '../../src/core/boardView';
import { PIECES } from './pieces';
import { THEME } from './theme';

// Ring thickness and piece inset scale with the board so the board stays
// legible whether it is sized for a 1080p panel or a smaller window.
const ring = (size: number) => Math.max(2, Math.round(size / 240));

// A legal destination, marked the way most chess programs mark one: a dot on an
// empty square, and a ring around a piece that would be taken, since a dot would
// hide behind it. The ring is drawn under the piece: the piece is wider than the
// ring's opening, so a ring on top would cover its edges.
const Destination = ({
  edge,
  occupied,
}: {
  edge: number;
  occupied: boolean;
}) => {
  const size = Math.round(edge * (occupied ? 0.94 : 0.32));
  const offset = Math.round((edge - size) / 2);
  return (
    <View
      style={{
        position: 'absolute',
        left: offset,
        top: offset,
        width: size,
        height: size,
        borderRadius: size / 2,
        ...(occupied
          ? {
              borderWidth: Math.max(2, Math.round(edge * 0.08)),
              borderColor: THEME.destination,
            }
          : { backgroundColor: THEME.destination }),
      }}
    />
  );
};

export const Square = ({ view, edge }: { view: SquareView; edge: number }) => {
  const Piece = view.piece ? PIECES[view.piece as keyof typeof PIECES] : null;
  const width = ring(edge * 8);
  const focus = view.cursor || view.selected;
  return (
    <View
      style={{
        width: edge,
        height: edge,
        backgroundColor: view.dark ? THEME.dark : THEME.light,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {view.lastMove ? (
        <View
          style={{
            position: 'absolute',
            width: edge,
            height: edge,
            backgroundColor: THEME.lastMove,
          }}
        />
      ) : null}
      {view.movable ? (
        // A piece that can move now (#68): a fill under the piece, a shape the
        // cursor's ring and the destination dots do not share.
        <View
          style={{
            position: 'absolute',
            width: edge,
            height: edge,
            backgroundColor: THEME.movable,
          }}
        />
      ) : null}
      {view.selected ? (
        <View
          style={{
            position: 'absolute',
            width: edge,
            height: edge,
            backgroundColor: THEME.selected,
          }}
        />
      ) : null}
      {view.destination ? (
        <Destination edge={edge} occupied={view.piece !== null} />
      ) : null}
      {Piece ? <Piece size={Math.round(edge * 0.92)} /> : null}
      {focus ? (
        <View
          style={{
            position: 'absolute',
            width: edge,
            height: edge,
            borderWidth: view.selected ? width * 2 : width,
            borderColor: THEME.cursor,
          }}
        />
      ) : null}
    </View>
  );
};
