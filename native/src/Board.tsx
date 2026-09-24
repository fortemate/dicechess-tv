// The board renderer. It draws what boardView() describes and nothing else:
// it does not know the rules, does not decide legality and emits no moves.
// A controller supplies the position, cursor, selection, legal actions and last
// move, and reads move intent from the input layer instead of from here.
import React from 'react';
import { View } from 'react-native';
import {
  boardView,
  type BoardInput,
  type SquareView,
} from '../../src/core/boardView';
import { PIECES } from './pieces';
import { THEME } from './theme';

export type BoardProps = BoardInput & {
  // Edge length of the whole board in pixels. The caller decides it from the
  // space available, so the board stays responsive on any panel.
  size: number;
};

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

const Square = ({ view, edge }: { view: SquareView; edge: number }) => {
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

export const Board = ({ size, ...input }: BoardProps) => {
  const edge = Math.floor(size / 8);
  const rows = boardView(input);
  return (
    <View style={{ width: edge * 8, height: edge * 8 }}>
      {rows.map((row) => (
        <View key={row[0].square} style={{ flexDirection: 'row' }}>
          {row.map((view) => (
            <Square key={view.square} view={view} edge={edge} />
          ))}
        </View>
      ))}
    </View>
  );
};
