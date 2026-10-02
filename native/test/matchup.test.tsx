// The matchup header in the gameplay HUD (#156, #168): a badge for each side
// where that side sits on the board, the side to move framed in the turn colour
// rather than the focus style, the bot's level and thinking status, and the
// speech zone under the top badge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
  HOST_FACE,
  HOST_GAP,
  Matchup,
  SPEECH_ZONE,
  type MatchupProps,
} from '../src/Matchup';
import { BUBBLE_TAIL } from '../src/SpeechBubble';
import { THEME } from '../src/theme';
import { newGame, type Game } from '../../src/core/game';

type Instance = renderer.ReactTestInstance;
type Style = Record<string, unknown>;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const isHost = (node: Instance, name: string) =>
  (node.type as unknown as string) === name;
const styleOf = (node: Instance): Style => (node.props.style ?? {}) as Style;

const mount = (props: MatchupProps): renderer.ReactTestRenderer => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(Matchup, props));
  });
  return tree;
};

// The host element with a testID: the stubs pass it on from their component.
const byTestId = (root: Instance, id: string): Instance => {
  const match = root.find(
    (node) => typeof node.type === 'string' && node.props.testID === id,
  );
  assert.ok(match, `expected element with testID="${id}"`);
  return match;
};

// Every host element with a testID.
const drawn = (root: Instance, id: string) =>
  root.findAll(
    (node) => typeof node.type === 'string' && node.props.testID === id,
  );

const texts = (node: Instance): string[] =>
  node
    .findAll((each) => isHost(each, 'Text'))
    .map((each) => String(each.props.children));

// The badges from top to bottom.
const badges = (root: Instance): string[] =>
  root
    .findAll(
      (node) =>
        isHost(node, 'View') && /-badge$/.test(String(node.props.testID)),
    )
    .map((node) => texts(node)[0]);

const assertToMove = (badge: Instance) => {
  assert.equal(styleOf(badge).borderColor, THEME.turn);
  assert.equal(styleOf(badge).opacity, 1);
};
const assertWaiting = (badge: Instance) => {
  assert.notEqual(styleOf(badge).borderColor, THEME.turn);
  assert.ok(Number(styleOf(badge).opacity) < 1, 'the waiting side dims');
};

test('renders player and opponent badges with initial turn on White', () => {
  const tree = mount({ game: newGame('aggressive', 'game-1'), side: 'w' });

  const player = byTestId(tree.root, 'player-badge');
  const opponent = byTestId(tree.root, 'opponent-badge');
  assert.deepEqual(texts(player), ['YOU', 'White']);
  assert.deepEqual(texts(opponent), ['RAMPAGE', 'Hard']);
  assertToMove(player);
  assertWaiting(opponent);
  assert.deepEqual(badges(tree.root), ['RAMPAGE', 'YOU']);
});

test('active turn shifts to opponent on Black turn', () => {
  const tree = mount({ game: newGame('aggressive', 'game-2'), side: 'b' });

  assertWaiting(byTestId(tree.root, 'player-badge'));
  assertToMove(byTestId(tree.root, 'opponent-badge'));
});

test('no badge wears the focus style, which is the cursor and menu items', () => {
  for (const mode of ['hotseat', 'random', 'aggressive'] as const)
    for (const side of ['w', 'b'] as const) {
      const tree = mount({ game: newGame(mode, `focus-${mode}`), side });
      for (const id of ['player-badge', 'opponent-badge']) {
        const style = styleOf(byTestId(tree.root, id));
        assert.notEqual(style.borderColor, THEME.cursor, `${mode} ${id}`);
        assert.notEqual(
          style.backgroundColor,
          THEME.focusFill,
          `${mode} ${id}`,
        );
      }
    }
});

test('bot shows Thinking… status when it owes a move', () => {
  const tree = mount({
    game: newGame('aggressive', 'game-3'),
    side: 'b',
    thinking: true,
  });

  const opponent = byTestId(tree.root, 'opponent-badge');
  assert.equal(byTestId(opponent, 'bot-status').props.children, 'Thinking…');
});

test('reflects difficulty pips for each bot opponent', () => {
  for (const [mode, expectedFilled] of [
    ['random', 1],
    ['greedy', 2],
    ['aggressive', 3],
  ] as const) {
    const tree = mount({ game: newGame(mode, `game-${mode}`), side: 'w' });
    const opponent = byTestId(tree.root, 'opponent-badge');
    const filled = opponent.findAll(
      (node) => isHost(node, 'View') && node.props.testID === 'pip-filled',
    );
    assert.equal(filled.length, expectedFilled, `pips for ${mode}`);
  }
});

test('the person playing Black still sits at the bottom, as the board turns', () => {
  const game = newGame('greedy', 'game-black', undefined, 'b');
  const tree = mount({ game, side: 'b' });

  const player = byTestId(tree.root, 'player-badge');
  assert.deepEqual(texts(player), ['YOU', 'Black']);
  assertToMove(player);
  assert.deepEqual(badges(tree.root), ['GRABBY', 'YOU']);
});

test('renders Hotseat mode with Player 1 and Player 2 badges', () => {
  const tree = mount({ game: newGame('hotseat', 'game-hotseat'), side: 'w' });

  const player = byTestId(tree.root, 'player-badge');
  const opponent = byTestId(tree.root, 'opponent-badge');
  assert.deepEqual(texts(player), ['PLAYER 1', 'White']);
  assert.deepEqual(texts(opponent), ['PLAYER 2', 'Black']);
  assertToMove(player);
  assertWaiting(opponent);
  assert.deepEqual(badges(tree.root), ['PLAYER 2', 'PLAYER 1']);
});

test('in hotseat the badges follow the turned board', () => {
  // Black to move with the board turned to it (#120): Black's pieces are at
  // the bottom, and so is Player 2.
  const tree = mount({
    game: newGame('hotseat', 'game-turned'),
    side: 'b',
    flipped: true,
  });

  assert.deepEqual(badges(tree.root), ['PLAYER 1', 'PLAYER 2']);
  assertToMove(byTestId(tree.root, 'opponent-badge'));
});

test('neither badge is highlighted when the game has ended', () => {
  const game: Game = {
    ...newGame('random', 'game-ended'),
    phase: 'ended',
    result: { reason: 'king-captured', winner: 'w' },
  };
  const tree = mount({ game, side: 'w' });

  assertWaiting(byTestId(tree.root, 'player-badge'));
  assertWaiting(byTestId(tree.root, 'opponent-badge'));
});

test('the bot speaks in a zone of its own, in place of the turn line', () => {
  const tree = mount({
    game: newGame('aggressive', 'game-bubble'),
    side: 'b',
    header: React.createElement('Text', { testID: 'turn-line' }, 'TURN 3'),
    speechBubble: React.createElement(
      'Text',
      { testID: 'test-bubble' },
      'Your king is in my sights!',
    ),
  });

  const zone = byTestId(tree.root, 'speech-zone');
  assert.equal(styleOf(zone).height, SPEECH_ZONE);
  assert.equal(styleOf(zone).justifyContent, 'flex-end');
  const slot = byTestId(zone, 'speech-bubble-slot');
  assert.equal(styleOf(slot).position, 'absolute');
  assert.equal(styleOf(slot).top, 0);
  assert.deepEqual(texts(slot), ['Your king is in my sights!']);
  // The turn line is left out while the bot speaks, from the screen and from
  // a screen reader, and the zone keeps its height.
  assert.equal(
    zone.findAll((node) => node.props?.testID === 'turn-line').length,
    0,
  );
  assert.ok(!texts(zone).includes('TURN 3'));
});

test('the turn line shows while the bot is quiet', () => {
  const tree = mount({
    game: newGame('aggressive', 'game-quiet-bot'),
    side: 'w',
    header: React.createElement('Text', null, 'TURN 3'),
  });

  const zone = byTestId(tree.root, 'speech-zone');
  assert.deepEqual(texts(byTestId(zone, 'turn-line')), ['TURN 3']);
});

test('with the host off, hotseat has no speech zone to leave empty', () => {
  for (const host of [undefined, false]) {
    const tree = mount({
      game: newGame('hotseat', 'game-quiet'),
      side: 'w',
      host,
      header: React.createElement('Text', null, 'HOTSEAT · TURN 1'),
    });

    const zone = byTestId(tree.root, 'speech-zone');
    assert.equal(styleOf(zone).height, undefined);
    assert.equal(drawn(tree.root, 'host-face').length, 0);
    assert.equal(styleOf(byTestId(zone, 'turn-line')).marginLeft, undefined);
  }
});

// ── The Hot Seat host (#202) ──────────────────────────────────────────────────

const hosted = (props: Partial<MatchupProps> = {}) =>
  mount({
    game: newGame('hotseat', 'game-hosted'),
    side: 'w',
    host: true,
    header: React.createElement('Text', null, 'HOTSEAT · TURN 1'),
    ...props,
  });

test('the host reserves the speech zone, his face at its left, dimmed while he is quiet', () => {
  const tree = hosted();
  const zone = byTestId(tree.root, 'speech-zone');
  assert.equal(styleOf(zone).height, SPEECH_ZONE);
  const face = byTestId(zone, 'host-face');
  assert.deepEqual(
    {
      position: styleOf(face).position,
      left: styleOf(face).left,
      top: styleOf(face).top,
      width: styleOf(face).width,
      height: styleOf(face).height,
      opacity: styleOf(face).opacity,
    },
    {
      position: 'absolute',
      left: 0,
      top: 20,
      width: 36,
      height: 36,
      opacity: 0.5,
    },
  );
  assert.equal(HOST_FACE, 36);
  // The turn line stands beside the face, where his bubble's tail would be.
  const line = byTestId(zone, 'turn-line');
  assert.equal(styleOf(line).marginLeft, 47);
  assert.equal(HOST_FACE + HOST_GAP + BUBBLE_TAIL, 47);
  assert.deepEqual(texts(line), ['HOTSEAT · TURN 1']);
});

test('while he speaks, his bubble sits beside his face, in place of the turn line', () => {
  const tree = hosted({
    speechBubble: React.createElement('Text', null, 'Oho! The plot thickens!'),
  });
  const zone = byTestId(tree.root, 'speech-zone');
  const slot = byTestId(zone, 'speech-bubble-slot');
  assert.equal(styleOf(slot).position, 'absolute');
  assert.equal(styleOf(slot).left, HOST_FACE + HOST_GAP);
  assert.equal(styleOf(slot).left, 40);
  assert.equal(styleOf(slot).top, 0);
  assert.equal(styleOf(slot).bottom, 0);
  assert.equal(styleOf(slot).right, 0);
  assert.equal(styleOf(slot).justifyContent, 'center');
  assert.equal(styleOf(byTestId(zone, 'host-face')).opacity, 1);
  assert.equal(drawn(zone, 'turn-line').length, 0);
});

test('the face and the bubble stay put when the board turns; only the badges swap', () => {
  for (const flipped of [false, true]) {
    const tree = hosted({
      side: flipped ? 'b' : 'w',
      flipped,
      speechBubble: React.createElement('Text', null, 'Timber!'),
    });
    const header = byTestId(tree.root, 'matchup-header');
    const [, zone] = header.children as Instance[];
    assert.equal(zone.props.testID, 'speech-zone', `flipped ${flipped}`);
    assert.equal(drawn(zone, 'host-face').length, 1);
    assert.equal(drawn(zone, 'speech-bubble-slot').length, 1);
    assert.deepEqual(
      badges(tree.root),
      flipped ? ['PLAYER 1', 'PLAYER 2'] : ['PLAYER 2', 'PLAYER 1'],
    );
  }
});

test('a game against the bot has no host face', () => {
  const tree = mount({
    game: newGame('random', 'game-bot-host'),
    side: 'w',
    host: true,
  });
  assert.equal(drawn(tree.root, 'host-face').length, 0);
  assert.equal(styleOf(byTestId(tree.root, 'speech-zone')).height, SPEECH_ZONE);
});

test('renders center children between the badges, anchored at the top', () => {
  const tree = mount({
    game: newGame('aggressive', 'game-children'),
    side: 'w',
    children: React.createElement('Text', null, 'White to play · you'),
  });

  const center = byTestId(tree.root, 'matchup-center');
  assert.deepEqual(texts(center), ['White to play · you']);
  assert.notEqual(styleOf(center).justifyContent, 'center');
});
