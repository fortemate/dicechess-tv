// What a step of the game sounds like.
//
// Given the game before and after one step, this names the cues the step should
// play. It knows nothing about files, players or muting — the native layer maps
// a cue to a sound and decides whether it is heard — so it can be checked
// against the engine like the rules guide is, in test/cues.test.ts.
//
// Every cue has a visual equivalent already on screen, which the roadmap asks
// for alongside a mute: the dice appear, the piece moves, the promotion chooser
// opens, the handoff prompt shows, the result is written out.

import { viewGame, type Game, type Side } from './game.ts';
import { pieceAt } from './board.ts';

export type Cue =
  | 'dice_roll'
  | 'piece_move'
  | 'piece_capture'
  | 'castle'
  | 'promotion'
  | 'turn_handoff'
  | 'game_win'
  | 'game_loss'
  | 'game_draw';

// `humanSide` is the side a person plays against the bot. Today that is always
// White; it is a parameter so that choosing a colour later changes one caller,
// not this function. It means nothing in hotseat, where both sides are people.
export function cues(before: Game, after: Game, humanSide: Side = 'w'): Cue[] {
  // A different game — a new one started, or one restored at launch — is not a
  // step of either, and makes no sound.
  if (before.id !== after.id) return [];

  const heard: Cue[] = [];
  if (after.turn === before.turn + 1) heard.push('turn_handoff');
  else if (after.turn === before.turn) {
    if (before.roll.length === 0 && after.roll.length > 0)
      heard.push('dice_roll');
    if (after.moves.length === before.moves.length + 1)
      heard.push(moveCue(before, after.moves[after.moves.length - 1]));
  }
  // A step can both move and end the game — a king taken, or the move that
  // completes the hundredth quiet half-move — and then both are heard.
  if (after.phase === 'ended' && before.phase !== 'ended' && after.result)
    heard.push(resultCue(after, humanSide));
  return heard;
}

function moveCue(before: Game, move: string): Cue {
  // A promotion that also captures is still, above all, a promotion.
  if (move.length === 5) return 'promotion';
  const board = viewGame(before).dfen.split(' ')[0];
  const from = move.slice(0, 2);
  const to = move.slice(2, 4);
  const piece = pieceAt(board, from)?.toLowerCase();
  // A king only ever moves two files when it castles.
  if (piece === 'k' && Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2)
    return 'castle';
  // The engine never offers a move onto a friendly piece, so anything on the
  // target square is an enemy one.
  if (pieceAt(board, to)) return 'piece_capture';
  // En passant: a pawn changing file onto an empty square takes the pawn beside it.
  if (piece === 'p' && from[0] !== to[0]) return 'piece_capture';
  return 'piece_move';
}

function resultCue(game: Game, humanSide: Side): Cue {
  const winner = game.result?.winner ?? null;
  if (winner === null) return 'game_draw';
  // Two people at one television: whoever won, somebody in the room did, so a
  // decisive hotseat game ends on the winning jingle rather than the losing one.
  if (game.mode === 'hotseat') return 'game_win';
  return winner === humanSide ? 'game_win' : 'game_loss';
}
