// The dice roll's tumble (#99): short, on the native driver, lit on the way in
// with the lost dice dimming as they land, and no tumble for dice already there,
// after an action, or when the platform asks for less motion or has not
// answered whether it does.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Dice, ROLL_MS, TUMBLE_MS, TUMBLE_STAGGER_MS } from '../src/Dice';
import { PIECES } from '../src/pieces';
import { BOT_STEP_MS } from '../src/screen';
import { CUE_DELAY_MS } from '../src/sound';
import { THEME } from '../src/theme';
import type { Die } from '../../src/core/dice';
import type { Side } from '../../src/core/game';

type Instance = renderer.ReactTestInstance;
type Style = Record<string, unknown>;
type Held = {
  config: {
    toValue: number;
    duration: number;
    delay?: number;
    useNativeDriver: boolean;
  };
  done: ((result: { finished: boolean }) => void) | null;
  stopped: boolean;
};
const globals = globalThis as {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
  __holdSlides?: boolean;
  __heldSlides?: Held[];
  __reduceMotion?: boolean;
  __reduceMotionQuery?: 'pending' | 'fails' | 'throws';
};
globals.IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  globals.__holdSlides = true;
  globals.__heldSlides = [];
  globals.__reduceMotion = false;
  globals.__reduceMotionQuery = undefined;
});

// Queen, rook and knight at the start: the queen die is lost.
const ROLLED: Die[] = [
  { piece: 'Q', spent: false, leftover: true },
  { piece: 'R', spent: false, leftover: false },
  { piece: 'N', spent: false, leftover: false },
];
// The same roll after b1a3.
const AFTER_KNIGHT: Die[] = [
  { piece: 'Q', spent: false, leftover: true },
  { piece: 'R', spent: false, leftover: false },
  { piece: 'N', spent: true, leftover: false },
];

const isHost = (node: Instance, name: string) =>
  (node.type as unknown as string) === name;
const styleOf = (node: Instance): Style => (node.props.style ?? {}) as Style;

// Mounts the dice, lets the platform answer whether it asks for less motion,
// and returns what shows the next dice.
const mount = async (dice: Die[], side: Side = 'w') => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(React.createElement(Dice, { dice, side }));
  });
  return {
    root: () => tree.root,
    show: (next: Die[], nextSide: Side = 'w') =>
      act(() => {
        tree.update(React.createElement(Dice, { dice: next, side: nextSide }));
      }),
  };
};

const tumbles = (root: Instance) =>
  root.findAll(
    (node) => isHost(node, 'Animated.View') && node.props.testID === 'tumble',
  );

// Each face in slot order, as the screen draws it.
const looks = (root: Instance): string[] =>
  root
    .findAll(
      (node) =>
        isHost(node, 'View') && styleOf(node).backgroundColor === THEME.die,
    )
    .map((node) => {
      const face = styleOf(node);
      if (face.opacity === 0.3) return 'spent';
      if (face.opacity === 0.45 && face.borderWidth === 0) return 'dim';
      if (face.opacity === 1 && (face.borderWidth as number) > 0) return 'lit';
      return JSON.stringify(face);
    });

const land = () =>
  act(() => {
    for (const thrown of globals.__heldSlides ?? [])
      if (!thrown.stopped) thrown.done?.({ finished: true });
  });

test('a roll is short, and over before the no-move cue and the opponent’s next step', () => {
  assert.equal(ROLL_MS, TUMBLE_MS + 2 * TUMBLE_STAGGER_MS);
  assert.ok(ROLL_MS <= 300, 'the TV guidance of #51');
  // The notice of a roll with nothing to play is heard after the dice land.
  assert.ok(ROLL_MS < (CUE_DELAY_MS.no_move ?? 0));
  assert.ok(ROLL_MS < BOT_STEP_MS);
});

test('a roll tumbles each die onto its own face, left to right, on the native driver', async () => {
  const dice = await mount([]);
  dice.show(ROLLED);
  assert.equal(tumbles(dice.root()).length, 3);
  const held = globals.__heldSlides ?? [];
  assert.deepEqual(
    held.map(({ config }) => config.delay ?? 0),
    [0, TUMBLE_STAGGER_MS, 2 * TUMBLE_STAGGER_MS],
  );
  for (const { config } of held) {
    assert.equal(config.duration, TUMBLE_MS);
    assert.equal(config.toValue, 1);
    assert.equal(config.useNativeDriver, true);
  }
  // The faces are the rolled pieces all the way in: nothing else flashes up.
  for (const [slot, piece] of ['Q', 'R', 'N'].entries())
    assert.equal(
      tumbles(dice.root())[slot].findAllByType(
        PIECES[piece as keyof typeof PIECES] as never,
      ).length,
      1,
    );
});

test('the dice tumble lit, and the lost one dims as it lands', async () => {
  const dice = await mount([]);
  dice.show(ROLLED);
  assert.deepEqual(looks(dice.root()), ['lit', 'lit', 'lit']);
  land();
  assert.equal(tumbles(dice.root()).length, 0);
  assert.deepEqual(looks(dice.root()), ['dim', 'lit', 'lit']);
});

test('dice already rolled when the screen opens do not tumble', async () => {
  // A resumed game, or a tutorial lesson, opens with its roll made.
  const dice = await mount(ROLLED);
  assert.equal(tumbles(dice.root()).length, 0);
  assert.equal((globals.__heldSlides ?? []).length, 0);
  assert.deepEqual(looks(dice.root()), ['dim', 'lit', 'lit']);
  // Nor does an action.
  dice.show(AFTER_KNIGHT);
  assert.equal(tumbles(dice.root()).length, 0);
});

test('an action during the tumble ends it, and the dice show what they are', async () => {
  const dice = await mount([]);
  dice.show(ROLLED);
  dice.show(AFTER_KNIGHT);
  assert.equal(tumbles(dice.root()).length, 0);
  assert.ok((globals.__heldSlides ?? []).every(({ stopped }) => stopped));
  assert.deepEqual(looks(dice.root()), ['dim', 'lit', 'spent']);
});

test('once the dice are cleared, the next roll tumbles again', async () => {
  const dice = await mount([]);
  dice.show(ROLLED);
  land();
  // The turn is handed over, and the next side rolls.
  dice.show([]);
  dice.show(ROLLED);
  assert.equal(tumbles(dice.root()).length, 3);
});

// Queen, rook and king at the start, for Black: nothing can move.
const EMPTY_FOR_BLACK: Die[] = [
  { piece: 'Q', spent: false, leftover: true },
  { piece: 'R', spent: false, leftover: true },
  { piece: 'K', spent: false, leftover: true },
];

test('a roll over the other side’s dice tumbles too (#149)', async () => {
  // The bot's roll with nothing to play stays on screen, dimmed, until the
  // person's OK passes it and throws their own dice over it.
  const dice = await mount(EMPTY_FOR_BLACK, 'b');
  assert.equal(tumbles(dice.root()).length, 0);
  dice.show(ROLLED, 'w');
  assert.equal(tumbles(dice.root()).length, 3);
  assert.equal((globals.__heldSlides ?? []).length, 3);
  // The same faces thrown again by the other side are a roll as well.
  land();
  dice.show(ROLLED, 'b');
  assert.equal(tumbles(dice.root()).length, 3);
});

test('no tumble when the platform asks for less motion', async () => {
  globals.__reduceMotion = true;
  const dice = await mount([]);
  dice.show(ROLLED);
  assert.equal(tumbles(dice.root()).length, 0);
  assert.deepEqual(looks(dice.root()), ['dim', 'lit', 'lit']);
});

test('no tumble before the platform has answered, and a tumble where it cannot', async () => {
  globals.__reduceMotionQuery = 'pending';
  const waiting = await mount([]);
  waiting.show(ROLLED);
  assert.equal(tumbles(waiting.root()).length, 0);

  // A platform without the setting keeps the motion, as the board's slides do.
  globals.__reduceMotionQuery = 'throws';
  const lacking = await mount([]);
  lacking.show(ROLLED);
  assert.equal(tumbles(lacking.root()).length, 3);
});
