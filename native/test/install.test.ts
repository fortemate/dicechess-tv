// scripts/install.mjs picks the package a device can run. The wrong one installs
// without a word and crashes at start (friction log FL-30), so the choice is
// held here without a device: what `uname -m` says, which package that means,
// and which processor a package is for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  archOf,
  archOfListing,
  archOfPackage,
  machineOf,
  packagePath,
  // @ts-expect-error — a build script, deliberately plain JavaScript.
} from '../scripts/install.mjs';

test('each device processor maps to the package built for it', () => {
  assert.equal(archOf('aarch64'), 'aarch64'); // the Virtual Device on Apple silicon
  assert.equal(archOf('arm64\n'), 'aarch64');
  assert.equal(archOf('armv7l'), 'armv7'); // a Fire TV Stick
  assert.equal(archOf('x86_64'), 'x86_64'); // the Virtual Device on Linux or Intel
  assert.throws(() => archOf('mips'), /no package is built for a "mips"/);
  assert.throws(() => archOf(''), /no package is built/);
});

test('the machine name is the last one-word line of run-cmd output', () => {
  assert.equal(machineOf('aarch64\n'), 'aarch64');
  assert.equal(
    machineOf('Running command on VirtualDevice ...\narmv7l\n\n'),
    'armv7l',
  );
  assert.equal(machineOf(''), '');
});

test('the default package for a processor is the one the build writes', () => {
  assert.equal(
    packagePath('armv7', '/n'),
    '/n/build/armv7-release/dicechess-tv-native_armv7.vpkg',
  );
});

test("a package's processor is read from its native libraries", () => {
  const listing = [
    'bundle/index.hermes.bundle',
    'lib/armv7/libreact-native-mmkv-kepler.so',
    'manifest.toml',
  ].join('\n');
  assert.equal(archOfListing(listing), 'armv7');
  assert.throws(
    () => archOfListing('bundle/index.hermes.bundle\nmanifest.toml'),
    /found none/,
  );
  assert.throws(
    () => archOfListing('lib/armv7/libmmkv.so\nlib/aarch64/libmmkv.so\n'),
    /found armv7, aarch64/,
  );
});

test('a package tar cannot open is placed by its name, or refused', () => {
  assert.equal(
    archOfPackage('/nowhere/dicechess-tv-native_x86_64.vpkg'),
    'x86_64',
  );
  assert.throws(
    () => archOfPackage('/nowhere/app.vpkg'),
    /cannot tell which processor/,
  );
});
