import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Portrait, FACE_OF, PORTRAIT_OF } from '../src/Portrait';
import { FACES } from '../src/faces';
import { isHost } from './support';

const mount = (props: React.ComponentProps<typeof Portrait>) => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Portrait {...props} />);
  });
  return tree;
};

test('a missing cat or teacher portrait keeps its frame and reports the failed image', () => {
  for (const character of ['cat', 'thinkle'] as const) {
    for (const kind of ['badge', 'card'] as const) {
      let reports = 0;
      const size = kind === 'badge' ? 38 : 112;
      const props = Object.freeze({
        character,
        kind,
        size,
        onMissing: () => reports++,
      });
      const tree = mount(props);
      const image = tree.root.find((node) => isHost(node, 'Image'));
      assert.equal(reports, 0);
      assert.equal(image.props.fadeDuration, 0);
      assert.deepEqual(image.props.style, { width: size, height: size });
      act(() => image.props.onError());
      assert.equal(reports, 1);
      assert.equal(
        tree.root.findAll((node) => isHost(node, 'Image')).length,
        0,
      );
      const frame = tree.root.findByProps({
        testID: `portrait-missing-${character}`,
      });
      assert.deepEqual(frame.props.style, { width: size, height: size });
      assert.deepEqual(props, {
        character,
        kind,
        size,
        onMissing: props.onMissing,
      });
      act(() => tree.unmount());
    }
  }
});

test('a missing opponent portrait reports the failure and shows its existing emoji at the same size', () => {
  for (const mode of ['random', 'greedy', 'aggressive'] as const) {
    let reports = 0;
    const tree = mount({
      character: PORTRAIT_OF[mode],
      kind: 'badge',
      size: 38,
      onMissing: () => reports++,
    });
    const image = tree.root.find((node) => isHost(node, 'Image'));
    act(() => image.props.onError());
    assert.equal(reports, 1);
    assert.equal(tree.root.findAll((node) => isHost(node, 'Image')).length, 0);
    const [face] = tree.root.findAllByType(FACES[FACE_OF[mode]]);
    assert.ok(face);
    assert.equal(face.props.size, 38);
    act(() => tree.unmount());
  }
});
