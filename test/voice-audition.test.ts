// The voice audition of /voices/ (#172): the clips the site carries are the
// pinned copy scripts/vendor-voices.mjs wrote, they say the game's own lines,
// and the page cannot name the voices.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VOICE_CATALOGUE } from '../src/core/botVoice.ts';

const site = fileURLToPath(new URL('../site/', import.meta.url));
const audition = JSON.parse(
  readFileSync(join(site, 'src/voices/audition.json'), 'utf8'),
);
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : [join(dir, entry.name)],
  );
const clips = audition.bots.flatMap(
  (bot: { candidates: { clips: { file: string; sha256: string }[] }[] }) =>
    bot.candidates.flatMap((candidate) => candidate.clips),
);

test('every clip on the site is the one the asset repository published', () => {
  assert.match(audition.commit, /^[0-9a-f]{40}$/);
  assert.equal(audition.license, 'CC0-1.0');
  assert.equal(clips.length, 27);
  for (const clip of clips) {
    const bytes = readFileSync(join(site, 'public', clip.file));
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      clip.sha256,
      clip.file,
    );
  }
  const present = files(join(site, 'public/voices')).map((path) =>
    relative(join(site, 'public'), path),
  );
  assert.deepEqual(
    present.sort(),
    [
      ...clips.map((clip: { file: string }) => clip.file),
      'voices/LICENSE.txt',
    ].sort(),
  );
});

test('the clips say lines the game has', () => {
  const lines = new Map(VOICE_CATALOGUE.map((line) => [line.id, line]));
  for (const bot of audition.bots) {
    assert.equal(bot.candidates.length, 3, bot.name);
    for (const candidate of bot.candidates)
      for (const clip of candidate.clips) {
        const line = lines.get(clip.line);
        assert.ok(line, `${clip.line} is not in the catalogue`);
        assert.equal(line.bot, bot.mode);
        assert.equal(line.text, clip.text, clip.line);
      }
  }
});

test('the page cannot name a voice: the data has none', () => {
  const text = readFileSync(join(site, 'src/voices/audition.json'), 'utf8');
  assert.doesNotMatch(
    text,
    /Kevin|Justin|Joey|Brian|Arthur|Matthew|Stephen|Gregory|neural|generative/i,
  );
});
