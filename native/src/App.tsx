// The native app: the board, plus the saving the board deliberately knows
// nothing about.
//
// The saved game is read synchronously, during the first render, so the board
// never shows a fresh position that is about to be replaced by a restored one
// and there is no loading frame. That is the whole reason to use a synchronous
// store: an asynchronous one would force a first render with nothing in it.
import React from 'react';
import { decodeGame, type Game } from '../../src/core/game';
import { GameScreen } from './GameScreen';
import { MmkvSnapshotStore } from './mmkvStore';

const KEY = 'dicechess-tv.game.v2';

type Opened = { game: Game | null; damaged: string | null };

export const App = () => {
  const store = React.useMemo(
    () => new MmkvSnapshotStore<Game>({ key: KEY, decode: decodeGame }),
    [],
  );
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

  const onCommit = React.useCallback(
    (game: Game) => {
      void store.save(game).catch(() => undefined);
    },
    [store],
  );

  return <GameScreen initial={opened.game} onCommit={onCommit} />;
};
