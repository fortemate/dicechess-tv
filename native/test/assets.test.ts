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
import { main, copyPortraits } from '../scripts/generate-assets.mjs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PORTRAITS_VERSION } from '../src/Portrait';

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
  for (const input of ['icon', 'brand', 'sounds', 'music', 'voices'])
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

  const built = main(root) as {
    sounds: string[];
    music: string[];
    voices: string[];
  };

  assert.deepEqual(
    files(assets),
    [
      'image/icon.png',
      'raw/SplashScreenImages.zip',
      ...built.sounds.map((file) => `sfx/${file}`),
      ...built.music.map((file) => `music/${file}`),
      'music/music.json',
      ...built.voices.map((file) => `voices/${file}`),
    ].sort(),
  );
  assert.equal(
    existsSync(join(assets, 'probe')),
    false,
    'the stray folder was emptied but not removed',
  );
});

// The portraits (dicechess-assets#31) stay out of the public repository, so a
// checkout may have none: then nothing ships and the game shows the emoji
// faces. When scripts/vendor-portraits.mjs has put them in portraits/, they
// ship exactly as its lock pinned them.
test('portraits ship as the lock pinned them, and not at all without one', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'dicechess-tv-portraits-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const target = join(root, 'assets/portraits');

  assert.deepEqual(copyPortraits(root), []);
  assert.equal(existsSync(target), false);

  const bytes = Buffer.from('a portrait');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  mkdirSync(join(root, 'portraits'));
  writeFileSync(join(root, 'portraits/rolly-card-336.png'), bytes);
  writeFileSync(
    join(root, 'portraits/portraits.lock.json'),
    JSON.stringify({
      source: { version: PORTRAITS_VERSION },
      files: { 'rolly-card-336.png': { sha256 } },
    }),
  );
  assert.deepEqual(copyPortraits(root), ['rolly-card-336.png']);
  assert.deepEqual(files(target), [`${PORTRAITS_VERSION}/rolly-card-336.png`]);

  writeFileSync(join(root, 'portraits/rolly-card-336.png'), 'edited by hand');
  assert.throws(() => copyPortraits(root), /no longer matches/);
});

// The app looks for the portraits under the version src/Portrait.tsx names, so
// that version has to be the one vendored. Only a checkout with portraits can
// tell; the public repository has none.
const LOCK = join(NATIVE, 'portraits/portraits.lock.json');
test(
  'the app looks for the portraits of the version the lock pins',
  { skip: !existsSync(LOCK) && 'no portraits in this checkout' },
  () => {
    const { source } = JSON.parse(readFileSync(LOCK, 'utf8'));
    assert.equal(source.version, PORTRAITS_VERSION);
  },
);
