// The matchup header in the gameplay HUD (#156): player and opponent badges,
// active turn borders, bot difficulty pips, and thinking status.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Matchup } from '../src/Matchup';
import { THEME } from '../src/theme';
import { newGame, type Game, type Side } from '../../src/core/game';

type Instance = renderer.ReactTestInstance;
type Style = Record<string, unknown>;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const isHost = (node: Instance, name: string) =>
  (node.type as unknown as string) === name;
const styleOf = (node: Instance): Style => (node.props.style ?? {}) as Style;

const mount = (
  game: Game,
  side: Side,
  thinking = false,
): renderer.ReactTestRenderer => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      React.createElement(Matchup, { game, side, thinking }),
    );
  });
  return tree;
};

const byTestId = (root: Instance, id: string): Instance => {
  const match = root.find((node) => node.props && node.props.testID === id);
  assert.ok(match, `expected element with testID="${id}"`);
  return match;
};

const texts = (node: Instance): string[] =>
  node
    .findAll((each) => isHost(each, 'Text'))
    .map((each) => String(each.props.children));

test('renders player and opponent badges with initial turn on White', () => {
  const game = newGame('aggressive', 'game-1');
  const tree = mount(game, 'w');

  const player = byTestId(tree.root, 'player-badge');
  const opponent = byTestId(tree.root, 'opponent-badge');

  assert.deepEqual(texts(player), ['YOU', 'White']);
  assert.equal(texts(opponent)[0], 'RAMPAGE');
  assert.equal(texts(opponent)[1], 'Hard');

  // White (player) has active turn
  assert.equal(styleOf(player).borderColor, THEME.cursor);
  assert.equal(styleOf(player).opacity, 1);

  // Black (bot) is inactive
  assert.notEqual(styleOf(opponent).borderColor, THEME.cursor);
  assert.equal(styleOf(opponent).opacity, 0.72);
});

test('active turn shifts to opponent on Black turn', () => {
  const game = newGame('aggressive', 'game-2');
  const tree = mount(game, 'b');

  const player = byTestId(tree.root, 'player-badge');
  const opponent = byTestId(tree.root, 'opponent-badge');

  // Player is inactive
  assert.notEqual(styleOf(player).borderColor, THEME.cursor);
  assert.equal(styleOf(player).opacity, 0.72);

  // Opponent has active turn
  assert.equal(styleOf(opponent).borderColor, THEME.cursor);
  assert.equal(styleOf(opponent).opacity, 1);
});

test('bot shows Thinking… status when it owes a move', () => {
  const game = newGame('aggressive', 'game-3');
  const tree = mount(game, 'b', true);

  const opponent = byTestId(tree.root, 'opponent-badge');
  const status = byTestId(opponent, 'bot-status');

  assert.equal(texts(status)[0], 'Thinking…');
});

test('reflects difficulty pips for each bot opponent', () => {
  for (const [mode, expectedFilled] of [
    ['random', 1],
    ['greedy', 2],
    ['aggressive', 3],
  ] as const) {
    const game = newGame(mode, `game-${mode}`);
    const tree = mount(game, 'w');
    const opponent = byTestId(tree.root, 'opponent-badge');
    const filled = opponent.findAll(
      (node) => isHost(node, 'View') && node.props.testID === 'pip-filled',
    );
    assert.equal(
      filled.length,
      expectedFilled,
      `expected ${expectedFilled} pips for ${mode}`,
    );
  }
});

test('renders correctly when player chooses Black against bot', () => {
  const game = newGame('greedy', 'game-black', undefined, 'b');
  const tree = mount(game, 'b');

  const player = byTestId(tree.root, 'player-badge');
  const opponent = byTestId(tree.root, 'opponent-badge');

  assert.deepEqual(texts(player), ['YOU', 'Black']);
  assert.equal(texts(opponent)[0], 'GRABBY');

  // Player on Black is active
  assert.equal(styleOf(player).borderColor, THEME.cursor);
  assert.equal(styleOf(player).opacity, 1);
});

test('renders Hotseat mode with Player 1 and Player 2 badges', () => {
  const game = newGame('hotseat', 'game-hotseat');
  const tree = mount(game, 'w');

  const player = byTestId(tree.root, 'player-badge');
  const opponent = byTestId(tree.root, 'opponent-badge');

  assert.deepEqual(texts(player), ['PLAYER 1', 'White']);
  assert.deepEqual(texts(opponent), ['PLAYER 2', 'Black']);

  // Player 1 (White) is active
  assert.equal(styleOf(player).borderColor, THEME.cursor);
  assert.notEqual(styleOf(opponent).borderColor, THEME.cursor);
});

test('neither badge is highlighted when the game has ended', () => {
  const game: Game = {
    ...newGame('random', 'game-ended'),
    phase: 'ended',
    result: { reason: 'king-captured', winner: 'w' },
  };
  const tree = mount(game, 'w');

  const player = byTestId(tree.root, 'player-badge');
  const opponent = byTestId(tree.root, 'opponent-badge');

  assert.notEqual(styleOf(player).borderColor, THEME.cursor);
  assert.notEqual(styleOf(opponent).borderColor, THEME.cursor);
});

test('renders speech bubble under opponent badge when provided', () => {
  const game = newGame('aggressive', 'game-bubble');
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      React.createElement(Matchup, {
        game,
        side: 'b',
        speechBubble: React.createElement(
          'Text',
          { testID: 'test-bubble' },
          'Your king is trapped!',
        ),
      }),
    );
  });

  const slot = byTestId(tree.root, 'speech-bubble-slot');
  const bubble = byTestId(slot, 'test-bubble');
  assert.equal(texts(bubble)[0], 'Your king is trapped!');
  assert.equal(styleOf(slot).position, 'absolute');
  assert.equal(styleOf(slot).top, '100%');
});

test('renders center children between opponent and player badges', () => {
  const game = newGame('aggressive', 'game-children');
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      React.createElement(
        Matchup,
        { game, side: 'w' },
        React.createElement('Text', { testID: 'center-action' }, 'TURN 1'),
      ),
    );
  });

  const center = byTestId(tree.root, 'center-action');
  assert.equal(texts(center)[0], 'TURN 1');
});
