// The game screen's committed HUD contract, before its view is extracted.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act } from 'react-test-renderer';
import { GameScreen, type GameScreenProps } from '../src/GameScreen';
import { Matchup, type MatchupProps } from '../src/Matchup';
import { SpeechBubble, HOST_BUBBLE_ROWS } from '../src/SpeechBubble';
import type { SpokenLine } from '../src/sound';
import { BOT_STEP_MS } from '../src/screen';
import { newGame } from '../../src/core/game';
import { botReply } from '../../src/core/bot';
import {
  fakeTimers,
  fixedOptions,
  mount,
  reporter,
  send,
  silentSounds,
  type Instance,
} from './support';

fakeTimers();

const mounted = (props: Partial<GameScreenProps> = {}) => {
  const reports = reporter();
  const tree = mount(
    <GameScreen
      options={fixedOptions()}
      initialHost="off"
      {...props}
      onState={reports.onState}
    />,
  );
  return { tree, root: tree.root, state: reports.state };
};

const hud = (root: Instance) => root.findByType(Matchup).props as MatchupProps;

const element = (node: React.ReactNode) => {
  assert.ok(React.isValidElement<Record<string, unknown>>(node));
  return node;
};

const content = (props: MatchupProps) => {
  assert.ok(Array.isArray(props.children));
  assert.equal(props.children.length, 2);
  return props.children.map(element);
};

const spokenText = (said: SpokenLine[]) => {
  const line = said.at(-1);
  assert.ok(line && 'text' in line);
  return line.text;
};

test('the gameplay HUD keeps the header, status and panel in order with shared current state', () => {
  const app = mounted();
  assert.equal(app.root.findAllByType(Matchup).length, 0);
  send('enter');
  const shown = hud(app.root);
  assert.equal(shown.side, 'w');
  assert.equal(shown.flipped, false);
  assert.equal(shown.thinking, false);
  assert.equal(shown.speechBubble, undefined);
  assert.equal(shown.hostBubble, undefined);
  assert.equal(shown.host, undefined);
  assert.deepEqual(element(shown.header).props, {
    line: 'FRIEND GAME · TURN 1',
  });
  const [status, panel] = content(shown);
  assert.equal((status.type as { name: string }).name, 'Status');
  assert.equal((panel.type as { name: string }).name, 'Panel');
  assert.equal(status.props.game, shown.game);
  assert.equal(status.props.view, panel.props.view);
  assert.equal(status.props.lastDice, null);
  assert.deepEqual(panel.props.overlay, { kind: 'none' });
  assert.equal(panel.props.auto, false);
  assert.equal(panel.props.selected, null);
  assert.equal(panel.props.pressed, false);
  assert.equal((panel.props.context as { game: unknown }).game, shown.game);
});

test('a selection updates the same HUD contract and Back restores the unselected panel', () => {
  const app = mounted();
  send('enter', 'enter');
  const rolled = hud(app.root);
  assert.equal(rolled.game.phase, 'move');
  send('enter');
  const selected = hud(app.root);
  assert.equal(selected.game, rolled.game, 'picking up does not commit a game');
  const [status, panel] = content(selected);
  assert.equal(panel.props.selected, 'g1');
  assert.equal(status.props.view, panel.props.view);
  send('back');
  assert.equal(content(hud(app.root))[1].props.selected, null);
  assert.equal(hud(app.root).game, rolled.game);
});

test('a menu hides Matchup and resuming restores its current game and header', () => {
  const app = mounted();
  send('enter', 'enter');
  const before = hud(app.root);
  send('menu');
  assert.equal(app.root.findAllByType(Matchup).length, 0);
  send('back');
  const after = hud(app.root);
  assert.equal(after.game, before.game);
  assert.deepEqual(element(after.header).props, element(before.header).props);
  assert.equal(content(after)[1].props.selected, null);
});

test('the HUD follows the turned hotseat board when Black takes the next turn', () => {
  const app = mounted({ initialTurnBoard: true });
  send('enter', 'enter', 'enter', 'enter', 'enter', 'enter');
  assert.match(app.state(), /phase handoff/);
  send('enter');
  const shown = hud(app.root);
  assert.equal(shown.side, 'b');
  assert.equal(shown.flipped, true);
  assert.deepEqual(element(shown.header).props, {
    line: 'FRIEND GAME · TURN 2',
  });
});

test('a bot line reaches the ordinary bubble and clears without adding a host bubble', () => {
  const said: SpokenLine[] = [];
  const app = mounted({
    initial: newGame('random', 'bot-view'),
    sounds: { ...silentSounds(), say: (line) => said.push(line) },
  });
  send('enter');
  const shown = hud(app.root);
  const bubble = element(shown.speechBubble);
  assert.equal(bubble.type, SpeechBubble);
  assert.deepEqual(bubble.props, { text: spokenText(said) });
  assert.ok(said.length > 0);
  assert.equal(shown.hostBubble, undefined);
  assert.equal(shown.host, undefined);
  assert.deepEqual(element(shown.header).props, { line: 'TURN 1' });
  act(() => mock.timers.tick(100_000));
  assert.equal(hud(app.root).speechBubble, undefined);
});

test('the chosen host supplies a separate fixed-height bubble and portrait identity', () => {
  const said: SpokenLine[] = [];
  const app = mounted({
    initialHost: 'rolly',
    sounds: { ...silentSounds(), say: (line) => said.push(line) },
  });
  send('enter');
  const shown = hud(app.root);
  assert.ok(said.length > 0);
  const bubble = element(shown.hostBubble);
  assert.equal(bubble.type, SpeechBubble);
  assert.deepEqual(bubble.props, {
    text: spokenText(said),
    rows: HOST_BUBBLE_ROWS,
  });
  assert.equal(shown.host, 'rolly');
  assert.equal(shown.speechBubble, undefined);
  act(() => mock.timers.tick(100_000));
  assert.equal(hud(app.root).hostBubble, undefined);
  assert.equal(hud(app.root).host, undefined);
});

test('a reply provider shows thinking only after its wait and clears it when search resolves', async () => {
  const waiting: (() => void)[] = [];
  let time = 0;
  let resolve!: () => void;
  const app = mounted({
    initial: newGame('random', 'search-view', undefined, 'b'),
    options: fixedOptions({
      roll: () => [1, 1, 1],
      now: () => time,
      schedule: (step) => {
        waiting.push(step);
      },
      reply: (game) =>
        new Promise((done) => {
          resolve = () => done(botReply(game));
        }),
    }),
  });
  send('enter');
  assert.equal(hud(app.root).flipped, true);
  assert.equal(hud(app.root).thinking, false);
  act(() => waiting.shift()!());
  assert.equal(hud(app.root).thinking, false);
  time += BOT_STEP_MS;
  act(() => waiting.shift()!());
  assert.equal(hud(app.root).thinking, true);
  await act(async () => resolve());
  assert.equal(hud(app.root).thinking, false);
});

test('without a reply provider the HUD identifies an owed bot turn directly', () => {
  const waiting: (() => void)[] = [];
  const app = mounted({
    initial: newGame('random', 'sync-bot-view', undefined, 'b'),
    options: fixedOptions({
      schedule: (step) => {
        waiting.push(step);
      },
    }),
  });
  send('enter');
  const shown = hud(app.root);
  assert.equal(shown.thinking, true);
  assert.equal(shown.side, 'w');
  assert.equal(shown.flipped, true);
  assert.equal(waiting.length, 1);
});

test('the result keeps the HUD, its result panel and the lasting bot bubble', () => {
  const said: SpokenLine[] = [];
  const app = mounted({
    initial: newGame('random', 'result-view'),
    sounds: { ...silentSounds(), say: (line) => said.push(line) },
  });
  send('enter', 'back', 'down', 'select', 'down', 'select');
  const shown = hud(app.root);
  assert.equal(shown.game.phase, 'ended');
  assert.ok(shown.game.result);
  assert.equal(shown.thinking, false);
  const [status, panel] = content(shown);
  assert.equal(status.props.game, shown.game);
  assert.equal((panel.props.overlay as { kind: string }).kind, 'result');
  assert.equal((panel.props.context as { game: unknown }).game, shown.game);
  assert.deepEqual(element(shown.header).props, { line: 'TURN 1' });
  const bubble = element(shown.speechBubble);
  assert.equal(bubble.type, SpeechBubble);
  assert.equal(bubble.props.text, spokenText(said));
  act(() => mock.timers.tick(100_000));
  assert.deepEqual(element(hud(app.root).speechBubble).props, bubble.props);
});
