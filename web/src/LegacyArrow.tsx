// The earlier arrow, retained only for browser design comparisons,
// from #121. The two squares used to carry the same cyan frame, told apart only by
// its width; the arrow says "this piece goes here" in one shape, and it spans
// squares, so it is drawn over the board rather than by a square.
import React from 'react';
import { View } from 'react-native';
import { Path, Svg } from '@amazon-devices/react-native-svg';
import { arrowPath, type Point } from './arrow';
import { DOT } from '../../native/src/Square';
import { THEME } from '../../native/src/theme';

// A destination the arrow passes over, such as e3 under a pawn's arrow to e4.
export type Dot = Point & { dark: boolean };

// The dots the arrow passes over, drawn on top of it so that none of the
// choices is hidden: a disc of the square's own colour, then the dot as a
// square draws it, so it looks like every other dot.
export const Dots = ({
  dots,
  edge,
}: {
  dots: readonly Dot[];
  edge: number;
}) => {
  const size = Math.round(edge * DOT);
  return (
    <>
      {dots.flatMap(({ x, y, dark }) =>
        [dark ? THEME.dark : THEME.light, THEME.destination].map((colour) => (
          <View
            key={`${x},${y},${colour}`}
            style={{
              position: 'absolute',
              left: Math.round(x - size / 2),
              top: Math.round(y - size / 2),
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colour,
            }}
          />
        )),
      )}
    </>
  );
};

// In the cursor's cyan, slightly translucent so the squares show through, and
// outlined in the cursor's dark line so it reads on both square colours.
export const MoveArrow = ({
  from,
  to,
  edge,
  dots,
}: {
  from: Point;
  to: Point;
  edge: number;
  dots: readonly Dot[];
}) => {
  const d = arrowPath(from, to, edge);
  const size = edge * 8;
  return (
    <>
      {d ? (
        <View
          testID="move-arrow"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: size,
            height: size,
          }}
        >
          <Svg width={size} height={size}>
            <Path
              d={d}
              fill={THEME.cursor}
              fillOpacity={0.85}
              stroke={THEME.cursorLine}
              strokeWidth={Math.max(2, Math.round(edge * 0.04))}
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      ) : null}
      <Dots dots={dots} edge={edge} />
    </>
  );
};
