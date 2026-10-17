// One square of the board and the marks on it: the last move, the pieces that
// can move, the picked-up piece, the legal destinations and the cursor. It
// draws what a SquareView says and nothing else.
import React from 'react';
import { View } from 'react-native';
import type { SquareView } from '../../src/core/boardView';
import { squareLabel } from '../../src/core/announcements';
import { DEFAULT_HIGHLIGHTS, type HighlightStyle } from './highlightsSetting';
import { PIECES } from './pieces';
import { THEME } from './theme';

type Style = Record<string, unknown>;
type PieceComponent = React.ComponentType<{ size: number }>;

// Ring thickness and piece inset scale with the board so the board stays
// legible whether it is sized for a 1080p panel or a smaller window.
const ring = (size: number) => Math.max(2, Math.round(size / 240));

const cover = (edge: number, style: Style) => (
  <View style={{ position: 'absolute', width: edge, height: edge, ...style }} />
);

// Four corner triangles, the shape of the #105 mock-ups: a transparent box
// whose two adjacent borders meet on the diagonal.
const Corners = ({ edge, color }: { edge: number; color: string }) => {
  const leg = Math.max(6, Math.round(edge * 0.24));
  const corners: { id: string; style: Style }[] = [
    {
      id: 'top-left',
      style: {
        top: 0,
        left: 0,
        borderTopWidth: leg,
        borderTopColor: color,
        borderRightWidth: leg,
        borderRightColor: 'transparent',
      },
    },
    {
      id: 'top-right',
      style: {
        top: 0,
        right: 0,
        borderTopWidth: leg,
        borderTopColor: color,
        borderLeftWidth: leg,
        borderLeftColor: 'transparent',
      },
    },
    {
      id: 'bottom-left',
      style: {
        bottom: 0,
        left: 0,
        borderBottomWidth: leg,
        borderBottomColor: color,
        borderRightWidth: leg,
        borderRightColor: 'transparent',
      },
    },
    {
      id: 'bottom-right',
      style: {
        bottom: 0,
        right: 0,
        borderBottomWidth: leg,
        borderBottomColor: color,
        borderLeftWidth: leg,
        borderLeftColor: 'transparent',
      },
    },
  ];
  return (
    <>
      {corners.map(({ id, style }) => (
        <View
          key={id}
          style={{ position: 'absolute', width: 0, height: 0, ...style }}
        />
      ))}
    </>
  );
};

// A frame inset from the square's edge, inside both bands of the cursor's
// two-tone frame so the cursor does not cover it.
const Inset = ({ edge, color }: { edge: number; color: string }) => {
  const width = ring(edge * 8);
  const gap = width * 2 + Math.max(2, Math.round(width * 2 * 0.45));
  const side = edge - gap * 2;
  return (
    <View
      style={{
        position: 'absolute',
        left: gap,
        top: gap,
        width: side,
        height: side,
        borderWidth: width,
        borderColor: color,
      }}
    />
  );
};

// A bottom pedestal bar inside the square: a non-perimeter shape that never
// collides with the cursor frame.
const Pedestal = ({
  edge,
  color,
  borderColor,
}: {
  edge: number;
  color: string;
  borderColor?: string;
}) => {
  const height = Math.max(5, Math.round(edge * 0.12));
  const inset = Math.max(4, Math.round(edge * 0.1));
  return (
    <View
      style={{
        position: 'absolute',
        left: inset,
        right: inset,
        bottom: Math.max(3, Math.round(edge * 0.05)),
        height,
        borderRadius: Math.round(height / 2),
        backgroundColor: color,
        ...(borderColor
          ? {
              borderWidth: Math.max(1, Math.round(edge * 0.02)),
              borderColor,
            }
          : {}),
      }}
    />
  );
};

// A soft oval shadow under a lifted piece so it reads as hovering above the
// board.
const Shadow = ({ edge, color }: { edge: number; color: string }) => {
  const width = Math.round(edge * 0.56);
  const height = Math.max(6, Math.round(edge * 0.15));
  return (
    <View
      style={{
        position: 'absolute',
        left: Math.round((edge - width) / 2),
        bottom: Math.max(5, Math.round(edge * 0.09)),
        width,
        height,
        borderRadius: Math.round(height / 2),
        backgroundColor: color,
      }}
    />
  );
};

const TwoToneFrame = ({
  edge,
  width,
  color,
  inner,
}: {
  edge: number;
  width: number;
  color: string;
  inner: string;
}) => {
  const innerWidth = Math.max(2, Math.round(width * 0.45));
  return (
    <>
      {cover(edge, { borderWidth: width, borderColor: color })}
      <View
        style={{
          position: 'absolute',
          left: width,
          top: width,
          width: edge - width * 2,
          height: edge - width * 2,
          borderWidth: innerWidth,
          borderColor: inner,
        }}
      />
    </>
  );
};

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

const RingedDestination = ({
  edge,
  occupied,
  line,
  rim,
}: {
  edge: number;
  occupied: boolean;
  line: string;
  rim: string;
}) => {
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
                borderColor: line,
              }
            : {
                backgroundColor: line,
                borderWidth: Math.max(2, Math.round(edge * 0.035)),
                borderColor: rim,
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
            borderColor: rim,
          }}
        />
      ) : null}
    </>
  );
};

type StyledTokens = {
  cursorColor: string;
  cursorInner: string;
  shadowColor: string;
  lastMoveOutline: string | null;
  destinationLine: string | null;
  usesGhost: boolean;
  cursorWash: boolean;
  selectedPedestal: boolean;
};

const STYLED_TOKENS: Record<
  Exclude<HighlightStyle, 'standard'>,
  StyledTokens
> = {
  enhanced: {
    cursorColor: THEME.cursor,
    cursorInner: '#0b1a24',
    shadowColor: 'rgba(11, 26, 36, 0.58)',
    lastMoveOutline: null,
    destinationLine: null,
    usesGhost: false,
    cursorWash: false,
    selectedPedestal: false,
  },
  'colour-blind': {
    cursorColor: '#f0e442',
    cursorInner: '#000000',
    shadowColor: 'rgba(0, 0, 0, 0.62)',
    lastMoveOutline: '#56b4e9',
    destinationLine: '#d55e00',
    usesGhost: true,
    cursorWash: false,
    selectedPedestal: true,
  },
  'high-contrast': {
    cursorColor: '#ffffff',
    cursorInner: '#000000',
    shadowColor: 'rgba(0, 0, 0, 0.68)',
    lastMoveOutline: '#ffffff',
    destinationLine: '#000000',
    usesGhost: true,
    cursorWash: true,
    selectedPedestal: false,
  },
};

const renderLastMove = (
  view: SquareView,
  edge: number,
  tokens: StyledTokens,
) => {
  if (!view.lastMove) return null;
  if (!tokens.lastMoveOutline) {
    return cover(edge, { backgroundColor: THEME.lastMove });
  }
  return <Inset edge={edge} color={tokens.lastMoveOutline} />;
};

const renderMovable = (
  view: SquareView,
  edge: number,
  highlights: Exclude<HighlightStyle, 'standard'>,
) => {
  if (!view.movable) return null;
  if (highlights === 'enhanced') {
    return cover(edge, { backgroundColor: THEME.movable });
  }
  if (highlights === 'colour-blind') {
    return (
      <>
        {cover(edge, { backgroundColor: 'rgba(0, 114, 178, 0.5)' })}
        <Corners edge={edge} color="#0072b2" />
      </>
    );
  }
  if (view.cursor) return null;
  return <Corners edge={edge} color="#000000" />;
};

const renderSelected = (
  view: SquareView,
  edge: number,
  tokens: StyledTokens,
) => {
  if (!view.selected) return null;
  return (
    <>
      {tokens.selectedPedestal
        ? cover(edge, { backgroundColor: 'rgba(204, 121, 167, 0.38)' })
        : null}
      <Shadow edge={edge} color={tokens.shadowColor} />
      {tokens.selectedPedestal ? (
        <Pedestal edge={edge} color="#cc79a7" borderColor="#000000" />
      ) : null}
    </>
  );
};

const renderDestination = (
  view: SquareView,
  edge: number,
  tokens: StyledTokens,
  hasGhost: boolean,
) => {
  if (!view.destination) return null;
  if (hasGhost && !view.piece) return null;
  const occupied = view.piece !== null;
  if (!tokens.destinationLine) {
    return <Destination edge={edge} occupied={occupied} />;
  }
  return (
    <RingedDestination
      edge={edge}
      occupied={occupied}
      line={tokens.destinationLine}
      rim="#ffffff"
    />
  );
};

const renderPiece = (
  Piece: PieceComponent | null,
  view: SquareView,
  edge: number,
  hasGhost: boolean,
) => {
  if (!Piece) return null;
  const size = Math.round(edge * 0.92);
  if (view.selected) {
    return (
      <View
        style={{
          transform: [{ scale: 1.18 }, { translateY: -edge * 0.09 }],
        }}
      >
        <Piece size={size} />
      </View>
    );
  }
  if (hasGhost) {
    return (
      <View style={{ opacity: 0.3 }}>
        <Piece size={size} />
      </View>
    );
  }
  return <Piece size={size} />;
};

const StandardSquare = ({
  view,
  edge,
  width,
  Piece,
}: {
  view: SquareView;
  edge: number;
  width: number;
  Piece: PieceComponent | null;
}) => {
  const focus = view.cursor || view.selected;
  return (
    <View
      // Named for a screen reader, which the board's missing coordinates leave
      // to guess otherwise (#257); the cursor's square is also said aloud.
      aria-label={squareLabel(view)}
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

export type SquareProps = {
  view: SquareView;
  edge: number;
  highlights?: HighlightStyle;
  // The picked-up piece letter when this square is the destination under the
  // cursor, for styles that show a ghost preview (#404).
  carried?: string | null;
};

// boardView() builds a new SquareView for every square on every render, so the
// comparison is by value, over every field there is: a mark added to SquareView
// later is compared without being listed here. A cursor move then redraws the
// two squares it changes, not all 64 (#312).
const sameSquare = (prev: SquareProps, next: SquareProps): boolean => {
  if (
    prev.edge !== next.edge ||
    prev.highlights !== next.highlights ||
    prev.carried !== next.carried
  )
    return false;
  const keys = Object.keys(next.view) as (keyof SquareView)[];
  return (
    keys.length === Object.keys(prev.view).length &&
    keys.every((key) => prev.view[key] === next.view[key])
  );
};

export const Square = React.memo(function Square({
  view,
  edge,
  highlights = DEFAULT_HIGHLIGHTS,
  carried = null,
}: SquareProps) {
  const Piece = view.piece ? PIECES[view.piece as keyof typeof PIECES] : null;
  const width = ring(edge * 8);

  if (highlights === 'standard') {
    return (
      <StandardSquare view={view} edge={edge} width={width} Piece={Piece} />
    );
  }

  const tokens = STYLED_TOKENS[highlights];
  const GhostPiece =
    tokens.usesGhost && view.cursor && view.destination && carried
      ? PIECES[carried as keyof typeof PIECES]
      : null;
  const hasGhost = GhostPiece !== null;

  return (
    <View
      aria-label={squareLabel(view)}
      style={{
        width: edge,
        height: edge,
        backgroundColor: view.dark ? THEME.dark : THEME.light,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {renderLastMove(view, edge, tokens)}
      {renderMovable(view, edge, highlights)}
      {tokens.cursorWash && view.cursor
        ? cover(edge, { backgroundColor: 'rgba(255, 255, 255, 0.48)' })
        : null}
      {renderSelected(view, edge, tokens)}
      {renderDestination(view, edge, tokens, hasGhost)}
      {renderPiece(Piece, view, edge, hasGhost)}
      {GhostPiece ? (
        <View style={{ position: 'absolute', opacity: 0.74 }}>
          <GhostPiece size={Math.round(edge * 0.92)} />
        </View>
      ) : null}
      {view.cursor ? (
        <TwoToneFrame
          edge={edge}
          width={width * 2}
          color={tokens.cursorColor}
          inner={tokens.cursorInner}
        />
      ) : null}
    </View>
  );
}, sameSquare);
