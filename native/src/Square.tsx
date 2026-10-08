// One square of the board and the marks on it: the last move, the pieces that
// can move, the picked-up piece, the legal destinations and the cursor. It
// draws what a SquareView says and nothing else.
import React from 'react';
import { View } from 'react-native';
import type { SquareView } from '../../src/core/boardView';
import { PIECES } from './pieces';
import { THEME } from './theme';

// A destination dot's diameter, in squares.
export const DOT = 0.32;

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
  const size = Math.round(edge * (occupied ? 0.94 : DOT));
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

// The remote's focus, whether choosing a piece or its destination: two dark
// green square brackets. Their open top and bottom leave the piece visible.
export const FocusBrackets = ({
  edge,
  color = THEME.boardCursor,
}: {
  edge: number;
  color?: string;
}) => {
  const width = Math.max(2, Math.round(edge * 0.085));
  const inset = Math.round(edge * 0.06);
  const top = Math.round(edge * 0.13);
  return (
    <>
      {[true, false].map((left) => (
        <View
          key={String(left)}
          style={{
            position: 'absolute',
            ...(left ? { left: inset } : { right: inset }),
            top,
            width: Math.round(edge * 0.2),
            height: edge - top * 2,
            borderColor: color,
            borderTopWidth: width,
            borderBottomWidth: width,
            ...(left
              ? { borderLeftWidth: width }
              : { borderRightWidth: width }),
          }}
        />
      ))}
    </>
  );
};

// The source stays marked while focus moves: a warm fill and a dark baseline,
// distinct in shape from the focus brackets. The piece keeps its normal size.
export const PickedUp = ({
  edge,
  fill = THEME.selected,
  line = THEME.selectedLine,
}: {
  edge: number;
  fill?: string;
  line?: string;
}) => (
  <View
    style={{
      position: 'absolute',
      left: 0,
      top: 0,
      width: edge,
      height: edge,
      backgroundColor: fill,
      borderBottomWidth: Math.max(2, Math.round(edge * 0.085)),
      borderBottomColor: line,
    }}
  />
);

export const Square = ({ view, edge }: { view: SquareView; edge: number }) => {
  const Piece = view.piece ? PIECES[view.piece as keyof typeof PIECES] : null;
  const piece = Piece ? <Piece size={Math.round(edge * 0.92)} /> : null;
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
        // cursor's brackets and the destination dots do not share.
        <View
          style={{
            position: 'absolute',
            width: edge,
            height: edge,
            backgroundColor: THEME.movable,
          }}
        />
      ) : null}
      {view.selected ? <PickedUp edge={edge} /> : null}
      {view.cursor ? (
        <View
          style={{
            position: 'absolute',
            width: edge,
            height: edge,
            backgroundColor: THEME.boardFocusFill,
          }}
        />
      ) : null}
      {view.destination && !view.cursor ? (
        <Destination edge={edge} occupied={view.piece !== null} />
      ) : null}
      {piece}
      {view.cursor ? <FocusBrackets edge={edge} /> : null}
    </View>
  );
};
