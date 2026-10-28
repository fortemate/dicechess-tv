import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import vm from 'node:vm';
import { applyBotReply, newGame, rollGame } from '../../src/core/game.ts';
import type { BotJobResult } from '../../native/src/botJob.ts';

async function engine() {
  const code = await readFile(
    new URL('../assets/bot.engine', import.meta.url),
    'utf8',
  );
  const context = vm.createContext({});
  vm.runInContext(code, context, { timeout: 10000 });
  return context.DiceChessWorkletEngine as {
    runBotJob(raw: string): BotJobResult;
  };
}

test('packaged engine runs a canonical job in an isolated JS context', async () => {
  const isolated = await engine();
  const game = rollGame(
    newGame('greedy', 'android-asset', undefined, 'b'),
    [1, 1, 1],
  );
  const result = isolated.runBotJob(
    JSON.stringify({ requestId: 'asset-test', game }),
  );
  assert.equal(result.requestId, 'asset-test');
  assert.equal(result.error, undefined);
  assert.ok(result.reply);
  assert.equal(applyBotReply(game, result.reply).phase, 'handoff');
  assert.throws(
    () => applyBotReply({ ...game, id: 'replaced' }, result.reply!),
    /Stale bot reply/,
  );
});

test('packaged engine returns protocol errors without requiring RN or a browser', async () => {
  const isolated = await engine();
  const result = isolated.runBotJob(
    JSON.stringify({
      requestId: 'invalid',
      game: newGame('greedy', 'roll-phase'),
    }),
  );
  assert.equal(result.requestId, 'invalid');
  assert.match(result.error!, /does not owe a move/);
});

test('packaged engine syntax is accepted by the installed Android Hermes compiler', async () => {
  const require = createRequire(import.meta.url);
  const compiler = join(
    dirname(require.resolve('hermes-compiler/package.json')),
    'hermesc',
    process.platform === 'darwin' ? 'osx-bin' : 'linux64-bin',
    'hermesc',
  );
  const directory = await mkdtemp(join(tmpdir(), 'dicechess-android-engine-'));
  try {
    execFileSync(
      compiler,
      [
        '-w',
        '-emit-binary',
        '-out',
        join(directory, 'engine.hbc'),
        fileURLToPath(new URL('../assets/bot.engine', import.meta.url)),
      ],
      { stdio: 'pipe' },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
