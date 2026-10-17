// Board highlights setting (#404): Standard (default), Enhanced, Colour-blind
// and High contrast, cycled in Settings and remembered across launches.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { MMKV, reset } from './stubs/react-native-mmkv.mjs';
import {
  DEFAULT_HIGHLIGHTS,
  HIGHLIGHT_CHOICES,
  cycleHighlights,
  highlightsName,
  readHighlights,
  saveHighlights,
  type HighlightStyle,
} from '../src/highlightsSetting';
import {
  initialState,
  screenReducer,
  settingsOptions,
  type ScreenOptions,
  type ScreenState,
} from '../src/screen';
import { Board } from '../src/Board';
import { PIECES } from '../src/pieces';
import { THEME } from '../src/theme';
import type { KeyValueStore } from '../src/mmkvStore';
import type { BoardKey } from '../../src/core/boardInput';
import {
  fixedOptions,
  isHost,
  launch,
  send,
  styleOf,
  text,
  type Instance,
  type Style,
} from './support';

const options: ScreenOptions = fixedOptions({ newId: () => 'highlights' });

const drive = (state: ScreenState, ...keys: BoardKey[]): ScreenState =>
  keys.reduce(
    (current, key) => screenReducer(current, { kind: 'key', key }, options),
    state,
  );

const memoryStore = (initial?: Record<string, string>): KeyValueStore => {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getString: (key: string) => map.get(key),
    set: (key: string, value: string) => {
      map.set(key, value);
    },
    delete: (key: string) => {
      map.delete(key);
    },
  };
};

test('the setting defaults to standard, cycles in both directions and ignores unknown values', () => {
  assert.equal(DEFAULT_HIGHLIGHTS, 'standard');
  assert.deepEqual(HIGHLIGHT_CHOICES, [
    'standard',
    'enhanced',
    'colour-blind',
    'high-contrast',
  ]);
  assert.deepEqual(HIGHLIGHT_CHOICES.map(highlightsName), [
    'Standard',
    'Enhanced',
    'Colour-blind',
    'High contrast',
  ]);
  assert.equal(cycleHighlights('standard', 1), 'enhanced');
  assert.equal(cycleHighlights('enhanced', 1), 'colour-blind');
  assert.equal(cycleHighlights('colour-blind', 1), 'high-contrast');
  assert.equal(cycleHighlights('high-contrast', 1), 'standard');
  assert.equal(cycleHighlights('standard', -1), 'high-contrast');
  assert.equal(cycleHighlights('high-contrast', -1), 'colour-blind');

  assert.equal(readHighlights(memoryStore()), 'standard');
  assert.equal(
    readHighlights(memoryStore({ 'dicechess-tv.highlights.v1': 'neon' })),
    'standard',
  );
  const store = memoryStore();
  for (const choice of HIGHLIGHT_CHOICES) {
    saveHighlights(store, choice);
    assert.equal(readHighlights(store), choice);
  }
});

test('OK or the sideways arrows cycle the Highlights row in Settings', () => {
  const home = initialState(options);
  assert.equal(home.highlights, 'standard');
  const settings = drive(home, 'down', 'down', 'down', 'down', 'select');
  assert.equal(settings.overlay.kind, 'settings');
  assert.ok(
    settingsOptions({ ...settings, musicAvailable: false }).includes(
      'Highlights: Standard',
    ),
  );
  // Up wraps to Auto-select only choice; one more Up reaches Highlights.
  const row = drive(settings, 'up', 'up');
  const enhanced = drive(row, 'select');
  assert.equal(enhanced.highlights, 'enhanced');
  const colourBlind = drive(enhanced, 'right');
  assert.equal(colourBlind.highlights, 'colour-blind');
  const highContrast = drive(colourBlind, 'right');
  assert.equal(highContrast.highlights, 'high-contrast');
  const wrapped = drive(highContrast, 'right');
  assert.equal(wrapped.highlights, 'standard');
  assert.equal(drive(wrapped, 'left').highlights, 'high-contrast');
});

test('in the app the setting is saved when changed and read on the next launch', () => {
  reset();
  let root = launch().root;
  send('down', 'down', 'down', 'down', 'enter');
  assert.match(text(root), /Highlights: Standard/);
  send('up', 'up', 'enter');
  assert.match(text(root), /Highlights: Enhanced/);
  assert.equal(new MMKV().getString('dicechess-tv.highlights.v1'), 'enhanced');
  send('right');
  assert.match(text(root), /Highlights: Colour-blind/);
  assert.equal(
    new MMKV().getString('dicechess-tv.highlights.v1'),
    'colour-blind',
  );
  root = launch().root;
  send('down', 'down', 'down', 'down', 'enter');
  assert.match(text(root), /Highlights: Colour-blind/);
});

// ── Board rendering across all four styles ───────────────────────────────────

const SIZE = 800;
const EDGE = Math.floor(SIZE / 8);

const mountBoard = (highlights: HighlightStyle): Instance => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      React.createElement(Board, {
        size: SIZE,
        board: '4k3/8/8/3p4/8/8/8/3RK3',
        legal: ['d1d2', 'd1d3', 'd1d4', 'd1d5', 'd1c1'],
        selected: 'd1',
        cursor: 'd2',
        lastMove: 'e2e1',
        highlights,
      }),
    );
  });
  return tree.root;
};

const overlays = (
  root: Instance,
  match: (style: Style) => boolean,
): Instance[] =>
  root.findAll(
    (node) =>
      isHost(node, 'View') &&
      styleOf(node).position === 'absolute' &&
      match(styleOf(node)),
    { deep: true },
  );

test('each highlight style draws its distinct selected, destination, target and cursor marks', () => {
  const standard = mountBoard('standard');
  assert.equal(
    overlays(standard, (s) => s.backgroundColor === THEME.selected).length,
    1,
  );
  assert.equal(
    overlays(standard, (s) => s.borderColor === THEME.cursor).length,
    2,
  );

  // Enhanced lifts the piece in hand and gives the cursor a bold two-tone frame.
  const enhanced = mountBoard('enhanced');
  assert.equal(
    overlays(
      enhanced,
      (s) => s.borderColor === THEME.cursor && s.borderWidth === 6,
    ).length,
    1,
    'outer cyan frame of two-tone-bold cursor',
  );
  assert.equal(
    overlays(
      enhanced,
      (s) => s.borderColor === '#0b1a24' && s.left === 6 && s.top === 6,
    ).length,
    1,
    'inner dark frame of two-tone-bold cursor',
  );
  // Enhanced lifts the selected rook on d1 above its shadow.
  const liftedRooks = enhanced.findAll(
    (node) =>
      isHost(node, 'View') &&
      Array.isArray(styleOf(node).transform) &&
      node.findAllByType(PIECES.R as never).length > 0,
    { deep: true },
  );
  assert.equal(liftedRooks.length, 1, 'lifted piece');

  // Colour-blind uses Okabe-Ito sky-blue (#56b4e9), vermilion (#d55e00),
  // reddish-purple (#cc79a7) and a ghost of the carried rook on the destination
  // under the cursor (d2).
  const colourBlind = mountBoard('colour-blind');
  assert.equal(
    overlays(colourBlind, (s) => s.borderColor === '#56b4e9').length,
    2,
    'last-move outlines on both ends',
  );
  assert.equal(
    overlays(colourBlind, (s) => s.backgroundColor === '#cc79a7').length,
    1,
    'warm pedestal on the selected square',
  );
  assert.equal(
    overlays(colourBlind, (s) => s.backgroundColor === '#d55e00').length,
    3,
    'vermilion ringed dots on the three empty destinations not under the ghost',
  );
  // Ghost rook on d2 + real rook on d1 = 2 rook SVG instances.
  assert.equal(
    colourBlind.findAllByType(PIECES.R as never, { deep: true }).length,
    2,
    'real rook on d1 and ghost rook on destination d2 under cursor',
  );

  // High contrast uses pure black/white and draws the ghost rook on d2 too.
  const highContrast = mountBoard('high-contrast');
  assert.equal(
    overlays(
      highContrast,
      (s) => s.backgroundColor === 'rgba(255, 255, 255, 0.48)',
    ).length,
    1,
    'fill-two-tone cursor white wash',
  );
  assert.equal(
    overlays(
      highContrast,
      (s) => s.backgroundColor === '#000000' && s.borderColor === '#ffffff',
    ).length,
    3,
    'three ringed dots on empty destinations not under the ghost',
  );
  assert.equal(
    highContrast.findAll(
      (node) =>
        isHost(node, 'View') &&
        styleOf(node).width === EDGE &&
        styleOf(node).position !== 'absolute',
      { deep: true },
    ).length,
    64,
  );
});
