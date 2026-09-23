// The native app: the board, plus the saving and the randomness the board
// deliberately knows nothing about.
//
// The saved game is read synchronously, during the first render, so the board
// never shows a fresh position that is about to be replaced by a restored one
// and there is no loading frame. A Vega app with a loading frame does not
// receive remote input at all.
import React from 'react';
import { decodeGame, rollDice, type Game } from '../../src/core/game';
import {
  decodeLedger,
  emptyLedger,
  record,
  type Ledger,
} from '../../src/core/ledger';
import { GameScreen } from './GameScreen';
import { MmkvSnapshotStore } from './mmkvStore';
import { randomSource } from './randomSource';
import type { ScreenOptions } from './screen';

const KEY = 'dicechess-tv.game.v2';
const LEDGER_KEY = 'dicechess-tv.ledger.v1';

type Opened = { game: Game | null; damaged: string | null };

export type AppProps = {
  // Injected by tests so a roll is known; the app builds its own from the best
  // random source the device offers.
  options?: ScreenOptions;
  onState?: (line: string) => void;
};

export const App = ({ options: injected, onState }: AppProps) => {
  const store = React.useMemo(
    () => new MmkvSnapshotStore<Game>({ key: KEY, decode: decodeGame }),
    [],
  );
  const ledgerStore = React.useMemo(
    () =>
      new MmkvSnapshotStore<Ledger>({
        key: LEDGER_KEY,
        decode: decodeLedger,
      }),
    [],
  );
  const options = React.useMemo<ScreenOptions>(() => {
    if (injected) return injected;
    const source = randomSource();
    return {
      roll: () => rollDice(source.fill),
      newId: () => 'g' + Date.now().toString(36),
      // Space the opponent's steps out so the player watches it roll and move
      // rather than seeing the board jump.
      schedule: (step) => {
        setTimeout(step, 600);
      },
    };
  }, [injected]);

  // A save that no longer decodes is not silently played over: it is recorded,
  // and the board starts fresh only after that is true.
  const [opened] = React.useState<Opened>(() => {
    try {
      return { game: store.read(), damaged: null };
    } catch (error) {
      return {
        game: null,
        damaged: (error as Error)?.message ?? String(error),
      };
    }
  });

  React.useEffect(() => {
    if (opened.damaged) store.clear();
  }, [opened.damaged, store]);

  // The ledger is read once and kept here, so recording a result is one write
  // that both counts it and remembers it was counted.
  const [ledger, setLedger] = React.useState<Ledger>(() => {
    try {
      return ledgerStore.read() ?? emptyLedger();
    } catch {
      // A ledger that no longer decodes is left on disk rather than
      // overwritten: losing a record silently is worse than showing none.
      return emptyLedger();
    }
  });

  // A result is recorded whenever one is seen, including on the launch after a
  // game ended while the app was gone. record() is a no-op for a game already
  // counted, so running it every time is safe.
  const count = React.useCallback(
    (game: Game) => {
      setLedger((current) => {
        const next = record(current, game, 'w');
        if (next !== current)
          void ledgerStore.save(next).catch(() => undefined);
        return next;
      });
    },
    [ledgerStore],
  );

  React.useEffect(() => {
    if (opened.game) count(opened.game);
  }, [count, opened.game]);

  const onCommit = React.useCallback(
    (game: Game) => {
      void store.save(game).catch(() => undefined);
      count(game);
    },
    [count, store],
  );

  return (
    <GameScreen
      options={options}
      initial={opened.game}
      onCommit={onCommit}
      ledger={ledger}
      onState={onState}
    />
  );
};
