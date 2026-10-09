// The splash is the one asset nothing else would catch. It is generated, it is
// never imported by any code, and nobody looks at a television boot screen in
// CI — so a wrong colour, a title off the safe area or a blurred mark would
// ship in silence.
//
// Every assertion here reads the file that was actually written, not the
// buffer that was meant to be written, except where a test draws the scene
// itself to try both medallions: CI has no private portraits.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error — a build script, deliberately plain JavaScript.
import { decodePng, main, SPLASH } from '../scripts/generate-assets.mjs';
import {
  CREDIT,
  DICE,
  HAT_BLUE,
  MEDALLION,
  MOTION,
  REST_FRAME,
  splashRenderer,
  // @ts-expect-error — a build script, deliberately plain JavaScript.
} from '../scripts/splash.mjs';

const NATIVE = join(dirname(fileURLToPath(import.meta.url)), '..');

// The generator runs on a temporary root holding copies of its inputs, as in
// test/assets.test.ts, so a test run never rewrites the real assets/ that a
// build packages. The portraits come too when this checkout has them, so the
// medallion is the one this checkout would build.
const root = mkdtempSync(join(tmpdir(), 'dicechess-tv-splash-'));
after(() => rmSync(root, { recursive: true, force: true }));
for (const input of [
  'icon',
  'brand',
  'splash',
  'sounds',
  'music',
  'voices',
  'portraits',
])
  if (existsSync(join(NATIVE, input)))
    cpSync(join(NATIVE, input), join(root, input), { recursive: true });

const built = main(root) as {
  framePaths: string[];
  descriptorPath: string;
  destination: string;
  icon: string;
  iconSource: string;
  thinkle: boolean;
};

type Frame = {
  width: number;
  height: number;
  channels: number;
  pixels: Buffer;
};
const frames = built.framePaths.map((path) => decodePng(path) as Frame);
// The pose most launches hand over on: the dice hovering on their orbit.
const frame = frames[REST_FRAME];

const at = (x: number, y: number) => {
  const base = (y * frame.width + x) * frame.channels;
  return [frame.pixels[base], frame.pixels[base + 1], frame.pixels[base + 2]];
};

const near = (pixel: number[], rgb: number[], tolerance = 6) =>
  pixel.every((value, i) => Math.abs(value - rgb[i]) <= tolerance);

const hex = (colour: string) =>
  [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16));

const IVORY = hex('#f4ead8');

test('every frame is a television frame, not a 4K one the service would refuse', () => {
  assert.equal(frames.length, MOTION.frames);
  for (const each of frames) {
    assert.equal(each.width, 1920);
    assert.equal(each.height, 1080);
    assert.equal(
      each.channels,
      3,
      'an alpha channel would leave the compositor to blend',
    );
  }
});

// The title and the credit are what a cut at any frame must still show, so
// only the right side, where Thinkle conjures, may change.
test('the title and the credit stand still in every frame', () => {
  const left = (each: Frame) => {
    const rows = [];
    for (let y = 0; y < 1080; y++)
      rows.push(each.pixels.subarray(y * 1920 * 3, (y * 1920 + 800) * 3));
    return Buffer.concat(rows);
  };
  const first = left(frames[0]);
  frames.forEach((each, i) =>
    assert.ok(left(each).equals(first), `frame ${i} moved the left side`),
  );
});

// Vega plays the frames in a loop, so the last must lead into the first
// without a jump.
test('the loop closes without a jump', () => {
  const last = frames[frames.length - 1].pixels;
  const first = frames[0].pixels;
  let changed = 0;
  for (let i = 0; i < first.length; i += 3)
    if (
      Math.abs(first[i] - last[i]) > 24 ||
      Math.abs(first[i + 1] - last[i + 1]) > 24 ||
      Math.abs(first[i + 2] - last[i + 2]) > 24
    )
      changed++;
  assert.ok(changed / (1920 * 1080) < 0.01, `${changed} pixels jump`);
});

test('the background is the board colour, so the handover is invisible', () => {
  // THEME.background, #122737. If the app changes it, this fails rather than
  // leaving a seam between the splash and the first frame.
  assert.deepEqual(SPLASH.BACKGROUND, [0x12, 0x27, 0x37]);
  for (const [x, y] of [
    [0, 0],
    [frame.width - 1, 0],
    [0, frame.height - 1],
    [frame.width - 1, frame.height - 1],
    [40, 540],
  ])
    assert.deepEqual(at(x, y), SPLASH.BACKGROUND, `corner ${x},${y}`);
});

test('everything stays inside the five per cent a television may crop', () => {
  let minX = 1920;
  let minY = 1080;
  let maxX = -1;
  let maxY = -1;
  const [r, g, b] = SPLASH.BACKGROUND;
  for (const { pixels } of frames)
    for (let y = 0; y < 1080; y++)
      for (let x = 0; x < 1920; x++) {
        const i = (y * 1920 + x) * 3;
        if (pixels[i] === r && pixels[i + 1] === g && pixels[i + 2] === b)
          continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
  assert.ok(maxX > 0, 'the frame is empty');
  assert.ok(
    minX >= 96 && maxX < 1824 && minY >= 54 && maxY < 1026,
    `artwork spans ${minX}..${maxX} x ${minY}..${maxY}`,
  );
});

test('the title leads: two lines of large ivory letters on the left', () => {
  let top = frame.height;
  let bottom = -1;
  let ink = 0;
  for (let y = 54; y < 760; y++)
    for (let x = 96; x < 800; x++)
      if (near(at(x, y), IVORY)) {
        ink++;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
  assert.ok(ink > 100000, `only ${ink} ivory pixels: is the title drawn?`);
  // "Dice" over "Chess": from the D's top to the baseline of the second line.
  assert.ok(bottom - top > 320, `the title is ${bottom - top} px tall`);
});

test('the mark sits on whole pixels beside the name, so it stays crisp', () => {
  // 56 px for a 14-unit canvas: 16 px cells, 4 px gaps. The middle of the
  // first cell is white, and so is the last pixel of it; the gap after it is
  // the background, with nothing blurred between.
  const top = CREDIT.base - CREDIT.cap / 2 - CREDIT.mark / 2;
  const row = top + 8;
  assert.deepEqual(at(CREDIT.x + 8, row), [255, 255, 255]);
  assert.deepEqual(at(CREDIT.x + 15, row), [255, 255, 255]);
  assert.deepEqual(at(CREDIT.x + 17, row), SPLASH.BACKGROUND);
  assert.deepEqual(at(CREDIT.x + 20, row), [255, 255, 255]);
  // The name follows the mark, in white, on the same line.
  let white = 0;
  for (let y = CREDIT.base - CREDIT.cap; y <= CREDIT.base; y++)
    for (let x = CREDIT.x + CREDIT.mark + 10; x < CREDIT.x + 400; x++)
      if (near(at(x, y), [255, 255, 255], 2)) white++;
  assert.ok(white > 3000, `only ${white} white pixels in the name`);
});

test('at rest, the three dice show ivory faces on their orbit', () => {
  for (const { piece, x, y } of DICE)
    assert.ok(
      near(at(Math.round(x - 70), Math.round(y)), IVORY),
      `the ${piece} die is missing at ${Math.round(x)},${Math.round(y)}`,
    );
});

test('the medallion holds Thinkle, or his hat in a checkout without him', () => {
  const pixel = (rgb: Buffer, x: number, y: number) => {
    const i = (y * 1920 + x) * 3;
    return [rgb[i], rgb[i + 1], rgb[i + 2]];
  };
  // A stand-in portrait, since the real one is private: a plain magenta square.
  const standIn = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><rect width="2048" height="2048" fill="#ff00ff"/></svg>',
  );
  const drawn = splashRenderer(NATIVE, standIn)(REST_FRAME);
  assert.deepEqual(pixel(drawn, MEDALLION.cx, MEDALLION.cy), [255, 0, 255]);
  const hat = splashRenderer(NATIVE, null)(REST_FRAME);
  assert.ok(near(pixel(hat, 1440, 650), hex(HAT_BLUE), 2), 'no hat');
  // The build drew the one this checkout has.
  const medallion = at(1440, 650);
  assert.equal(near(medallion, hex(HAT_BLUE), 2), !built.thinkle);
});

test('the icon is the game icon from the asset repository, unchanged', () => {
  // Byte for byte, because the icon is drawn there and only copied here. If a
  // new export arrives, this fails until the copy is replaced on purpose.
  assert.deepEqual(readFileSync(built.icon), readFileSync(built.iconSource));
});

type Picture = {
  width: number;
  height: number;
  channels: number;
  pixels: Buffer;
};

// The launcher scales the square to fill a 3:2 tile and crops the top and
// bottom (measured on the virtual device, #83), so everything but the
// background must stay inside the middle band, with even margins left and
// right.
const BAND = { top: 100, bottom: 412, side: 51 };

// The background is taken to be what the four corners show, blended across the
// square, which reproduces a flat fill or a straight gradient exactly. A pixel
// more than a tenth of the range away from it is artwork, whatever its colour:
// a bright red die counts as much as a black outline.
function artworkOutsideBand({ width, height, channels, pixels }: Picture) {
  const rgb = (x: number, y: number) => {
    const base = (y * width + x) * channels;
    return [pixels[base], pixels[base + 1], pixels[base + 2]];
  };
  const [c00, c10, c01, c11] = [
    rgb(0, 0),
    rgb(width - 1, 0),
    rgb(0, height - 1),
    rgb(width - 1, height - 1),
  ];
  let artwork = 0;
  const strays: string[] = [];
  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      const off = rgb(x, y).map((value, i) =>
        Math.abs(
          value -
            (c00[i] * (1 - u) * (1 - v) +
              c10[i] * u * (1 - v) +
              c01[i] * (1 - u) * v +
              c11[i] * u * v),
        ),
      );
      if (Math.max(...off) <= 24) continue;
      artwork += 1;
      const inBand =
        y >= BAND.top &&
        y < BAND.bottom &&
        x >= BAND.side &&
        x < width - BAND.side;
      if (!inBand) strays.push(`${x},${y}`);
    }
  }
  return { artwork, strays };
}

test('the icon survives being cropped into the launcher tile', () => {
  const icon = decodePng(built.icon) as Picture;
  assert.equal(icon.width, 512);
  assert.equal(icon.height, 512);

  // Opaque everywhere: a transparent icon came out distorted in the launcher.
  if (icon.channels === 4)
    for (let i = 3; i < icon.pixels.length; i += 4)
      assert.equal(icon.pixels[i], 255, 'the icon has a transparent pixel');

  const { artwork, strays } = artworkOutsideBand(icon);
  assert.equal(
    strays.length,
    0,
    `${strays.length} artwork pixels sit outside the launcher's band and can be cropped away, the first at ${strays[0]}`,
  );
  assert.ok(
    artwork > 10000,
    `only ${artwork} artwork pixels: is this the icon?`,
  );
});

test('the crop check sees artwork of any colour outside the band', () => {
  // The icon's own gradient, with a dark block inside the band.
  const width = 512;
  const height = 512;
  const pixels = Buffer.alloc(width * height * 3);
  const paint = (x: number, y: number, colour: number[]) =>
    pixels.set(colour, (y * width + x) * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const t = (x + y) / (width + height - 2);
      paint(x, y, [255 - 38 * t, 138 - 73 * t, 61 - 18 * t].map(Math.round));
    }
  for (let y = 200; y < 300; y++)
    for (let x = 200; x < 300; x++) paint(x, y, [26, 26, 26]);
  const picture = { width, height, channels: 3, pixels };
  assert.deepEqual(artworkOutsideBand(picture), { artwork: 10000, strays: [] });

  // Bright and saturated like the background, so only its difference from the
  // background gives it away: once above the band, once in the side margin.
  paint(256, 40, [255, 220, 0]);
  paint(20, 256, [255, 220, 0]);
  assert.deepEqual(artworkOutsideBand(picture).strays, ['256,40', '20,256']);
});

test('the descriptor says what the animation service expects', () => {
  assert.equal(
    readFileSync(built.descriptorPath, 'utf8'),
    `${SPLASH.WIDTH} ${SPLASH.HEIGHT} ${SPLASH.FPS}\nc 0 0 _loop\n`,
  );
});

// Vega has to unpack the whole archive before the first frame; a 17 MB one
// appeared only after the game did (#290). With Thinkle the archive is about
// 3.02 MB, the size the Stick showed when the animation was approved (#293).
// The limit leaves room for either Node's zlib, but not for one more frame.
test('the archive stays under 3.1 MB', () => {
  const size = statSync(built.destination).size;
  assert.ok(size < 3_100_000, `the archive is ${size} bytes`);
});

test('the archive has no wrapping folder and keeps the frames in playback order', () => {
  const listed = execFileSync('unzip', ['-Z1', built.destination], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
  assert.deepEqual(listed, [
    '_loop/',
    ...Array.from(
      { length: MOTION.frames },
      (_, i) => `_loop/loop${String(i).padStart(5, '0')}.png`,
    ),
    'desc.txt',
  ]);
});
