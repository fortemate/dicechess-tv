import { DiceChess } from '@fortemate/dicechess-engine/rules';

// A diagnostic position with one remaining knight die, not a full-game dice roll.
export const INITIAL =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 N';
export const STORAGE_KEY = 'dicechess-tv.probe.v1';
export type Snapshot = { schema: 1; humanMove?: string; botMove?: string };
export type Phase = 'human' | 'bot' | 'done';

export function applyLegal(dfen: string, uci: string): string {
  if (!DiceChess.getLegalUciMoves(dfen).includes(uci))
    throw new Error('Illegal engine action: ' + uci);
  const next = DiceChess.applyMove(
    dfen,
    uci.slice(0, 2),
    uci.slice(2, 4),
    uci.slice(4) || undefined,
  );
  if (!next) throw new Error('Engine rejected action');
  return next;
}
function finish(dfen: string): string {
  if (DiceChess.getLegalUciMoves(dfen).length)
    throw new Error('Turn is not complete');
  const next = DiceChess.endTurn(dfen);
  if (!next) throw new Error('Engine rejected endTurn');
  return next;
}
export function derive(snapshot: Snapshot) {
  let dfen = INITIAL;
  let phase: Phase = 'human';
  if (snapshot.humanMove) {
    dfen =
      finish(applyLegal(dfen, snapshot.humanMove))
        .split(' ')
        .slice(0, 6)
        .join(' ') + ' N';
    phase = 'bot';
  }
  if (snapshot.botMove) {
    if (!snapshot.humanMove) throw new Error('Bot action without human action');
    dfen = finish(applyLegal(dfen, snapshot.botMove));
    phase = 'done';
  }
  return {
    dfen,
    phase,
    legal: phase === 'done' ? [] : DiceChess.getLegalUciMoves(dfen),
  };
}
export function decode(raw: string): Snapshot {
  const value = JSON.parse(raw);
  if (
    !value ||
    typeof value !== 'object' ||
    value.schema !== 1 ||
    Object.keys(value).some(
      (key) => !['schema', 'humanMove', 'botMove'].includes(key),
    ) ||
    ['humanMove', 'botMove'].some(
      (key) =>
        value[key] !== undefined &&
        (typeof value[key] !== 'string' ||
          !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(value[key])),
    )
  ) {
    throw new Error('Unsupported or damaged save');
  }
  derive(value);
  return value;
}
