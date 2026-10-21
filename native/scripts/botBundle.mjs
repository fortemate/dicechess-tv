// Bundle only the app's pure request handler and the canonical engine. The
// background Hermes runtime gets this code from the signed package, without
// importing React Native or copying a live engine across JavaScript runtimes.
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const native = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ENGINE_MAP = 'build/bot-engine.js.map';
export async function botBundle() {
  const result = await build({
    absWorkingDir: native,
    entryPoints: ['src/botJob.ts'],
    outfile: 'build/bot-engine.js',
    write: false,
    bundle: true,
    format: 'iife',
    globalName: 'DiceChessWorkletEngine',
    footer: {
      js: 'globalThis.DiceChessWorkletEngine = DiceChessWorkletEngine;',
    },
    platform: 'neutral',
    target: 'es2022',
    minify: true,
    sourcemap: 'external',
  });
  return {
    code: result.outputFiles.find((file) => file.path.endsWith('.js')).text,
    map: result.outputFiles.find((file) => file.path.endsWith('.js.map')).text,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { code, map } = await botBundle();
  mkdirSync(join(native, 'assets/raw'), { recursive: true });
  mkdirSync(join(native, 'build'), { recursive: true });
  writeFileSync(join(native, 'assets/raw/bot-engine.js'), code);
  writeFileSync(join(native, ENGINE_MAP), map);
  console.log(
    `bot engine: ${Buffer.byteLength(code)} bytes, canonical request handler`,
  );
}
