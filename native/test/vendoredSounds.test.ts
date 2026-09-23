// The vendored sounds are what the lock says they are.
//
// The lock records, for every file, where it came from in dicechess-assets and
// the digest that repository published for it at the pinned commit. These checks
// make a hand-edited file, a stray one, or a regenerated cue table that drifted
// from the lock fail here rather than ship.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUE_FILES } from '../src/cueFiles';

// Plain paths: this project's types reject a URL object where a path is expected.
const SOUNDS = join(dirname(fileURLToPath(import.meta.url)), '..', 'sounds');
const read = (path: string) => readFileSync(join(SOUNDS, path));

type Lock = {
  upstream: string;
  commit: string;
  packs: Record<
    string,
    {
      version: string;
      license: string;
      attribution: string;
      attributionRequired: boolean;
      files: Record<string, { from: string; sha256: string }>;
    }
  >;
  cues: Record<string, string[]>;
};

const lock = JSON.parse(read('sounds.lock.json').toString('utf8')) as Lock;

test('the lock pins one full commit of the asset repository', () => {
  assert.equal(lock.upstream, 'fortemate/dicechess-assets');
  assert.match(lock.commit, /^[0-9a-f]{40}$/);
});

test('every vendored file has the bytes the lock pinned, and nothing else is there', () => {
  for (const [pack, { files }] of Object.entries(lock.packs)) {
    for (const [name, { sha256 }] of Object.entries(files)) {
      const digest = createHash('sha256')
        .update(read(`${pack}/${name}`))
        .digest('hex');
      assert.equal(digest, sha256, `${pack}/${name}`);
    }
    // A file on disk that the lock does not know about came from somewhere else.
    const onDisk = readdirSync(join(SOUNDS, pack)).sort();
    assert.deepEqual(onDisk, Object.keys(files).sort(), pack);
  }
});

test('every pack travels with its manifest and licence', () => {
  for (const [pack, { files }] of Object.entries(lock.packs)) {
    const manifest = JSON.parse(read(`${pack}/manifest.json`).toString('utf8'));
    assert.equal(manifest.id, pack);
    assert.ok(files[manifest.licenseFile], `${pack}: licence not vendored`);
    assert.ok(existsSync(join(SOUNDS, pack, manifest.licenseFile)));
    // The lock repeats the credit terms so the About screen can be checked
    // against them without reading every manifest.
    assert.equal(lock.packs[pack].attribution, manifest.attribution);
    assert.equal(
      lock.packs[pack].attributionRequired,
      manifest.attributionRequired,
    );
  }
});

test('the cue table the app reads is the one the lock records', () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(CUE_FILES).map(([cue, files]) => [cue, [...files]]),
    ),
    lock.cues,
  );
  for (const files of Object.values(lock.cues))
    for (const file of files) {
      const [pack, name] = file.split('/');
      assert.ok(lock.packs[pack]?.files[name], `${file} is not vendored`);
      assert.match(name, /\.mp3$/, 'Vega cannot play Ogg Vorbis');
    }
});
