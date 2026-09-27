// The vendored music is what its catalogue says it is (#76).
//
// scripts/vendor-music.mjs writes music/music.json: the pinned commit of
// dicechess-assets, the pack's permission, the tracks each role plays, and the
// digest of every file it copied. These checks make a hand-edited file, a stray
// one, or a pack this repository may not carry fail here rather than ship.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MUSIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'music');
const read = (path: string) => readFileSync(join(MUSIC, path));

type Catalogue = {
  upstream: string;
  commit: string;
  pack: string;
  license: string;
  licenseFile: string | null;
  distribution: string;
  clients: string[] | null;
  attribution: string;
  tracks: Record<
    string,
    { file: string; sha256: string; loopStart: number; loopEnd: number }
  >;
  files: Record<string, string>;
};

const catalogue = JSON.parse(read('music.json').toString('utf8')) as Catalogue;

test('the catalogue pins one full commit of the asset repository', () => {
  assert.equal(catalogue.upstream, 'fortemate/dicechess-assets');
  assert.match(catalogue.commit, /^[0-9a-f]{40}$/);
});

test('this repository may carry the pack', () => {
  // A pending licence is private; a permission for one project names the
  // repositories that may carry it.
  const allowed =
    catalogue.distribution === 'public' ||
    (catalogue.distribution === 'project' &&
      (catalogue.clients ?? []).includes('fortemate/dicechess-tv'));
  assert.ok(allowed, `${catalogue.pack}: ${catalogue.distribution}`);
  assert.notEqual(catalogue.license, 'pending');
});

test('every vendored file has the bytes the catalogue pinned, and nothing else is there', () => {
  for (const [name, sha256] of Object.entries(catalogue.files)) {
    const digest = createHash('sha256')
      .update(read(`${catalogue.pack}/${name}`))
      .digest('hex');
    assert.equal(digest, sha256, name);
  }
  assert.deepEqual(
    readdirSync(join(MUSIC, catalogue.pack)).sort(),
    Object.keys(catalogue.files).sort(),
  );
  assert.deepEqual(readdirSync(MUSIC).sort(), ['music.json', catalogue.pack]);
});

test('the pack travels with its manifest and its licence', () => {
  const manifest = JSON.parse(
    read(`${catalogue.pack}/manifest.json`).toString('utf8'),
  );
  assert.equal(manifest.id, catalogue.pack);
  assert.ok(catalogue.licenseFile, 'the permission has a licence file');
  assert.ok(catalogue.files[catalogue.licenseFile!], 'licence not vendored');
  assert.equal(manifest.attribution, catalogue.attribution);
});

test('every role plays a vendored track, looping inside it', () => {
  assert.deepEqual(Object.keys(catalogue.tracks).sort(), [
    'calm',
    'critical',
    'menu',
    'tense',
  ]);
  for (const [role, track] of Object.entries(catalogue.tracks)) {
    const name = track.file.split('/').pop()!;
    assert.equal(catalogue.files[name], track.sha256, role);
    assert.ok(track.loopStart >= 0 && track.loopEnd > track.loopStart, role);
  }
});
