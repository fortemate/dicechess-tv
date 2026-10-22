// Render tests for the 10-foot UI SpeechBubble component (#158).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
  BUBBLE_ROWS,
  HOST_BUBBLE_ROWS,
  SpeechBubble,
} from '../src/SpeechBubble';
import { styleOf, type Instance } from './support';
import { HOST_CATALOGUE } from '../../src/core/hostVoice';
import { TUTOR_CATALOGUE } from '../../src/core/tutorial';
import { VOICE_FILES } from '../src/voiceFiles';

const byTestId = (root: Instance, id: string): Instance => {
  const match = root.find((node) => node.props && node.props.testID === id);
  assert.ok(match, `expected element with testID="${id}"`);
  return match;
};

test('recorded lines show U.S. captions while keeping the exact audio transcripts', () => {
  const captions = {
    thinkle_host_intro_1: 'Hmm... the dice favor no one, young or old.',
    thinkle_tutor_capture_rolled_2:
      'You have no queen or bishop here, so those dice go gray.',
    thinkle_tutor_dice_done_1:
      'Well leapt! The gray dice go unused, and the turn ends.',
    thinkle_tutor_dice_rolled_2:
      'The queen and bishop are boxed in. Their dice go gray.',
    thinkle_tutor_pass_rolled_2:
      'All three are boxed in, so every die goes gray.',
  };
  const lines = [...HOST_CATALOGUE, ...TUTOR_CATALOGUE];
  for (const [id, caption] of Object.entries(captions)) {
    const line = lines.find((entry) => entry.id === id)!;
    const transcript = VOICE_FILES[id].text;
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<SpeechBubble text={line.text} />);
    });
    assert.equal(
      byTestId(tree.root, 'speech-bubble-text').props.children,
      caption,
    );
    assert.equal(
      line.text,
      transcript,
      `${id}: source transcript was rewritten`,
    );
    assert.notEqual(line.text, caption);
    act(() => tree.unmount());
  }
});

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

  // Background and border contrast; the tail points left, back at the
  // speaker's portrait (#213).
  assert.equal(bodyStyle.backgroundColor, '#112233');
  assert.equal(bodyStyle.borderColor, '#2b425b');
  assert.equal(tailStyle.borderRightColor, '#2b425b');
  assert.equal(tailStyle.borderTopColor, 'transparent');

  // Text legibility on TV screens: no smaller than any other caption (#168),
  // in at most the four rows the dialog block has room for.
  assert.equal(textStyle.color, '#f0f4f8');
  assert.ok(Number(textStyle.fontSize) >= 20, 'bubble text is at least 20 dp');
  assert.equal(textStyle.fontWeight, '600');
  assert.equal(text.props.numberOfLines, BUBBLE_ROWS);
});

test('the host’s bubble takes the rows it is given', () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <SpeechBubble text="Now pass the remote over!" rows={HOST_BUBBLE_ROWS} />,
    );
  });
  const text = byTestId(tree.root, 'speech-bubble-text');
  assert.equal(text.props.numberOfLines, 3);
});
