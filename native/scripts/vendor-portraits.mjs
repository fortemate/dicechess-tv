// Vendors the opponents' portraits (fortemate/dicechess-assets#31) from
// fortemate/dicechess-assets at one pinned commit.
//
//   node scripts/vendor-portraits.mjs <dicechess-assets checkout> <commit>
//
// Like the other vendor scripts, files are read with `git show <commit>:<path>`
// and checked against the digests the asset repository published in the pack's
// checksums.json: the manifest and the notice as well as every portrait. They
// land in portraits/ with their notice and a lock that pins the commit and
// every digest; scripts/generate-assets.mjs ships them.
//
// The portraits are for Fortemate's Dice Chess apps only. The pinned pack is
// tracked with its notice, so a normal checkout builds with the portraits.
// This script refreshes that pack; it does not change the rights in the notice.
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  UPSTREAM,
  assertMayCarry,
  pinned,
  replaceDirectory,
} from './vendor-lib.mjs';

const PACK = 'portraits/dicechess-cast';
const native = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const [checkout, commit] = process.argv.slice(2);
const source = pinned(checkout, commit, {
  usage:
    'vendor-portraits.mjs <dicechess-assets checkout> <full 40-character commit>',
});

// The manifest is checked against the pack's checksums.json before anything in
// it is trusted, and so is the notice; each portrait matches both the digest
// its manifest entry records and the one checksums.json publishes.
const published = source.json(`${PACK}/checksums.json`);
const manifestBytes = source.verified(
  `${PACK}/manifest.json`,
  published['manifest.json'],
).bytes;
const manifest = JSON.parse(manifestBytes.toString('utf8'));
assertMayCarry(PACK, manifest);

// Every file is read and checked before portraits/ is replaced.
const vendored = replaceDirectory(join(native, 'portraits'), (target) => {
  const files = {};
  for (const [dest, entry] of Object.entries(manifest.derivedExports)) {
    if (published[dest] !== entry.sha256)
      throw new Error(
        `${PACK}/${dest}: the manifest and checksums.json disagree on its digest`,
      );
    const name = dest.split('/').pop();
    source.copy(`${PACK}/${dest}`, published[dest], join(target, name));
    files[name] = {
      sha256: entry.sha256,
      character: entry.character,
      kind: entry.kind,
      size: entry.width,
    };
  }
  const notice = source.copy(
    `${PACK}/${manifest.licenseFile}`,
    published[manifest.licenseFile],
    join(target, 'NOTICE.txt'),
  );

  const lock = {
    source: {
      repository: UPSTREAM,
      commit,
      pack: PACK,
      version: manifest.version,
    },
    license: manifest.license,
    notice: { file: 'NOTICE.txt', sha256: notice },
    files,
  };
  writeFileSync(
    join(target, 'portraits.lock.json'),
    `${JSON.stringify(lock, null, 2)}\n`,
  );
  return lock;
});
console.log(
  `Vendored ${Object.keys(vendored.files).length} portraits from ${UPSTREAM}@${commit.slice(0, 7)} into portraits/`,
);
