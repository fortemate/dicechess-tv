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
//
// It also removes the copy of the package that `vega device install-app` leaves
// in the device's /tmp, which on a Fire TV Stick is held in RAM (#379).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const native = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const APP = 'com.fortemate.dicechesstv.main';

// The package's processor for what `uname -m` prints on the device.
export const archOf = (machine) => {
  const name = machine.trim();
  if (name === 'aarch64' || name === 'arm64') return 'aarch64';
  if (name.startsWith('armv7')) return 'armv7';
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
      .map((line) => /^(?:\.\/)?lib\/([^/]+)\//.exec(line.trim())?.[1])
      .filter(Boolean),
  );
  if (arches.size !== 1)
    throw new Error(
      `expected native libraries for one processor under lib/, found ${arches.size ? [...arches].join(', ') : 'none'}`,
    );
  return [...arches][0];
};

// Runs the Vega CLI. Without it on the PATH, spawnSync answers with an ENOENT
// error and no output at all, which would surface as a TypeError on the
// missing output instead of the reason.
export const vega = (args, options = {}, spawn = spawnSync) => {
  const result = spawn('vega', args, { encoding: 'utf8', ...options });
  if (result.error?.code === 'ENOENT')
    throw new Error(
      'vega CLI not found on PATH: install the Vega SDK and put its vega command there',
    );
  if (result.error) throw new Error(`vega ${args[0]}: ${result.error.message}`);
  return result;
};

// What a vega command that failed said: its error output, else its output,
// else its exit status. Neither output is a string when it was inherited.
export const failureOf = (result) =>
  `${result.stderr || result.stdout || ''}`.trim() ||
  `exit status ${result.status}`;

// The package's file list, from the Vega SDK's own packaging tool, which reads
// the format without any other program on the PATH.
export const listPackage = (vpkg, run = vega) => {
  const listed = run(['exec', 'vpt', 'show-contents', vpkg]);
  if (listed.status !== 0)
    throw new Error(`vpt cannot list ${vpkg}: ${failureOf(listed)}`);
  return `${listed.stdout ?? ''}`;
};

// The processor a package is for, read from inside it. A package that cannot
// be listed is refused: its file name is not evidence of what it holds.
export const archOfPackage = (vpkg, list = listPackage) =>
  archOfListing(list(vpkg));

// `run-cmd` prints the command's output, on stdout or stderr, after its own
// lines: the machine name is the last line that is one word.
export const machineOf = (output) =>
  output
    .split('\n')
    .map((line) => line.trim())
    .findLast((line) => /^\w+$/.test(line)) ?? '';

// `vega device install-app` copies the package to the device's /tmp and installs
// it from there (SDK 0.24: `vda push`, then `vpm install`), and never deletes the
// copy. On a Fire TV Stick /tmp is a tmpfs held in RAM, about half of its 1 GB.
// Fifteen installs of a 31 MB package filled it: every measurement taken on the
// Stick meanwhile ran short of memory, and the next install failed with "No space
// left on device" (#379). So the copy is removed after every install.
export const pushedPath = (vpkg) => `/tmp/${basename(vpkg)}`;

// The device command that removes the copy. `run-cmd` hands it to the device's
// shell inside single quotes, so a name these double quotes cannot carry is
// refused rather than sent.
export const removeCommand = (vpkg) => {
  const path = pushedPath(vpkg);
  if (/["'$`\\]/.test(path))
    throw new Error(`cannot quote ${path} for the device's shell`);
  return `rm -f "${path}"`;
};

// Installs the package, then removes its copy from the device, after a failed
// install as well. `run-cmd` takes the same device id as `install-app`, so the
// Virtual Device is `VirtualDevice` here too, not its vda serial. Returns the
// install's exit status: a copy left behind is reported, and never fails an
// install that worked.
export const installPackage = (
  device,
  vpkg,
  { run = vega, log = console.log, warn = console.warn } = {},
) => {
  const install = run(['device', 'install-app', '-d', device, '-p', vpkg], {
    stdio: 'inherit',
  });
  const copy = pushedPath(vpkg);
  try {
    const removed = run([
      'device',
      'run-cmd',
      '-d',
      device,
      '-c',
      removeCommand(vpkg),
    ]);
    if (removed.status !== 0)
      throw new Error(removed.error?.message || failureOf(removed));
    log(`removed ${copy} from ${device}`);
  } catch (error) {
    warn(
      `install: ${copy} is still on ${device}, in its memory (${error.message}). Remove it with: vega device run-cmd -d ${device} -c 'rm -f ${copy}'`,
    );
  }
  return install.status ?? 1;
};

// The processor of the device, from `uname -m` run on it.
export const deviceArch = (device, run = vega) => {
  const probe = run(['device', 'run-cmd', '-d', device, '-c', 'uname -m']);
  if (probe.status !== 0)
    throw new Error(`cannot reach ${device}: ${failureOf(probe)}`);
  return archOf(machineOf(`${probe.stdout ?? ''}\n${probe.stderr ?? ''}`));
};

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
  const arch = deviceArch(device);
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
  const status = installPackage(device, path);
  if (status !== 0) process.exit(status);
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
