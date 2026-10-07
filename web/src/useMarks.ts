// The marks a board on the bench is drawn with: the bench's own, from its
// address and controls, or the ones a gallery figure gives the boards inside it.
import React from 'react';
import { getBench, subscribeBench, type Marks } from './marks';

// Marks for the boards below it, in place of the bench's own: the gallery
// draws several variants on one page.
export const MarksOverride = React.createContext<Marks | null>(null);

export const useMarks = (): Marks => {
  const override = React.useContext(MarksOverride);
  const marks = React.useSyncExternalStore(
    subscribeBench,
    () => getBench().marks,
  );
  return override ?? marks;
};
