// Package the same pure job as Vega. No server or runtime download is involved.
import { build } from 'esbuild';
import { transformAsync } from '@babel/core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(`${root}assets`, { recursive: true });
const result = await build({
  entryPoints: [
    fileURLToPath(new URL('../../native/src/botJob.ts', import.meta.url)),
  ],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'DiceChessWorkletEngine',
  footer: { js: 'globalThis.DiceChessWorkletEngine = DiceChessWorkletEngine;' },
  platform: 'neutral',
  target: 'es2022',
  minify: true,
  legalComments: 'inline',
});
// Android Hermes's eval parser does not accept the engine's class syntax.
// Use RN's lowering pass for the asset too; Metro cannot transform a raw asset.
const lowered = await transformAsync(result.outputFiles[0].text, {
  filename: 'bot-engine.js',
  babelrc: false,
  configFile: false,
  presets: [['@react-native/babel-preset', { enableBabelRuntime: false }]],
  compact: true,
  comments: true,
});
if (!lowered?.code) throw new Error('Engine syntax lowering produced no code');
await writeFile(`${root}assets/bot.engine`, lowered.code);
// Original generated tone: isolate player completion/seek/lifecycle from asset licensing.
const rate = 24000;
const frames = rate;
const wav = Buffer.alloc(44 + frames * 2);
wav.write('RIFF');
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(frames * 2, 40);
for (let i = 0; i < frames; i++) {
  const fade = Math.min(1, i / 480, (frames - 1 - i) / 480);
  wav.writeInt16LE(
    Math.round(4000 * fade * Math.sin((2 * Math.PI * 440 * i) / rate)),
    44 + i * 2,
  );
}
await writeFile(`${root}assets/tone.wav`, wav);

// Reuse one already-vendored tutorial line, preserving its pinned bytes and license.
const pack = 'elevenlabs-dicechess-tutorial-thinkle';
const voiceFile = 'thinkle_tutor_capture_done_1.mp3';
const catalog = JSON.parse(
  await readFile(
    new URL('../../native/voices/voices.json', import.meta.url),
    'utf8',
  ),
);
for (const file of [voiceFile, 'LICENSE.txt']) {
  const bytes = await readFile(
    new URL(`../../native/voices/${pack}/${file}`, import.meta.url),
  );
  if (
    createHash('sha256').update(bytes).digest('hex') !==
    catalog.packs[pack].files[file]
  ) {
    throw new Error(`Pinned tutorial asset changed: ${file}`);
  }
  await writeFile(
    `${root}assets/${file === voiceFile ? 'voice.mp3' : 'voice-LICENSE.txt'}`,
    bytes,
  );
}

console.log(
  'Packaged canonical engine, original tone, pinned tutorial voice and license.',
);
