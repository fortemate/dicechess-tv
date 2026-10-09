// Everything under assets/ ships: the build packages the whole directory into
// every .vpkg. So a run of the generator must leave nothing there that it did
// not write, whatever an earlier run, another branch or a hand copy left behind
// (#122). On 27 September 2026 a stray assets/probe/ of test tones, left by a
// probe branch, would have shipped in all three tester packages.
//
// The generator runs on a temporary root holding copies of its inputs, so this
// never touches the real assets/.
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
import {
  main,
  copyPortraits,
  portraitVector,
  portraitsVersion,
  shownPortraits,
  // @ts-expect-error — a build script, deliberately plain JavaScript.
} from '../scripts/generate-assets.mjs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import {
  CHARACTERS,
  PORTRAIT_OF,
  PORTRAITS_VERSION,
  portraitPath,
  type PortraitKind,
} from '../src/Portrait';
import { HOSTS } from '../src/hostSetting';
import { TEACHER } from '../src/Teacher';

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
  for (const input of ['icon', 'brand', 'splash', 'sounds', 'music', 'voices'])
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

  // zip stamps entries in local time, so a build elsewhere in the world must
  // still write the same archive, byte for byte.
  const digest = () =>
    createHash('sha256')
      .update(readFileSync(join(assets, 'raw/SplashScreenImages.zip')))
      .digest('hex');
  const first = digest();
  const zone = process.env.TZ;
  try {
    process.env.TZ = 'America/Los_Angeles';
    main(root);
  } finally {
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  }
  assert.equal(digest(), first, 'a rebuild changed the splash archive');
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
  const shown = ['rolly-card-336.png'];
  assert.deepEqual(copyPortraits(root, PORTRAITS_VERSION, shown), shown);
  assert.deepEqual(files(target), [`${PORTRAITS_VERSION}/rolly-card-336.png`]);

  writeFileSync(join(root, 'portraits/rolly-card-336.png'), 'edited by hand');
  assert.throws(
    () => copyPortraits(root, PORTRAITS_VERSION, shown),
    /no longer matches/,
  );
});

// Since pack 1.4.0 Thinkle comes as a vector too. The splash draws him from it
// at build time; the app never loads it, so it must not ship.
test('a portrait vector is read for the splash and never shipped', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'dicechess-tv-portraits-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.equal(portraitVector(root, 'thinkle.svg'), null);

  const pin = (bytes: Buffer) => ({
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  const card = Buffer.from('a card');
  const vector = Buffer.from('<svg/>');
  mkdirSync(join(root, 'portraits'));
  writeFileSync(join(root, 'portraits/thinkle-card-336.png'), card);
  writeFileSync(join(root, 'portraits/thinkle.svg'), vector);
  const lock = (files: object) =>
    writeFileSync(
      join(root, 'portraits/portraits.lock.json'),
      JSON.stringify({ source: { version: PORTRAITS_VERSION }, files }),
    );

  lock({ 'thinkle-card-336.png': pin(card) });
  assert.equal(portraitVector(root, 'thinkle.svg'), null, 'not pinned');

  lock({ 'thinkle-card-336.png': pin(card), 'thinkle.svg': pin(vector) });
  const shown = ['thinkle-card-336.png'];
  assert.deepEqual(copyPortraits(root, PORTRAITS_VERSION, shown), shown);
  assert.deepEqual(files(join(root, 'assets/portraits')), [
    `${PORTRAITS_VERSION}/thinkle-card-336.png`,
  ]);
  assert.deepEqual(portraitVector(root, 'thinkle.svg'), vector);

  writeFileSync(join(root, 'portraits/thinkle.svg'), '<svg>edited</svg>');
  assert.throws(() => portraitVector(root, 'thinkle.svg'), /no longer matches/);
  assert.throws(
    () => copyPortraits(root, PORTRAITS_VERSION, shown),
    /no longer matches/,
  );
});

// The pack holds characters the game has not introduced, Ashby and two more
// cats among them. Only the portraits a screen shows ship (#262), and a pack
// without one of those is refused rather than built into a game that shows an
// emoji face or an empty place where the portrait belongs.
test('only the portraits the app shows ship, and a pack missing one is refused', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'dicechess-tv-portraits-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const shown: string[] = shownPortraits();
  const unshown = [
    'ashby-badge-128.png',
    'ashby-card-336.png',
    'cat-blue-badge-128.png',
    'cat-green-card-336.png',
    'thinkle.svg',
  ];
  mkdirSync(join(root, 'portraits'));
  const pinned: Record<string, { sha256: string }> = {};
  for (const name of [...shown, ...unshown]) {
    const bytes = Buffer.from(name);
    writeFileSync(join(root, 'portraits', name), bytes);
    pinned[name] = { sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  const lock = (files: object) =>
    writeFileSync(
      join(root, 'portraits/portraits.lock.json'),
      JSON.stringify({ source: { version: PORTRAITS_VERSION }, files }),
    );

  lock(pinned);
  assert.deepEqual(copyPortraits(root).sort(), [...shown].sort());
  assert.deepEqual(
    files(join(root, 'assets/portraits')),
    shown.map((name) => `${PORTRAITS_VERSION}/${name}`).sort(),
  );

  delete pinned['cat-card-336.png'];
  lock(pinned);
  assert.throws(() => copyPortraits(root), /holds no cat-card-336\.png/);
  assert.equal(existsSync(join(root, 'assets/portraits')), false);
});

// The build names the files from src/Portrait.tsx; the app names them with
// portraitPath. Two readings of one list must name the same files.
test('the build ships the portrait files the app loads', () => {
  const kinds: readonly PortraitKind[] = ['badge', 'card'];
  assert.deepEqual(
    shownPortraits(),
    CHARACTERS.flatMap((character) =>
      kinds.map((kind) => basename(portraitPath(character, kind))),
    ),
  );
});

// A character in CHARACTERS ships, so each one needs a screen that shows it:
// an opponent, a Hot Seat host or the tutorial's teacher. One that no screen
// shows would ship a character the game has not introduced.
test('every character whose portrait ships is one a screen shows', () => {
  const onScreen = new Set([
    ...Object.values(PORTRAIT_OF),
    ...HOSTS.map((host) => host.portrait),
    TEACHER,
  ]);
  assert.deepEqual([...CHARACTERS].sort(), [...onScreen].sort());
});

// A pack the app does not look for would ship and never load, and the game
// would show the emoji faces without a word: the build stops instead.
test('the build refuses a portrait pack of another version than the app looks for', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'dicechess-tv-portraits-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bytes = Buffer.from('a portrait');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  mkdirSync(join(root, 'portraits'));
  writeFileSync(join(root, 'portraits/rolly-card-336.png'), bytes);
  writeFileSync(
    join(root, 'portraits/portraits.lock.json'),
    JSON.stringify({
      source: { version: '0.9.0' },
      files: { 'rolly-card-336.png': { sha256 } },
    }),
  );
  assert.throws(
    () => copyPortraits(root),
    new RegExp(
      `pack 0\\.9\\.0, but src/Portrait\\.tsx looks for ${PORTRAITS_VERSION}`,
    ),
  );
  assert.equal(existsSync(join(root, 'assets/portraits')), false);
});

test('the build reads the portrait version the app looks for', () => {
  assert.equal(portraitsVersion(), PORTRAITS_VERSION);
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

// And it has to hold every portrait the app shows. Run on a copy, so the real
// assets/ is not touched.
test(
  'the vendored pack has every portrait the app shows, and only those ship',
  { skip: !existsSync(LOCK) && 'no portraits in this checkout' },
  (t) => {
    const root = mkdtempSync(join(tmpdir(), 'dicechess-tv-portraits-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    cpSync(join(NATIVE, 'portraits'), join(root, 'portraits'), {
      recursive: true,
    });
    assert.deepEqual(copyPortraits(root).sort(), [...shownPortraits()].sort());
  },
);
