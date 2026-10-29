import React from 'react';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SettingsPanel } from '../src/SettingsPanel';
import { Option } from '../src/Option';
import { mount } from './support';

test('shared Settings retains all Vega rows and limits Android to working audio', () => {
  const vega = mount(<SettingsPanel settings={{}} index={0} />);
  assert.equal(vega.root.findAllByType(Option).length, 8);
  const android = mount(
    <SettingsPanel
      settings={{ sound: { on: false, volume: 7 } }}
      only={['sounds']}
      index={0}
    />,
  );
  const rows = android.root.findAllByType(Option);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].props.label, 'Sounds: off');
  assert.equal(rows[0].props.focused, true);
  assert.equal(
    android.root.findAllByProps({ testID: 'ring-filled' }).length,
    0,
  );
});
