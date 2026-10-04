// The About screen's credits for the opponents (#212): a build with their
// portraits names them with the maker and credits only the pieces to RhosGFX,
// and one without them credits the RhosGFX faces with the pieces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { AboutScreen } from '../src/AboutScreen';
import { PIECES, PIECES_AND_FACES, PORTRAITS } from '../../src/core/credits';

type Instance = renderer.ReactTestInstance;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const isHost = (node: Instance, name: string) =>
  (node.type as unknown as string) === name;

const texts = (root: Instance): string[] =>
  root
    .findAll((node) => isHost(node, 'Text'))
    .map((node) => String(node.props.children));

const images = (root: Instance): Instance[] =>
  root.findAll((node) => isHost(node, 'Image'));

const mount = (reports: string[]): renderer.ReactTestRenderer => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      React.createElement(AboutScreen, {
        onExit: () => {},
        onState: (report: string) => reports.push(report),
      }),
    );
  });
  return tree;
};

test('a build with the portraits shows them in their credit, and the RhosGFX card names only the pieces', () => {
  const reports: string[] = [];
  const tree = mount(reports);
  const shown = texts(tree.root);

  assert.ok(
    shown.includes(
      `${PORTRAITS.line} · ${PORTRAITS.licence} · ${PORTRAITS.source}`,
    ),
  );
  assert.deepEqual(
    images(tree.root).map((image) => image.props.testID),
    // The opponents, then Prowla, who hosts (#258).
    ['portrait-rolly', 'portrait-grabby', 'portrait-rampage', 'portrait-cat'],
  );
  assert.ok(shown.includes(PIECES.line));
  assert.ok(!shown.includes(PIECES_AND_FACES.line));
  assert.equal(reports.at(-1), 'about | credits 4 | portraits true');
});

test('a build without the portraits credits the RhosGFX faces instead, and shows no face in their place', () => {
  const reports: string[] = [];
  const tree = mount(reports);
  // One portrait that does not load is enough: the build has none.
  act(() => images(tree.root)[1].props.onError());
  const shown = texts(tree.root);

  assert.ok(!shown.some((line) => line.includes('Recraft')));
  assert.equal(images(tree.root).length, 0);
  assert.equal(
    tree.root.findAll((node) => node.props?.testID === 'portraits-credit')
      .length,
    0,
  );
  assert.ok(shown.includes(PIECES_AND_FACES.line));
  assert.ok(!shown.includes(PIECES.line));
  assert.equal(reports.at(-1), 'about | credits 4 | portraits false');
});
