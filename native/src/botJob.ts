// A bounded request/response protocol. The native client owns its mailbox in
// default MMKV; the background runtime receives and returns plain JSON strings.
import { botReply, botToAct, type BotReply } from '../../src/core/bot';
import { decodeGame } from '../../src/core/game';

export const BOT_REQUEST = 'dicechess-tv.bot.request.v1';
export const BOT_RESPONSE = 'dicechess-tv.bot.response.v1';

export type BotJobResult = {
  requestId: string;
  reply?: BotReply;
  error?: string;
};

// Only this function, called in the worker runtime, performs the engine search.
// It deliberately uses the same algorithm and work budget as the UI did.
export function runBotJob(raw: string): BotJobResult {
  const request: unknown = JSON.parse(raw);
  if (
    !request ||
    typeof request !== 'object' ||
    !('requestId' in request) ||
    typeof request.requestId !== 'string' ||
    !request.requestId ||
    !('game' in request)
  )
    throw new Error('Invalid opponent request');
  const { requestId } = request;
  try {
    const game = decodeGame(JSON.stringify(request.game));
    if (!botToAct(game) || game.phase !== 'move')
      throw new Error('The opponent does not owe a move');
    return { requestId, reply: botReply(game) };
  } catch (error) {
    return {
      requestId,
      error: (error instanceof Error ? error.message : String(error)).slice(
        0,
        500,
      ),
    };
  }
}

export function readBotResult(raw: string, requestId: string): BotJobResult {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || !('requestId' in value))
    throw new Error('Invalid opponent response');
  if (value.requestId !== requestId)
    throw new Error('The opponent response belongs to another request');
  if ('error' in value && typeof value.error === 'string')
    throw new Error(value.error || 'Opponent search failed');
  if (!('reply' in value) || !value.reply || typeof value.reply !== 'object')
    throw new Error('Missing opponent reply');
  const reply = value.reply;
  if (
    !('gameId' in reply) ||
    typeof reply.gameId !== 'string' ||
    !('revision' in reply) ||
    !Number.isSafeInteger(reply.revision) ||
    !('dfen' in reply) ||
    typeof reply.dfen !== 'string' ||
    !('moves' in reply) ||
    !Array.isArray(reply.moves) ||
    reply.moves.length > 3 ||
    !reply.moves.every(
      (move: unknown) =>
        typeof move === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move),
    )
  )
    throw new Error('Invalid opponent reply');
  return value as BotJobResult;
}
