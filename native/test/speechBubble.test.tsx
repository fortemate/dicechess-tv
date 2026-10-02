// Render tests for the 10-foot UI SpeechBubble component (#158).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SpeechBubble } from '../src/SpeechBubble';

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
