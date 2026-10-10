// Installs the built package that suits the device's processor, and launches
// it on request.
//
//   node scripts/install.mjs [--device <id>] [--vpkg <path>] [--launch]
//
// The device defaults to the Vega Virtual Device; a Fire TV Stick is named by
// its id from `vega device list`.
//
// A build writes one package per processor, and each carries the MMKV native
// library only for its own: lib/aarch64/, lib/armv7/ or lib/x86_64/.
// `vega device install-app` installs any of them on any device without a word,
// and the wrong one dies at start. react-native-mmkv's TurboModule is then
// missing, and the log says only `ModuleNotFoundError` in `getMMKVTurboModule`
// (friction log FL-30). So this asks the device what it runs on first:
// - the Virtual Device is aarch64 on an Apple silicon Mac and x86_64 elsewhere;
// - a Fire TV Stick is armv7.
// It refuses a package built for another processor, `--vpkg` included.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const native = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const APP = 'com.fortemate.dicechesstv.main';

// The package's processor for what `uname -m` prints on the device.
export const archOf = (machine) => {
  const name = machine.trim();
  if (name === 'aarch64' || name === 'arm64') return 'aarch64';
  if (/^armv7/.test(name)) return 'armv7';
  if (name === 'x86_64') return 'x86_64';
  throw new Error(
    `no package is built for a "${name}" processor: expected aarch64, armv7 or x86_64`,
  );
};

export const packagePath = (arch, root = native) =>
  join(root, 'build', `${arch}-release`, `dicechess-tv-native_${arch}.vpkg`);

// The processor a package is for, from the native libraries in its file list:
// one directory under lib/, and only one.
export const archOfListing = (listing) => {
  const arches = new Set(
    listing
      .split('\n')
      .map((line) => /^lib\/([^/]+)\//.exec(line.trim())?.[1])
      .filter(Boolean),
  );
  if (arches.size !== 1)
    throw new Error(
      `expected native libraries for one processor under lib/, found ${arches.size ? [...arches].join(', ') : 'none'}`,
    );
  return [...arches][0];
};

// Read from the package itself when tar can open it (a .vpkg is a
// zstd-compressed tar, so tar needs zstd on the PATH); from the name the build
// gives it otherwise.
export const archOfPackage = (vpkg) => {
  try {
    const listing = execFileSync('tar', ['-tf', vpkg], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return archOfListing(listing);
  } catch {
    const named = /_(aarch64|armv7|x86_64)\.vpkg$/.exec(basename(vpkg))?.[1];
    if (named) return named;
    throw new Error(
      `cannot tell which processor ${vpkg} is for: tar cannot read it (is zstd on the PATH?) and its name does not say`,
    );
  }
};

const vega = (args, options = {}) =>
  spawnSync('vega', args, { encoding: 'utf8', ...options });

// `run-cmd` prints the command's output, on stdout or stderr, after its own
// lines: the machine name is the last line that is one word.
export const machineOf = (output) =>
  output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[A-Za-z0-9_]+$/.test(line))
    .at(-1) ?? '';

const parse = (argv) => {
  const options = { device: 'VirtualDevice', vpkg: null, launch: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--launch') options.launch = true;
    else if (arg === '--device' && argv[i + 1]) options.device = argv[++i];
    else if (arg === '--vpkg' && argv[i + 1]) options.vpkg = resolve(argv[++i]);
    else
      throw new Error(
        `unknown argument ${arg}. Usage: install.mjs [--device <id>] [--vpkg <path>] [--launch]`,
      );
  }
  return options;
};

export const main = (argv = process.argv.slice(2)) => {
  const { device, vpkg, launch } = parse(argv);
  const probe = vega(['device', 'run-cmd', '-d', device, '-c', 'uname -m']);
  if (probe.status !== 0)
    throw new Error(
      `cannot reach ${device}: ${(probe.stderr || probe.stdout).trim()}`,
    );
  const arch = archOf(machineOf(`${probe.stdout}\n${probe.stderr}`));
  const path = vpkg ?? packagePath(arch);
  if (!existsSync(path))
    throw new Error(
      `${path} does not exist: build it first with npm run build --prefix native`,
    );
  const built = archOfPackage(path);
  if (built !== arch)
    throw new Error(
      `${basename(path)} is built for ${built}, but ${device} runs on ${arch}: it would install and then crash at start (friction log FL-30)`,
    );
  console.log(`${device} runs on ${arch}: installing ${path}`);
  const install = vega(['device', 'install-app', '-d', device, '-p', path], {
    stdio: 'inherit',
  });
  if (install.status !== 0) process.exit(install.status ?? 1);
  if (launch) {
    const run = vega(['device', 'launch-app', '-d', device, '-a', APP], {
      stdio: 'inherit',
    });
    if (run.status !== 0) process.exit(run.status ?? 1);
  }
};

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main();
  } catch (error) {
    console.error(`install: ${error.message}`);
    process.exit(1);
  }
}
