// What a screen reader is told as a game goes on (#257).
//
// The app keeps its own focus, in the screen's reducer, and VoiceView, Fire
// TV's screen reader, reads what holds the platform's focus: nothing on these
// screens does. So what a sighted player sees change is said in words instead.
// Given the game before and after one step, gameSpeech() names what to say, as
// cues() names what to play; the native layer decides whether a screen reader
// is listening, and says it.
//
// The words are the ones on screen where there are some (#235), so a player
// who hears the game and one who reads it are told the same thing. The
// helpers that word the result are here for that reason: the screen draws them
// too.
import {
  emptyRoll,
  isBotMode,
  opposite,
  sideName,
  viewGame,
  type Game,
  type Result,
  type Side,
} from './game.ts';
import { opponentOf } from './opponents.ts';
import { fileOf, pieceAt } from './board.ts';
import { diceOf, type Die } from './dice.ts';
import { isCastling, isEnPassant, isPromotion } from './cues.ts';
import type { SquareView } from './boardView.ts';

const NAMES = {
  P: 'pawn',
  N: 'knight',
  B: 'bishop',
  R: 'rook',
  Q: 'queen',
  K: 'king',
} as const;

// A FEN piece letter as a word, whatever its colour: 'n' and 'N' are both a
// knight.
export const pieceName = (letter: string): string =>
  NAMES[letter.toUpperCase() as keyof typeof NAMES] ?? 'piece';

// A piece with its colour, as a square names what stands on it.
const colouredPiece = (letter: string): string =>
  `${letter === letter.toUpperCase() ? 'white' : 'black'} ${pieceName(letter)}`;

// Who the person plays: nobody in hotseat, else the opponent's name.
export const opponentName = (game: Game): string | null =>
  isBotMode(game.mode) ? opponentOf(game.mode).name : null;

// Who plays a side, in the player's words (#235): against the bot the person is
// "You" and the bot goes by its name; in hotseat each side is its colour.
export const playerOf = (game: Game, side: Side): string => {
  if (game.human === null) return sideName(side);
  return side === game.human ? 'You' : (opponentName(game) ?? 'The computer');
};

// A side's king, as a sentence names it: the person's is "your king".
const kingOf = (game: Game, side: Side): string =>
  side === game.human ? 'your king' : `${playerOf(game, side)}'s king`;

// The headline of a finished game: who won, in the player's words (#235). The
// person's win is the one cheer; a loss names the bot that won rather than
// telling the person they lost.
export const outcome = (game: Game, { winner }: Result): string => {
  if (!winner) return 'Draw';
  return winner === game.human ? 'You win!' : `${playerOf(game, winner)} wins`;
};

// Why a game was drawn, in the rules guide's terms but plain words (#235). The
// hundred is the engine's half-move clock, which counts each action that is
// neither a capture nor a pawn move, a die each, and nothing for a turn that
// passes (test/rules.test.ts). So it is a hundred moves in the tutorial's
// sense, where each die is one move, not fifty turns each as in chess.
const DRAWN = {
  'agreed-draw': 'Both players agreed',
  '100-halfmoves': '100 moves, no capture or pawn move',
  'turn-limit': '5,000-turn limit reached',
} as const;

// How a game ended, the line under who won (#235). A king taken and a
// resignation always have a winner.
export const reasonOf = (game: Game, { winner, reason }: Result): string => {
  if (reason === 'king-captured')
    return `${playerOf(game, winner!)} took ${kingOf(game, opposite(winner!))}`;
  if (reason === 'resigned')
    return `${playerOf(game, opposite(winner!))} resigned`;
  return DRAWN[reason];
};

// A turn with no action left is over, though it is still the mover's until OK
// hands it on (#232): the headline says so, not that the side is to play.
// Against the bot the person's own is "your turn", in the player's words, as
// the result is (#235).
export const turnOver = (
  game: Game,
  view: { side: Side; bot: boolean },
): string =>
  game.human !== null && !view.bot
    ? 'Your turn is over'
    : `${sideName(view.side)}'s turn is over`;

// Under the dice after a roll with nothing to play, in the rules guide's words.
export const NO_MOVE_LINE = 'No die can be used — the turn passes';

// A square as a screen reader names it: where it is, what stands on it, and the
// mark a sighted player sees there while choosing. The board draws no
// coordinates, so the square's name is the one thing only a listener gets.
export const squareLabel = (
  view: Pick<
    SquareView,
    'square' | 'piece' | 'selected' | 'destination' | 'movable'
  >,
): string => {
  const parts: string[] = [
    view.square,
    view.piece ? colouredPiece(view.piece) : 'empty',
  ];
  if (view.selected) parts.push('picked up');
  else if (view.destination)
    parts.push(view.piece ? 'can take' : 'can go here');
  else if (view.movable) parts.push('can move');
  return parts.join(', ');
};

// A die as a screen reader names it: the piece it lets move, and whether it is
// spent or cannot be (#85, #140), which the screen shows by dimming it.
export const dieLabel = (die: Die): string => {
  const state = die.spent ? ', used' : die.leftover ? ", can't be used" : '';
  return `${pieceName(die.piece)} die${state}`;
};

// "queen", "queen and rook", "queen, rook and knight".
const listed = (words: readonly string[]): string =>
  words.length < 2
    ? words.join('')
    : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;

// Lines said one after another, each closed as a sentence.
export const sentences = (lines: readonly string[]): string =>
  lines.map((line) => (/[.!?…]$/.test(line) ? line : `${line}.`)).join(' ');

// Whose turn it now is, in the player's words.
const turnOf = (game: Game, side: Side): string =>
  side === game.human ? 'Your turn' : `${playerOf(game, side)}'s turn`;

// The dice just thrown, and the ones no turn can spend.
function rolled(game: Game): string[] {
  const view = viewGame(game);
  const dice = diceOf(game.roll, view.remaining, view.playable);
  const lines = [
    `${playerOf(game, view.side)} rolled ${listed(dice.map((die) => pieceName(die.piece)))}`,
  ];
  if (emptyRoll(game)) lines.push(NO_MOVE_LINE);
  else if (game.phase !== 'ended') {
    const lost = dice.filter((die) => die.leftover);
    if (lost.length)
      lines.push(
        `The ${listed(lost.map((die) => pieceName(die.piece)))} can't be used`,
      );
  }
  return lines;
}

// One action, from the position it was played in.
function moved(before: Game, move: string): string {
  const view = viewGame(before);
  const board = view.dfen.split(' ')[0];
  const who = playerOf(before, view.side);
  const from = move.slice(0, 2);
  const to = move.slice(2, 4);
  if (isCastling(board, move))
    return `${who} castled on the ${fileOf(to) > fileOf(from) ? "king's" : "queen's"} side`;
  const piece = pieceName(pieceAt(board, from) ?? '');
  // The engine never offers a move onto a friendly piece, so anything on the
  // target square is an enemy one; en passant takes the pawn beside it.
  const taken = pieceAt(board, to) ?? (isEnPassant(board, move) ? 'p' : null);
  const took = taken ? ` and took the ${pieceName(taken)}` : '';
  const became = isPromotion(move)
    ? `. The pawn became a ${pieceName(move[4])}`
    : '';
  return `${who} moved the ${piece} from ${from} to ${to}${took}${became}`;
}

// What one step of the game says: a turn handed on, the dice thrown, an action
// played, a turn over and the result, in that order. The steps are the ones
// cues() hears, so what is heard and what is said agree.
export function gameSpeech(before: Game, after: Game): string[] {
  // A different game, a new one or one restored at launch, is not a step.
  if (before.id !== after.id || before === after) return [];
  const lines: string[] = [];
  const view = viewGame(after);
  const handed = after.turn === before.turn + 1;
  if (handed) lines.push(turnOf(after, view.side));
  if (handed || after.turn === before.turn) {
    if ((handed || before.roll.length === 0) && after.roll.length > 0)
      lines.push(...rolled(after));
    const played = after.moves.at(-1);
    if (after.moves.length === before.moves.length + 1 && played)
      lines.push(moved(before, played));
  }
  // The bot hands its own turn on a moment later, so its turn over goes
  // unsaid: the next line is the person's turn.
  if (
    after.phase === 'handoff' &&
    before.phase !== 'handoff' &&
    !emptyRoll(after) &&
    !view.bot
  )
    lines.push(turnOver(after, view));
  if (after.phase === 'ended' && before.phase !== 'ended' && after.result)
    lines.push(outcome(after, after.result), reasonOf(after, after.result));
  return lines;
}
