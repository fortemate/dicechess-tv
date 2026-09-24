import { DiceChess } from '@fortemate/dicechess-engine/rules';
import { applyLegal } from './model.ts';
import { pieceAt } from './board.ts';
import { hasExactKeys } from './keys.ts';

export const INITIAL_POSITION =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export type Side = 'w' | 'b';
export type Mode = 'hotseat' | 'random';
export type Phase = 'roll' | 'move' | 'handoff' | 'ended';
export type Result = {
  winner: Side | null;
  reason:
    | 'king-captured'
    | 'resigned'
    | 'agreed-draw'
    | '100-halfmoves'
    | 'turn-limit';
};
export type Game = {
  schema: 3;
  id: string;
  mode: Mode;
  // The side a person plays against the bot. Null in hotseat, where both sides
  // are people.
  human: Side | null;
  revision: number;
  turn: number;
  start: string;
  roll: number[];
  moves: string[];
  phase: Phase;
  result: Result | null;
  lastMove: string | null;
};
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const FIELDS = [
  'schema',
  'id',
  'mode',
  'human',
  'revision',
  'turn',
  'start',
  'roll',
  'moves',
  'phase',
  'result',
  'lastMove',
];
// Saves written before a person could choose a colour, when the person always
// played White against the bot.
const SCHEMA_2_FIELDS = FIELDS.filter((field) => field !== 'human');
export const opposite = (side: Side): Side => (side === 'w' ? 'b' : 'w');
export const sideName = (side: Side) => (side === 'w' ? 'White' : 'Black');

export function viewGame(game: Game) {
  let dfen = game.start;
  if (game.roll.length) {
    dfen +=
      ' ' +
      game.roll
        .map((die) => {
          const piece = DiceChess.getPieceFromDice(die);
          if (!piece) throw new Error('Invalid die');
          return piece.toUpperCase();
        })
        .join('');
  }
  for (const move of game.moves) {
    const board = dfen.split(' ')[0];
    if (!board.includes('K') || !board.includes('k'))
      throw new Error('Move after king capture');
    // Engine 0.12.2 applyMove returns board fields but clears the dice field.
    // Reattach the surviving dice, as the play client does. Legality, including
    // maximal use and promotion restrictions, is checked by applyLegal first.
    const piece = pieceAt(board, move.slice(0, 2));
    if (!piece) throw new Error('Missing moving piece');
    const letter = piece.toUpperCase();
    let remaining = (dfen.split(' ')[6] ?? '').toUpperCase();
    const consume = (die: string) => {
      if (!remaining.includes(die)) throw new Error('Missing required die');
      remaining = remaining.replace(die, '');
    };
    const next = applyLegal(dfen, move);
    consume(letter);
    if (
      letter === 'K' &&
      Math.abs(move.charCodeAt(0) - move.charCodeAt(2)) === 2
    )
      consume('R');
    dfen =
      next.split(' ').slice(0, 6).join(' ') +
      (remaining ? ' ' + remaining : '');
  }
  const parts = dfen.split(' ');
  const side = parts[1] as Side;
  const legal =
    game.roll.length && parts[0].includes('K') && parts[0].includes('k')
      ? DiceChess.getLegalUciMoves(dfen)
      : [];
  return {
    dfen,
    side,
    legal,
    remaining: parts[6] ?? '',
    // Whether the side to move belongs to the bot.
    bot: game.human !== null && side !== game.human,
  };
}

function automaticResult(
  game: Game,
  dfen: string,
  complete: boolean,
): Result | null {
  const parts = dfen.split(' ');
  if (!parts[0].includes('k')) return { winner: 'w', reason: 'king-captured' };
  if (!parts[0].includes('K')) return { winner: 'b', reason: 'king-captured' };
  if (complete && Number(parts[4]) >= 100)
    return { winner: null, reason: '100-halfmoves' };
  if (complete && game.turn >= 5000)
    return { winner: null, reason: 'turn-limit' };
  return null;
}
function normalize(game: Game): Game {
  const state = viewGame(game);
  const result = automaticResult(game, state.dfen, state.legal.length === 0);
  return {
    ...game,
    result,
    phase: result ? 'ended' : state.legal.length ? 'move' : 'handoff',
  };
}
export function newGame(
  mode: Mode,
  id: string,
  start = INITIAL_POSITION,
  human: Side | null = mode === 'hotseat' ? null : 'w',
): Game {
  return decodeGame(
    JSON.stringify({
      schema: 3,
      id,
      mode,
      human,
      revision: 0,
      turn: 1,
      start,
      roll: [],
      moves: [],
      phase: 'roll',
      result: null,
      lastMove: null,
    }),
  );
}
export function rollGame(game: Game, roll: number[]): Game {
  if (
    game.phase !== 'roll' ||
    roll.length !== 3 ||
    roll.some((n) => !Number.isInteger(n) || n < 1 || n > 6)
  ) {
    throw new Error('Roll is not allowed');
  }
  return normalize({
    ...game,
    revision: game.revision + 1,
    roll: [...roll],
    moves: [],
  });
}
export function moveGame(game: Game, move: string): Game {
  if (game.phase !== 'move' || !viewGame(game).legal.includes(move))
    throw new Error('Illegal move');
  return normalize({
    ...game,
    revision: game.revision + 1,
    moves: [...game.moves, move],
    lastMove: move,
  });
}
export function applyBotReply(
  game: Game,
  reply: { gameId: string; revision: number; dfen: string; moves: string[] },
): Game {
  const state = viewGame(game);
  if (
    !state.bot ||
    game.phase !== 'move' ||
    reply.gameId !== game.id ||
    reply.revision !== game.revision ||
    reply.dfen !== state.dfen
  ) {
    throw new Error('Stale bot reply');
  }
  if (!Array.isArray(reply.moves) || reply.moves.length > 3)
    throw new Error('Invalid bot path');
  let next = game;
  for (const move of reply.moves) next = moveGame(next, move);
  if (next.phase === 'move') throw new Error('Incomplete bot turn');
  return next;
}
export function nextTurn(game: Game): Game {
  if (game.phase !== 'handoff') throw new Error('Mandatory actions remain');
  const start = DiceChess.endTurn(viewGame(game).dfen);
  if (!start) throw new Error('Engine rejected end of turn');
  return {
    ...game,
    revision: game.revision + 1,
    turn: game.turn + 1,
    start,
    roll: [],
    moves: [],
    phase: 'roll',
    result: null,
  };
}
export function resignGame(game: Game): Game {
  if (game.phase === 'ended') throw new Error('Game already ended');
  // Against the bot only the person resigns; in hotseat, the side to move.
  const loser = game.human ?? viewGame(game).side;
  return {
    ...game,
    revision: game.revision + 1,
    phase: 'ended',
    result: { winner: opposite(loser), reason: 'resigned' },
  };
}
export function agreeDraw(game: Game): Game {
  if (game.phase === 'ended' || game.mode !== 'hotseat')
    throw new Error('Draw agreement unavailable');
  return {
    ...game,
    revision: game.revision + 1,
    phase: 'ended',
    result: { winner: null, reason: 'agreed-draw' },
  };
}
// The caller supplies the random source. Core stays free of platform globals:
// crypto.getRandomValues is not guaranteed outside a browser runtime.
// Rejection sampling avoids the modulo bias of an arbitrary byte % 6.
export function rollDice(
  fill: (bytes: Uint8Array<ArrayBuffer>) => void,
): number[] {
  const dice: number[] = [];
  const bytes = new Uint8Array(8);
  for (let attempt = 0; dice.length < 3 && attempt < 100; attempt++) {
    fill(bytes);
    for (const byte of bytes)
      if (byte < 252 && dice.length < 3) dice.push((byte % 6) + 1);
  }
  if (dice.length !== 3) throw new Error('Random source failed');
  return dice;
}

// The colour a person gets on choosing Random. One byte decides, and 256 is
// even, so both sides are equally likely.
export function randomSide(
  fill: (bytes: Uint8Array<ArrayBuffer>) => void,
): Side {
  const bytes = new Uint8Array(1);
  fill(bytes);
  return bytes[0] % 2 === 0 ? 'w' : 'b';
}

// A schema-2 save becomes schema 3 by adding the person's side, which was
// White whenever there was a bot. Anything else passes through for the checks.
function upgrade(value: unknown): unknown {
  if (
    !value ||
    typeof value !== 'object' ||
    (value as { schema?: unknown }).schema !== 2 ||
    !hasExactKeys(value, SCHEMA_2_FIELDS)
  )
    return value;
  const legacy = value as Omit<Game, 'schema' | 'human'>;
  return {
    ...legacy,
    schema: 3,
    human: legacy.mode === 'hotseat' ? null : 'w',
  };
}

export function decodeGame(raw: string): Game {
  const game = upgrade(JSON.parse(raw)) as Game;
  if (
    !game ||
    typeof game !== 'object' ||
    !hasExactKeys(game, FIELDS) ||
    game.schema !== 3 ||
    typeof game.id !== 'string' ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(game.id) ||
    !['hotseat', 'random'].includes(game.mode) ||
    (game.mode === 'hotseat'
      ? game.human !== null
      : game.human !== 'w' && game.human !== 'b') ||
    !Number.isSafeInteger(game.revision) ||
    game.revision < 0 ||
    !Number.isInteger(game.turn) ||
    game.turn < 1 ||
    game.turn > 5000 ||
    typeof game.start !== 'string' ||
    game.start.split(' ').length !== 6 ||
    !DiceChess.canonicalKey(game.start) ||
    game.start.split(' ')[0].match(/K/g)?.length !== 1 ||
    game.start.split(' ')[0].match(/k/g)?.length !== 1 ||
    !Array.isArray(game.roll) ||
    ![0, 3].includes(game.roll.length) ||
    game.roll.some((n) => !Number.isInteger(n) || n < 1 || n > 6) ||
    !Array.isArray(game.moves) ||
    game.moves.length > 3 ||
    game.moves.some((m) => typeof m !== 'string' || !UCI.test(m)) ||
    !['roll', 'move', 'handoff', 'ended'].includes(game.phase) ||
    !(
      game.lastMove === null ||
      (typeof game.lastMove === 'string' && UCI.test(game.lastMove))
    )
  ) {
    throw new Error('Unsupported or damaged game save');
  }
  const state = viewGame(game);
  const automatic = game.roll.length
    ? automaticResult(game, state.dfen, state.legal.length === 0)
    : null;
  if (game.result !== null) {
    if (
      typeof game.result !== 'object' ||
      !hasExactKeys(game.result, ['winner', 'reason']) ||
      game.phase !== 'ended'
    )
      throw new Error('Invalid result');
    if (game.result.reason === 'resigned') {
      const loser = game.human ?? state.side;
      if (automatic || game.result.winner !== opposite(loser))
        throw new Error('Invalid resignation');
    } else if (game.result.reason === 'agreed-draw') {
      if (automatic || game.mode !== 'hotseat' || game.result.winner !== null)
        throw new Error('Invalid draw agreement');
    } else if (
      !automatic ||
      game.result.winner !== automatic.winner ||
      game.result.reason !== automatic.reason
    ) {
      throw new Error('Invalid automatic result');
    }
  } else if (game.phase === 'ended' || automatic)
    throw new Error('Missing result');
  if (game.roll.length === 0) {
    if (game.moves.length || !['roll', 'ended'].includes(game.phase))
      throw new Error('Invalid pre-roll state');
  } else if (
    !game.result &&
    game.phase !== (state.legal.length ? 'move' : 'handoff')
  ) {
    throw new Error('Phase does not match remaining legal actions');
  }
  return game;
}
