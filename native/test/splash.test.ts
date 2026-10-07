// The splash is the one asset nothing else would catch. It is generated, it is
// never imported by any code, and nobody looks at a television boot screen in
// CI — so a wrong colour or an off-centre mark would ship in silence.
//
// Every assertion here reads the file that was actually written, not the
// buffer that was meant to be written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
// @ts-expect-error — a build script, deliberately plain JavaScript.
import { decodePng, main, SPLASH } from '../scripts/generate-assets.mjs';

const built = main() as {
  framePath: string;
  framePaths: string[];
  holdPath: string;
  holdPaths: string[];
  descriptorPath: string;
  destination: string;
  icon: string;
  iconSource: string;
};

const frame = decodePng(built.framePath) as {
  width: number;
  height: number;
  channels: number;
  pixels: Buffer;
};

const at = (x: number, y: number) => {
  const base = (y * frame.width + x) * frame.channels;
  return [frame.pixels[base], frame.pixels[base + 1], frame.pixels[base + 2]];
};

test('the frame is a television frame, not a 4K one the service would refuse', () => {
  assert.equal(frame.width, 1920);
  assert.equal(frame.height, 1080);
  assert.equal(
    frame.channels,
    3,
    'an alpha channel would leave the compositor to blend',
  );
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

test('the final composition is centred and inside the television safe margins', () => {
  let minX = frame.width;
  let minY = frame.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      const [r, g, b] = at(x, y);
      if (
        r === SPLASH.BACKGROUND[0] &&
        g === SPLASH.BACKGROUND[1] &&
        b === SPLASH.BACKGROUND[2]
      )
        continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  assert.ok(maxX > 0, 'the frame is empty');

  // Equal margins on each side, within a pixel for an odd difference.
  assert.ok(
    Math.abs(minX - (frame.width - 1 - maxX)) <= 4,
    `composition is off-centre: ${minX} left, ${frame.width - 1 - maxX} right`,
  );
  assert.ok(minX >= 96 && maxX < 1824);
  assert.ok(minY >= 54 && maxY < 1026);
});

test('title and developer credit are legible and unchanged throughout the reveal', () => {
  const first = decodePng(built.framePaths[0]) as Picture;
  const titleEnd = frame.width * 454 * 3;
  const creditStart = frame.width * 900 * 3;
  for (const path of built.framePaths) {
    const picture = decodePng(path) as Picture;
    assert.equal(picture.width, 1920);
    assert.equal(picture.height, 1080);
    assert.equal(picture.channels, 3);
    assert.deepEqual(
      picture.pixels.subarray(0, titleEnd),
      first.pixels.subarray(0, titleEnd),
    );
    assert.deepEqual(
      picture.pixels.subarray(creditStart),
      first.pixels.subarray(creditStart),
    );
  }
  const ink = (start: number, end: number) => {
    let count = 0;
    for (let i = start; i < end; i += 3)
      if (
        first.pixels[i] !== 0x12 ||
        first.pixels[i + 1] !== 0x27 ||
        first.pixels[i + 2] !== 0x37
      )
        count++;
    return count;
  };
  assert.ok(ink(0, titleEnd) > 20000, 'the title is missing or too small');
  assert.ok(
    ink(creditStart, first.pixels.length) > 3000,
    'the developer credit is missing or too small',
  );
});

test('the dice enter below the title and settle into three distinct faces', () => {
  const first = decodePng(built.framePaths[0]) as Picture;
  for (let y = 454; y < 900; y++)
    for (let x = 0; x < first.width; x++) {
      const i = (y * first.width + x) * 3;
      assert.deepEqual(
        Array.from(first.pixels.subarray(i, i + 3)),
        SPLASH.BACKGROUND,
      );
    }
  for (const centre of [700, 960, 1220]) {
    assert.deepEqual(
      at(centre, 600),
      [0xf4, 0xea, 0xd8],
      'the final die face is missing',
    );
    assert.notDeepEqual(
      at(centre, 700),
      [0xf4, 0xea, 0xd8],
      'the chess piece is missing',
    );
  }
  assert.notDeepEqual(
    readFileSync(built.framePaths[8]),
    readFileSync(built.framePath),
  );
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
  for (const path of built.holdPaths)
    assert.deepEqual(readFileSync(path), readFileSync(built.framePath));
});

test('the archive has no wrapping folder and preserves playback order', () => {
  const listed = execFileSync('unzip', ['-Z1', built.destination], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
  assert.equal(SPLASH.frames, 18);
  assert.deepEqual(listed, [
    '_loop/',
    ...Array.from(
      { length: SPLASH.frames + SPLASH.holdFrames },
      (_, i) => `_loop/loop${String(i).padStart(5, '0')}.png`,
    ),
    'desc.txt',
  ]);
});
