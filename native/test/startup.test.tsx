// Exercise the startup boundary with storage and lifecycle services independent
// of the Vega stubs. The rendered screens still use the native remote stub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act } from 'react-test-renderer';
import { GameApp } from '../src/GameApp';
import type { AppEnvironment } from '../src/appEnvironment';
import { GameScreen } from '../src/GameScreen';
import { decodeGame, moveGame, newGame, rollGame } from '../../src/core/game';
import { MMKV } from './stubs/react-native-mmkv.mjs';
import {
  fixedOptions,
  memoryStore,
  mount,
  reporter,
  send,
  silentMusic,
  silentSounds,
  unmount,
} from './support';

const KEY = 'dicechess-tv.game.v2';
const environment = (initial: Record<string, string> = {}) => {
  const storage = memoryStore(initial);
  const listeners = new Map<string, (state: unknown) => void>();
  let current = 'unknown';
  let draws = 0;
  const services: AppEnvironment = {
    audio: {
      createSounds: silentSounds,
      createMusic: () => silentMusic(),
      loadCatalogue: () => Promise.resolve(null),
    },
    openStorage: () => storage,
    reportFullyDrawn: () => {
      draws++;
    },
    appState: {
      getCurrentState: () => current,
      addEventListener(event, listener) {
        listeners.set(event, listener);
        return {
          remove: () => {
            listeners.delete(event);
          },
        };
      },
    },
  };
  return {
    services,
    storage,
    listeners,
    draws: () => draws,
    event: (event: 'change' | 'blur' | 'focus', state?: string) =>
      act(() => {
        if (event === 'change') current = state!;
        listeners.get(event)?.(state);
      }),
  };
};

const open = (services: AppEnvironment) => {
  const reports = reporter();
  const tree = mount(
    <GameApp
      environment={services}
      options={fixedOptions()}
      sounds={silentSounds()}
      music={silentMusic()}
      onState={reports.onState}
    />,
  );
  return { tree, ...reports };
};

test('injected storage restores a partial turn and settings on the first screen', () => {
  const game = moveGame(
    rollGame(newGame('hotseat', 'saved'), [5, 4, 2]),
    'b1c3',
  );
  const rig = environment({
    [KEY]: JSON.stringify(game),
    'dicechess-tv.turnBoard.v1': 'on',
    'dicechess-tv.tutorialOffer.v1': 'answered',
  });
  const first = open(rig.services);
  const screen = first.tree.root.findByType(GameScreen);
  assert.deepEqual(screen.props.initial, game);
  assert.equal(screen.props.initialTurnBoard, true);
  assert.equal(screen.props.offerTutorial, false);
  send('enter');
  assert.match(first.state(), /phase move/);
  assert.match(first.state(), /dice "QR"/);
  // Change a setting through the screen's real callback, then relaunch.
  act(() => screen.props.onTurnBoard(false));
  const second = open(rig.services);
  assert.equal(
    second.tree.root.findByType(GameScreen).props.initialTurnBoard,
    false,
  );
  assert.deepEqual(decodeGame(rig.storage.getString(KEY)!), game);
  assert.equal(new MMKV().getString(KEY), undefined);
  assert.equal(new MMKV().getString('dicechess-tv.turnBoard.v1'), undefined);
});

test('new games write to the injected namespace and survive a fresh mount', () => {
  const rig = environment({ 'dicechess-tv.tutorialOffer.v1': 'answered' });
  open(rig.services);
  assert.equal(rig.storage.getString(KEY), undefined);
  send('enter', 'enter');
  const saved = rig.storage.getString(KEY)!;
  assert.deepEqual(decodeGame(saved).roll, [5, 4, 2]);
  const relaunched = open(rig.services);
  send('enter');
  assert.match(relaunched.state(), /phase move/);
  assert.equal(rig.storage.getString(KEY), saved);
  assert.equal(new MMKV().getString(KEY), undefined);
});

test('injected lifecycle pauses input, resumes on focus and removes every subscription', () => {
  const rig = environment({ 'dicechess-tv.tutorialOffer.v1': 'answered' });
  const app = open(rig.services);
  assert.equal(rig.draws(), 1);
  send('enter');
  rig.event('blur');
  const before = rig.storage.getString(KEY);
  rig.event('change', 'active');
  send('enter');
  assert.equal(rig.storage.getString(KEY), before);
  rig.event('change', 'background');
  rig.event('focus');
  assert.equal(rig.draws(), 2);
  send('enter');
  assert.match(app.state(), /phase move/);
  rig.event('change', 'active');
  assert.equal(rig.draws(), 2);
  unmount();
  assert.equal(rig.listeners.size, 0);
  rig.event('focus');
  assert.equal(rig.draws(), 2);
});
