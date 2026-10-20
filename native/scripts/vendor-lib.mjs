// What the vendor scripts share: vendor-sounds, vendor-music, vendor-voices and
// vendor-portraits each copy one kind of asset from fortemate/dicechess-assets,
// and each follows the asset repository's consumption rules in the same way.
//
// - Files are read with `git show <commit>:<path>` from one full commit, so the
//   checkout's working tree and branch do not matter.
// - Every file is checked against the digest the asset repository published for
//   it before it is kept.
// - A pack is carried only when its manifest allows this repository to carry it.
// - Nothing replaces the vendored directory until every file has been read and
//   checked: the copy is made in a directory beside it, which is then renamed
//   into its place. A refused pack or a wrong digest leaves the old copy as it
//   was.
// - Lists are sorted by their bytes, the same on every machine; localeCompare
//   follows the machine's locale.
//
// test/vendorLib.test.ts holds each of these.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const UPSTREAM = 'fortemate/dicechess-assets';
export const CLIENT = 'fortemate/dicechess-tv';

const native = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repository = resolve(native, '..');

export const sha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');

// UTF-8 byte order, for Array.prototype.sort.
export const byteOrder = (a, b) =>
  Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));

const FULL_COMMIT = /^[0-9a-f]{40}$/;

// One commit of a dicechess-assets checkout. `usage` is the script's own usage
// line, shown when the checkout or a full 40-character commit is missing.
export const pinned = (
  checkout,
  commit,
  { usage, maxBuffer = 64 * 1024 * 1024 } = {},
) => {
  if (!checkout || !FULL_COMMIT.test(commit ?? ''))
    throw new Error(
      `Usage: ${usage ?? '<dicechess-assets checkout> <full 40-character commit>'}`,
    );
  const show = (path) =>
    execFileSync('git', ['-C', checkout, 'show', `${commit}:${path}`], {
      maxBuffer,
    });
  // The file's bytes and digest, once the digest is the one published for it.
  const verified = (path, published, label = path) => {
    const bytes = show(path);
    const digest = sha256(bytes);
    if (digest !== published)
      throw new Error(
        `${label} does not match the digest ${UPSTREAM} published at ${commit}`,
      );
    return { bytes, sha256: digest };
  };
  return {
    commit,
    show,
    json: (path) => JSON.parse(show(path).toString('utf8')),
    verified,
    // Writes the file to `to` once it is verified, and returns its digest.
    copy: (path, published, to, label = path) => {
      const { bytes, sha256: digest } = verified(path, published, label);
      mkdirSync(dirname(to), { recursive: true });
      writeFileSync(to, bytes);
      return digest;
    },
  };
};

// Why this repository may not carry a pack, or null when it may. A manifest
// says who may carry it: `distribution: public`, any client; `project`, only
// the repositories its `clients` list; anything else, none. A pending license
// is private whatever else it says, and a pack without its license file
// cannot be carried with it.
//
// Packs older than the `distribution` field say nothing; `audited` is then the
// license this repository audited for the pack, and the pack may be carried
// while its manifest still names that license.
export const refusal = (manifest, { client = CLIENT, audited } = {}) => {
  const { license, distribution, clients, licenseFile } = manifest;
  const terms = `license ${license}, distribution ${distribution}`;
  if (!licenseFile) return `it has no license file (${terms})`;
  if (!license || license === 'pending')
    return `its license is pending (${terms})`;
  if (distribution === undefined)
    return audited !== undefined && license === audited
      ? null
      : `it names no distribution, and ${license} is not the license audited for it (${audited ?? 'none'})`;
  if (distribution === 'public') return null;
  if (
    distribution === 'project' &&
    Array.isArray(clients) &&
    clients.includes(client)
  )
    return null;
  return `it is not for ${client} (${terms})`;
};

export const assertMayCarry = (pack, manifest, options = {}) => {
  const reason = refusal(manifest, options);
  if (!reason) return;
  const hint = options.hint ? `. ${options.hint}` : '';
  throw new Error(
    `${pack} may not be carried by ${options.client ?? CLIENT}: ${reason}${hint}`,
  );
};

// Fills a new directory with `fill(dir)` and puts it in the place of `target`,
// returning what `fill` returned. The new directory is made beside the target,
// on the same file system, so the rename is not a copy. If `fill` throws, it is
// removed and the target is left as it was.
export const replaceDirectory = (target, fill) => {
  const parent = dirname(target);
  mkdirSync(parent, { recursive: true });
  const staged = mkdtempSync(join(parent, `.${basename(target)}.new-`));
  let result;
  try {
    result = fill(staged);
  } catch (error) {
    rmSync(staged, { recursive: true, force: true });
    throw error;
  }
  const old = `${staged}.old`;
  const had = existsSync(target);
  if (had) renameSync(target, old);
  try {
    renameSync(staged, target);
  } catch (error) {
    if (had) renameSync(old, target);
    rmSync(staged, { recursive: true, force: true });
    throw error;
  }
  if (had) rmSync(old, { recursive: true, force: true });
  return result;
};

// Formats generated source with the repository's own Prettier, the version the
// root package pins, so the format check passes and a re-run leaves no diff.
// Never `npx prettier`: without a local install that fetches whatever version
// the registry has.
export const formatWithPrettier = (files, { root = repository } = {}) => {
  const bin = join(root, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
  if (!existsSync(bin))
    throw new Error(
      `${bin} is missing: install the repository's tools with npm ci at its root`,
    );
  execFileSync(process.execPath, [bin, '--write', ...files], {
    cwd: root,
    stdio: 'ignore',
  });
};
