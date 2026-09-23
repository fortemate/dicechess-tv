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
import { decodePng, main, SPLASH } from '../scripts/generate-splash.mjs';

const built = main() as {
  framePath: string;
  descriptorPath: string;
  destination: string;
  left: number;
  top: number;
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

test('the mark is inked, and centred', () => {
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
  assert.ok(maxX > 0, 'the frame is empty: the mark was never drawn');

  // Equal margins on each side, within a pixel for an odd difference.
  assert.ok(
    Math.abs(minX - (frame.width - 1 - maxX)) <= 1,
    `mark is off-centre horizontally: ${minX} left, ${frame.width - 1 - maxX} right`,
  );
  assert.ok(
    Math.abs(minY - (frame.height - 1 - maxY)) <= 1,
    `mark is off-centre vertically: ${minY} top, ${frame.height - 1 - maxY} bottom`,
  );

  // Large enough to read from a sofa: at least a fifth of the frame height.
  assert.ok(
    maxY - minY >= frame.height / 5,
    'the mark is too small to read on a television',
  );
});

test('the descriptor says what the animation service expects', () => {
  assert.equal(
    readFileSync(built.descriptorPath, 'utf8'),
    `${SPLASH.WIDTH} ${SPLASH.HEIGHT} ${SPLASH.FPS}\nc 0 0 _loop\n`,
  );
});

test('the archive has no wrapping folder, which would hide it from the service', () => {
  const listed = execFileSync('unzip', ['-Z1', built.destination], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    .sort();
  assert.deepEqual(listed, ['_loop/', '_loop/loop00000.png', 'desc.txt']);
});
