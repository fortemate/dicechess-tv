// Cuts the owner's voice-over lines out of his recordings, as
// scripts/demo-video/voice-over.json lists them, into dist/demo-video/voice/
// (VOICE), where assemble.ts reads them by id.
//
//   node scripts/demo-video/voice-over.mjs
//
// Each line is cut between its `from` and `to` seconds, faded in and out,
// brought to the loudness Thinkle's narration is packed at (-16 LUFS, measured
// over the whole recording so every line keeps its place in the sentence),
// with a light lift at 3 kHz for a lavalier worn on the chest. The recordings
// are the owner's and are not committed.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = 'scripts/demo-video';
const VOICE = process.env.VOICE ?? 'dist/demo-video/voice';
const LOUDNESS = -16;
const SHAPE =
  'highpass=f=80,equalizer=f=3000:t=q:w=0.8:g=3,highshelf=f=7000:g=2,afftdn=nf=-55:nr=4';

const catalogue = JSON.parse(
  readFileSync(join(HERE, 'voice-over.json'), 'utf8'),
);

function loudness(file) {
  const { stderr } = spawnSync(
    'ffmpeg',
    ['-v', 'info', '-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-'],
    { encoding: 'utf8' },
  );
  const found = [...stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1);
  if (!found) throw new Error(`could not measure the loudness of ${file}`);
  return Number(found[1]);
}

const gains = new Map();
for (const [id, line] of Object.entries(catalogue.lines)) {
  const source = join(VOICE, line.source);
  if (!existsSync(source)) throw new Error(`${id}: no recording at ${source}`);
  if (!gains.has(source)) gains.set(source, LOUDNESS - loudness(source));
  const length = line.to - line.from;
  execFileSync(
    'ffmpeg',
    [
      [
        '-v',
        'error',
        '-y',
        '-ss',
        String(line.from),
        '-t',
        String(length),
        '-i',
        source,
      ],
      [
        '-af',
        `aformat=channel_layouts=mono,${SHAPE},volume=${gains.get(source).toFixed(2)}dB,` +
          `afade=t=in:d=0.08,afade=t=out:st=${(length - 0.12).toFixed(3)}:d=0.12`,
      ],
      ['-ar', '48000', '-c:a', 'pcm_s16le', join(VOICE, `${id}.wav`)],
    ].flat(),
  );
  console.log(`${id}: ${length.toFixed(2)} s, ${line.text}`);
}
