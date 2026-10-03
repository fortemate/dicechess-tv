// Vendors the opponents' portraits (fortemate/dicechess-assets#31) from
// fortemate/dicechess-assets at one pinned commit.
//
//   node scripts/vendor-portraits.mjs <dicechess-assets checkout> <commit>
//
// Like the other vendor scripts, files are read with `git show <commit>:<path>`
// and checked against the digests the asset repository published, in the pack's
// manifest.json. They land in portraits/ with their notice and a lock that pins
// the commit and every digest; scripts/generate-assets.mjs ships them.
//
// The portraits are for Fortemate's Dice Chess apps only. While this repository
// is public, git ignores portraits/, so a local build has them and nothing is
// committed: a checkout without them shows the RhosGFX emoji faces instead.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACK = 'portraits/dicechess-cast';
const UPSTREAM = 'fortemate/dicechess-assets';
const CLIENT = 'fortemate/dicechess-tv';
const native = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const [checkout, commit] = process.argv.slice(2);
if (!checkout || !/^[0-9a-f]{40}$/.test(commit ?? ''))
  throw new Error(
    'Usage: vendor-portraits.mjs <dicechess-assets checkout> <full 40-character commit>',
  );

const show = (path) =>
  execFileSync('git', ['-C', checkout, 'show', `${commit}:${path}`], {
    maxBuffer: 64 * 1024 * 1024,
  });
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const manifest = JSON.parse(show(`${PACK}/manifest.json`).toString('utf8'));
if (manifest.distribution !== 'project' || !manifest.clients?.includes(CLIENT))
  throw new Error(`${PACK} does not name ${CLIENT} among its clients`);

const target = join(native, 'portraits');
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

const files = {};
for (const [dest, entry] of Object.entries(manifest.derivedExports)) {
  const bytes = show(`${PACK}/${dest}`);
  if (sha256(bytes) !== entry.sha256)
    throw new Error(`${PACK}/${dest} does not match its published digest`);
  const name = dest.split('/').pop();
  writeFileSync(join(target, name), bytes);
  files[name] = {
    sha256: entry.sha256,
    character: entry.character,
    kind: entry.kind,
    size: entry.width,
  };
}
const notice = show(`${PACK}/${manifest.licenseFile}`);
writeFileSync(join(target, 'NOTICE.txt'), notice);

const lock = {
  source: {
    repository: UPSTREAM,
    commit,
    pack: PACK,
    version: manifest.version,
  },
  license: manifest.license,
  notice: { file: 'NOTICE.txt', sha256: sha256(notice) },
  files,
};
writeFileSync(
  join(target, 'portraits.lock.json'),
  `${JSON.stringify(lock, null, 2)}\n`,
);
console.log(
  `Vendored ${Object.keys(files).length} portraits from ${UPSTREAM}@${commit.slice(0, 7)} into portraits/ (git-ignored while the repository is public)`,
);
