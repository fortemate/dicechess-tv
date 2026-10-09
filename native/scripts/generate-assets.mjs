// Builds what the package ships under assets/: the application icon, the native
// splash screen, the game's sounds, its music, the bots' voices and, when the
// checkout has them, the opponents' portraits. The build packages the whole
// directory, so it belongs to this script alone: every run deletes it and writes
// it afresh (#122).
//
// Vega wants `assets/raw/SplashScreenImages.zip`, and inside it a `desc.txt`
// naming the frame size and rate, plus a `_loop` directory of PNG frames, which
// the descriptor loops forever until the app has drawn. Vega repeats the whole
// archive whatever count desc.txt gives, so ours is a loop that ends where it
// starts (#289).
//
// The frames are "Thinkle conjures", drawn by ./splash.mjs on the app's own
// background, so the handover has no change of colour. They need Thinkle's
// vector from the private portrait pack; a checkout without it draws his hat
// instead. ../splash/README.md covers the scene, its fonts and its sizes.
//
// The icon is the game's own, copied unchanged: the launcher fits a square icon
// into a wide tile, and this one was made to survive that.
//
// The PNG work is done by hand here: the frames are written as plain RGB, and
// the tests read them back with the decoder below. `zip` is on every machine that can
// build this package.
//
// The frames are compressed with fflate, not node:zlib, whose output depends on
// how Node was built: the official builds, CI's included, carry Chromium's
// zlib, Homebrew's links the system one, and the same frames came out 74 KB
// apart. fflate is plain JavaScript, so every machine writes the same archive,
// and a smaller one (../splash/README.md, Size).
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { zlibSync } from 'fflate';
import { MOTION, splashRenderer } from './splash.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// The application's directory. The functions below take it as `root`, so a test
// can build into a temporary one instead.
const native = resolve(here, '..');

// A television frame. 4K is not supported by the animation service.
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = MOTION.fps;

// THEME.background in src/theme.ts. If one changes, change both.
const BACKGROUND = [0x12, 0x27, 0x37];

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
};

// The value each PNG filter predicted from a byte's neighbours, which the
// stored byte is relative to: None, Sub, Up, Average and Paeth.
const PREDICTORS = [
  () => 0,
  (left) => left,
  (left, up) => up,
  (left, up) => (left + up) >> 1,
  paeth,
];

// The image header. Only the two colour types involved here are accepted: the
// icon is RGBA, the frame this script writes is RGB.
const readHeader = (body, file) => {
  const [depth, colour, interlace] = [body[8], body[9], body[12]];
  if (depth !== 8 || (colour !== 6 && colour !== 2) || interlace !== 0)
    throw new Error(
      `${file}: expected 8-bit RGB or RGBA without interlacing, got depth ${depth} colour ${colour} interlace ${interlace}`,
    );
  return {
    width: body.readUInt32BE(0),
    height: body.readUInt32BE(4),
    channels: colour === 6 ? 4 : 3,
  };
};

// The header's fields and the image data, walking the chunks up to IEND.
const readChunks = (png, file) => {
  const image = { width: 0, height: 0, channels: 4, parts: [] };
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at);
    const type = png.toString('ascii', at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') Object.assign(image, readHeader(body, file));
    if (type === 'IDAT') image.parts.push(body);
    if (type === 'IEND') break;
    at += 12 + length;
  }
  return image;
};

// The bytes to the left of, above and above-left of the one at `at`, with 0
// for any that fall off the image.
const neighbours = (pixels, at, x, y, stride, channels) => {
  const hasLeft = x >= channels;
  const hasUp = y > 0;
  return [
    hasLeft ? pixels[at - channels] : 0,
    hasUp ? pixels[at - stride] : 0,
    hasLeft && hasUp ? pixels[at - stride - channels] : 0,
  ];
};

// Undoes each line's filter, returning the pixel bytes.
const unfilter = (raw, { width, height, channels }, file) => {
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const predict = PREDICTORS[filter];
    if (stride > 0 && !predict)
      throw new Error(`${file}: unknown filter ${filter}`);
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x;
      const [left, up, upLeft] = neighbours(pixels, at, x, y, stride, channels);
      pixels[at] = (line[x] + predict(left, up, upLeft)) & 0xff;
    }
  }
  return pixels;
};

// Returns { width, height, channels, pixels }. Exported so a test can read back
// what was written rather than trusting it.
export const decodePng = (file) => {
  const png = readFileSync(file);
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
    throw new Error(`${file} is not a PNG`);
  const { parts, ...image } = readChunks(png, file);
  const pixels = unfilter(inflateSync(Buffer.concat(parts)), image, file);
  return { ...image, pixels };
};

const chunk = (type, body) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])) >>> 0, 0);
  return Buffer.concat([head, body, tail]);
};

// Opaque RGB, so the frame carries no alpha the compositor would have to blend.
const encodePng = (width, height, rgb) => {
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none, which deflate handles well on flat colour
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header),
    chunk('IDAT', Buffer.from(zlibSync(raw, { level: 9 }))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

export const SPLASH = { WIDTH, HEIGHT, FPS, BACKGROUND };

export const main = (root = native) => {
  // Nothing may be there that this run did not write: a file left by an earlier
  // run, another branch or a hand copy would ship with the game.
  rmSync(join(root, 'assets'), { recursive: true, force: true });

  // The game icon ships exactly as the asset repository exported it.
  const iconSource = join(root, 'icon/icon-512.png');
  const icon = join(root, 'assets/image/icon.png');
  mkdirSync(dirname(icon), { recursive: true });
  copyFileSync(iconSource, icon);

  // The portraits first: they refuse a pack the app does not look for, and the
  // splash draws Thinkle from the same pinned pack.
  const portraits = copyPortraits(root);
  const thinkle = portraitVector(root, 'thinkle.svg');
  const render = splashRenderer(root, thinkle);

  // Staged outside assets/, because only the zip belongs in the package.
  const staging = join(root, 'build/splash');
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(join(staging, '_loop'), { recursive: true });

  // The documented names, loop00000.png on, one per frame of the loop.
  const framePaths = Array.from({ length: MOTION.frames }, (_, i) => {
    const path = join(staging, `_loop/loop${String(i).padStart(5, '0')}.png`);
    writeFileSync(path, encodePng(WIDTH, HEIGHT, render(i)));
    return path;
  });

  // Line 1: frame size and rate. Line 2: keep the assets, loop forever, no
  // delay, and read the frames from `_loop`.
  const descriptorPath = join(staging, 'desc.txt');
  writeFileSync(descriptorPath, `${WIDTH} ${HEIGHT} ${FPS}\nc 0 0 _loop\n`);

  // A fixed timestamp keeps the archive byte-identical between builds. The
  // directory entry carries one of its own, so it is stamped too.
  const epoch = new Date('2020-01-01T00:00:00Z');
  for (const path of [...framePaths, descriptorPath, join(staging, '_loop')])
    utimesSync(path, epoch, epoch);

  const destination = join(root, 'assets/raw/SplashScreenImages.zip');
  mkdirSync(dirname(destination), { recursive: true });
  rmSync(destination, { force: true });
  // -X drops the extra attributes that would differ between machines, and zip
  // stamps entries in local time, so it runs in UTC. Built from inside the
  // staging directory so the archive has no wrapping folder: the animation
  // service looks for `_loop` and `desc.txt` at the root and finds neither if
  // one is added. The frames are named one by one, in playback order: the
  // service takes them in archive order, and a recursive walk of the folder
  // can list them in another (#290). PNG is already compressed, so -0 stores
  // them as they are.
  execFileSync(
    'zip',
    [
      '-q',
      '-0',
      '-X',
      destination,
      '_loop/',
      ...framePaths.map((path) => `_loop/${basename(path)}`),
      'desc.txt',
    ],
    { cwd: staging, env: { ...process.env, TZ: 'UTC' } },
  );

  return {
    framePaths,
    descriptorPath,
    destination,
    icon,
    iconSource,
    thinkle: thinkle !== null,
    sounds: copySounds(root),
    music: copyMusic(root),
    voices: copyVoices(root),
    portraits,
  };
};

// The vendored sounds go where the player looks for them: assets/sfx/<pack>/,
// which is /pkg/assets/sfx/<pack>/ on the device. Only the files the lock lists,
// and only if their bytes are still the bytes the lock pinned — a vendored file
// edited by hand stops the build rather than shipping.
export const copySounds = (root = native) => {
  const lock = JSON.parse(
    readFileSync(join(root, 'sounds/sounds.lock.json'), 'utf8'),
  );
  const target = join(root, 'assets/sfx');
  rmSync(target, { recursive: true, force: true });
  const copied = [];
  for (const [pack, { files }] of Object.entries(lock.packs)) {
    for (const [name, { sha256 }] of Object.entries(files)) {
      if (!name.endsWith('.mp3')) continue;
      const bytes = readFileSync(join(root, 'sounds', pack, name));
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (digest !== sha256)
        throw new Error(
          `sounds/${pack}/${name} no longer matches sounds.lock.json`,
        );
      mkdirSync(join(target, pack), { recursive: true });
      writeFileSync(join(target, pack, name), bytes);
      copied.push(`${pack}/${name}`);
    }
  }
  return copied;
};

// The adaptive music (#76), when this checkout has it: scripts/vendor-music.mjs
// puts the tracks and their catalogue in music/. They go to assets/music/, which
// is /pkg/assets/music/ on the device, and only if each file still has the bytes
// the catalogue pinned. A checkout without music builds a game without it: the
// app finds no catalogue and plays none.
export const copyMusic = (root = native) => {
  const target = join(root, 'assets/music');
  rmSync(target, { recursive: true, force: true });
  const catalogue = join(root, 'music/music.json');
  if (!existsSync(catalogue)) return [];
  const bytes = readFileSync(catalogue);
  const { tracks } = JSON.parse(bytes.toString('utf8'));
  const copied = [];
  for (const { file, sha256 } of Object.values(tracks)) {
    if (copied.includes(file)) continue;
    const data = readFileSync(join(root, 'music', file));
    if (createHash('sha256').update(data).digest('hex') !== sha256)
      throw new Error(`music/${file} no longer matches music/music.json`);
    mkdirSync(dirname(join(target, file)), { recursive: true });
    writeFileSync(join(target, file), data);
    copied.push(file);
  }
  writeFileSync(join(target, 'music.json'), bytes);
  return copied;
};

// The opponents' portraits (dicechess-assets#31), when this checkout has them:
// scripts/vendor-portraits.mjs puts them in portraits/ with a lock, and git
// ignores that directory while the repository is public. They go to
// assets/portraits/<pack version>/, which is /pkg/assets/portraits/ on the
// device, and only if each still has the bytes the lock pinned. A checkout
// without them builds a game that shows the RhosGFX emoji faces
// (src/Portrait.tsx).
//
// The app looks for them only under the version src/Portrait.tsx names
// (`portraitsVersion`). A pack of any other version would ship and never load,
// and the game would show the emoji faces without a word, so the build refuses
// it instead.
//
// A vector (an .svg, since pack 1.4.0) is a build input for the splash and
// does not ship: the app draws only the PNG exports.
export const copyPortraits = (root = native, expected = portraitsVersion()) => {
  rmSync(join(root, 'assets/portraits'), { recursive: true, force: true });
  const lockPath = join(root, 'portraits/portraits.lock.json');
  if (!existsSync(lockPath)) return [];
  const { files, source } = JSON.parse(readFileSync(lockPath, 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(source?.version ?? ''))
    throw new Error('portraits/portraits.lock.json names no pack version');
  if (source.version !== expected)
    throw new Error(
      `portraits/ holds portrait pack ${source.version}, but src/Portrait.tsx ` +
        `looks for ${expected}: vendor that pack, or change PORTRAITS_VERSION`,
    );
  const target = join(root, 'assets/portraits', source.version);
  const copied = [];
  for (const [name, { sha256 }] of Object.entries(files)) {
    const data = readFileSync(join(root, 'portraits', name));
    if (createHash('sha256').update(data).digest('hex') !== sha256)
      throw new Error(
        `portraits/${name} no longer matches portraits/portraits.lock.json`,
      );
    if (name.endsWith('.svg')) continue;
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, name), data);
    copied.push(name);
  }
  return copied;
};

// A portrait vector pinned by the lock, for drawing at build time, or null in a
// checkout without the portraits. copyPortraits has already refused a pack of
// another version.
export const portraitVector = (root, name) => {
  const lockPath = join(root, 'portraits/portraits.lock.json');
  if (!existsSync(lockPath)) return null;
  const pinned = JSON.parse(readFileSync(lockPath, 'utf8')).files?.[name];
  if (!pinned) return null;
  const data = readFileSync(join(root, 'portraits', name));
  if (createHash('sha256').update(data).digest('hex') !== pinned.sha256)
    throw new Error(
      `portraits/${name} no longer matches portraits/portraits.lock.json`,
    );
  return data;
};

// The portrait pack version the app looks for: PORTRAITS_VERSION in
// src/Portrait.tsx, read from the source so the app and the build cannot hold
// two different numbers.
export const portraitsVersion = (root = native) => {
  const source = readFileSync(join(root, 'src/Portrait.tsx'), 'utf8');
  const match = /export const PORTRAITS_VERSION = '(\d+\.\d+\.\d+)';/.exec(
    source,
  );
  if (!match) throw new Error('src/Portrait.tsx names no PORTRAITS_VERSION');
  return match[1];
};

// The bots' voices (#159), vendored by scripts/vendor-voices.mjs into voices/.
// Their clips go to assets/voices/, which is /pkg/assets/voices/ on the device,
// and only if each still has the bytes voices/voices.json pinned.
export const copyVoices = (root = native) => {
  const target = join(root, 'assets/voices');
  rmSync(target, { recursive: true, force: true });
  const { lines } = JSON.parse(
    readFileSync(join(root, 'voices/voices.json'), 'utf8'),
  );
  const copied = [];
  for (const { file, sha256 } of Object.values(lines)) {
    const data = readFileSync(join(root, 'voices', file));
    if (createHash('sha256').update(data).digest('hex') !== sha256)
      throw new Error(`voices/${file} no longer matches voices/voices.json`);
    mkdirSync(dirname(join(target, file)), { recursive: true });
    writeFileSync(join(target, file), data);
    copied.push(file);
  }
  return copied;
};

// Only when run as a script, so a test can import the pieces above.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { destination, icon, thinkle, sounds, music, voices } = main();
  const shown = (path) => path.replace(`${native}/`, '');
  console.log(`icon:   ${shown(icon)}`);
  console.log(`sounds: ${sounds.length} files -> assets/sfx/`);
  console.log(
    music.length
      ? `music:  ${music.length} tracks -> assets/music/`
      : 'music:  none in this checkout (native/music/music.json absent)',
  );
  console.log(`voices: ${voices.length} clips -> assets/voices/`);
  console.log(
    `splash: ${WIDTH}x${HEIGHT}, ${MOTION.frames} frames at ${FPS} fps, ${thinkle ? 'Thinkle' : "Thinkle's hat (no portraits in this checkout)"} -> ${shown(destination)}`,
  );
}
