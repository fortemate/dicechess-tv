// The About screen: the game's name, its maker, and cards for other authors
// only. Whether the build has the characters' portraits (#212) decides the
// RhosGFX card: with them it names only the pieces, and without them it
// credits the RhosGFX faces the game shows in their place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act } from 'react-test-renderer';
import { AboutScreen } from '../src/AboutScreen';
import {
  APP,
  OPEN_SOURCE,
  PIECES,
  PIECES_AND_FACES,
} from '../../src/core/credits';
import { isHost, mount, styleOf, type Instance } from './support';
import { textWidth } from './textWidth';

const texts = (root: Instance): string[] =>
  root
    .findAll((node) => isHost(node, 'Text'))
    .map((node) => String(node.props.children));

const images = (root: Instance): Instance[] =>
  root.findAll((node) => isHost(node, 'Image'));

// Whether a host View above the node draws it transparent.
const unseen = (node: Instance | null): boolean =>
  node !== null &&
  ((isHost(node, 'View') && styleOf(node).opacity === 0) ||
    unseen(node.parent));

const open = (reports: string[]) =>
  mount(
    React.createElement(AboutScreen, {
      onExit: () => {},
      onState: (report: string) => reports.push(report),
    }),
  );

test('the screen names the game and its maker, and nothing of Fortemate’s own beyond them', () => {
  const shown = texts(open([]).root);

  assert.ok(shown.includes(APP.title));
  assert.ok(shown.includes(APP.maker));
  // The engine, the voices and the portraits are Fortemate's own: the maker's
  // line covers them.
  for (const gone of [
    /\bTV\b/,
    /engine/i,
    /AGPL/,
    /ElevenLabs/,
    /Recraft/,
    /Fortemate apps only/,
  ])
    assert.ok(!shown.some((line) => gone.test(line)), String(gone));
});

test('a build with the portraits shows none, and the RhosGFX card names only the pieces', () => {
  const reports: string[] = [];
  const tree = open(reports);
  const shown = texts(tree.root);

  // One portrait is loaded to learn whether the build has them, and it is not
  // seen.
  const [probe, ...others] = images(tree.root);
  assert.equal(others.length, 0);
  assert.equal(probe.props.testID, 'portrait-thinkle');
  assert.ok(unseen(probe), 'the portrait is seen');
  assert.ok(shown.includes(PIECES.line));
  assert.ok(!shown.includes(PIECES_AND_FACES.line));
  assert.equal(reports.at(-1), 'about | credits 4 | portraits true');
});

test('a build without the portraits credits the RhosGFX faces instead', () => {
  const reports: string[] = [];
  const tree = open(reports);
  act(() => images(tree.root)[0].props.onError());
  const shown = texts(tree.root);

  assert.equal(images(tree.root).length, 0);
  assert.ok(shown.includes(PIECES_AND_FACES.line));
  assert.ok(!shown.includes(PIECES.line));
  assert.equal(reports.at(-1), 'about | credits 4 | portraits false');
});

// The package carries the notices of the open-source software in it (#338), and
// a viewer cannot open a file from the sofa, so the screen gives the address of
// the site's page that lists them as well.
test('the screen says where the open-source licences are, the address on one line', () => {
  const tree = open([]);
  const shown = texts(tree.root);
  const where = `${OPEN_SOURCE.line} ${OPEN_SOURCE.source}`;

  assert.ok(shown.includes(OPEN_SOURCE.subject));
  assert.ok(shown.includes(where));
  // A television screen is 960 dp wide, and the page keeps 56 dp at each side.
  // The drawn width ran up to 4.5% over textWidth's sum (textWidth.ts).
  const [line] = tree.root.findAll(
    (node) => isHost(node, 'Text') && node.props.children === where,
  );
  const { fontSize } = styleOf(line) as { fontSize: number };
  assert.ok(textWidth(where, fontSize) * 1.05 <= 960 - 2 * 56);
});
