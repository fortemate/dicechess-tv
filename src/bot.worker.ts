import { DiceChess } from '@fortemate/dicechess-engine';
type Request = { id: number; gameId: string; revision: number; dfen: string };
self.onmessage = (event: MessageEvent<Request>) => {
  const { id, gameId, revision, dfen } = event.data;
  try {
    const result = DiceChess.getBestMove(dfen, { algorithm: 'random' });
    const moves = result.moves.map(
      (move) => move.from + move.to + (move.promotion ?? '').toLowerCase(),
    );
    self.postMessage({ id, gameId, revision, dfen, moves });
  } catch (error) {
    self.postMessage({
      id,
      gameId,
      revision,
      dfen,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
