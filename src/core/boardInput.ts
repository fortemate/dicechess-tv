// Remote input for the board: where the cursor goes and what the player meant.
//
// The board emits intent, not moves. This reducer takes the focus state and a
// key and returns the new focus plus, when the player has committed to
// something, an action for the controller to validate and apply. It decides no
// legality of its own: the legal actions are an input, exactly as the engine
// reported them.
//
// The key names are Vega's own remote vocabulary, so the native layer passes
// them through unchanged.

import { shiftSquare } from './model.ts';
import type { Square } from './board.ts';

export type BoardKey = 'up' | 'down' | 'left' | 'right' | 'select' | 'back';

export type BoardFocus = {
  cursor: Square;
  selected: Square | null;
};

export type BoardAction =
  // Nothing for the controller to do; the focus may still have changed.
  | { type: 'none' }
  // A single legal action the player chose.
  | { type: 'move'; move: string }
  // The destination is legal by more than one promotion suffix, so the player
  // still has to choose. The board does not pick for them.
  | { type: 'promote'; moves: string[] }
  // Back with nothing selected: the caller decides what leaving means.
  | { type: 'exit' };

export type BoardInputResult = {
  focus: BoardFocus;
  action: BoardAction;
};

const ARROW = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
} as const;

// Legal actions that start on a square, so a square is known to be selectable.
export function movesFrom(legal: readonly string[], square: string): string[] {
  return legal.filter((move) => move.slice(0, 2) === square);
}

export function boardInput(
  focus: BoardFocus,
  key: BoardKey,
  legal: readonly string[],
): BoardInputResult {
  if (key === 'back') {
    // Back never leaves the player stuck: it drops the selection if there is
    // one, and otherwise hands the decision up.
    return focus.selected
      ? { focus: { ...focus, selected: null }, action: { type: 'none' } }
      : { focus, action: { type: 'exit' } };
  }

  if (key !== 'select') {
    const cursor = shiftSquare(focus.cursor, ARROW[key]) as Square;
    return { focus: { ...focus, cursor }, action: { type: 'none' } };
  }

  const matches = focus.selected
    ? legal.filter(
        (move) =>
          move.slice(0, 2) === focus.selected &&
          move.slice(2, 4) === focus.cursor,
      )
    : [];
  if (matches.length > 1) {
    return { focus, action: { type: 'promote', moves: matches } };
  }
  if (matches.length === 1) {
    return { focus, action: { type: 'move', move: matches[0] } };
  }
  // Not a destination. If the cursor holds a piece that can act, select it —
  // that also lets the player switch pieces without pressing Back first.
  if (movesFrom(legal, focus.cursor).length) {
    return {
      focus: { ...focus, selected: focus.cursor },
      action: { type: 'none' },
    };
  }
  return { focus, action: { type: 'none' } };
}
