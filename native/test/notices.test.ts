// The notices of the third-party software the package ships (#338). Which
// packages ship is read from the bundle's source map, so `npm run bundle` is
// what checks the committed file against the bundle; these tests hold the
// pieces it is built from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NATIVE_NOTICES,
  NOTICES,
  noticesFor,
  packagesIn,
  packagesNamed,
  shippedPackages,
  // @ts-expect-error — a build script, deliberately plain JavaScript.
} from '../scripts/notices.mjs';

const NATIVE = join(dirname(fileURLToPath(import.meta.url)), '..');

type Found = { name: string; dirs: string[] };

test('the packages of a bundle are read from the paths of its sources', () => {
  const found: Found[] = packagesIn([
    '__prelude__',
    '/app/native/index.js',
    '/app/native/src/App.tsx',
    '/app/src/core/game.ts',
    '/app/native/node_modules/react/index.js',
    '/app/native/node_modules/react/cjs/react.production.js',
    '/app/native/node_modules/@babel/runtime/helpers/typeof.js',
    '/app/native/node_modules/x/node_modules/@react-native/virtualized-lists/index.js',
    '/app/native/node_modules/@react-native/virtualized-lists/index.js',
    // Fortemate's own, and so not third-party.
    '/app/node_modules/@fortemate/dicechess-engine/dist/index.js',
  ]);

  assert.deepEqual(found, [
    {
      name: '@babel/runtime',
      dirs: ['/app/native/node_modules/@babel/runtime'],
    },
    {
      name: '@react-native/virtualized-lists',
      dirs: [
        '/app/native/node_modules/@react-native/virtualized-lists',
        '/app/native/node_modules/x/node_modules/@react-native/virtualized-lists',
      ],
    },
    { name: 'react', dirs: ['/app/native/node_modules/react'] },
  ]);
});

// The Vega build leaves React Native for Vega to the device and adds Amazon's
// module map, which a Metro bundle has not. The notices name both.
test('the notices name what the Vega build adds to a Metro bundle', () => {
  const found: Found[] = shippedPackages(
    ['/app/native/node_modules/react/index.js'],
    '/app/native',
  );

  assert.deepEqual(found, [
    {
      name: '@amazon-devices/kepler-compatibility-metro-config',
      dirs: [
        '/app/native/node_modules/@amazon-devices/kepler-compatibility-metro-config',
      ],
    },
    { name: 'react', dirs: ['/app/native/node_modules/react'] },
  ]);
});

test('each package is printed with its own licence, or the text of the repository it comes from', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'dicechess-tv-notices-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const make = (name: string, license: string, text?: string) => {
    const dir = join(root, 'node_modules', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, license }));
    if (text !== undefined) writeFileSync(join(dir, 'LICENSE'), text);
    return { name, dirs: [dir] };
  };
  const meta = 'MIT License\r\n\r\nCopyright (c) Meta Platforms, Inc.   \r\n';
  make('react-native', 'MIT', meta);
  const packages = [
    make(
      '@amazon-devices/react-native-kepler',
      'See license in LICENSE',
      'Program Materials',
    ),
    make('@react-native/assets-registry', 'MIT'),
    make('ieee754', 'BSD-3-Clause', 'Copyright 2008 Fair Oaks Labs, Inc.\n'),
  ];

  const notices: string = noticesFor(packages, root);

  assert.deepEqual(packagesNamed(notices), [
    '@amazon-devices/react-native-kepler',
    '@react-native/assets-registry',
    'ieee754',
  ]);
  // Amazon's terms, and then React Native's notice, which the package's files
  // name and it does not ship.
  assert.match(
    notices,
    /react-native-kepler\nAmazon Program Materials License Agreement\n-+\nProgram Materials\n\nBuilt on React Native, whose notice follows\.\n\nMIT License\n\nCopyright \(c\) Meta Platforms, Inc\.\n/,
  );
  // A package without a LICENSE takes its repository's.
  assert.match(
    notices,
    /assets-registry\nMIT\n-+\nMIT License\n\nCopyright \(c\) Meta Platforms, Inc\.\n/,
  );
  assert.match(notices, /ieee754\nBSD-3-Clause\n-+\nCopyright 2008 Fair Oaks/);
  assert.doesNotMatch(notices, /[ \t]$|\r/m, 'trailing space or CR');

  // A package with no licence anywhere stops the build rather than shipping
  // without one.
  assert.throws(
    () => noticesFor([make('left-pad', 'MIT')], root),
    /left-pad ships no LICENSE file/,
  );
});

test('the committed notices name each package once, in order, with a licence for each', () => {
  const notices = readFileSync(join(NATIVE, NOTICES), 'utf8');
  const named: string[] = packagesNamed(notices);

  assert.ok(named.length > 0);
  assert.deepEqual(named, [...new Set(named)].sort());
  assert.ok(!named.some((name) => name.startsWith('@fortemate/')));
  for (const name of ['react', '@amazon-devices/react-native-kepler'])
    assert.ok(named.includes(name), name);
  assert.doesNotMatch(notices, /[ \t]$|\r/m, 'trailing space or CR');
  // The MMKV native library's notices ship beside the file, which says so.
  for (const notice of NATIVE_NOTICES) {
    assert.ok(named.includes(notice.package), notice.package);
    assert.ok(existsSync(join(NATIVE, notice.from)), notice.from);
    assert.ok(notices.includes(notice.to), notice.to);
  }
});
