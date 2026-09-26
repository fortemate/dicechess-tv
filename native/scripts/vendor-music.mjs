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
// A pack whose licence is still pending says so in its manifest
// (`distribution: private`), and this public repository may not carry it. The
// script refuses such a pack unless --private says the copy is for a local build
// only. native/music/ is ignored by git until the licence is recorded.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACK = 'pepka-prygni-dicechess';
const UPSTREAM = 'fortemate/dicechess-assets';
const ROLES = ['menu', 'calm', 'tense', 'critical'];
const native = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const local = args.includes('--private');
const [checkout, commit] = args.filter((arg) => arg !== '--private');
if (!checkout || !/^[0-9a-f]{40}$/.test(commit ?? ''))
  throw new Error(
    'Usage: vendor-music.mjs <dicechess-assets checkout> <full 40-character commit> [--private]',
  );

const show = (path) =>
  execFileSync('git', ['-C', checkout, 'show', `${commit}:${path}`], {
    maxBuffer: 256 * 1024 * 1024,
  });
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const manifest = JSON.parse(
  show(`music/${PACK}/manifest.json`).toString('utf8'),
);
if (manifest.distribution !== 'public' && !local)
  throw new Error(
    `${PACK} is not distributable (license ${manifest.license}, distribution ${manifest.distribution}). ` +
      'Pass --private for a local build that is never committed.',
  );
const published = JSON.parse(
  show(`music/${PACK}/checksums.json`).toString('utf8'),
);
const quietest = Math.min(
  ...Object.values(manifest.tracks).map(
    (track) => track.loudness.integratedLufs,
  ),
);

const root = join(native, 'music');
rmSync(root, { recursive: true, force: true });
mkdirSync(join(root, PACK), { recursive: true });
const copy = (path) => {
  const bytes = show(`music/${PACK}/${path}`);
  if (published[path] !== sha256(bytes))
    throw new Error(
      `${PACK}/${path} does not match the digest ${UPSTREAM} published at ${commit}`,
    );
  const name = path.split('/').pop();
  writeFileSync(join(root, PACK, name), bytes);
  return { file: `${PACK}/${name}`, sha256: sha256(bytes) };
};

copy('manifest.json');
if (manifest.licenseFile) copy(manifest.licenseFile);
const tracks = {};
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
  distribution: manifest.distribution,
  attribution: manifest.attribution,
  attributionRequired: manifest.attributionRequired,
  roles: manifest.rolesStatus,
  tracks,
};
writeFileSync(
  join(root, 'music.json'),
  JSON.stringify(catalogue, null, 2) + '\n',
);
console.log(
  `music: ${Object.keys(tracks).length} roles from ${PACK} at ${commit.slice(0, 7)} -> native/music/` +
    (local ? ' (private: never commit)' : ''),
);
