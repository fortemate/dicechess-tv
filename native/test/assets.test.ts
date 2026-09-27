// Everything under assets/ ships: the build packages the whole directory into
// every .vpkg. So a run of the generator must leave nothing there that it did
// not write, whatever an earlier run, another branch or a hand copy left behind
// (#122). On 27 September 2026 a stray assets/probe/ of test tones, left by a
// probe branch, would have shipped in all three tester packages.
//
// The generator runs on a temporary root holding copies of its inputs, so this
// never touches the real assets/, which test/splash.test.ts reads back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error — a build script, deliberately plain JavaScript.
import { main } from '../scripts/generate-assets.mjs';

const NATIVE = join(dirname(fileURLToPath(import.meta.url)), '..');

// Every file under `dir`, relative to it and sorted.
const files = (dir: string) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort();

test('a run leaves nothing under assets/ that it did not write', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'dicechess-tv-assets-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  // Copied rather than linked, so nothing the generator deletes can reach the
  // real inputs.
  for (const input of ['icon', 'brand', 'sounds', 'music'])
    cpSync(join(NATIVE, input), join(root, input), { recursive: true });

  // What gets left behind: a folder of its own, a loose file, and a file next to
  // the icon and one next to the splash, in folders nothing used to empty.
  const assets = join(root, 'assets');
  for (const stray of [
    'probe/tone_a.wav',
    'probe/tone_a.mp3',
    'notes.txt',
    'image/old-icon.png',
    'raw/old-splash.zip',
  ]) {
    mkdirSync(dirname(join(assets, stray)), { recursive: true });
    writeFileSync(join(assets, stray), 'left over');
  }

  const built = main(root) as { sounds: string[]; music: string[] };

  assert.deepEqual(
    files(assets),
    [
      'image/icon.png',
      'raw/SplashScreenImages.zip',
      ...built.sounds.map((file) => `sfx/${file}`),
      ...built.music.map((file) => `music/${file}`),
      'music/music.json',
    ].sort(),
  );
  assert.equal(
    existsSync(join(assets, 'probe')),
    false,
    'the stray folder was emptied but not removed',
  );
});
