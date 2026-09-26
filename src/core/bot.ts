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
import { isBotMode, viewGame, type Game } from './game.ts';

// The shape applyMove-side validation expects: enough context to reject a reply
// that belongs to a game or a position that has since moved on.
export type BotReply = {
  gameId: string;
  revision: number;
  dfen: string;
  moves: string[];
};

// True while the local opponent, not a player, owes the next action.
export function botToAct(game: Game): boolean {
  return game.phase !== 'ended' && viewGame(game).bot;
}

export function botReply(game: Game): BotReply {
  if (!isBotMode(game.mode)) throw new Error('No opponent in a hotseat game');
  const state = viewGame(game);
  const result = DiceChess.getBestMove(state.dfen, { algorithm: game.mode });
  return {
    gameId: game.id,
    revision: game.revision,
    dfen: state.dfen,
    moves: result.moves.map(
      (move) => move.from + move.to + (move.promotion ?? '').toLowerCase(),
    ),
  };
}
