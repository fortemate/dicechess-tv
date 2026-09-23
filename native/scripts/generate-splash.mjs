// Builds the two pieces of artwork the package ships: the application icon and
// the native splash screen.
//
// Vega wants `assets/raw/SplashScreenImages.zip`, and inside it a `desc.txt`
// naming the frame size and rate, plus a `_loop` directory of PNG frames. Ours
// is one frame: a still image, which the descriptor loops forever until the app
// says it has drawn.
//
// The splash is the Fortemate mark on the board's own background, so it and the
// first frame of the application are the same colour and the handover is
// invisible. The icon is the brand's maskable export, copied unchanged: the
// launcher fits a square icon into a wide tile, and a maskable icon is the one
// built to survive that.
//
// Neither is redrawn here. Both sources are verbatim brand exports; see
// ../brand/README.md.
//
// No dependencies: the sources are 8-bit PNG without interlacing, which is the
// one case worth decoding by hand, and `zip` is on every machine that can build
// this package.
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync, inflateSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

// A television frame. 4K is not supported by the animation service.
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;

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

// Returns { width, height, channels, pixels }. Handles the two colour types
// involved here: the mark is RGBA, the frame this script writes is RGB.
// Exported so a test can read back what was written rather than trusting it.
export const decodePng = (file) => {
  const png = readFileSync(file);
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
    throw new Error(`${file} is not a PNG`);

  let width = 0;
  let height = 0;
  let channels = 4;
  const parts = [];
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at);
    const type = png.toString('ascii', at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const [depth, colour, interlace] = [body[8], body[9], body[12]];
      if (depth !== 8 || (colour !== 6 && colour !== 2) || interlace !== 0)
        throw new Error(
          `${file}: expected 8-bit RGB or RGBA without interlacing, got depth ${depth} colour ${colour} interlace ${interlace}`,
        );
      channels = colour === 6 ? 4 : 3;
    }
    if (type === 'IDAT') parts.push(body);
    if (type === 'IEND') break;
    at += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft =
        x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels] : 0;
      let value = line[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) value += paeth(left, up, upLeft);
      else if (filter !== 0)
        throw new Error(`${file}: unknown filter ${filter}`);
      pixels[y * stride + x] = value & 0xff;
    }
  }
  return { width, height, channels, pixels };
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
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

export const SPLASH = { WIDTH, HEIGHT, FPS, BACKGROUND };

export const main = () => {
  // The icon ships exactly as the brand drew it.
  const iconSource = join(root, 'brand/pwa-maskable-512.png');
  const icon = join(root, 'assets/image/icon.png');
  mkdirSync(dirname(icon), { recursive: true });
  copyFileSync(iconSource, icon);

  const mark = decodePng(join(root, 'brand/fortemate-mark-512-white.png'));
  if (mark.width > WIDTH || mark.height > HEIGHT)
    throw new Error('the mark does not fit the frame');

  // Centred, and on whole pixels, so the mark is copied rather than resampled.
  const left = (WIDTH - mark.width) >> 1;
  const top = (HEIGHT - mark.height) >> 1;

  const frame = Buffer.alloc(WIDTH * HEIGHT * 3);
  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    frame[i * 3] = BACKGROUND[0];
    frame[i * 3 + 1] = BACKGROUND[1];
    frame[i * 3 + 2] = BACKGROUND[2];
  }
  for (let y = 0; y < mark.height; y++) {
    for (let x = 0; x < mark.width; x++) {
      const source = (y * mark.width + x) * 4;
      const alpha = mark.pixels[source + 3];
      if (alpha === 0) continue;
      const target = ((top + y) * WIDTH + left + x) * 3;
      for (let c = 0; c < 3; c++) {
        const over = mark.pixels[source + c];
        const under = frame[target + c];
        frame[target + c] = Math.round(
          (over * alpha + under * (255 - alpha)) / 255,
        );
      }
    }
  }

  // Staged outside assets/, because only the zip belongs in the package.
  const staging = join(root, 'build/splash');
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(join(staging, '_loop'), { recursive: true });

  const framePath = join(staging, '_loop/loop00000.png');
  writeFileSync(framePath, encodePng(WIDTH, HEIGHT, frame));

  // Line 1: frame size and rate. Line 2: keep the assets, loop forever, no
  // delay, and read the frames from `_loop`.
  const descriptorPath = join(staging, 'desc.txt');
  writeFileSync(descriptorPath, `${WIDTH} ${HEIGHT} ${FPS}\nc 0 0 _loop\n`);

  // A fixed timestamp keeps the archive byte-identical between builds. The
  // directory entry carries one of its own, so it is stamped too.
  const epoch = new Date('2020-01-01T00:00:00Z');
  for (const path of [framePath, descriptorPath, join(staging, '_loop')])
    utimesSync(path, epoch, epoch);

  const destination = join(root, 'assets/raw/SplashScreenImages.zip');
  mkdirSync(dirname(destination), { recursive: true });
  rmSync(destination, { force: true });
  // -X drops the extra attributes that would differ between machines. Built
  // from inside the staging directory so the archive has no wrapping folder:
  // the animation service looks for `_loop` and `desc.txt` at the root and
  // finds neither if one is added.
  execFileSync('zip', ['-q', '-X', '-r', destination, '_loop', 'desc.txt'], {
    cwd: staging,
  });

  return {
    framePath,
    descriptorPath,
    destination,
    icon,
    iconSource,
    left,
    top,
  };
};

// Only when run as a script, so a test can import the pieces above.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { destination, icon, left, top } = main();
  const shown = (path) => path.replace(`${root}/`, '');
  console.log(`icon:   ${shown(icon)}`);
  console.log(
    `splash: ${WIDTH}x${HEIGHT}, mark at ${left},${top} -> ${shown(destination)}`,
  );
}
