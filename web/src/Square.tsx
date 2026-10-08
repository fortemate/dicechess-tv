// A board square with the bench's marks. native/src/Board.tsx draws its
// squares with this one on the bench (vite.config.ts swaps the import), and
// with native/src/Square.tsx on the television.
//
// With the default marks it is the television's square itself, so the TV look
// on the bench is never a copy that has drifted. Every other choice is drawn
// here, in the same layers and order as the original: last move, the movable
// mark, the picked-up tint, the destination, the piece, then the cursor.
import React from 'react';
import { View } from 'react-native';
import type { SquareView } from '../../src/core/boardView';
import { Square as TvSquare } from '../../native/src/Square';
import { PIECES } from '../../native/src/pieces';
import { THEME } from '../../native/src/theme';
import {
  PALETTES,
  getBench,
  isDefault,
  subscribeBench,
  type Marks,
  type Palette,
} from './marks';

const useMarks = (): Marks =>
  React.useSyncExternalStore(subscribeBench, () => getBench().marks);

// The cursor's width on the television, native/src/Square.tsx's ring().
const ring = (edge: number) => Math.max(2, Math.round((edge * 8) / 240));

const cover = (edge: number, style: object) => (
  <View
    style={{
      position: 'absolute',
      left: 0,
      top: 0,
      width: edge,
      height: edge,
      ...style,
    }}
  />
);

// An inset frame: inside the square, clear of the cursor at its edge.
const Inset = ({ edge, color }: { edge: number; color: string }) => {
  const width = Math.max(2, Math.round(edge * 0.06));
  const inset = Math.max(3, Math.round(edge * 0.08));
  return (
    <View
      style={{
        position: 'absolute',
        left: inset,
        top: inset,
        width: edge - inset * 2,
        height: edge - inset * 2,
        borderWidth: width,
        borderColor: color,
        borderRadius: Math.round(edge * 0.08),
      }}
    />
  );
};

// The corner brackets of the #105 mock-ups (b903da5), unchanged: inset so that
// the cursor's frame at the square's edge stays clear of them.
const CORNERS = [
  { key: 'top-left', left: true, top: true },
  { key: 'top-right', left: false, top: true },
  { key: 'bottom-left', left: true, top: false },
  { key: 'bottom-right', left: false, top: false },
];

const Corners = ({ edge, color }: { edge: number; color: string }) => {
  const width = Math.max(2, Math.round(edge * 0.07));
  const arm = Math.round(edge * 0.28);
  const inset = Math.max(3, Math.round(edge * 0.07));
  return (
    <>
      {CORNERS.map(({ key, left, top }) => (
        <View
          key={key}
          style={{
            position: 'absolute',
            width: arm,
            height: arm,
            borderColor: color,
            ...(left
              ? { left: inset, borderLeftWidth: width }
              : { right: inset, borderRightWidth: width }),
            ...(top
              ? { top: inset, borderTopWidth: width }
              : { bottom: inset, borderBottomWidth: width }),
          }}
        />
      ))}
    </>
  );
};

// A disc in the top-right corner, ringed in white so it reads on either square.
const Badge = ({ edge, color }: { edge: number; color: string }) => {
  const size = Math.round(edge * 0.24);
  const inset = Math.max(3, Math.round(edge * 0.06));
  return (
    <View
      style={{
        position: 'absolute',
        right: inset,
        top: inset,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: Math.max(1, Math.round(edge * 0.03)),
        borderColor: '#ffffff',
      }}
    />
  );
};

const Movable = ({ marks, palette, edge }: MarkProps) => {
  switch (marks.movable) {
    case 'fill':
      return cover(edge, { backgroundColor: palette.movable });
    case 'fill-corners':
      return (
        <>
          {cover(edge, { backgroundColor: palette.movable })}
          <Corners edge={edge} color={palette.movableLine} />
        </>
      );
    case 'corners':
      return <Corners edge={edge} color={palette.movableLine} />;
    case 'outline':
      return <Inset edge={edge} color={palette.movableLine} />;
    case 'badge':
      return <Badge edge={edge} color={palette.movableLine} />;
    case 'none':
      return null;
  }
};

// A dot on an empty square, a ring around a piece that would be taken; or a
// mark on the whole square, which needs no such difference.
const Destination = ({
  marks,
  palette,
  edge,
  occupied,
}: MarkProps & { occupied: boolean }) => {
  switch (marks.destination) {
    case 'fill':
      return cover(edge, { backgroundColor: palette.destination });
    case 'corners':
      return <Corners edge={edge} color={palette.destinationLine} />;
    case 'outline':
      return <Inset edge={edge} color={palette.destinationLine} />;
    case 'dot':
    case 'dot-large': {
      const dot = marks.destination === 'dot' ? 0.32 : 0.46;
      const size = Math.round(edge * (occupied ? 0.94 : dot));
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
                  borderWidth: Math.max(
                    2,
                    Math.round(
                      edge * (marks.destination === 'dot' ? 0.08 : 0.12),
                    ),
                  ),
                  borderColor: palette.destination,
                }
              : { backgroundColor: palette.destination }),
          }}
        />
      );
    }
  }
};

// The cursor, and the picked-up piece's heavier frame. A two-tone frame keeps a
// dark line inside the bright one, so it stands out from light and dark squares
// by lightness as well as by colour.
const Cursor = ({
  marks,
  palette,
  edge,
  selected,
}: MarkProps & { selected: boolean }) => {
  const base = ring(edge) * (marks.cursor === 'thick' ? 2 : 1);
  const width = selected && marks.selected !== 'lift' ? base * 2 : base;
  return (
    <>
      {cover(edge, { borderWidth: width, borderColor: palette.cursor })}
      {marks.cursor === 'two-tone' ? (
        <View
          style={{
            position: 'absolute',
            left: width,
            top: width,
            width: edge - width * 2,
            height: edge - width * 2,
            borderWidth: Math.max(1, Math.round(width / 2)),
            borderColor: palette.cursorInner,
          }}
        />
      ) : null}
    </>
  );
};

type MarkProps = { marks: Marks; palette: Palette; edge: number };

export const Square = ({ view, edge }: { view: SquareView; edge: number }) => {
  const marks = useMarks();
  if (isDefault(marks)) return <TvSquare view={view} edge={edge} />;
  const palette = PALETTES[marks.palette];
  const props = { marks, palette, edge };
  const Piece = view.piece ? PIECES[view.piece as keyof typeof PIECES] : null;
  const lifted = view.selected && marks.selected === 'lift';
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
      {view.lastMove && marks.lastMove === 'tint'
        ? cover(edge, { backgroundColor: palette.lastMove })
        : null}
      {view.lastMove && marks.lastMove === 'outline' ? (
        <Inset edge={edge} color={palette.lastMoveLine} />
      ) : null}
      {view.movable ? <Movable {...props} /> : null}
      {view.selected && marks.selected === 'tint-frame'
        ? cover(edge, { backgroundColor: palette.selected })
        : null}
      {view.selected && marks.selected === 'solid'
        ? cover(edge, { backgroundColor: palette.selectedSolid })
        : null}
      {lifted ? cover(edge, { backgroundColor: palette.selected }) : null}
      {view.destination ? (
        <Destination {...props} occupied={view.piece !== null} />
      ) : null}
      {Piece ? (
        <View
          style={
            lifted
              ? { transform: [{ scale: 1.14 }, { translateY: -edge * 0.04 }] }
              : undefined
          }
        >
          <Piece size={Math.round(edge * 0.92)} />
        </View>
      ) : null}
      {view.cursor || view.selected ? (
        <Cursor {...props} selected={view.selected} />
      ) : null}
    </View>
  );
};
