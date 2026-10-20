// Vendors the adaptive music (#76) from fortemate/dicechess-assets at one pinned
// commit.
//
//   node scripts/vendor-music.mjs <dicechess-assets checkout> <commit> [--private]
//
// Like vendor-sounds.mjs, files are read with `git show <commit>:<path>` and
// checked against the digests the asset repository published. The pack's roles
// say which track plays when; each track loops over its sound, without the
// silence at either end, until loop points are chosen by ear, and is levelled to
// the quietest by the loudness the pack measured.
//
// A pack says in its manifest who may carry it: `distribution: public`, any
// client; `project`, only the repositories its `clients` list; `private`, none,
// which is also what a pending licence means. The script vendors a pack this
// repository may carry, and refuses any other unless --private says the copy is
// for a local build that is never committed.
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  UPSTREAM,
  assertMayCarry,
  pinned,
  replaceDirectory,
} from './vendor-lib.mjs';

const PACK = 'pepka-prygni-dicechess';
const ROLES = ['menu', 'calm', 'tense', 'critical'];
const native = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const local = args.includes('--private');
const [checkout, commit] = args.filter((arg) => arg !== '--private');
const source = pinned(checkout, commit, {
  usage:
    'vendor-music.mjs <dicechess-assets checkout> <full 40-character commit> [--private]',
  maxBuffer: 256 * 1024 * 1024,
});

const manifest = source.json(`music/${PACK}/manifest.json`);
if (!local)
  assertMayCarry(PACK, manifest, {
    hint: 'Pass --private for a local build that is never committed.',
  });
const published = source.json(`music/${PACK}/checksums.json`);
const quietest = Math.min(
  ...Object.values(manifest.tracks).map(
    (track) => track.loudness.integratedLufs,
  ),
);

// Every file is read and checked before music/ is replaced.
const files = {};
const tracks = {};
replaceDirectory(join(native, 'music'), (root) => {
  const copy = (path) => {
    const name = path.split('/').pop();
    const digest = source.copy(
      `music/${PACK}/${path}`,
      published[path],
      join(root, PACK, name),
      `${PACK}/${path}`,
    );
    files[name] = digest;
    return { file: `${PACK}/${name}`, sha256: digest };
  };

  copy('manifest.json');
  if (manifest.licenseFile) copy(manifest.licenseFile);
  for (const role of ROLES) {
    const id = manifest.roles?.[role];
    if (!id) continue;
    const track = manifest.tracks[id];
    const { file, sha256: digest } = copy(track.export);
    const loop = track.loop ?? {
      start: track.leadingSilenceSeconds,
      end: track.durationSeconds - track.trailingSilenceSeconds,
    };
    tracks[role] = {
      title: track.title,
      file,
      sha256: digest,
      loopStart: loop.start,
      loopEnd: loop.end,
      gainDb: Math.round((quietest - track.loudness.integratedLufs) * 10) / 10,
    };
  }

  const catalogue = {
    upstream: UPSTREAM,
    commit,
    pack: PACK,
    version: manifest.version,
    license: manifest.license,
    licenseFile: manifest.licenseFile,
    distribution: manifest.distribution,
    clients: manifest.clients ?? null,
    attribution: manifest.attribution,
    attributionRequired: manifest.attributionRequired,
    roles: manifest.rolesStatus,
    tracks,
    // Every file vendored for the pack, with its digest.
    files,
  };
  writeFileSync(
    join(root, 'music.json'),
    JSON.stringify(catalogue, null, 2) + '\n',
  );
});
console.log(
  `music: ${Object.keys(tracks).length} roles from ${PACK} at ${commit.slice(0, 7)} -> native/music/` +
    (local ? ' (private: never commit)' : ''),
);
