// scripts/vendor-lib.mjs is what the four vendor scripts share: files read from
// one pinned commit, each checked against its published digest, packs carried
// only with the asset repository's permission, lists sorted the same on every
// machine, and the vendored directory replaced only once all of that passed.
// These run against a small Git repository made for each test, not the private
// asset repository.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { stripVTControlCharacters } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertMayCarry,
  byteOrder,
  formatWithPrettier,
  pinned,
  refusal,
  replaceDirectory,
  sha256,
  // @ts-expect-error — a build script, deliberately plain JavaScript.
} from '../scripts/vendor-lib.mjs';

const LIB = join(
  dirname(fileURLToPath(import.meta.url)),
  '../scripts/vendor-lib.mjs',
);

const scratch = (t: { after: (fn: () => void) => void }) => {
  const dir = mkdtempSync(join(tmpdir(), 'vendor-lib-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

const git = (checkout: string, ...args: string[]) =>
  execFileSync(
    'git',
    [
      '-C',
      checkout,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { encoding: 'utf8' },
  ).trim();

// A checkout with the given files committed, and the commit's full id.
const commitFiles = (checkout: string, files: Record<string, string>) => {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(checkout, path)), { recursive: true });
    writeFileSync(join(checkout, path), content);
  }
  git(checkout, 'add', '-A');
  git(checkout, 'commit', '-q', '-m', 'files');
  return git(checkout, 'rev-parse', 'HEAD');
};

const assets = (t: { after: (fn: () => void) => void }) => {
  const checkout = scratch(t);
  git(checkout, 'init', '-q');
  return checkout;
};

test('files are read from the pinned commit, whatever the working tree holds', (t) => {
  const checkout = assets(t);
  const first = commitFiles(checkout, { 'pack/a.txt': 'one' });
  commitFiles(checkout, { 'pack/a.txt': 'two' });
  writeFileSync(join(checkout, 'pack/a.txt'), 'uncommitted');

  const source = pinned(checkout, first);
  assert.equal(source.commit, first);
  assert.equal(source.show('pack/a.txt').toString(), 'one');

  writeFileSync(join(checkout, 'pack/b.json'), '{"x":1}');
  const last = commitFiles(checkout, {});
  assert.deepEqual(pinned(checkout, last).json('pack/b.json'), { x: 1 });
});

test('only a checkout and a full 40-character commit are accepted', (t) => {
  const checkout = assets(t);
  const commit = commitFiles(checkout, { 'a.txt': 'a' });
  const usage = 'vendor-x.mjs <checkout> <commit>';
  assert.throws(() => pinned(undefined, commit, { usage }), {
    message: `Usage: ${usage}`,
  });
  // A short id, a branch or a tag could name another commit tomorrow.
  for (const moving of [commit.slice(0, 7), 'main', 'HEAD', undefined])
    assert.throws(() => pinned(checkout, moving, { usage }), /^Error: Usage:/);
  assert.throws(() => pinned(checkout, commit.toUpperCase()), /Usage:/);
});

test('a file is kept only with the digest the asset repository published', (t) => {
  const checkout = assets(t);
  const commit = commitFiles(checkout, { 'pack/clip.mp3': 'clip' });
  const source = pinned(checkout, commit);
  const out = scratch(t);

  const to = join(out, 'deep', 'clip.mp3');
  assert.equal(
    source.copy('pack/clip.mp3', sha256('clip'), to),
    sha256('clip'),
  );
  assert.equal(readFileSync(to, 'utf8'), 'clip');

  const wrong = join(out, 'wrong.mp3');
  assert.throws(
    () => source.copy('pack/clip.mp3', sha256('other'), wrong, 'pack/clip'),
    new RegExp(
      `^Error: pack/clip does not match the digest fortemate/dicechess-assets published at ${commit}$`,
    ),
  );
  // A file with no published digest is refused too.
  assert.throws(
    () => source.copy('pack/clip.mp3', undefined, wrong),
    /does not match the digest/,
  );
  assert.equal(existsSync(wrong), false);
  assert.deepEqual(source.verified('pack/clip.mp3', sha256('clip')), {
    bytes: Buffer.from('clip'),
    sha256: sha256('clip'),
  });
});

test('a pack is carried only where its manifest allows this repository', () => {
  const pack = { license: 'Permission', licenseFile: 'LICENSE.txt' };
  const project = (clients: unknown) => ({
    ...pack,
    distribution: 'project',
    clients,
  });

  assert.equal(refusal({ ...pack, distribution: 'public' }), null);
  assert.equal(refusal(project(['fortemate/dicechess-tv'])), null);
  assert.match(
    refusal(project(['fortemate/dicechess-android'])),
    /not for fortemate\/dicechess-tv/,
  );
  assert.match(refusal(project('fortemate/dicechess-tv')), /not for/);
  assert.match(refusal(project(undefined)), /not for/);
  assert.match(refusal({ ...pack, distribution: 'private' }), /not for/);
  // Another client may be named, for a script that vendors for one.
  assert.equal(
    refusal(project(['fortemate/web']), { client: 'fortemate/web' }),
    null,
  );

  // A pending license is private, and a pack travels with its license file.
  assert.match(
    refusal({ ...pack, license: 'pending', distribution: 'public' }),
    /pending/,
  );
  assert.match(
    refusal({ license: 'CC0-1.0', distribution: 'public' }),
    /no license file/,
  );

  // A pack older than `distribution` is carried only under the license this
  // repository audited for it, and refused once its manifest names another.
  const old = { license: 'CC0-1.0', licenseFile: 'LICENSE.txt' };
  assert.equal(refusal(old, { audited: 'CC0-1.0' }), null);
  assert.match(refusal(old), /names no distribution/);
  assert.match(
    refusal({ ...old, license: 'CC-BY-NC-4.0' }, { audited: 'CC0-1.0' }),
    /CC-BY-NC-4\.0 is not the license audited for it \(CC0-1\.0\)/,
  );

  assert.doesNotThrow(() =>
    assertMayCarry('p', { ...pack, distribution: 'public' }),
  );
  assert.throws(
    () =>
      assertMayCarry(
        'music/p',
        { ...pack, distribution: 'private' },
        { hint: 'Pass --private.' },
      ),
    /^Error: music\/p may not be carried by fortemate\/dicechess-tv: it is not for .*\. Pass --private\.$/,
  );
});

test('lists are sorted by their UTF-8 bytes, not by locale', () => {
  assert.deepEqual(['b', 'B', 'a', 'é', 'z', '_', 'A'].sort(byteOrder), [
    'A',
    'B',
    '_',
    'a',
    'b',
    'z',
    'é',
  ]);
  // Code units would put the emoji (a surrogate pair, 0xD83D…) before U+FF01;
  // its UTF-8 bytes (F0 …) come after U+FF01's (EF …).
  assert.deepEqual(['😀', '！'].sort(byteOrder), ['！', '😀']);
  assert.equal(byteOrder('same', 'same'), 0);
});

test('a directory is replaced only once it has been filled', (t) => {
  const parent = scratch(t);
  const target = join(parent, 'sounds');
  mkdirSync(join(target, 'old-pack'), { recursive: true });
  writeFileSync(join(target, 'old-pack', 'a.mp3'), 'old');

  // A fill that fails leaves the old copy as it was, and nothing beside it.
  assert.throws(
    () =>
      replaceDirectory(target, (dir: string) => {
        writeFileSync(join(dir, 'half.mp3'), 'half');
        throw new Error('digest mismatch');
      }),
    /digest mismatch/,
  );
  assert.equal(readFileSync(join(target, 'old-pack', 'a.mp3'), 'utf8'), 'old');
  assert.deepEqual(readdirSync(parent), ['sounds']);

  // One that succeeds replaces it whole: nothing of the old copy stays.
  const result = replaceDirectory(target, (dir: string) => {
    mkdirSync(join(dir, 'new-pack'));
    writeFileSync(join(dir, 'new-pack', 'b.mp3'), 'new');
    return 'filled';
  });
  assert.equal(result, 'filled');
  assert.deepEqual(readdirSync(target), ['new-pack']);
  assert.deepEqual(readdirSync(parent), ['sounds']);

  // A target that is not there yet is made.
  const fresh = join(parent, 'more', 'voices');
  replaceDirectory(fresh, (dir: string) => writeFileSync(join(dir, 'x'), 'x'));
  assert.deepEqual(readdirSync(fresh), ['x']);
});

// Every file under a directory and its bytes, by relative path.
const snapshot = (dir: string): Record<string, string> =>
  Object.fromEntries(
    (readdirSync(dir, { recursive: true }) as string[])
      .filter((path) => !statSync(join(dir, path)).isDirectory())
      .sort()
      .map((path) => [path, readFileSync(join(dir, path)).toString('hex')]),
  );

test('a digest mismatch or a refused pack leaves the vendored copy byte for byte as it was', (t) => {
  const checkout = assets(t);
  const pack = (manifest: object, clip: string, published = clip) => {
    const files = {
      'manifest.json': JSON.stringify(manifest),
      'LICENSE.txt': 'license',
    };
    return commitFiles(checkout, {
      ...Object.fromEntries(
        Object.entries(files).map(([name, text]) => [`p/${name}`, text]),
      ),
      'p/clip.mp3': clip,
      'p/checksums.json': JSON.stringify({
        'manifest.json': sha256(files['manifest.json']),
        'LICENSE.txt': sha256('license'),
        'clip.mp3': sha256(published),
      }),
    });
  };
  // What each vendor script does: the permission, then every file checked
  // into a new directory that replaces the old one.
  const vendor = (commit: string, target: string) => {
    const source = pinned(checkout, commit);
    const manifest = source.json('p/manifest.json');
    assertMayCarry('p', manifest);
    const published = source.json('p/checksums.json');
    replaceDirectory(target, (dir: string) => {
      for (const name of ['manifest.json', 'LICENSE.txt', 'clip.mp3'])
        source.copy(`p/${name}`, published[name], join(dir, 'p', name));
    });
  };
  const allowed = {
    license: 'CC0-1.0',
    licenseFile: 'LICENSE.txt',
    distribution: 'public',
  };

  const parent = scratch(t);
  const target = join(parent, 'sounds');
  vendor(pack(allowed, 'first'), target);
  const before = snapshot(target);
  assert.equal(readFileSync(join(target, 'p', 'clip.mp3'), 'utf8'), 'first');

  // A clip whose bytes are not the ones checksums.json publishes.
  const tampered = pack(allowed, 'tampered', 'second');
  assert.throws(() => vendor(tampered, target), /does not match the digest/);
  assert.deepEqual(snapshot(target), before);

  // A pack that is not for this repository, with digests that all match.
  const refused = pack({ ...allowed, distribution: 'private' }, 'third');
  assert.throws(() => vendor(refused, target), /may not be carried/);
  assert.deepEqual(snapshot(target), before);

  // Nothing is left beside it, and a good pack still replaces it.
  assert.deepEqual(readdirSync(parent), ['sounds']);
  vendor(pack(allowed, 'fourth'), target);
  assert.equal(readFileSync(join(target, 'p', 'clip.mp3'), 'utf8'), 'fourth');
});

test("generated source is formatted by the repository's pinned Prettier", (t) => {
  const root = scratch(t);
  assert.throws(
    () => formatWithPrettier([join(root, 'a.ts')], { root }),
    /node_modules\/prettier\/bin\/prettier\.cjs is missing: install .* npm ci/,
  );

  // Prettier's own reason for a failure reaches the person running the script.
  const broken = join(root, 'broken.ts');
  writeFileSync(broken, 'export const = ;\n');
  const run = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { formatWithPrettier } from ${JSON.stringify(LIB)};
       formatWithPrettier([${JSON.stringify(broken)}]);`,
    ],
    { encoding: 'utf8' },
  );
  assert.notEqual(run.status, 0);
  // CI forces color, which wraps the level in escape sequences.
  assert.match(
    stripVTControlCharacters(run.stderr),
    /\[error\] .*broken\.ts: SyntaxError/,
  );
});
