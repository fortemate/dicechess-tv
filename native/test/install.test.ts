// scripts/install.mjs picks the package a device can run. The wrong one installs
// without a word and crashes at start (friction log FL-30), so the choice is
// held here without a device: what `uname -m` says, which package that means,
// and which processor a package is for. So is the removal of the copy that
// `vega device install-app` leaves in the device's memory (#379).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  archOf,
  archOfListing,
  archOfPackage,
  deviceArch,
  failureOf,
  installPackage,
  listPackage,
  machineOf,
  packagePath,
  pushedPath,
  removeCommand,
  vega,
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
  assert.equal(
    archOfListing('./lib/aarch64/libreact-native-mmkv-kepler.so\n'),
    'aarch64',
  );
  assert.throws(
    () => archOfListing('bundle/index.hermes.bundle\nmanifest.toml'),
    /found none/,
  );
  assert.throws(
    () => archOfListing('lib/armv7/libmmkv.so\nlib/aarch64/libmmkv.so\n'),
    /found armv7, aarch64/,
  );
});

test('a package is placed by what it holds, never by its name', () => {
  const holding = (listing: string) => () => listing;
  assert.equal(
    archOfPackage(
      'any.vpkg',
      holding('lib/x86_64/libreact-native-mmkv-kepler.so\n'),
    ),
    'x86_64',
  );
  // A package that cannot be listed is refused, whatever its name says.
  assert.throws(
    () =>
      archOfPackage('dicechess-tv-native_aarch64.vpkg', () => {
        throw new Error('vpt cannot list dicechess-tv-native_aarch64.vpkg');
      }),
    /vpt cannot list/,
  );
  // So is one whose libraries disagree, even when its name looks right.
  assert.throws(
    () =>
      archOfPackage(
        'dicechess-tv-native_aarch64.vpkg',
        holding('lib/aarch64/a.so\nlib/armv7/a.so\n'),
      ),
    /found aarch64, armv7/,
  );
});

// A stand-in for `vega`: records each call and answers with the next result.
const vegaAnswering = (...results: object[]) => {
  const calls: string[][] = [];
  const run = (args: string[]) => {
    calls.push(args);
    return results[calls.length - 1];
  };
  return { calls, run };
};

const quiet = { log: () => {}, warn: () => {} };
const VPKG = '/n/build/armv7-release/dicechess-tv-native_armv7.vpkg';

test("the copy is the package's name in the device's /tmp", () => {
  assert.equal(pushedPath(VPKG), '/tmp/dicechess-tv-native_armv7.vpkg');
  assert.equal(
    removeCommand('/home/me/a b (2).vpkg'),
    'rm -f "/tmp/a b (2).vpkg"',
  );
  // run-cmd sends the command inside single quotes: a name that would end
  // them, or that the double quotes would expand, is never sent.
  for (const name of ["it's.vpkg", 'a"b.vpkg', '$(reboot).vpkg', 'a`b`.vpkg'])
    assert.throws(() => removeCommand(`/x/${name}`), /cannot quote/);
});

test('the copy is removed from the device the package was installed on', () => {
  const vega = vegaAnswering({ status: 0 }, { status: 0 });
  assert.equal(
    installPackage('VirtualDevice', VPKG, { ...quiet, run: vega.run }),
    0,
  );
  assert.deepEqual(vega.calls, [
    ['device', 'install-app', '-d', 'VirtualDevice', '-p', VPKG],
    [
      'device',
      'run-cmd',
      '-d',
      'VirtualDevice',
      '-c',
      'rm -f "/tmp/dicechess-tv-native_armv7.vpkg"',
    ],
  ]);
});

test('the copy is removed after a failed install too', () => {
  const vega = vegaAnswering({ status: 3 }, { status: 0 });
  assert.equal(installPackage('stick', VPKG, { ...quiet, run: vega.run }), 3);
  assert.equal(vega.calls.length, 2);
  assert.deepEqual(vega.calls[1].slice(0, 4), [
    'device',
    'run-cmd',
    '-d',
    'stick',
  ]);
  // An install that could not even start still counts as failed.
  const unstarted = vegaAnswering({ status: null }, { status: 0 });
  assert.equal(
    installPackage('stick', VPKG, { ...quiet, run: unstarted.run }),
    1,
  );
});

test('a copy that cannot be removed is reported, and the install still succeeds', () => {
  const warnings: string[] = [];
  const warn = (line: string) => warnings.push(line);
  const vega = vegaAnswering(
    { status: 0 },
    { status: 1, stdout: '', stderr: 'error: device offline\n' },
  );
  assert.equal(
    installPackage('stick', VPKG, { ...quiet, run: vega.run, warn }),
    0,
  );
  assert.equal(warnings.length, 1);
  assert.match(
    warnings[0],
    /\/tmp\/dicechess-tv-native_armv7\.vpkg is still on stick/,
  );
  assert.match(warnings[0], /device offline/);
  assert.match(warnings[0], /vega device run-cmd -d stick -c 'rm -f \/tmp\//);

  // A name that cannot be quoted is reported the same way, and never sent.
  const unquotable = vegaAnswering({ status: 0 });
  assert.equal(
    installPackage('stick', "/x/it's.vpkg", {
      ...quiet,
      run: unquotable.run,
      warn,
    }),
    0,
  );
  assert.equal(unquotable.calls.length, 1);
  assert.match(warnings[1], /cannot quote/);
});

// What spawnSync answers when the command is not on the PATH: an error, no
// status and no output.
const notFound = () => ({
  error: Object.assign(new Error('spawnSync vega ENOENT'), { code: 'ENOENT' }),
  status: null,
  stdout: undefined,
  stderr: undefined,
});

test('a missing Vega CLI is reported as missing', () => {
  assert.throws(
    () => vega(['device', 'run-cmd'], {}, notFound),
    /^Error: vega CLI not found on PATH: install the Vega SDK/,
  );
  // Any other failure to start it names the failure.
  const denied = () => ({
    error: Object.assign(new Error('spawnSync vega EACCES'), {
      code: 'EACCES',
    }),
    status: null,
  });
  assert.throws(
    () => vega(['device', 'list'], {}, denied),
    /^Error: vega device: spawnSync vega EACCES$/,
  );
  // A CLI that ran is answered as it answered, whatever its status.
  const ran = { status: 2, stdout: '', stderr: 'no device\n' };
  const calls: unknown[][] = [];
  assert.equal(
    vega(['device', 'list'], { stdio: 'inherit' }, (...args: unknown[]) => {
      calls.push(args);
      return ran;
    }),
    ran,
  );
  assert.deepEqual(calls, [
    ['vega', ['device', 'list'], { encoding: 'utf8', stdio: 'inherit' }],
  ]);
});

test('npm run device without the Vega CLI says so, not a TypeError', (t) => {
  const empty = mkdtempSync(join(tmpdir(), 'no-vega-'));
  t.after(() => rmSync(empty, { recursive: true, force: true }));
  const script = join(
    dirname(fileURLToPath(import.meta.url)),
    '../scripts/install.mjs',
  );
  const run = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: { ...process.env, PATH: empty },
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^install: vega CLI not found on PATH/);
  assert.doesNotMatch(run.stderr, /TypeError/);
});

test('a vega command that fails is reported by what it said, or its exit status', () => {
  assert.equal(
    failureOf({ status: 1, stdout: 'out\n', stderr: 'error: offline\n' }),
    'error: offline',
  );
  assert.equal(
    failureOf({ status: 1, stdout: 'only out\n', stderr: '' }),
    'only out',
  );
  // Blank error output gives way to the output.
  assert.equal(
    failureOf({ status: 1, stdout: 'error: no such package\n', stderr: ' \n' }),
    'error: no such package',
  );
  // With its output inherited, or with nothing said, the status is all there is.
  assert.equal(
    failureOf({ status: 4, stdout: null, stderr: null }),
    'exit status 4',
  );
  assert.equal(failureOf({ status: 2 }), 'exit status 2');

  const unreachable = vegaAnswering({
    status: 1,
    stdout: '',
    stderr: 'error: device stick not found\n',
  });
  assert.throws(
    () => deviceArch('stick', unreachable.run),
    /^Error: cannot reach stick: error: device stick not found$/,
  );
  assert.deepEqual(unreachable.calls, [
    ['device', 'run-cmd', '-d', 'stick', '-c', 'uname -m'],
  ]);
  const silent = vegaAnswering({ status: 255 });
  assert.throws(
    () => deviceArch('stick', silent.run),
    /^Error: cannot reach stick: exit status 255$/,
  );
  assert.equal(
    deviceArch(
      'VirtualDevice',
      vegaAnswering({ status: 0, stdout: 'Running...\naarch64\n', stderr: '' })
        .run,
    ),
    'aarch64',
  );

  const unlisted = vegaAnswering({ status: 3 });
  assert.throws(
    () => listPackage('a.vpkg', unlisted.run),
    /^Error: vpt cannot list a\.vpkg: exit status 3$/,
  );
  assert.deepEqual(unlisted.calls, [
    ['exec', 'vpt', 'show-contents', 'a.vpkg'],
  ]);
});
