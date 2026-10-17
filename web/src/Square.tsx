// A board square with the bench's marks. native/src/Board.tsx draws its
// squares with this one on the bench (vite.config.ts swaps the import), and
// with native/src/Square.tsx on the television.
//
// With the default marks it is the television's square itself, so the TV look
// on the bench is never a copy that has drifted. Every other choice is drawn
// here, in the same layers and order as the original: last move, the movable
// mark, the picked-up mark, the destination, the piece, then the cursor.
import React from 'react';
import { View } from 'react-native';
import { Square as TvSquare, type SquareProps } from '../../native/src/Square';
import { PIECES } from '../../native/src/pieces';
import { THEME } from '../../native/src/theme';
import {
  PALETTES,
  SHARES_CURSOR_FRAME,
  getBench,
  isDefault,
  subscribeBench,
  type Marks,
  type Palette,
} from './marks';

// The FEN letter of the picked-up piece, for the ghost under the cursor. The
// compare view supplies it directly; in a live game on the bench it is
// remembered from the selected or focused movable square.
export const Carried = React.createContext<string | null>(null);
let lastCarried: string | null = null;

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

const Corners = ({
  edge,
  color,
  insetScale = 0.07,
  armScale = 0.28,
  widthScale = 0.07,
}: {
  edge: number;
  color: string;
  insetScale?: number;
  armScale?: number;
  widthScale?: number;
}) => {
  const width = Math.max(2, Math.round(edge * widthScale));
  const arm = Math.round(edge * armScale);
  const inset = Math.round(edge * insetScale);
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

// A bar along the bottom of the square, ringed for contrast on both squares.
const Pedestal = ({
  edge,
  color,
  borderColor = '#ffffff',
}: {
  edge: number;
  color: string;
  borderColor?: string;
}) => {
  const width = Math.round(edge * 0.74);
  const height = Math.max(5, Math.round(edge * 0.14));
  const bottom = Math.max(3, Math.round(edge * 0.05));
  return (
    <View
      style={{
        position: 'absolute',
        left: Math.round((edge - width) / 2),
        bottom,
        width,
        height,
        borderRadius: Math.round(height / 2),
        backgroundColor: color,
        borderWidth: Math.max(1, Math.round(edge * 0.03)),
        borderColor,
      }}
    />
  );
};

// An oval drop shadow beneath a lifted piece.
const Shadow = ({ edge, color }: { edge: number; color: string }) => {
  const width = Math.round(edge * 0.74);
  const height = Math.round(edge * 0.22);
  return (
    <View
      style={{
        position: 'absolute',
        left: Math.round((edge - width) / 2),
        top: Math.round(edge * 0.73),
        width,
        height,
        borderRadius: Math.round(height / 2),
        backgroundColor: color,
      }}
    />
  );
};

// A frame at the square's edge, optionally lined inside with a dark border so
// it stands out on light and dark squares alike.
const TwoToneFrame = ({
  edge,
  width,
  color,
  inner,
}: {
  edge: number;
  width: number;
  color: string;
  inner: string | null;
}) => (
  <>
    {cover(edge, { borderWidth: width, borderColor: color })}
    {inner ? (
      <View
        style={{
          position: 'absolute',
          left: width,
          top: width,
          width: edge - width * 2,
          height: edge - width * 2,
          borderWidth: Math.max(1, Math.round(width / 2)),
          borderColor: inner,
        }}
      />
    ) : null}
  </>
);

const Movable = ({
  marks,
  palette,
  edge,
  cursorFilled,
}: MarkProps & { cursorFilled: boolean }) => {
  switch (marks.movable) {
    case 'fill':
      return cursorFilled
        ? null
        : cover(edge, { backgroundColor: palette.movable });
    case 'fill-corners':
      return (
        <>
          {cursorFilled
            ? null
            : cover(edge, { backgroundColor: palette.movable })}
          <Corners edge={edge} color={palette.movableLine} />
        </>
      );
    case 'corners':
      return <Corners edge={edge} color={palette.movableLine} />;
    case 'outline':
      return <Inset edge={edge} color={palette.movableLine} />;
    case 'pedestal':
      return <Pedestal edge={edge} color={palette.movableLine} />;
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
    case 'diamond': {
      if (occupied) {
        return <Corners edge={edge} color={palette.destinationLine} />;
      }
      const size = Math.round(edge * 0.3);
      const offset = Math.round((edge - size) / 2);
      return (
        <View
          style={{
            position: 'absolute',
            left: offset,
            top: offset,
            width: size,
            height: size,
            backgroundColor: palette.destinationLine,
            borderWidth: Math.max(1, Math.round(edge * 0.03)),
            borderColor: palette.destinationRing,
            transform: [{ rotate: '45deg' }],
          }}
        />
      );
    }
    case 'dot-ringed': {
      const size = Math.round(edge * (occupied ? 0.94 : 0.36));
      const offset = Math.round((edge - size) / 2);
      const ringWidth = Math.max(2, Math.round(edge * 0.08));
      const rimWidth = Math.max(1, Math.round(edge * 0.03));
      return (
        <>
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
                    borderWidth: ringWidth,
                    borderColor: palette.destinationLine,
                  }
                : {
                    backgroundColor: palette.destinationLine,
                    borderWidth: Math.max(2, Math.round(edge * 0.035)),
                    borderColor: palette.destinationRing,
                  }),
            }}
          />
          {occupied ? (
            <View
              style={{
                position: 'absolute',
                left: offset + ringWidth,
                top: offset + ringWidth,
                width: size - ringWidth * 2,
                height: size - ringWidth * 2,
                borderRadius: (size - ringWidth * 2) / 2,
                borderWidth: rimWidth,
                borderColor: palette.destinationRing,
              }}
            />
          ) : null}
        </>
      );
    }
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

// An extra cue on the destination square currently under the cursor (#401).
const TargetBullseye = ({
  palette,
  edge,
  occupied,
}: {
  palette: Palette;
  edge: number;
  occupied: boolean;
}) => {
  if (occupied) {
    return (
      <Corners
        edge={edge}
        color={palette.cursor}
        insetScale={0.11}
        armScale={0.26}
        widthScale={0.07}
      />
    );
  }
  const size = Math.round(edge * 0.72);
  const offset = Math.round((edge - size) / 2);
  const outer = Math.max(2, Math.round(edge * 0.065));
  const inner = Math.max(1, Math.round(outer / 2));
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: offset,
          top: offset,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: outer,
          borderColor: palette.cursor,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: offset + outer,
          top: offset + outer,
          width: size - outer * 2,
          height: size - outer * 2,
          borderRadius: (size - outer * 2) / 2,
          borderWidth: inner,
          borderColor: palette.cursorInner,
        }}
      />
    </>
  );
};

// The cursor, and the picked-up piece's heavier frame when a frame-sharing
// selected mark is chosen.
const Cursor = ({
  marks,
  palette,
  edge,
  selected,
}: MarkProps & { selected: boolean }) => {
  if (marks.cursor === 'brackets') {
    const outer = ring(edge) * 2;
    return (
      <>
        <Corners
          edge={edge}
          color={palette.cursor}
          insetScale={0}
          armScale={0.34}
          widthScale={(outer / edge) * 1.1}
        />
        <Corners
          edge={edge}
          color={palette.cursorInner}
          insetScale={outer / edge}
          armScale={0.26}
          widthScale={ring(edge) / edge}
        />
      </>
    );
  }
  const bold =
    marks.cursor === 'thick' ||
    marks.cursor === 'two-tone-bold' ||
    marks.cursor === 'fill-two-tone';
  const base = ring(edge) * (bold ? 2 : 1);
  const width =
    selected && SHARES_CURSOR_FRAME.includes(marks.selected) ? base * 2 : base;
  const twoTone =
    marks.cursor === 'two-tone' ||
    marks.cursor === 'two-tone-bold' ||
    marks.cursor === 'fill-two-tone';
  return (
    <TwoToneFrame
      edge={edge}
      width={width}
      color={palette.cursor}
      inner={twoTone ? palette.cursorInner : null}
    />
  );
};

type MarkProps = { marks: Marks; palette: Palette; edge: number };

export const Square = ({
  view,
  edge,
  highlights,
  carried: propCarried,
}: SquareProps) => {
  const marks = useMarks();
  const contextCarried = React.useContext(Carried);
  if ((view.selected || (view.cursor && view.movable)) && view.piece) {
    lastCarried = view.piece;
  }
  const carried = propCarried ?? contextCarried ?? lastCarried;
  if (isDefault(marks))
    return (
      <TvSquare
        view={view}
        edge={edge}
        highlights={highlights}
        carried={view.cursor && view.destination ? carried : null}
      />
    );
  const palette = PALETTES[marks.palette];
  const props = { marks, palette, edge };
  const Piece = view.piece ? PIECES[view.piece as keyof typeof PIECES] : null;
  const GhostPiece =
    marks.target === 'ghost' && view.cursor && view.destination && carried
      ? PIECES[carried as keyof typeof PIECES]
      : null;
  const lifted = view.selected && marks.selected === 'lift';
  const raised = view.selected && marks.selected === 'raised';
  const warmPedestal = view.selected && marks.selected === 'warm-pedestal';
  const warmFrame = view.selected && marks.selected === 'warm-frame';
  const cursorFilled = view.cursor && marks.cursor === 'fill-two-tone';
  const targetFilled =
    view.cursor && view.destination && marks.target === 'fill';
  const sharesCursorFrame = SHARES_CURSOR_FRAME.includes(marks.selected);
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
      {view.movable ? <Movable {...props} cursorFilled={cursorFilled} /> : null}
      {cursorFilled || targetFilled
        ? cover(edge, { backgroundColor: palette.cursorFill })
        : null}
      {view.selected && marks.selected === 'tint-frame'
        ? cover(edge, { backgroundColor: palette.selected })
        : null}
      {view.selected && marks.selected === 'solid'
        ? cover(edge, { backgroundColor: palette.selectedSolid })
        : null}
      {lifted ? cover(edge, { backgroundColor: palette.selected }) : null}
      {warmFrame || warmPedestal
        ? cover(edge, { backgroundColor: palette.selectedWarmFill })
        : null}
      {raised || warmPedestal ? (
        <Shadow edge={edge} color={palette.shadow} />
      ) : null}
      {warmPedestal ? (
        <Pedestal
          edge={edge}
          color={palette.selectedWarm}
          borderColor={palette.cursorInner}
        />
      ) : null}
      {view.destination && !(GhostPiece && !view.piece) ? (
        <Destination {...props} occupied={view.piece !== null} />
      ) : null}
      {view.destination && view.cursor && marks.target === 'bullseye' ? (
        <TargetBullseye
          palette={palette}
          edge={edge}
          occupied={view.piece !== null}
        />
      ) : null}
      {Piece ? (
        <View
          style={
            lifted
              ? { transform: [{ scale: 1.14 }, { translateY: -edge * 0.04 }] }
              : raised || warmPedestal
                ? {
                    transform: [{ scale: 1.18 }, { translateY: -edge * 0.09 }],
                  }
                : GhostPiece
                  ? { opacity: 0.3 }
                  : undefined
          }
        >
          <Piece size={Math.round(edge * 0.92)} />
        </View>
      ) : null}
      {GhostPiece ? (
        <View style={{ position: 'absolute', opacity: 0.74 }}>
          <GhostPiece size={Math.round(edge * 0.92)} />
        </View>
      ) : null}
      {warmFrame ? (
        <TwoToneFrame
          edge={edge}
          width={ring(edge) * 2}
          color={palette.selectedWarm}
          inner={palette.cursorInner}
        />
      ) : null}
      {view.cursor || (view.selected && sharesCursorFrame) ? (
        <Cursor {...props} selected={view.selected} />
      ) : null}
    </View>
  );
};
