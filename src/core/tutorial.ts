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

import { emptyRoll, newGame, nextTurn, rollGame, type Game } from './game.ts';

export type TutorialGoal =
  // Play any legal action.
  | { kind: 'anyMove' }
  // Play out the whole turn, until no action remains.
  | { kind: 'turn' }
  // Land on a square, which in these positions means taking what stands there.
  | { kind: 'capture'; square: string }
  // End the game by taking the king.
  | { kind: 'kingCapture' }
  // Press OK on a roll no die can use, so the turn passes, as in a game.
  | { kind: 'pass' };

// What Thinkle the wizard, who teaches the tutorial (#264), says at each point
// of a step. Each entry is a list of short lines, shown together in his bubble
// and spoken one after another. Every line keeps to the voice packs' rules
// (fortemate/dicechess-assets, docs/CHARACTERS.md): plain ASCII and at most 56
// characters, so each can be recorded as a clip of its own. A point with no
// lines of its own keeps the lines before it.
export type TutorialSpeech = {
  // When the step opens, before its roll.
  opening: readonly string[];
  // After the roll.
  rolled?: readonly string[];
  // After an action, while the step is not yet done.
  moved?: readonly string[];
  // Once the step is done.
  done?: readonly string[];
};

export type TutorialStep = {
  id: string;
  title: string;
  // What to do next, in the imperative and in plain words. It stays on screen
  // under Thinkle's bubble, so a player who did not catch his words, or plays
  // with Voices off, still knows.
  task: string;
  speech: TutorialSpeech;
  start: string;
  roll: number[];
  goal: TutorialGoal;
};

const INITIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Every step opens before its roll and OK makes it, as every turn of a game
// starts with a roll (#264). Until then this is the task.
export const ROLL_TASK = 'Press OK to roll the dice.';

// The lessons, each reviewed in turn with the owner (#264).
export const TUTORIAL: readonly TutorialStep[] = [
  {
    id: 'move',
    title: 'Roll and move',
    task: 'Use the arrows to choose a piece, press OK, then press OK on a dot.',
    speech: {
      opening: [
        'Welcome, my friend!',
        'I am Thinkle, and I shall teach you Dice Chess.',
        'Every turn begins with a roll of the dice.',
      ],
      rolled: [
        'Three pawns! So your pawns may move, and they glow.',
        'Pick one, and the dots show where it may go.',
      ],
      // True after the first action and after the second alike.
      moved: ['Well done! Each die is one move. Use them all.'],
      done: ['There! Three dice, three moves: your first turn.'],
    },
    start: INITIAL,
    // Three pawns: every pawn may move, the same one may move again, and all
    // three dice can always be spent, so the turn always plays out.
    roll: [1, 1, 1],
    goal: { kind: 'turn' },
  },
  {
    id: 'dice',
    title: 'Dice choose the pieces',
    task: 'Play a knight. Nothing else can move on this roll.',
    speech: {
      opening: [
        'Now, a little secret of the dice.',
        'Each die shows a piece, and only that piece may move.',
        'Roll, and let us see what they choose.',
      ],
      rolled: [
        'Hmm... a queen, a bishop and a knight.',
        'The queen and bishop are boxed in. Their dice go grey.',
        'But a knight can leap over pieces!',
      ],
      done: ['Well leapt! The grey dice go unused, and the turn ends.'],
    },
    start: INITIAL,
    // Queen, bishop and knight: only the knights have anywhere to go, and no
    // knight move frees the bishop or the queen, so both dice dim at the roll,
    // as the task says, and any knight move ends the turn, as Thinkle does. A
    // rook die would stay lit, since a1b1 can follow b1a3.
    roll: [5, 3, 2],
    goal: { kind: 'turn' },
  },
  {
    id: 'clear',
    title: 'Clear the way',
    task: 'Move a glowing pawn, then play the bishop and the queen.',
    speech: {
      opening: [
        'Sometimes a piece is stuck behind its own pawns.',
        'Then move a pawn first, and set it free!',
        'Roll the dice, my friend.',
      ],
      rolled: [
        'A pawn, a bishop and a queen.',
        'The bishop and queen are stuck, yet their dice are lit.',
        'Only pawns that open the way glow. Move one first!',
      ],
      // True after the pawn and after the bishop or queen alike.
      moved: ['The way is open! Use the dice that are left.'],
      done: ['All three used! Use every die you can: that is the rule.'],
    },
    start: INITIAL,
    // Pawn, bishop and queen. At the roll only pawns can move, yet the bishop
    // and queen dice stay lit, since a pawn move can free them. Only the b, d
    // and e pawns are offered: any other pawn move would leave a die unused,
    // and the engine refuses an order that wastes a die. So every way to play
    // the turn spends all three.
    roll: [1, 3, 5],
    goal: { kind: 'turn' },
  },
  {
    id: 'pass',
    title: 'When nothing can move',
    task: 'No die can be used, so the turn passes. Press OK.',
    speech: {
      opening: [
        'Now and then, the dice play a little trick.',
        'Roll, and you will see what I mean.',
      ],
      rolled: [
        'Hmm... a queen, a rook and a king.',
        'All three are boxed in, so every die goes grey.',
        'When no die can be used, your turn simply passes.',
      ],
      done: ['No harm done! At the start of a game, it happens often.'],
    },
    start: INITIAL,
    // Queen, rook and king: at the start only pawns and knights can move, so
    // no die can be used. From the starting position that is (4/6)^3 of all
    // rolls, about 30%, which is what "it happens often" rests on.
    roll: [5, 4, 6],
    goal: { kind: 'pass' },
  },
  {
    id: 'capture',
    title: 'Taking a piece',
    // The pawn by its colour, not its square: the board draws no coordinates
    // (#233), and it is the only black pawn there is.
    task: 'Take the black pawn with your rook.',
    speech: {
      opening: [
        'Now for the fun part: taking pieces!',
        'Land on an enemy piece, and it leaves the board.',
        'Roll, my friend.',
      ],
      rolled: [
        'A rook, a queen and a bishop.',
        'You have no queen or bishop here, so those dice go grey.',
        'The rook will do nicely. See that black pawn?',
      ],
      done: ['Splendid! The dice chose the rook; you chose the target.'],
    },
    start: '4k3/8/8/3p4/8/8/8/3RK3 w - - 0 1',
    // Rook, queen and bishop. White has no queen or bishop, so their dice are
    // grey at the roll and the rook has one move. Taking the pawn ends the turn
    // with no die left lit, and the black king is out of the rook's reach in
    // one move, so the lesson cannot be won by taking him instead. A rook move
    // elsewhere misses, and OK tries again.
    roll: [4, 5, 3],
    goal: { kind: 'capture', square: 'd5' },
  },
  {
    id: 'king',
    title: 'Taking the king ends it',
    task: 'Take the black king with your rook.',
    // There is no check in Dice Chess, and the voice packs' rules keep the
    // words out of his lines, so he says what it means for the player.
    speech: {
      opening: [
        'Now, the most important rule of all.',
        'Whoever takes the other king wins, there and then.',
        'Roll the dice!',
      ],
      rolled: [
        'A rook, and nothing between it and the king.',
        'Go on, take him!',
      ],
      done: [
        'Victory! Taking the king wins at once.',
        'Nothing warns you when a king is attacked. Guard yours!',
      ],
    },
    start: 'k7/8/8/8/8/8/8/R3K3 w - - 0 1',
    // Rook, queen and bishop, as in the capture lesson: one rook move, which
    // takes the king up the open file or misses, and OK tries again.
    roll: [4, 5, 3],
    goal: { kind: 'kingCapture' },
  },
];

// What Thinkle says after the last lesson. Castling, promotion and en passant
// are left to the rules guide, but not described as chess: each needs a die.
export const CLOSING_SPEECH: readonly string[] = [
  'Castling, promotion and en passant use dice too.',
  'Rules, on the home screen, has every detail.',
  'May the stars and the dice be kind to you!',
];

// The board after the last lesson: the starting position, as a game opens.
export const closingGame = (): Game =>
  newGame('hotseat', 'tutorial-closing', INITIAL);

// The game a step opens on: a fixed position, before its roll.
export const stepGame = (step: TutorialStep): Game =>
  newGame('hotseat', 'tutorial-' + step.id, step.start);

// The step's roll, made, which is what OK does when the step opens: always its
// own fixed dice, so the lesson is the same every time.
export const rollStep = (step: TutorialStep, game: Game): Game =>
  rollGame(game, step.roll);

// What Thinkle says when a step's turn ends without its goal, before OK tries
// it again. One line for every lesson, so it is one clip.
export const MISSED_SPEECH: readonly string[] = [
  'Not quite, my friend. Let us try that again.',
];

// The step's turn is over and its goal was missed: the dice are spent, or the
// game is over, so the lesson can only be tried again. Without this a player
// who moved elsewhere was left on a board that took no keys (#264).
export const isMissed = (step: TutorialStep, game: Game): boolean =>
  !isComplete(step, game) && game.moves.length > 0 && game.phase !== 'move';

// What OK does on a roll no die can use: the turn passes, as in a game.
export const passStep = (game: Game): Game =>
  emptyRoll(game) ? nextTurn(game) : game;

// The task on screen: the roll, until it is made.
export const taskAt = (step: TutorialStep, game: Game): string =>
  game.phase === 'roll' ? ROLL_TASK : step.task;

// What Thinkle says at this point of the step.
export function speechAt(
  step: TutorialStep,
  game: Game,
  complete: boolean,
): readonly string[] {
  return spoken(step, game, complete).lines;
}

// The points of a step in order. A point with no lines of its own keeps the
// lines of the last one before it that has some.
const MOMENTS = ['opening', 'rolled', 'moved', 'done'] as const;
type Moment = (typeof MOMENTS)[number];

// The point a step is at: before its roll, rolled, after an action, or done.
const momentAt = (game: Game, complete: boolean): Moment => {
  if (complete) return 'done';
  if (game.moves.length > 0) return 'moved';
  return game.phase === 'roll' ? 'opening' : 'rolled';
};

// What Thinkle says now and the tutorial event it is recorded under in his
// voice pack (fortemate/dicechess-assets, voices/events.json): the step's id and
// the point whose lines are said, as `move_rolled`, or `missed`.
const spoken = (
  step: TutorialStep,
  game: Game,
  complete: boolean,
): { event: TutorEvent; lines: readonly string[] } => {
  if (!complete && isMissed(step, game))
    return { event: 'missed', lines: MISSED_SPEECH };
  const at = momentAt(game, complete);
  const moment =
    MOMENTS.slice(0, MOMENTS.indexOf(at) + 1)
      .reverse()
      .find((point) => step.speech[point]) ?? 'opening';
  return {
    event: `${step.id}_${moment}`,
    lines: step.speech[moment] ?? step.speech.opening,
  };
};

// A tutorial event: a point of a lesson, a miss, or the closing words.
export type TutorEvent = `${string}_${Moment}` | 'missed' | 'closing';

// A line Thinkle says, as his voice pack records it: the clip's id, the event
// it belongs to, and its text. An event's lines are said one after another, in
// order (#264).
export type TutorLine = {
  readonly id: string;
  readonly event: TutorEvent;
  readonly text: string;
};

// The lines' ids in the pack: `thinkle_tutor_<event>_<n>`, n counting from 1.
const TUTOR_PREFIX = 'thinkle_tutor';
const tutorLines = (
  event: TutorEvent,
  lines: readonly string[],
): readonly TutorLine[] =>
  lines.map((text, i) => ({
    id: `${TUTOR_PREFIX}_${event}_${i + 1}`,
    event,
    text,
  }));

// What Thinkle says at this point of a step, line by line, with each line's
// clip.
export const tutorLinesAt = (
  step: TutorialStep,
  game: Game,
  complete: boolean,
): readonly TutorLine[] => {
  const { event, lines } = spoken(step, game, complete);
  return tutorLines(event, lines);
};

// What he says after the last lesson.
export const CLOSING_LINES: readonly TutorLine[] = tutorLines(
  'closing',
  CLOSING_SPEECH,
);

// Every line he may say, once each: what his voice pack must hold.
export const TUTOR_CATALOGUE: readonly TutorLine[] = [
  ...TUTORIAL.flatMap((step) =>
    MOMENTS.flatMap((moment) =>
      tutorLines(`${step.id}_${moment}`, step.speech[moment] ?? []),
    ),
  ),
  ...tutorLines('missed', MISSED_SPEECH),
  ...CLOSING_LINES,
];

export function isComplete(step: TutorialStep, game: Game): boolean {
  switch (step.goal.kind) {
    case 'anyMove':
      return game.moves.length > 0;
    // Played out, not merely not yet begun: before its roll a step is in the
    // roll phase too.
    case 'turn':
      return game.moves.length > 0 && game.phase !== 'move';
    case 'capture':
      return game.lastMove?.slice(2, 4) === step.goal.square;
    case 'kingCapture':
      return game.result?.reason === 'king-captured';
    // Passed: the turn has moved on from the one the step opened on.
    case 'pass':
      return game.turn > 1;
  }
}
