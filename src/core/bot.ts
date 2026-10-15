// The local opponent.
//
// The move choice is the engine's own algorithm for the opponent the game's mode
// names (#115), not a reimplementation: asking the engine for a complete legal
// path is the only way to be sure the path obeys maximal dice use and promotion
// restrictions.
//
// It imports the full engine entry point, as the game controller does for the
// legal turn tree (src/core/game.ts), so every build bundles that entry.
import { DiceChess } from '@fortemate/dicechess-engine';
import {
  botToMove,
  isBotMode,
  viewGame,
  type BotMode,
  type Game,
} from './game.ts';

// The engine bot each mode plays. A mode is what a game saves and the cards
// name; it is Rolly's `random` that plays the engine's `random-king-capture`:
// random, except that it never declines a king it can take with its first
// action. The algorithm lives in the engine, not here.
export function engineBot(mode: BotMode): string {
  return mode === 'random' ? 'random-king-capture' : mode;
}

// The shape applyMove-side validation expects: enough context to reject a reply
// that belongs to a game or a position that has since moved on.
export type BotReply = {
  gameId: string;
  revision: number;
  dfen: string;
  moves: string[];
};

// True while the local opponent, not a player, owes the next action. Whose turn
// it is comes from the turn's start, so asking replays nothing (#367).
export function botToAct(game: Game): boolean {
  return game.phase !== 'ended' && botToMove(game);
}

// Whether a reply, possibly worked out earlier, belongs to this very game and
// position. applyBotReply rejects one that does not; this lets a caller discard
// it and ask again instead.
export function replyFits(game: Game, reply: BotReply): boolean {
  return (
    reply.gameId === game.id &&
    reply.revision === game.revision &&
    reply.dfen === viewGame(game).dfen
  );
}

export function botReply(game: Game): BotReply {
  if (!isBotMode(game.mode)) throw new Error('No opponent in a hotseat game');
  const state = viewGame(game);
  const result = DiceChess.getBestMove(state.dfen, {
    algorithm: engineBot(game.mode),
  });
  return {
    gameId: game.id,
    revision: game.revision,
    dfen: state.dfen,
    moves: result.moves.map(
      (move) => move.from + move.to + (move.promotion ?? '').toLowerCase(),
    ),
  };
}
