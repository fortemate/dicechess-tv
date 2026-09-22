// The native app: the board, plus the saving the board deliberately knows
// nothing about.
//
// The saved game is read synchronously before the first render, so the board
// never shows a fresh position that is about to be replaced by a restored one.
// MMKV makes that possible; an asynchronous store would need a loading state.
import React from 'react';
import { decodeGame, type Game } from '../../src/core/game';
import { GameScreen } from './GameScreen';
import { MmkvSnapshotStore } from './mmkvStore';

const KEY = 'dicechess-tv.game.v2';

export const App = () => {
  const store = React.useMemo(
    () => new MmkvSnapshotStore<Game>({ key: KEY, decode: decodeGame }),
    [],
  );
  // A save that no longer decodes is not silently discarded in favour of a new
  // game: it is surfaced, and the player starts fresh only once that is shown.
  const [restored, setRestored] = React.useState<Game | null>(null);
  const [damaged, setDamaged] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    try {
      setRestored(store.read());
    } catch (error) {
      setDamaged((error as Error)?.message ?? String(error));
      store.clear();
    }
    setReady(true);
  }, [store]);

  const onCommit = React.useCallback(
    (game: Game) => {
      void store.save(game).catch(() => undefined);
    },
    [store],
  );

  if (!ready) return null;
  return (
    <GameScreen
      key={damaged ?? 'game'}
      initial={restored}
      onCommit={onCommit}
    />
  );
};
