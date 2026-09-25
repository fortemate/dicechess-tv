// The television's safe area and the board beside its panel (#51).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_GAP, boardSide, safeInsets } from '../src/layout';

// The screen Vega reports on a 1920 x 1080 television.
const WIDTH = 960;
const HEIGHT = 540;

test('nothing goes in the outer 5% of the screen: 48 dp across and 27 dp down', () => {
  assert.deepEqual(safeInsets(WIDTH, HEIGHT), { x: 48, y: 27 });
});

test('the board fits the safe area and leaves the panel room for its longest headline', () => {
  const side = boardSide(WIDTH, HEIGHT);
  const { x, y } = safeInsets(WIDTH, HEIGHT);
  assert.equal(side, 460);
  assert.ok(
    side <= HEIGHT - 2 * y,
    'the board keeps out of the top and bottom',
  );
  // "No legal moves · you" measured about 355 dp on the virtual device.
  const panel = WIDTH - 2 * x - side - BOARD_GAP;
  assert.ok(panel >= 360, `panel ${panel} dp`);
});
