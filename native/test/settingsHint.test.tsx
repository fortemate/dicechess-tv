// The actual Settings panel, with and without the optional Music row: a move
// of focus changes the controls, not just the selected frame (#422).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act } from 'react-test-renderer';
import { hold, release } from './stubs/react-native-kepler.mjs';
import { MMKV, setStored } from './stubs/react-native-mmkv.mjs';
import { GameScreen } from '../src/GameScreen';
import { focusedLabel } from './options';
import { fakeTimers, fixedOptions, launch, mount, send, text } from './support';

fakeTimers();

const AUDIO = 'Left/Right: volume · OK: mute/unmute';
const SWITCH = 'Left: off · Right: on · OK: toggle';
const CHOICE = 'Left/Right or OK: change';
const AUTO = 'Plays the only legal move for you.';
const PLAY_AS = 'Your colour in new computer games.';

for (const musicAvailable of [true, false]) {
  for (const fromGame of [false, true]) {
    test(`Settings shows focused controls and scope ${musicAvailable ? 'with' : 'without'} music, from ${fromGame ? 'a game' : 'home'}`, () => {
      const root = mount(
        React.createElement(GameScreen, {
          options: fixedOptions(),
          musicAvailable,
        }),
      ).root;
      if (fromGame) {
        send('enter', 'back');
        // Settings is the last option in the game menu.
        send('up', 'enter');
      } else send('up', 'up', 'enter');
      const rows = [
        ...(musicAvailable ? [['Music: 7', AUDIO]] : []),
        ['Sounds: 10', AUDIO],
        ['Voices: 10', AUDIO],
        ['Highlights: Standard', CHOICE],
        ['Auto-play only move: off', SWITCH, AUTO],
        ['Play as: Random', CHOICE, PLAY_AS],
        ['Turn board for friends: off', SWITCH],
        ['Host for friends: Prowla', CHOICE],
      ];
      for (const [label, hint, description] of rows) {
        assert.equal(focusedLabel(root), label);
        assert.ok(text(root).split('\n').includes(hint), `${label}: ${hint}`);
        for (const scope of [AUTO, PLAY_AS])
          assert.equal(
            text(root).includes(scope),
            description === scope,
            label,
          );
        if (label.startsWith('Host for friends:')) {
          // Off is an option of the host chooser, rather than a boolean switch.
          send('left');
          assert.equal(focusedLabel(root), 'Host for friends: off');
          assert.ok(text(root).split('\n').includes(CHOICE));
          send('right');
        }
        send('down');
      }
      assert.equal(focusedLabel(root), rows[0][0]);
      assert.ok(text(root).split('\n').includes(AUDIO));
      send('back');
      assert.equal(focusedLabel(root), 'Settings');
    });
  }
}

for (const initial of ['on', 'off']) {
  test(`both switches keep stable directions and toggle once on OK release, initially ${initial}`, () => {
    const autoKey = 'dicechess-tv.autoSelect.v1';
    const turnKey = 'dicechess-tv.turnBoard.v1';
    setStored({ [autoKey]: initial, [turnKey]: initial });
    let root = launch().root;
    send('up', 'up', 'enter', 'down', 'down', 'down');
    const store = new MMKV();
    for (const [label, key] of [
      ['Auto-play only move', autoKey],
      ['Turn board for friends', turnKey],
    ]) {
      const value = (expected: string) => {
        assert.equal(focusedLabel(root), `${label}: ${expected}`);
        assert.equal(store.getString(key), expected);
      };
      value(initial);
      for (const direction of ['right', 'left']) {
        const expected = direction === 'right' ? 'on' : 'off';
        send(direction, direction);
        value(expected);
        // Separate events/renders, just like a held direction on the remote.
        for (let i = 0; i < 7; i++) {
          act(() => hold(direction, 1));
          value(expected);
        }
        act(() => release(direction));
        value(expected);
      }
      for (let i = 0; i < 7; i++) {
        act(() => hold('select', 1));
        value('off');
      }
      act(() => release('select'));
      value('on');
      send('enter');
      value('off');
      send('right');
      value('on');
      if (key === autoKey) send('down', 'down');
    }
    send('back');
    assert.equal(focusedLabel(root), 'Settings');
    root = launch().root;
    send('up', 'up', 'enter', 'down', 'down', 'down');
    assert.equal(focusedLabel(root), 'Auto-play only move: on');
    send('left', 'down', 'down');
    assert.equal(focusedLabel(root), 'Turn board for friends: on');
    send('left');
    assert.equal(store.getString(autoKey), 'off');
    assert.equal(store.getString(turnKey), 'off');
  });
}
