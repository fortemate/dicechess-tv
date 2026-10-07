import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import config, { SWAPPED } from '../vite.config.ts';

// The bench's tests run in Node, which has a `global` of its own, so the crash
// this guards against only showed in a browser: react-native-web's Animated
// calls global.cancelAnimationFrame when a slide is stopped before it ends.
test('the bench gives react-native-web the global that React Native has', () => {
  assert.equal(config.define?.global, 'globalThis');
});

// A swapped module that lacks a name the board imports leaves the board
// undefined in the browser, and the bench goes black; tsc does not see it,
// since it checks the board against the television's module.
test("the bench's stand-ins export every name the board takes from them", () => {
  const read = (path: string) =>
    readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
  const board = read('../../native/src/Board.tsx');
  for (const [source, file] of Object.entries(SWAPPED)) {
    const from = new RegExp(`import \\{([^}]*)\\} from '${source}';`);
    const names = board
      .match(from)?.[1]
      .split(',')
      .map((name) => name.trim());
    assert.ok(names?.length, `the board imports from ${source}`);
    const stand = read(`../${file}`);
    for (const name of names.filter(Boolean))
      assert.match(
        stand,
        new RegExp(`export (const|function) ${name}\\b`),
        `${file} exports ${name}`,
      );
  }
});
