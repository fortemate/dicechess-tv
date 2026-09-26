// The full entry, not /rules: only it has the legal turn tree, and every build
// bundles it anyway for the bot (src/core/bot.ts).
import { DiceChess, type MoveTree } from '@fortemate/dicechess-engine';
import { hasExactKeys } from './keys.ts';

export const INITIAL_POSITION =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export type Side = 'w' | 'b';
// The colour option a person picks against the bot: a side, or Random, which
// draws one.
export type ColourChoice = 'random' | Side;
// The local opponents, each named after the engine algorithm it plays (#115).
// A game saved before there was more than one is a game against `random`.
export const BOT_MODES = ['random', 'greedy', 'aggressive'] as const;
export type BotMode = (typeof BOT_MODES)[number];
export type Mode = 'hotseat' | BotMode;
export const isBotMode = (mode: string): mode is BotMode =>
  (BOT_MODES as readonly string[]).includes(mode);
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
  schema: 4;
  id: string;
  mode: Mode;
  // The side a person plays against the bot. Null in hotseat, where both sides
  // are people.
  human: Side | null;
  // The colour option behind that side, which a rematch keeps: Random draws a
  // side again. Null in hotseat.
  colour: ColourChoice | null;
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
  'colour',
  'revision',
  'turn',
  'start',
  'roll',
  'moves',
  'phase',
  'result',
  'lastMove',
];
// Saves written before the colour option was kept, which recorded only the
// side; and before that, saves from when the person always played White.
const SCHEMA_3_FIELDS = FIELDS.filter((field) => field !== 'colour');
const SCHEMA_2_FIELDS = SCHEMA_3_FIELDS.filter((field) => field !== 'human');
export const opposite = (side: Side): Side => (side === 'w' ? 'b' : 'w');
export const sideName = (side: Side) => (side === 'w' ? 'White' : 'Black');

// The dice as the DFEN at the start of a turn writes them: upper case, in the
// order they were rolled.
const diceField = (roll: readonly number[]): string =>
  roll
    .map((die) => {
      const piece = DiceChess.getPieceFromDice(die);
      if (!piece) throw new Error('Invalid die');
      return piece.toUpperCase();
    })
    .join('');

// The DFEN after one action, with the dice it leaves. Since engine 0.13.0,
// applyMove keeps the unspent dice and castling spends the king's and a rook's
// (fortemate/dicechess-engine#279). It is not a legality check, so every action
// reaching it has been checked against the turn tree first.
function afterAction(dfen: string, move: string): string {
  const next = DiceChess.applyMove(
    dfen,
    move.slice(0, 2),
    move.slice(2, 4),
    move.slice(4) || undefined,
  );
  if (!next) throw new Error('Engine rejected action');
  return next;
}

// Every legal turn of a roll, as the engine's prefix tree of actions: a node's
// keys are the actions that may come next, and a node with none ends the turn.
// Following the tree closes the gap that a legal list asked for after each
// action leaves open: an action legal on its own that no full turn continues
// (#101). Built once per roll and kept for that roll only, because the largest
// trees run to a quarter of a megabyte and every view of the game walks them.
let turn: { dfen: string; tree: MoveTree } | null = null;
function turnTree(dfen: string): MoveTree {
  if (turn?.dfen !== dfen)
    turn = { dfen, tree: DiceChess.getLegalTurnTree(dfen) };
  return turn.tree;
}

// The dice left, in upper case and in the order they were rolled. The engine
// decides which dice are left, and writes them sorted and in the mover's case;
// the roll decides the order they are listed in, the order the screen shows.
function inRollOrder(roll: readonly number[], left: string): string {
  const pool = [...left.toUpperCase()];
  let listed = '';
  for (const letter of diceField(roll)) {
    const at = pool.indexOf(letter);
    if (at === -1) continue;
    listed += letter;
    pool.splice(at, 1);
  }
  return listed;
}

export function viewGame(game: Game) {
  let dfen = game.start;
  let node: MoveTree | null = null;
  if (game.roll.length) {
    dfen += ' ' + diceField(game.roll);
    node = turnTree(dfen);
  }
  // The actions played so far must be a path through the tree.
  for (const move of game.moves) {
    if (!node || !Object.hasOwn(node, move))
      throw new Error('Illegal action: ' + move);
    node = node[move];
    dfen = afterAction(dfen, move);
  }
  const parts = dfen.split(' ');
  const side = parts[1] as Side;
  return {
    dfen,
    side,
    // What may come next in this turn: nothing before the roll or once the turn
    // is complete, a king taken included, which always ends a turn.
    legal: node ? Object.keys(node) : [],
    remaining: game.roll.length ? inRollOrder(game.roll, parts[6] ?? '') : '',
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
// A turn in play: actions left to choose from, or none and the turn to hand
// over.
const livePhase = (legal: readonly string[]): Phase =>
  legal.length ? 'move' : 'handoff';

// A roll that left nothing to play: the turn passes without a single action
// (#85). A turn that ends with dice left over after an action is not one; that
// happens in about a third of all turns and passes without a notice.
export const emptyRoll = (game: Game): boolean =>
  game.phase === 'handoff' && game.roll.length > 0 && game.moves.length === 0;

function normalize(game: Game): Game {
  const state = viewGame(game);
  const result = automaticResult(game, state.dfen, state.legal.length === 0);
  return {
    ...game,
    result,
    phase: result ? 'ended' : livePhase(state.legal),
  };
}
export function newGame(
  mode: Mode,
  id: string,
  start = INITIAL_POSITION,
  human: Side | null = mode === 'hotseat' ? null : 'w',
  colour: ColourChoice | null = human,
): Game {
  return decodeGame(
    JSON.stringify({
      schema: 4,
      id,
      mode,
      human,
      colour,
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

const isSave = (
  value: unknown,
  schema: number,
  fields: readonly string[],
): value is object =>
  !!value &&
  typeof value === 'object' &&
  (value as { schema?: unknown }).schema === schema &&
  hasExactKeys(value, fields);

// Older saves are brought up to schema 4 one step at a time. A schema-2 save
// gains the person's side, which was White whenever there was a bot; a schema-3
// save gains its colour option, taken to be the side it recorded. Anything else
// passes through for the checks.
function upgrade(value: unknown): unknown {
  let save = value;
  if (isSave(save, 2, SCHEMA_2_FIELDS)) {
    const legacy = save as Omit<Game, 'schema' | 'human' | 'colour'>;
    save = {
      ...legacy,
      schema: 3,
      human: legacy.mode === 'hotseat' ? null : 'w',
    };
  }
  if (isSave(save, 3, SCHEMA_3_FIELDS)) {
    const legacy = save as Omit<Game, 'schema' | 'colour'>;
    save = { ...legacy, schema: 4, colour: legacy.human };
  }
  return save;
}

// Hotseat has no person set against a bot. A game against the bot has one, on
// either side, and a colour option that is Random or that side.
const sidesMatchMode = (game: Game): boolean =>
  game.mode === 'hotseat'
    ? game.human === null && game.colour === null
    : (game.human === 'w' || game.human === 'b') &&
      (game.colour === 'random' || game.colour === game.human);

// Whether a decoded save is missing a field or has one of the wrong shape,
// judged before anything is computed from it.
function isDamaged(game: Game): boolean {
  return (
    !game ||
    typeof game !== 'object' ||
    !hasExactKeys(game, FIELDS) ||
    game.schema !== 4 ||
    typeof game.id !== 'string' ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(game.id) ||
    !(game.mode === 'hotseat' || isBotMode(game.mode)) ||
    !sidesMatchMode(game) ||
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
  );
}

// A saved result must be the one the position explains: a resignation by the
// person, a draw agreed in hotseat, or exactly the automatic result. A game the
// position has ended must carry that result.
function checkResult(game: Game, side: Side, automatic: Result | null): void {
  const { result } = game;
  if (result === null) {
    if (game.phase === 'ended' || automatic) throw new Error('Missing result');
    return;
  }
  if (
    typeof result !== 'object' ||
    !hasExactKeys(result, ['winner', 'reason']) ||
    game.phase !== 'ended'
  )
    throw new Error('Invalid result');
  if (result.reason === 'resigned') {
    if (automatic || result.winner !== opposite(game.human ?? side))
      throw new Error('Invalid resignation');
  } else if (result.reason === 'agreed-draw') {
    if (automatic || game.mode !== 'hotseat' || result.winner !== null)
      throw new Error('Invalid draw agreement');
  } else if (
    result.winner !== automatic?.winner ||
    result.reason !== automatic?.reason
  ) {
    throw new Error('Invalid automatic result');
  }
}

// Before the roll nothing has been played; after it, the phase must be the one
// the remaining legal actions give.
function checkPhase(game: Game, legal: readonly string[]): void {
  if (game.roll.length === 0) {
    if (game.moves.length || !['roll', 'ended'].includes(game.phase))
      throw new Error('Invalid pre-roll state');
  } else if (!game.result && game.phase !== livePhase(legal)) {
    throw new Error('Phase does not match remaining legal actions');
  }
}

export function decodeGame(raw: string): Game {
  const game = upgrade(JSON.parse(raw)) as Game;
  if (isDamaged(game)) throw new Error('Unsupported or damaged game save');
  const state = viewGame(game);
  const automatic = game.roll.length
    ? automaticResult(game, state.dfen, state.legal.length === 0)
    : null;
  checkResult(game, state.side, automatic);
  checkPhase(game, state.legal);
  return game;
}
