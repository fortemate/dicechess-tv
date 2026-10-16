// A documentation example must remain a complete legal turn and demonstrate
// the opponent actually used by the TV app, even after an engine update.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DiceChess, type MoveTree } from '@fortemate/dicechess-engine';
import { engineBot } from '../src/core/bot.ts';
import { newGame, rollGame, viewGame } from '../src/core/game.ts';
import { OPPONENT_EXAMPLES } from '../site/src/opponentExamples.ts';

for (const [name, example] of Object.entries(OPPONENT_EXAMPLES)) {
  test(`${name}'s published example is legal and matches its playing style`, () => {
    const rolled = rollGame(newGame(example.mode, name, example.fen, 'b'), [
      ...example.dice,
    ]);
    const dfen = viewGame(rolled).dfen;
    const tree = DiceChess.getLegalTurnTree(dfen);
    for (const turn of example.turns) {
      let branch: MoveTree = tree;
      for (const move of turn) {
        assert.ok(
          Object.hasOwn(branch, move),
          `${name}: ${move} is legal here`,
        );
        branch = branch[move];
      }
      assert.deepEqual(branch, {}, `${name}: the example finishes the turn`);
    }
    const selected = DiceChess.getBestMove(dfen, {
      algorithm: engineBot(example.mode),
    }).moves.map(
      ({ from, to, promotion }) => from + to + (promotion ?? '').toLowerCase(),
    );
    assert.ok(
      example.turns.some(
        (turn) => JSON.stringify(turn) === JSON.stringify(selected),
      ),
      `${name}: unexpected example turn ${selected.join(', ')}`,
    );
  });
}
