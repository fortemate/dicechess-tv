// The choice of local opponent (#115): what each card shows, and which one has
// the focus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { OpponentScreen, FACE_OF, recordLines } from '../src/OpponentScreen';
import { FACES } from '../src/faces';
import { THEME } from '../src/theme';
import { OPPONENTS } from '../../src/core/opponents';
import { emptyLedger, type Ledger } from '../../src/core/ledger';

type Instance = renderer.ReactTestInstance;
type Style = Record<string, unknown>;

const isHost = (node: Instance, name: string) =>
  (node.type as unknown as string) === name;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mount = (
  props: { index: number; pressed?: boolean; ledger?: Ledger } = { index: 0 },
): Instance => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      React.createElement(OpponentScreen, { pressed: false, ...props }),
    );
  });
  return tree.root;
};

const cards = (root: Instance) =>
  root.findAll(
    (node) => isHost(node, 'View') && node.props.testID === 'opponent',
  );

const texts = (node: Instance): string[] =>
  node
    .findAll((each) => isHost(each, 'Text'))
    .map((each) => String(each.props.children));

test('three cards, Rolly, Grabby and Rampage, easiest first', () => {
  const shown = cards(mount());
  assert.deepEqual(
    shown.map((card) => texts(card)[0]),
    ['Rolly', 'Grabby', 'Rampage'],
  );
  assert.deepEqual(
    shown.map((card) => texts(card)[1]),
    ['Easy', 'Medium', 'Hard'],
  );
});

test('the level shows as filled rings as well as in words', () => {
  const filled = cards(mount()).map(
    (card) =>
      card.findAll(
        (node) => isHost(node, 'View') && node.props.testID === 'pip-filled',
      ).length,
  );
  assert.deepEqual(filled, [1, 2, 3]);
  for (const card of cards(mount())) {
    const pips = card.findAll(
      (node) =>
        isHost(node, 'View') && String(node.props.testID).startsWith('pip-'),
    );
    assert.equal(pips.length, 3, 'three rings on every card');
  }
});

test('each card draws its opponent’s face', () => {
  assert.deepEqual(
    OPPONENTS.map((opponent) => FACE_OF[opponent.mode]),
    ['zany-face', 'money-mouth-face', 'smiling-face-with-horns'],
  );
  for (const [i, card] of cards(mount()).entries()) {
    const Face = FACES[FACE_OF[OPPONENTS[i].mode]];
    assert.equal(card.findAllByType(Face).length, 1);
  }
});

test('the focused card is framed in the cursor’s colour, and shrinks while OK is held', () => {
  const style = (root: Instance, i: number) =>
    cards(root)[i].props.style as Style;
  const idle = mount({ index: 1 });
  assert.equal(style(idle, 1).borderColor, THEME.cursor);
  assert.equal(style(idle, 1).backgroundColor, THEME.focusFill);
  assert.notEqual(style(idle, 0).borderColor, THEME.cursor);
  assert.notEqual(style(idle, 2).borderColor, THEME.cursor);

  const held = mount({ index: 1, pressed: true });
  assert.equal(style(held, 1).backgroundColor, THEME.pressedFill);
  assert.deepEqual(style(held, 1).transform, [{ scale: 0.97 }]);
  assert.deepEqual(style(held, 0).transform, [{ scale: 1 }]);
});

test('a card shows the person’s record against that opponent, by side', () => {
  const ledger: Ledger = {
    ...emptyLedger(),
    bots: {
      greedy: {
        w: { wins: 2, draws: 0, losses: 1 },
        b: { wins: 0, draws: 1, losses: 3 },
      },
    },
  };
  const shown = cards(mount({ index: 0, ledger }));
  assert.ok(texts(shown[0]).includes('Not played yet'));
  assert.ok(texts(shown[1]).includes('As White: 2W 0D 1L'));
  assert.ok(texts(shown[1]).includes('As Black: 0W 1D 3L'));
  assert.ok(texts(shown[2]).includes('Not played yet'));
  assert.deepEqual(recordLines({}), ['Not played yet']);
});
