// The interactive tutorial: fixed positions and fixed rolls.
//
// Every step is data, and every step is checked against the canonical engine by
// its tests: that the position decodes, that the roll permits the action being
// taught, and that the goal is reachable. A lesson the engine disagrees with
// would teach the wrong game.
//
// Castling and promotion are deliberately absent. They are reference material,
// not a first lesson, and a tutorial long enough to cover them is no longer a
// tutorial.
//
// Nothing here touches a saved game or a ledger. The tutorial is played on its
// own state, and the screen that runs it is given no store at all, so "never
// changes W/D/L or the saved real game" is a property of the wiring rather than
// a promise.

import { newGame, rollGame, type Game } from './game.ts';

export type TutorialGoal =
  // Play any legal action.
  | { kind: 'anyMove' }
  // Play out the whole turn, until no action remains.
  | { kind: 'turn' }
  // Land on a square, which in these positions means taking what stands there.
  | { kind: 'capture'; square: string }
  // End the game by taking the king.
  | { kind: 'kingCapture' };

export type TutorialStep = {
  id: string;
  title: string;
  // One line, in the imperative, telling the player what to do next.
  instruction: string;
  // Why it matters, shown under the instruction.
  note: string;
  start: string;
  roll: number[];
  goal: TutorialGoal;
};

export const TUTORIAL: readonly TutorialStep[] = [
  {
    id: 'move',
    title: 'Moving a piece',
    instruction:
      'Move the focus with the arrows, press OK on a piece, then OK on a highlighted square.',
    note: 'Only squares the dice allow are highlighted. Back cancels a selection.',
    start: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    // Three pawns, so every pawn is available and any first move works.
    roll: [1, 1, 1],
    goal: { kind: 'anyMove' },
  },
  {
    id: 'dice',
    title: 'The dice choose the pieces',
    instruction: 'Play a knight. Nothing else can move on this roll.',
    note: 'Each die names a piece. A queen die is useless while the queen is blocked.',
    start: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    // Queen, rook and knight: only the knights have anywhere to go.
    roll: [5, 4, 2],
    goal: { kind: 'anyMove' },
  },
  {
    id: 'turn',
    title: 'Three actions, one turn',
    instruction:
      'Spend all three dice. The turn only ends when nothing is left to play.',
    note: 'You must use as many dice as the position allows; an unusable die is simply lost.',
    start: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    roll: [1, 1, 1],
    goal: { kind: 'turn' },
  },
  {
    id: 'capture',
    title: 'Taking a piece',
    instruction: 'Take the pawn on d5 with your rook.',
    note: 'Captures work as in chess. The dice decide which piece may take, not what it takes.',
    start: '4k3/8/8/3p4/8/8/8/3RK3 w - - 0 1',
    // Three rook dice, so the rook may act and the lesson cannot be blocked.
    roll: [4, 4, 4],
    goal: { kind: 'capture', square: 'd5' },
  },
  {
    id: 'king',
    title: 'Taking the king ends it',
    instruction: 'Take the black king with your rook.',
    note: 'There is no check and no checkmate in Dice Chess. The king is captured like any other piece, and that wins.',
    start: 'k7/8/8/8/8/8/8/R3K3 w - - 0 1',
    roll: [4, 4, 4],
    goal: { kind: 'kingCapture' },
  },
];

// The game a step starts from: a fixed position with its roll already made, so
// the player is never asked to roll during a lesson about something else.
export function stepGame(step: TutorialStep): Game {
  return rollGame(
    newGame('hotseat', 'tutorial-' + step.id, step.start),
    step.roll,
  );
}

export function isComplete(step: TutorialStep, game: Game): boolean {
  switch (step.goal.kind) {
    case 'anyMove':
      return game.moves.length > 0;
    case 'turn':
      return game.phase !== 'move';
    case 'capture':
      return game.lastMove?.slice(2, 4) === step.goal.square;
    case 'kingCapture':
      return game.result?.reason === 'king-captured';
  }
}
