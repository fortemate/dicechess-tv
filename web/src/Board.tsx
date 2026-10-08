// The native board, with the earlier arrow available only on the design bench.
import React from 'react';
import { View } from 'react-native';
import { Board as TvBoard, type BoardProps } from '../../native/src/Board';
import { fileOf, rankOf } from '../../src/core/board';
import { boardView } from '../../src/core/boardView';
import { hides } from './arrow';
import { MoveArrow } from './MoveArrow';
import { useMarks } from './useMarks';

export const Board = (props: BoardProps) => {
  const marks = useMarks();
  const edge = Math.floor(props.size / 8);
  const centre = (square: string) => ({
    x: ((props.flipped ? 7 - fileOf(square) : fileOf(square)) + 0.5) * edge,
    y: ((props.flipped ? rankOf(square) : 7 - rankOf(square)) + 0.5) * edge,
  });
  const arrow =
    marks.arrow === 'on' && props.selected && props.cursor
      ? { from: centre(props.selected), to: centre(props.cursor) }
      : null;
  const dots = arrow
    ? boardView(props)
        .flat()
        .filter(
          (view) =>
            view.destination &&
            !view.cursor &&
            view.piece === null &&
            hides(arrow.from, arrow.to, centre(view.square), edge),
        )
        .map((view) => ({ ...centre(view.square), dark: view.dark }))
    : [];
  return (
    <View style={{ width: edge * 8, height: edge * 8 }}>
      <TvBoard {...props} />
      {arrow ? <MoveArrow {...arrow} edge={edge} dots={dots} /> : null}
    </View>
  );
};
