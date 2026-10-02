// Render tests for the 10-foot UI SpeechBubble component (#158).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
  BUBBLE_INSET,
  BUBBLE_ROWS,
  BUBBLE_TAIL,
  SpeechBubble,
} from '../src/SpeechBubble';
import { HOST_FACE, HOST_GAP } from '../src/Matchup';
import { BOARD_GAP, boardSide, safeInsets } from '../src/layout';
import { HOST_CATALOGUE } from '../../src/core/hostVoice';

type Instance = renderer.ReactTestInstance;
type Style = Record<string, unknown>;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const byTestId = (root: Instance, id: string): Instance => {
  const match = root.find((node) => node.props && node.props.testID === id);
  assert.ok(match, `expected element with testID="${id}"`);
  return match;
};

const styleOf = (node: Instance): Style => (node.props.style ?? {}) as Style;

test('renders speech bubble structure and text correctly', () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <SpeechBubble text="Hello there! Let us play chess." />,
    );
  });

  const bubble = byTestId(tree.root, 'speech-bubble');
  const tail = byTestId(tree.root, 'speech-bubble-tail');
  const body = byTestId(tree.root, 'speech-bubble-body');
  const text = byTestId(tree.root, 'speech-bubble-text');

  assert.ok(bubble);
  assert.ok(tail);
  assert.ok(body);
  assert.equal(text.props.children, 'Hello there! Let us play chess.');
});

test('satisfies 10-foot UI high-contrast color and font standards', () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<SpeechBubble text="High contrast test line." />);
  });

  const body = byTestId(tree.root, 'speech-bubble-body');
  const text = byTestId(tree.root, 'speech-bubble-text');
  const tail = byTestId(tree.root, 'speech-bubble-tail');

  const bodyStyle = styleOf(body);
  const textStyle = styleOf(text);
  const tailStyle = styleOf(tail);

  // Background and border contrast
  assert.equal(bodyStyle.backgroundColor, '#112233');
  assert.equal(bodyStyle.borderColor, '#2b425b');
  assert.equal(tailStyle.borderBottomColor, '#2b425b');

  // Text legibility on TV screens: no smaller than any other caption (#168),
  // in at most the two rows the speech zone has room for.
  assert.equal(textStyle.color, '#f0f4f8');
  assert.ok(Number(textStyle.fontSize) >= 20, 'bubble text is at least 20 dp');
  assert.equal(textStyle.fontWeight, '600');
  assert.equal(text.props.numberOfLines, 2);
});

// ── The Hot Seat host's bubble, pointing left at his face (#202) ──────────────

test("the host's bubble points left, in the bot bubble's colours", () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <SpeechBubble text="Oho! The plot thickens!" tail="left" />,
    );
  });

  const bubble = styleOf(byTestId(tree.root, 'speech-bubble'));
  assert.equal(bubble.flexDirection, 'row');
  assert.equal(bubble.alignItems, 'center');
  const tail = styleOf(byTestId(tree.root, 'speech-bubble-tail'));
  assert.equal(tail.borderRightColor, '#2b425b');
  assert.equal(tail.borderRightWidth, BUBBLE_TAIL);
  assert.equal(tail.borderTopColor, 'transparent');
  assert.equal(tail.borderBottomColor, 'transparent');
  assert.equal(tail.borderBottomWidth, BUBBLE_TAIL);
  const body = styleOf(byTestId(tree.root, 'speech-bubble-body'));
  assert.equal(body.backgroundColor, '#112233');
  assert.equal(body.flexShrink, 1);
  assert.equal(body.maxWidth, undefined);
  const text = byTestId(tree.root, 'speech-bubble-text');
  assert.equal(styleOf(text).fontSize, 20);
  assert.equal(text.props.numberOfLines, 2);
});

// Rows filled word by word, at most `width` characters each.
const rows = (text: string, width: number): string[] =>
  text.split(' ').reduce<string[]>((filled, word) => {
    const last = filled.at(-1);
    if (last !== undefined && `${last} ${word}`.length <= width)
      filled[filled.length - 1] = `${last} ${word}`;
    else filled.push(word);
    return filled;
  }, []);

test('every host line fits the two rows of his bubble, beside his face', () => {
  // The panel beside the board on the 960 x 540 dp screen. A bubble its full
  // width holds about 36 characters a row on the Virtual Device
  // (test/botVoice.test.ts); the face, the gap and the tail take room from it.
  const panel =
    960 - 2 * safeInsets(960, 540).x - boardSide(960, 540) - BOARD_GAP;
  const fullText = panel - BUBBLE_INSET;
  const text = panel - (HOST_FACE + HOST_GAP) - BUBBLE_TAIL - BUBBLE_INSET;
  const perRow = Math.floor(text / (fullText / 36));
  assert.ok(perRow >= 30, `${perRow} characters a row`);
  for (const line of HOST_CATALOGUE)
    assert.ok(
      rows(line.text, perRow).length <= BUBBLE_ROWS,
      `${line.id}: ${rows(line.text, perRow).join(' / ')}`,
    );
});
