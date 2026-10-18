// The actual Settings panel, with and without the optional Music row: a move
// of focus changes the controls, not just the selected frame (#422).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { GameScreen } from '../src/GameScreen';
import { focusedLabel } from './options';
import { fixedOptions, mount, send, text } from './support';

const AUDIO = 'Left/Right: volume · OK: mute/unmute';
const SWITCH = 'Left/Right or OK: on/off';
const CHOICE = 'Left/Right or OK: change';

for (const musicAvailable of [true, false]) {
  test(`the focused Settings row shows its controls ${musicAvailable ? 'with' : 'without'} music`, () => {
    const root = mount(
      React.createElement(GameScreen, {
        options: fixedOptions(),
        musicAvailable,
      }),
    ).root;
    send('up', 'up', 'enter');
    const rows = [
      ...(musicAvailable ? [['Music: 7', AUDIO]] : []),
      ['Sounds: 10', AUDIO],
      ['Voices: 10', AUDIO],
      ['Highlights: Standard', CHOICE],
      ['Auto-select only choice: off', SWITCH],
      ['Play as: Random', CHOICE],
      ['Turn board for friends: off', SWITCH],
      ['Host for friends: Prowla', CHOICE],
    ];
    for (const [label, hint] of rows) {
      assert.equal(focusedLabel(root), label);
      assert.ok(text(root).split('\n').includes(hint), `${label}: ${hint}`);
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
