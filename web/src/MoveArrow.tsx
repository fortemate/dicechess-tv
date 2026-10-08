// The arrow from the picked-up piece to the cursor, on the bench.
// The bench wrapper draws it here, so the arrow can be switched off like any other mark; when on, it is
// the earlier renderer.
//
// The squares the arrow passes over leave their dots to it, so with the arrow
// off the dots are still drawn here, as the television's dot whatever the
// destination mark.
import React from 'react';
import { Dots, MoveArrow as TvArrow } from './LegacyArrow';
import { useMarks } from './useMarks';

export const MoveArrow = (props: React.ComponentProps<typeof TvArrow>) =>
  useMarks().arrow === 'on' ? (
    <TvArrow {...props} />
  ) : (
    <Dots dots={props.dots} edge={props.edge} />
  );
