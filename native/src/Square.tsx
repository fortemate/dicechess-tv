// One square of the board and the marks on it: the last move, the pieces that
// can move, the picked-up piece, the legal destinations and the cursor. It
// draws what a SquareView says and nothing else. The arrow from the picked-up
// piece to the cursor spans squares, so ./MoveArrow.tsx draws it over the board.
import React from 'react';
import { View } from 'react-native';
import type { SquareView } from '../../src/core/boardView';
import { PIECES } from './pieces';
import { THEME } from './theme';

// Ring thickness and piece inset scale with the board so the board stays
// legible whether it is sized for a 1080p panel or a smaller window.
const ring = (size: number) => Math.max(2, Math.round(size / 240));

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

// The cursor (#121): a cyan frame at twice the ring's width, with a dark line
// inside it. Cyan is almost as light as the light squares, so on them the frame
// alone stood out by hue only; the line stands out by lightness on both.
const Cursor = ({ edge }: { edge: number }) => {
  const line = ring(edge * 8);
  const frame = line * 2;
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: edge,
          height: edge,
          borderWidth: frame,
          borderColor: THEME.cursor,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: frame,
          top: frame,
          width: edge - frame * 2,
          height: edge - frame * 2,
          borderWidth: line,
          borderColor: THEME.cursorLine,
        }}
      />
    </>
  );
};

// The picked-up piece (#121), lifted off its square: a fifth larger, a tenth of
// a square higher, over the shadow it casts. It carries no frame or tint, so it
// cannot be mistaken for the cursor, which is on one of its destinations.
const RAISED = 1.2;
const LIFT = 0.1;

const Shadow = ({ edge }: { edge: number }) => {
  const width = Math.round(edge * 0.76);
  const height = Math.round(edge * 0.22);
  return (
    <View
      style={{
        position: 'absolute',
        left: Math.round((edge - width) / 2),
        top: Math.round(edge * 0.74),
        width,
        height,
        borderRadius: height / 2,
        backgroundColor: THEME.shadow,
      }}
    />
  );
};

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
      {view.selected ? <Shadow edge={edge} /> : null}
      {view.destination ? (
        <Destination edge={edge} occupied={view.piece !== null} />
      ) : null}
      {view.selected && piece ? (
        <View
          style={{
            transform: [{ scale: RAISED }, { translateY: -edge * LIFT }],
          }}
        >
          {piece}
        </View>
      ) : (
        piece
      )}
      {view.cursor ? <Cursor edge={edge} /> : null}
    </View>
  );
};
