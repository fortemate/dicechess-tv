// The completed-game ledger.
//
// The hard requirement is counting each result exactly once across reloads: a
// game that ends while the app is killed must still be counted when it comes
// back, and must not be counted twice if it was already recorded. The marker
// for that lives inside the ledger rather than beside it, so one write both
// records a result and remembers that it was recorded. Two writes could be
// interrupted between them; one cannot.
//
// A game that never ends is never counted, so an abandoned or replaced game
// stays out of the record without anything having to notice it was abandoned.
//
// Hotseat is reported by colour, never by player. The seats change hands and
// the ledger has no way to know who sat where.

import type { Game, Side } from './game.ts';
import { hasExactKeys } from './keys.ts';

export type BotRecord = { wins: number; draws: number; losses: number };
export type HotseatRecord = { white: number; draws: number; black: number };

export type Ledger = {
  schema: 1;
  // The last game counted. Recording the same game again is a no-op.
  lastCountedId: string | null;
  hotseat: HotseatRecord;
  // Opponent, then the side the human played, then the record from the human's
  // point of view. Nested because the same opponent plays differently against
  // each colour, and a combined number would hide that.
  bots: Record<string, Partial<Record<Side, BotRecord>>>;
};

export const emptyLedger = (): Ledger => ({
  schema: 1,
  lastCountedId: null,
  hotseat: { white: 0, draws: 0, black: 0 },
  bots: {},
});

const isCount = (value: unknown): boolean =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isBotRecord = (value: unknown): value is BotRecord => {
  const record = value as BotRecord;
  return (
    !!record &&
    typeof record === 'object' &&
    hasExactKeys(record, ['wins', 'draws', 'losses']) &&
    isCount(record.wins) &&
    isCount(record.draws) &&
    isCount(record.losses)
  );
};

// Throws rather than returning a default: a ledger that no longer decodes is a
// number the player may have been shown, and silently resetting it to zero
// would lose a record without saying so.
export function decodeLedger(raw: string): Ledger {
  const value = JSON.parse(raw) as Ledger;
  const shape =
    !!value &&
    typeof value === 'object' &&
    value.schema === 1 &&
    (value.lastCountedId === null || typeof value.lastCountedId === 'string') &&
    !!value.hotseat &&
    hasExactKeys(value.hotseat, ['white', 'draws', 'black']) &&
    [value.hotseat.white, value.hotseat.draws, value.hotseat.black].every(
      isCount,
    ) &&
    !!value.bots &&
    typeof value.bots === 'object' &&
    Object.values(value.bots).every(
      (sides) =>
        !!sides &&
        typeof sides === 'object' &&
        Object.keys(sides).every((side) => side === 'w' || side === 'b') &&
        Object.values(sides).every(isBotRecord),
    );
  if (!shape) throw new Error('Unsupported or damaged ledger');
  return value;
}

const bump = (record: BotRecord | undefined, field: keyof BotRecord) => {
  const base = record ?? { wins: 0, draws: 0, losses: 0 };
  return { ...base, [field]: base[field] + 1 };
};

// Records a finished game. Unfinished games, and games already counted, return
// the ledger unchanged, so a caller may run this after every state change and
// on every launch without keeping track of what it has already done.
export function record(
  ledger: Ledger,
  game: Game,
  // Which side the player held. Hotseat has no single human side and ignores it.
  humanSide: Side = 'w',
): Ledger {
  if (game.phase !== 'ended' || !game.result) return ledger;
  if (ledger.lastCountedId === game.id) return ledger;

  const counted = { ...ledger, lastCountedId: game.id };
  const { winner } = game.result;

  if (game.mode === 'hotseat') {
    const field =
      winner === null ? 'draws' : winner === 'w' ? 'white' : 'black';
    return {
      ...counted,
      hotseat: { ...ledger.hotseat, [field]: ledger.hotseat[field] + 1 },
    };
  }

  const opponent = game.mode;
  const sides = ledger.bots[opponent] ?? {};
  const field =
    winner === null ? 'draws' : winner === humanSide ? 'wins' : 'losses';
  return {
    ...counted,
    bots: {
      ...ledger.bots,
      [opponent]: { ...sides, [humanSide]: bump(sides[humanSide], field) },
    },
  };
}

// The totals a player is shown, in the order they read.
export const summary = (ledger: Ledger) => ({
  hotseat: ledger.hotseat,
  bots: Object.entries(ledger.bots).flatMap(([opponent, sides]) =>
    (['w', 'b'] as const)
      .filter((side) => sides[side])
      .map((side) => ({ opponent, side, record: sides[side]! })),
  ),
});
